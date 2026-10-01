// Included inside H620 after campaign declarations; no broker order bypass.
bool h620FuturePaused=false,h620Quarantine=false;
double wcoEvaluation=0;
string WcoEA(){return WcoPrefix(Symbol(),MagicNumber);}

void WcoClearRuntime(bool force=false)
{
   string p=WcoEA();
   int scope=(int)WcoRead(p,"runtimeScope");
   if(!force && scope==2)return;
   gWisdoRuntimeStopATR=0.0;StopATRMultiplierValue=MathMax(0.05,DirectATRStopMultiplier);
   gWisdoRuntimeTrailStartATR=0.0;
   gWisdoRuntimeTrailDistanceATR=0.0;
   gWisdoRuntimeTrailStepATR=0.0;
   WcoWrite(p,"runtimeOverrideMask",0);WcoWrite(p,"runtimeScope",0);WcoWrite(p,"runtimeCampaign",0);
   WcoWrite(p,"runtimeStopAtr",0);WcoWrite(p,"runtimeTrailStartAtr",0);WcoWrite(p,"runtimeTrailDistanceAtr",0);WcoWrite(p,"runtimeTrailStepAtr",0);
   GlobalVariablesFlush();
}
void WcoRestoreRuntime()
{
   string p=WcoEA();int mask=(int)WcoRead(p,"runtimeOverrideMask"),scope=(int)WcoRead(p,"runtimeScope");
   if(scope==1 && WcoRead(p,"runtimeCampaign")!=h620Id){WcoClearRuntime(true);return;}
   gWisdoRuntimeStopATR=((mask%2)==1?WcoRead(p,"runtimeStopAtr"):0.0);
   gWisdoRuntimeTrailStartATR=(((mask/2)%2)==1?WcoRead(p,"runtimeTrailStartAtr"):0.0);
   gWisdoRuntimeTrailDistanceATR=(((mask/2)%2)==1?WcoRead(p,"runtimeTrailDistanceAtr"):0.0);
   gWisdoRuntimeTrailStepATR=(((mask/2)%2)==1?WcoRead(p,"runtimeTrailStepAtr"):0.0);
}
double WcoEffectiveStopATR(){return gWisdoRuntimeStopATR>0.0?gWisdoRuntimeStopATR:MathMax(0.05,DirectATRStopMultiplier);}
double WcoEffectiveTrailStartATR(){return gWisdoRuntimeTrailStartATR>0.0?gWisdoRuntimeTrailStartATR:MathMax(0.05,DirectTrailStartATR);}
double WcoEffectiveTrailDistanceATR(){return gWisdoRuntimeTrailDistanceATR>0.0?gWisdoRuntimeTrailDistanceATR:MathMax(0.05,DirectTrailDistanceATR);}
double WcoEffectiveTrailStepATR(){return gWisdoRuntimeTrailStepATR>0.0?gWisdoRuntimeTrailStepATR:MathMax(0.01,DirectTrailStepATR);}

