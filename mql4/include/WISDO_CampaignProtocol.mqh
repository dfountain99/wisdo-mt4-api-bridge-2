#ifndef WISDO_CAMPAIGN_PROTOCOL
#define WISDO_CAMPAIGN_PROTOCOL
// Shared account/server/symbol/magic scope. MT4 terminal globals never cross scopes.
string WcoPrefix(string symbol,int magic)
{
   string identity=(IsTesting() || IsOptimization()?"TEST|":"LIVE|")+AccountServer()+"|"+symbol+"|"+IntegerToString(magic);
   uint hash=2166136261;
   for(int i=0;i<StringLen(identity);i++){hash^=(uint)StringGetCharacter(identity,i);hash*=16777619;}
   return "WCO1_"+IntegerToString(AccountNumber())+"_"+IntegerToString((int)hash)+"_";
}
double WcoRead(string prefix,string name){return GlobalVariableCheck(prefix+name)?GlobalVariableGet(prefix+name):0;}
void WcoWrite(string prefix,string name,double value){GlobalVariableSet(prefix+name,value);}
#endif
