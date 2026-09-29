// Included inside H620 after campaign declarations; no broker order bypass.
bool h620FuturePaused=false,h620Quarantine=false;
double wcoEvaluation=0;
string WcoEA(){return WcoPrefix(Symbol(),MagicNumber);}
void WcoRestoreGoal()
{
   string p=WcoEA();h620FutureGoal=(int)WcoRead(p,"goal");
   h620FutureUntil=(datetime)WcoRead(p,"until");h620FuturePaused=(WcoRead(p,"paused")==1);
}
void WcoSaveGoal()
{
   string p=WcoEA();WcoWrite(p,"goal",h620FutureGoal);WcoWrite(p,"until",h620FutureUntil);
   WcoWrite(p,"paused",h620FuturePaused?1:0);GlobalVariablesFlush();
}
void WcoAck(double id,int status)
{
   string p=WcoEA();int index=-1;
   for(int i=0;i<12;i++)if(WcoRead(p,"ai"+IntegerToString(i))==id)index=i;
   if(index<0){index=(int)WcoRead(p,"ackCursor");WcoWrite(p,"ackCursor",(index+1)%12);}
   string n=IntegerToString(index);WcoWrite(p,"ai"+n,id);WcoWrite(p,"as"+n,status);
   WcoWrite(p,"ac"+n,WcoRead(p,"changed"));WcoWrite(p,"ar"+n,WcoRead(p,"requested"));
   WcoWrite(p,"ackStatus",status);WcoWrite(p,"ack",id);WcoWrite(p,"slot",0);GlobalVariablesFlush();
}
double WcoLatestWin()
{
   datetime latest=0;int ticket=0;
   for(int i=OrdersHistoryTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_HISTORY) || !OurOrder() || !H620CampaignTicketSelected())continue;
      if(OrderProfit()+OrderSwap()+OrderCommission()<=0)continue;
      if(OrderCloseTime()>latest || (OrderCloseTime()==latest && OrderTicket()>ticket)) {latest=OrderCloseTime();ticket=OrderTicket();}
   }
   return ticket;
}
void WcoPublish()
{
   string p=WcoEA();double revision=WcoRead(p,"revision");if((int)revision%2!=0)revision++;WcoWrite(p,"revision",revision+1);WcoWrite(p,"version",1);WcoWrite(p,"enabled",H620Enabled() && H620EnableFutureGoals && !h620Quarantine?1:0);
   WcoWrite(p,"campaign",h620Id);WcoWrite(p,"phase",h620Phase);WcoWrite(p,"direction",h620Dir);
   WcoWrite(p,"rail",h620Rail);WcoWrite(p,"banked",h620BankedLevel);
   double campaignTargetEquity=(h620Base>0?h620Base*MathPow(1.0+H620GrowthMilestonePercent/100.0,h620BankedLevel+1):0);
   WcoWrite(p,"campaignBase",h620Base);WcoWrite(p,"campaignRealized",h620Realized);WcoWrite(p,"campaignFloating",h620Floating);
   WcoWrite(p,"milestonePercent",H620GrowthMilestonePercent);WcoWrite(p,"targetEquity",campaignTargetEquity);
   // CHRONOS truth: broker-clock session + the actual hard new-entry window.
   datetime chronosNow=TimeCurrent();
   bool chronosWindowAllowed=HT6DirectTradingWindowAllows(chronosNow);
   bool chronosEntryAllowed=(DirectAllowNewEntries && chronosWindowAllowed && !h620FuturePaused && !h620Quarantine);
   WcoWrite(p,"session",gHT5Session);WcoWrite(p,"sessionQuality",gHT5SessionQuality);
   WcoWrite(p,"brokerHour",TimeHour(chronosNow));WcoWrite(p,"brokerMinute",TimeMinute(chronosNow));
   WcoWrite(p,"windowMode",HT6ActiveWindowMode());
   WcoWrite(p,"window1Start",HT6NormalizeHour(HT6ActiveWindow1Start()));WcoWrite(p,"window1End",HT6NormalizeHour(HT6ActiveWindow1End()));
   WcoWrite(p,"window2Start",HT6NormalizeHour(HT6ActiveWindow2Start()));WcoWrite(p,"window2End",HT6NormalizeHour(HT6ActiveWindow2End()));
   WcoWrite(p,"scheduleEnforced",HT6ActiveWindowMode()==TIME_WINDOW_ALL_HOURS?0:1);
   WcoWrite(p,"windowAllowed",chronosWindowAllowed?1:0);WcoWrite(p,"entryAllowed",chronosEntryAllowed?1:0);
   int count=0;RefreshRates();
   for(int dir=-1;dir<=1;dir+=2)
   {
      double price=dir==1?Ask:Bid;
      for(int i=0;i<8;i++)
      {
         double level=H620Obstacle(dir,price);if(level<=0)break;
         string n=IntegerToString(count++);WcoWrite(p,"lp"+n,level);WcoWrite(p,"li"+n,MathRound(level/Point));price=level;
      }
   }
   WcoWrite(p,"levelCount",count);count=0;
   for(int k=OrdersTotal()-1;k>=0 && count<100;k--)
   {
      if(!OrderSelect(k,SELECT_BY_POS,MODE_TRADES) || !H620OwnedSelected() || !H620CampaignTicketSelected())continue;
      string n=IntegerToString(count++);WcoWrite(p,"pt"+n,OrderTicket());WcoWrite(p,"pr"+n,H620RoleSelected());
   }
   WcoWrite(p,"positionCount",count);WcoWrite(p,"heartbeat",TimeLocal());WcoWrite(p,"revision",revision+2);
}
bool WcoApplySpatial(int op,string p)
{
   int count=(int)WcoRead(p,"ticketCount");
   double target=WcoRead(p,"levelPrice"),levelId=WcoRead(p,"levelId");
   RefreshRates();
   double gap=MathMax(MarketInfo(Symbol(),MODE_STOPLEVEL),MarketInfo(Symbol(),MODE_FREEZELEVEL))*Point+2*Point;
   if(op==8 || op==9)
   {
      bool found=false;
      for(int i=0;i<(int)WcoRead(p,"levelCount");i++)
         if(WcoRead(p,"li"+IntegerToString(i))==levelId && MathAbs(WcoRead(p,"lp"+IntegerToString(i))-target)<Point/2)found=true;
      if(!found)return false;
   }
   if(op==9)
   {
      double quote=h620Dir==DIR_BUY?Bid:Ask;
      if(h620Rail<=0 || h620Dir*(target-h620Rail)<=Point || h620Dir*(quote-target)<=gap)return false;
      h620Rail=H620RoundStop(h620Dir,target);H620Persist();
      // The normal rail manager applies broker stops; acceptance is not a broker receipt.
      return true;
   }
   if(count<1 || count>12)return false;
   // Validate every selected ticket before mutating any of them.
   for(int j=0;j<count;j++)
   {
      int ticket=(int)WcoRead(p,"t"+IntegerToString(j));
      if(!OrderSelect(ticket,SELECT_BY_TICKET) || !H620OwnedSelected() || !H620CampaignTicketSelected() || H620RoleSelected()==0)return false;
      int dir=OrderType()==OP_BUY?DIR_BUY:DIR_SELL;
      if(dir!=h620Dir || (op==8 && dir*(target-(dir==DIR_BUY?Bid:Ask))<=gap))return false;
   }
   int ok=0;
   for(int j=0;j<count;j++)
   {
      int ticket=(int)WcoRead(p,"t"+IntegerToString(j));
      if(op==8)
      {
         if(OrderSelect(ticket,SELECT_BY_TICKET) && H620Modify(ticket,OrderStopLoss(),H620RoundTarget(h620Dir,target)))ok++;
      }
      else if(op==13 || op==14){GlobalVariableSet(H620TicketKey(ticket,"trailMode"),op==13?1:2);ok++;}
      else {GlobalVariableSet(H620TicketKey(ticket,"role"),op==10?2:1);ok++;}
   }
   WcoWrite(p,"changed",ok);WcoWrite(p,"requested",count);GlobalVariablesFlush();
   return ok==count;
}
void H620FutureTick()
{
   string p=WcoEA();
   if(wcoEvaluation>0) {if(WcoRead(p,"ackStatus")==4)WcoAck(wcoEvaluation,5);wcoEvaluation=0;}
   if(h620Quarantine && TradeCount()==0)h620Quarantine=false;
   WcoPublish();
   if(!H620Enabled() || !H620EnableFutureGoals || h620Quarantine)return;
   // Campaign-scoped standing rules expire when the thesis changes; explicit pauses stay paused.
   if(h620FutureGoal!=0 && h620FutureGoal!=1 && h620FutureGoal!=7 && WcoRead(p,"goalCampaign")!=h620Id)
   {h620FutureGoal=0;h620FuturePaused=false;h620FutureUntil=0;WcoSaveGoal();}
   double slot=WcoRead(p,"slot");
   if(slot>0 && (slot<=WcoRead(p,"ack") || (WcoRead(p,"seq")!=slot && TimeGMT()*1000.0-slot/1000.0>120000)))WcoWrite(p,"slot",0);
   double id=WcoRead(p,"seq");
   if(id>WcoRead(p,"ack") && WcoRead(p,"slot")==id)
   {
      int op=(int)WcoRead(p,"op"),duration=(int)WcoRead(p,"duration");
      bool valid=WcoRead(p,"expires")>=TimeGMT() && WcoRead(p,"expected")==h620Id && IsConnected() && IsExpertEnabled();
      if(op<1 || op>15)valid=false;
      if((op==1 || op==3 || op==6 || op==7 || op==12) && (duration<1 || duration>604800))valid=false;
      if((op==2 || op==3 || (op>=6 && op<=14)) && h620Phase!=1)valid=false;
      if(op==12 && (WcoRead(p,"burst")<1 || WcoRead(p,"burst")>10))valid=false;
      if(!valid){WcoAck(id,-1);return;}
      // A persisted processing marker prevents replay after a terminal crash.
      WcoWrite(p,"ack",id);WcoWrite(p,"ackStatus",-2);GlobalVariablesFlush();
      WcoWrite(p,"changed",0);WcoWrite(p,"requested",0);
      int result=1;
      if(op==4){wcoEvaluation=id;result=4;}
      else if(op==15)
      {
         int mode=(int)WcoRead(p,"windowMode");
         int w1s=(int)WcoRead(p,"window1Start"),w1e=(int)WcoRead(p,"window1End");
         int w2s=(int)WcoRead(p,"window2Start"),w2e=(int)WcoRead(p,"window2End");
         if(mode<0 || mode>2 || w1s<0 || w1s>23 || w1e<0 || w1e>23 || w2s<0 || w2s>23 || w2e<0 || w2e>23) result=-1;
         else
         {
            gHT6RuntimeWindowMode=mode;
            gHT6RuntimeWindow1Start=w1s;gHT6RuntimeWindow1End=w1e;
            gHT6RuntimeWindow2Start=w2s;gHT6RuntimeWindow2End=w2e;
            H620Set("windowOverride",1);H620Set("windowMode",mode);
            H620Set("window1Start",w1s);H620Set("window1End",w1e);
            H620Set("window2Start",w2s);H620Set("window2End",w2e);
            WcoWrite(p,"changed",1);WcoWrite(p,"requested",1);GlobalVariablesFlush();result=1;
         }
      }
      else if((op>=8 && op<=11) || op==13 || op==14)
      {
         WcoWrite(p,"changed",0);WcoWrite(p,"requested",0);
         bool ok=WcoApplySpatial(op,p);result=ok?(op==8?2:1):(WcoRead(p,"changed")>0?3:-1);
      }
      else
      {
         h620FutureGoal=(op==7?9:op);h620FutureUntil=0;h620FuturePaused=false;
         WcoWrite(p,"goalCampaign",h620Id);WcoWrite(p,"durationSaved",duration);
         WcoWrite(p,"baseline",op==2?h620BankedLevel:WcoLatestWin());
         if(op==1 || op==6 || op==12)h620FutureUntil=TimeGMT()+duration;
         if(op==1)h620FuturePaused=true;
         if(op==12)WcoWrite(p,"burstRemaining",WcoRead(p,"burst"));
         else WcoWrite(p,"burstRemaining",0);
         if(op==5)h620FutureGoal=0;
         WcoSaveGoal();
      }
      WcoAck(id,result);
   }
   bool changed=false;
   if(h620FutureGoal==1 && TimeGMT()>=h620FutureUntil)
   {h620FutureGoal=0;h620FuturePaused=false;h620FutureUntil=0;changed=true;}
   if(h620FutureGoal==2 && h620BankedLevel>WcoRead(p,"baseline"))
   {
      h620FuturePaused=true;h620FutureGoal=4;WcoWrite(p,"baseline",h620BankedLevel);
      // Wait for a bar that started AFTER the triggering tick, then closed.
      WcoWrite(p,"triggerBar",iTime(Symbol(),SignalTF,0));changed=true;
   }
   if(h620FutureGoal==4 && iTime(Symbol(),SignalTF,1)>(datetime)WcoRead(p,"triggerBar") && h620Dir!=DIR_FLAT)
   {
      double o=iOpen(Symbol(),SignalTF,1),c=iClose(Symbol(),SignalTF,1);
      if(h620Dir*(c-o)<0){h620FuturePaused=false;h620FutureGoal=2;changed=true;}
   }
   if(h620FutureGoal==3)
   {
      double win=WcoLatestWin();
      if(win>0 && win!=WcoRead(p,"baseline"))
      {WcoWrite(p,"baseline",win);h620FuturePaused=true;h620FutureUntil=TimeGMT()+(int)WcoRead(p,"durationSaved");changed=true;}
      if(h620FuturePaused && TimeGMT()>=h620FutureUntil){h620FuturePaused=false;h620FutureUntil=0;changed=true;}
   }
   if(h620FutureGoal==6 && TimeGMT()>=h620FutureUntil)
   {
      h620FutureGoal=7;h620FuturePaused=true;h620FutureUntil=0;
      h620Flip=0;h620Phase=2;H620Persist();changed=true; // CloseOld retries until flat; no auto-flip.
   }
   if(h620FutureGoal==9 && (h620Phase==0 || h620Phase==3))
   {h620FutureGoal=1;h620FuturePaused=true;h620FutureUntil=TimeGMT()+(int)WcoRead(p,"durationSaved");changed=true;}
   if(h620FutureGoal==12 && (TimeGMT()>=h620FutureUntil || WcoRead(p,"burstRemaining")<=0))
   {h620FutureGoal=8;h620FutureUntil=0;WcoWrite(p,"burstRemaining",0);changed=true;}
   if(changed)WcoSaveGoal();
   WcoPublish();
}