int WcoLotDigits(double step)
{
   if(step>=1.0)return 0;if(step>=0.1)return 1;if(step>=0.01)return 2;if(step>=0.001)return 3;return 4;
}
double WcoTrimLots(double lots,double percent)
{
   double step=MarketInfo(Symbol(),MODE_LOTSTEP),minimum=MarketInfo(Symbol(),MODE_MINLOT);
   if(step<=0 || minimum<=0 || lots<=minimum)return 0;
   double closeLots=MathFloor((lots*percent/100.0)/step+0.0000001)*step;
   closeLots=NormalizeDouble(closeLots,WcoLotDigits(step));
   double remain=NormalizeDouble(lots-closeLots,WcoLotDigits(step));
   if(closeLots<minimum || (remain>0 && remain<minimum))return 0;
   return closeLots;
}
bool WcoTicketRequested(string p,int ticket,int count)
{
   if(count<=0)return true;
   for(int i=0;i<count;i++)if((int)WcoRead(p,"t"+IntegerToString(i))==ticket)return true;
   return false;
}
bool WcoTrimCampaign(string p)
{
   double percent=WcoRead(p,"trimPercent");int count=(int)WcoRead(p,"ticketCount");
   if(percent<1 || percent>99 || count<0 || count>12)return false;
   int requested=0,changed=0;
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !H620OwnedSelected() || !H620CampaignTicketSelected())continue;
      int ticket=OrderTicket();if(!WcoTicketRequested(p,ticket,count))continue;
      int type=OrderType();if(type!=OP_BUY && type!=OP_SELL)continue;
      requested++;
      double lots=WcoTrimLots(OrderLots(),percent);if(lots<=0)continue;
      RefreshRates();double price=(type==OP_BUY?Bid:Ask);bool old=h620Mutation;h620Mutation=true;
      bool ok=OrderClose(ticket,lots,price,SlippagePoints,clrNONE);
      h620Mutation=old;if(ok)changed++;
   }
   WcoWrite(p,"requested",requested);WcoWrite(p,"changed",changed);GlobalVariablesFlush();
   H620Ledger();return requested>0 && changed==requested;
}
bool WcoApplyStopAtrNow(string p,double multiplier)
{
   if(multiplier<0.05 || multiplier>20)return false;
   gWisdoRuntimeStopATR=multiplier;StopATRMultiplierValue=multiplier;int mask=(int)WcoRead(p,"runtimeOverrideMask");if(mask%2==0)mask+=1;
   int scope=(int)WcoRead(p,"runtimeScope");if(scope!=2)scope=1;
   WcoWrite(p,"runtimeOverrideMask",mask);WcoWrite(p,"runtimeScope",scope);WcoWrite(p,"runtimeCampaign",h620Id);WcoWrite(p,"runtimeStopAtr",multiplier);
   int requested=0,changed=0;double atr=H620ATR();RefreshRates();
   double gap=MathMax(MarketInfo(Symbol(),MODE_STOPLEVEL),MarketInfo(Symbol(),MODE_FREEZELEVEL))*Point+2*Point;
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES) || !H620OwnedSelected() || !H620CampaignTicketSelected())continue;
      int type=OrderType();if(type!=OP_BUY && type!=OP_SELL)continue;requested++;
      int dir=(type==OP_BUY?DIR_BUY:DIR_SELL);double quote=(dir==DIR_BUY?Bid:Ask);
      double candidate=H620RoundStop(dir,quote-dir*atr*multiplier);
      double sl=OrderStopLoss();
      if(candidate<=0 || dir*(quote-candidate)<=gap || (sl>0 && dir*(candidate-sl)<=Point))continue; // Never loosen an existing broker stop.
      if(H620Modify(OrderTicket(),candidate,OrderTakeProfit()))changed++;
   }
   WcoWrite(p,"requested",requested);WcoWrite(p,"changed",changed);GlobalVariablesFlush();return true;
}
bool WcoApplyTrailAtr(string p,double startAtr,double distanceAtr,double stepAtr)
{
   if(startAtr<0.05 || startAtr>20 || distanceAtr<0.05 || distanceAtr>20 || stepAtr<0.01 || stepAtr>5)return false;
   gWisdoRuntimeTrailStartATR=startAtr;gWisdoRuntimeTrailDistanceATR=distanceAtr;gWisdoRuntimeTrailStepATR=stepAtr;
   int mask=(int)WcoRead(p,"runtimeOverrideMask");if((mask/2)%2==0)mask+=2;
   int scope=(int)WcoRead(p,"runtimeScope");if(scope!=2)scope=1;
   WcoWrite(p,"runtimeOverrideMask",mask);WcoWrite(p,"runtimeScope",scope);WcoWrite(p,"runtimeCampaign",h620Id);
   WcoWrite(p,"runtimeTrailStartAtr",startAtr);WcoWrite(p,"runtimeTrailDistanceAtr",distanceAtr);WcoWrite(p,"runtimeTrailStepAtr",stepAtr);
   WcoWrite(p,"requested",0);WcoWrite(p,"changed",0);GlobalVariablesFlush();
   H620TrailAndExtend();return true;
}
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
   bool wisdoTradingPaused=(GlobalVariableCheck("WISDO_TRADING_PAUSED") && GlobalVariableGet("WISDO_TRADING_PAUSED")>=0.5);
   bool chronosEntryAllowed=(DirectAllowNewEntries && chronosWindowAllowed && !wisdoTradingPaused && !h620FuturePaused && !h620Quarantine);
   WcoWrite(p,"session",gHT5Session);WcoWrite(p,"sessionQuality",gHT5SessionQuality);
   WcoWrite(p,"brokerHour",TimeHour(chronosNow));WcoWrite(p,"brokerMinute",TimeMinute(chronosNow));
   WcoWrite(p,"windowMode",(int)DirectTradingWindowMode);
   WcoWrite(p,"window1Start",HT6NormalizeHour(DirectWindow1StartHour));WcoWrite(p,"window1End",HT6NormalizeHour(DirectWindow1EndHour));
   WcoWrite(p,"window2Start",HT6NormalizeHour(DirectWindow2StartHour));WcoWrite(p,"window2End",HT6NormalizeHour(DirectWindow2EndHour));
   WcoWrite(p,"scheduleEnforced",DirectTradingWindowMode==TIME_WINDOW_ALL_HOURS?0:1);
   WcoWrite(p,"windowAllowed",chronosWindowAllowed?1:0);WcoWrite(p,"entryAllowed",chronosEntryAllowed?1:0);
   // MARKET SENSE truth from the active HIGHTOWER organism. Numeric fields only;
   // the website labels them, while the EA remains the authority.
   WcoWrite(p,"intentScore",gHT6CampaignIntent);
   WcoWrite(p,"continuationProbability",gHT5Brain.continuationProbability);
   WcoWrite(p,"reversalProbability",gHT5Brain.reversalProbability);
   WcoWrite(p,"pressureBias",gHT6Flow.pressureBias);
   WcoWrite(p,"flowLeg",gHT6Flow.leg);
   WcoWrite(p,"continuationDefense",gHT6Flow.continuationDefense?1:0);
   WcoWrite(p,"runtimeOverrideMask",WcoRead(p,"runtimeOverrideMask"));
   WcoWrite(p,"effectiveStopAtr",WcoEffectiveStopATR());
   WcoWrite(p,"effectiveTrailStartAtr",WcoEffectiveTrailStartATR());WcoWrite(p,"effectiveTrailDistanceAtr",WcoEffectiveTrailDistanceATR());WcoWrite(p,"effectiveTrailStepAtr",WcoEffectiveTrailStepATR());
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
      if(op<1 || op>19)valid=false;
      if((op==1 || op==3 || op==6 || op==7 || op==12) && (duration<1 || duration>604800))valid=false;
      if((op==2 || op==3 || (op>=6 && op<=18)) && h620Phase!=1)valid=false;
      if(op==12 && (WcoRead(p,"burst")<1 || WcoRead(p,"burst")>10))valid=false;
      if(!valid){WcoAck(id,-1);return;}
      // A persisted processing marker prevents replay after a terminal crash.
      WcoWrite(p,"ack",id);WcoWrite(p,"ackStatus",-2);GlobalVariablesFlush();
      WcoWrite(p,"changed",0);WcoWrite(p,"requested",0);
      int result=1;
      if(op==4){wcoEvaluation=id;result=4;}
      else if(op==15){result=WcoApplyStopAtrNow(p,WcoRead(p,"stopAtr"))?1:-1;}
      else if(op==16){result=WcoApplyTrailAtr(p,WcoRead(p,"trailStartAtr"),WcoRead(p,"trailDistanceAtr"),WcoRead(p,"trailStepAtr"))?1:-1;}
      else if(op==17){result=WcoTrimCampaign(p)?1:(WcoRead(p,"changed")>0?3:-1);}
      else if(op==18)
      {
         WcoWrite(p,"requested",1);bool opened=HT6EinsteinOpenContinuationAdd();WcoWrite(p,"changed",opened?1:0);GlobalVariablesFlush();result=opened?6:-1;
      }
      else if(op==19){WcoClearRuntime(true);WcoWrite(p,"requested",1);WcoWrite(p,"changed",1);result=1;}
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
