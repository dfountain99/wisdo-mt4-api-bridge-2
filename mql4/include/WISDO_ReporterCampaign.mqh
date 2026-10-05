// Include after Reporter JSON helpers. One watched campaign EA per Reporter instance.
string BuildCampaignControlJson()
{
   string p=WcoPrefix(CampaignControlSymbol,CampaignControlMagic);
   if(!EnableCampaignControl || CampaignControlMagic<=0 || WcoRead(p,"version")!=1) return "null";
   double revision=WcoRead(p,"revision");if((int)revision%2!=0)return "null";
   double age=(double)TimeLocal()-WcoRead(p,"heartbeat");
   if(age<0) age=999999;
   string j="{\"version\":1,\"symbol\":\""+EscapeJson(CampaignControlSymbol)+"\",\"magic\":"+IntegerToString(CampaignControlMagic);
   j+=",\"ageSeconds\":"+DoubleToString(age,0)+",\"enabled\":"+BoolToJson(WcoRead(p,"enabled")==1);
   j+=",\"campaignId\":"+DoubleToString(WcoRead(p,"campaign"),0)+",\"phase\":"+DoubleToString(WcoRead(p,"phase"),0);
   j+=",\"direction\":"+DoubleToString(WcoRead(p,"direction"),0)+",\"rail\":"+DoubleToString(WcoRead(p,"rail"),8);
   j+=",\"goal\":"+DoubleToString(WcoRead(p,"goal"),0)+",\"paused\":"+BoolToJson(WcoRead(p,"paused")==1);
   j+=",\"remainingSeconds\":"+DoubleToString(MathMax(0,WcoRead(p,"until")-TimeGMT()),0);
   j+=",\"banked\":"+DoubleToString(WcoRead(p,"banked"),0);
   j+=",\"campaignBase\":"+DoubleToString(WcoRead(p,"campaignBase"),2)+",\"campaignRealized\":"+DoubleToString(WcoRead(p,"campaignRealized"),2);
   j+=",\"campaignFloating\":"+DoubleToString(WcoRead(p,"campaignFloating"),2)+",\"milestonePercent\":"+DoubleToString(WcoRead(p,"milestonePercent"),4);
   j+=",\"targetEquity\":"+DoubleToString(WcoRead(p,"targetEquity"),2);
   j+=",\"sessionId\":"+DoubleToString(WcoRead(p,"session"),0)+",\"sessionQuality\":"+DoubleToString(WcoRead(p,"sessionQuality"),4);
   j+=",\"brokerHour\":"+DoubleToString(WcoRead(p,"brokerHour"),0)+",\"brokerMinute\":"+DoubleToString(WcoRead(p,"brokerMinute"),0);
   j+=",\"windowMode\":"+DoubleToString(WcoRead(p,"windowMode"),0);
   j+=",\"window1Start\":"+DoubleToString(WcoRead(p,"window1Start"),0)+",\"window1End\":"+DoubleToString(WcoRead(p,"window1End"),0);
   j+=",\"window2Start\":"+DoubleToString(WcoRead(p,"window2Start"),0)+",\"window2End\":"+DoubleToString(WcoRead(p,"window2End"),0);
   j+=",\"scheduleEnforced\":"+BoolToJson(WcoRead(p,"scheduleEnforced")==1);
   j+=",\"windowAllowed\":"+BoolToJson(WcoRead(p,"windowAllowed")==1)+",\"entryAllowed\":"+BoolToJson(WcoRead(p,"entryAllowed")==1);
   j+=",\"intentScore\":"+DoubleToString(WcoRead(p,"intentScore"),4);
   j+=",\"continuationProbability\":"+DoubleToString(WcoRead(p,"continuationProbability"),4)+",\"reversalProbability\":"+DoubleToString(WcoRead(p,"reversalProbability"),4);
   j+=",\"pressureBias\":"+DoubleToString(WcoRead(p,"pressureBias"),4)+",\"flowLeg\":"+DoubleToString(WcoRead(p,"flowLeg"),0);
   j+=",\"continuationDefense\":"+BoolToJson(WcoRead(p,"continuationDefense")==1);
   j+=",\"runtimeOverrideMask\":"+DoubleToString(WcoRead(p,"runtimeOverrideMask"),0);
   j+=",\"runtimeScope\":"+DoubleToString(WcoRead(p,"runtimeScope"),0);
   j+=",\"runtimeStopAtr\":"+DoubleToString(WcoRead(p,"effectiveStopAtr"),4);
   j+=",\"runtimeTrailStartAtr\":"+DoubleToString(WcoRead(p,"effectiveTrailStartAtr"),4);
   j+=",\"runtimeTrailDistanceAtr\":"+DoubleToString(WcoRead(p,"effectiveTrailDistanceAtr"),4);
   j+=",\"runtimeTrailStepAtr\":"+DoubleToString(WcoRead(p,"effectiveTrailStepAtr"),4);
   j+=",\"ackId\":"+DoubleToString(WcoRead(p,"ack"),0);
   j+=",\"ackStatus\":"+DoubleToString(WcoRead(p,"ackStatus"),0)+",\"pendingId\":"+DoubleToString(WcoRead(p,"slot"),0)+",\"levels\":[";
   int count=(int)MathMin(16,WcoRead(p,"levelCount"));
   for(int i=0;i<count;i++) {if(i>0)j+=",";string n=IntegerToString(i);j+="{\"id\":"+DoubleToString(WcoRead(p,"li"+n),0)+",\"price\":"+DoubleToString(WcoRead(p,"lp"+n),8)+"}";}
   j+="],\"positions\":["; bool first=true;
   int positions=(int)MathMin(100,WcoRead(p,"positionCount"));
   for(int k=0;k<positions;k++){if(!first)j+=",";first=false;string n=IntegerToString(k);j+="{\"ticket\":"+DoubleToString(WcoRead(p,"pt"+n),0)+",\"role\":"+DoubleToString(WcoRead(p,"pr"+n),0)+"}";}
   j+="],\"burstRemaining\":"+DoubleToString(WcoRead(p,"burstRemaining"),0)+",\"acknowledgements\":[";
   bool firstAck=true;
   for(int a=0;a<12;a++)
   {
      string n=IntegerToString(a);double ack=WcoRead(p,"ai"+n);if(ack<=0)continue;
      if(!firstAck)j+=",";firstAck=false;
      j+="{\"id\":"+DoubleToString(ack,0)+",\"status\":"+DoubleToString(WcoRead(p,"as"+n),0)+",\"changed\":"+DoubleToString(WcoRead(p,"ac"+n),0)+",\"requested\":"+DoubleToString(WcoRead(p,"ar"+n),0)+"}";
   }
   if(WcoRead(p,"revision")!=revision)return "null";
   return j+"]}";
}
bool ExecuteCampaignCommand(string json,string &message,int &ticket)
{
   ticket=0;
   string p=WcoPrefix(CampaignControlSymbol,CampaignControlMagic);
   double id=JsonGetDouble(json,"requestId",0),expires=JsonGetDouble(json,"expiresEpoch",0);
   int op=JsonGetInt(json,"operation",0),duration=JsonGetInt(json,"durationSeconds",0);
   if(!EnableCampaignControl || CampaignControlMagic<=0 || JsonGetString(json,"symbol","")!=CampaignControlSymbol || JsonGetInt(json,"magicNumber",0)!=CampaignControlMagic)
   {message="Campaign control scope is disabled or does not match Reporter inputs";return false;}
   if(id<=0 || expires<TimeGMT() || expires>TimeGMT()+120 || op<1 || op>21 ||
      ((op==1 || op==3 || op==6 || op==7 || op==12) && (duration<1 || duration>604800)))
   {message="Invalid or expired campaign instruction";return false;}
   if(WcoRead(p,"ack")>=id){message="Already processed by EA; inspect campaign acknowledgement";return true;}
   double age=TimeLocal()-WcoRead(p,"heartbeat");
   if(WcoRead(p,"version")!=1 || WcoRead(p,"enabled")!=1 || age<0 || age>15 || !IsConnected() || !IsExpertEnabled())
   {message="Campaign EA heartbeat or AutoTrading unavailable";return false;}
   double slot=WcoRead(p,"slot");
   if(slot==id && WcoRead(p,"seq")==id){message="Delivered previously; waiting for EA acknowledgement";return true;}
   if(!GlobalVariableCheck(p+"slot")) WcoWrite(p,"slot",0);
   if(!GlobalVariableSetOnCondition(p+"slot",id,0)){message="Campaign mailbox busy; preview again after acknowledgement";return false;}
   WcoWrite(p,"burst",JsonGetInt(json,"burstCount",0));WcoWrite(p,"op",op);WcoWrite(p,"duration",duration);WcoWrite(p,"expires",expires);
   WcoWrite(p,"expected",JsonGetDouble(json,"eaCampaignId",-1));
   WcoWrite(p,"levelId",JsonGetDouble(json,"levelId",0));WcoWrite(p,"levelPrice",JsonGetDouble(json,"levelPrice",0));
   WcoWrite(p,"stopAtr",JsonGetDouble(json,"stopAtr",0));WcoWrite(p,"trailStartAtr",JsonGetDouble(json,"trailStartAtr",0));
   WcoWrite(p,"trailDistanceAtr",JsonGetDouble(json,"trailDistanceAtr",0));WcoWrite(p,"trailStepAtr",JsonGetDouble(json,"trailStepAtr",0));
   WcoWrite(p,"trimPercent",JsonGetDouble(json,"trimPercent",0));
   WcoWrite(p,"counterDirection",JsonGetInt(json,"counterDirection",0));
   WcoWrite(p,"referencePrice",JsonGetDouble(json,"referencePrice",0));
   if(op==15 || op==16)WcoWrite(p,"runtimeScope",JsonGetInt(json,"runtimeScope",1));
   string parts[];int count=StringSplit(JsonGetString(json,"tickets",""),StringGetCharacter(",",0),parts);
   if(count>12){WcoWrite(p,"slot",0);message="Too many selected trades";return false;}
   WcoWrite(p,"ticketCount",count);
   for(int i=0;i<count;i++)WcoWrite(p,"t"+IntegerToString(i),StringToInteger(parts[i]));
   // Publish sequence last: the EA never consumes a partially written packet.
   WcoWrite(p,"seq",id);GlobalVariablesFlush();
   message="Delivered to campaign EA mailbox; not yet accepted or executed";return true;
}
