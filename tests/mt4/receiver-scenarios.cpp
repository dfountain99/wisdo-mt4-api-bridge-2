int main(){
 int passed=0;auto check=[&](bool ok,const char*name){if(!ok){std::cerr<<"FAIL "<<name<<"\n";exit(1);}passed++;std::cout<<"PASS "<<name<<"\n";};
 auto reset=[&](){now+=600;globals.clear();live.clear();history.clear();h620Phase=1;h620Dir=1;h620Id=42;h620Rail=100;h620BankedLevel=0;h620FutureGoal=0;h620FutureUntil=0;h620FuturePaused=false;h620Quarantine=false;wcoEvaluation=0;gWisdoPaused=false;gWisdoEmergencyLatched=false;modifyOK=true;mods=0;std::fill(highs.begin(),highs.end(),110);highs[5]=120;};
 auto command=[&](int op,double id,int seconds=900){string p=WcoEA();WcoWrite(p,"op",op);WcoWrite(p,"duration",seconds);WcoWrite(p,"expected",h620Id);WcoWrite(p,"expires",now+90);WcoWrite(p,"slot",id);WcoWrite(p,"seq",id);};
 reset();gWisdoPaused=true;command(1,101,60);H620FutureTick();check(h620FuturePaused&&h620FutureUntil==now+60,"timed pause armed");
 h620FuturePaused=false;h620FutureUntil=0;h620FutureGoal=0;WcoRestoreGoal();check(h620FuturePaused&&h620FutureUntil==now+60,"pause survives restart");
 now+=61;H620FutureTick();check(!h620FuturePaused&&gWisdoPaused,"timer never clears manual pause");
 reset();command(2,201);H620FutureTick();h620BankedLevel=1;H620FutureTick();check(h620FutureGoal==4&&h620FuturePaused,"compound milestone pauses");
 H620FutureTick();check(h620FuturePaused,"old opposite candle does not resume");now+=60;H620FutureTick();check(h620FuturePaused,"triggering bar does not resume");now+=60;H620FutureTick();check(!h620FuturePaused&&h620FutureGoal==2,"new closed opposite candle rearms recurring rule");
 reset();command(3,301,120);H620FutureTick();history.push_back({4,OP_BUY,100,99,111,.1,5,0,0,now,"HT6_ADD_BUY"});GlobalVariableSet(H620TicketKey(4,"campaign"),42);H620FutureTick();check(h620FuturePaused&&h620FutureUntil==now+120,"profitable close starts user duration");now+=121;H620FutureTick();check(!h620FuturePaused&&h620FutureGoal==3,"win rule remains armed after pause");
 reset();command(1,401);WcoWrite(WcoEA(),"expires",now-1);H620FutureTick();check(WcoRead(WcoEA(),"ackStatus")==-1&&!h620FuturePaused,"expired command rejected");
 reset();command(1,501);WcoWrite(WcoEA(),"expected",41);H620FutureTick();check(WcoRead(WcoEA(),"ackStatus")==-1,"wrong campaign rejected");
 reset();command(1,601,60);H620FutureTick();datetime until=h620FutureUntil;now+=10;command(1,601,900);H620FutureTick();check(h620FutureUntil==until&&WcoRead(WcoEA(),"slot")==0,"duplicate request cannot extend timer or block mailbox");
 reset();live.push_back({1,OP_BUY,110,100,0,.1});GlobalVariableSet(H620TicketKey(1,"campaign"),42);command(8,701);WcoWrite(WcoEA(),"ticketCount",1);WcoWrite(WcoEA(),"t0",1);WcoWrite(WcoEA(),"levelId",12000);WcoWrite(WcoEA(),"levelPrice",120);H620FutureTick();check(mods==0&&WcoRead(WcoEA(),"ackStatus")==-1,"HOLD target cannot be moved");
 live[0].comment="HT6_ADD_BUY";command(8,702);H620FutureTick();check(live[0].tp==120&&WcoRead(WcoEA(),"ackStatus")==2,"confirmed level target modification acknowledged");
 command(8,703);WcoWrite(WcoEA(),"levelPrice",119);H620FutureTick();check(WcoRead(WcoEA(),"ackStatus")==-1,"non-level target rejected by EA");
 reset();command(6,801,5);H620FutureTick();now+=6;H620FutureTick();check(h620Phase==2&&h620FuturePaused&&h620Flip==0,"closure timer enters retryable closing phase and blocks flip");
 reset();command(7,901,600);H620FutureTick();h620Phase=3;H620FutureTick();check(h620FuturePaused&&h620FutureUntil==now+600,"campaign-end pause blocks pending reversal entry");
 reset();command(12,1001,300);WcoWrite(WcoEA(),"burst",10);H620FutureTick();check(h620FutureGoal==12&&WcoRead(WcoEA(),"burstRemaining")==10,"bounded SONIC window arms quota");WcoWrite(WcoEA(),"burstRemaining",0);H620FutureTick();check(h620FutureGoal==8,"completed window pauses SONIC");
 command(5,1002);gWisdoEmergencyLatched=true;H620FutureTick();check(h620FutureGoal==0&&gWisdoEmergencyLatched,"cancel never clears emergency latch");
 reset();command(4,1101);H620FutureTick();check(WcoRead(WcoEA(),"ackStatus")==4,"evaluate request is not an execution receipt");H620FutureTick();check(WcoRead(WcoEA(),"ackStatus")==5,"no entry evaluation reported explicitly");
 reset();command(1,1201);WcoWrite(WcoEA(),"ack",1201);WcoWrite(WcoEA(),"ackStatus",-2);H620FutureTick();check(WcoRead(WcoEA(),"slot")==0&&!h620FuturePaused,"crash processing marker prevents replay and releases mailbox");
 std::cout<<passed<<" actual receiver compatibility scenarios passed (not a MetaEditor compile).\n";
}
