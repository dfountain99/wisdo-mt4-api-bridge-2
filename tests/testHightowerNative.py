from pathlib import Path
import re, subprocess, tempfile
src=(Path(__file__).resolve().parents[1]/'mql4/HIGHTOWER_UNITY_SERVER_v6_22.mq4').read_text()
# Exercise the actual new MQL functions in a C++ compatibility shim. Not an MQL compiler.
names=['WBQuote','WBSkip','WBString','WBParse','WBGet','WBAllows','WBClose','WBExecute']
def function(name):
    inline=re.search(r'^(?:string|void|bool) '+name+r'\([^\n]*',src,re.M)
    if inline and '{' in inline.group():return inline.group()
    m=re.search(r'^(?:string|void|bool) '+name+r'\([^\n]+\)\n\{',src,re.M)
    start=m.start();i=m.end();depth=1
    # End is the next unindented closing brace (all bridge functions follow this style).
    return src[start:src.index('\n}',i)+2]
code='\n'.join(function(n) for n in names)
shim=r'''
#include <string>
#include <vector>
#include <cassert>
#include <cstdint>
#include <iostream>
using string=std::string;using ushort=unsigned short;
int StringLen(string s){return s.size();}int StringGetCharacter(string s,int i){return i>=0&&i<(int)s.size()?(unsigned char)s[i]:0;}
string ShortToString(int c){return string(1,(char)c);}string StringSubstr(string s,int i,int n=-1){return s.substr(i,n<0?string::npos:n);}
void StringTrimLeft(string &s){auto p=s.find_first_not_of(" \n\r\t");s=p==string::npos?"":s.substr(p);}void StringTrimRight(string &s){auto p=s.find_last_not_of(" \n\r\t");s=p==string::npos?"":s.substr(0,p+1);}
string IntegerToString(int x){return std::to_string(x);}string WBHash(string x){return "hash";}
string wbKeys[24],wbValues[24];int wbFields=0;
const int OP_BUY=0,OP_SELL=1,OP_BUYLIMIT=2,OP_SELLLIMIT=3,OP_BUYSTOP=4,OP_SELLSTOP=5;
const int SELECT_BY_POS=0,MODE_TRADES=0,clrNONE=0;
bool WisdoServerControl=true,wbFault=false,wbPaused=true,wbEmergency=false,gWisdoPaused=true,gWisdoEmergencyLatched=false,wbAckSuccess=false;
bool fresh=true,connected=true,allowed=true,expert=true,cancel=true;
int wbDirection=0,gWisdoDirectionMode=0,MagicNumber=26080204,wbChanged=0,wbRequested=0,SlippagePoints=2;
string wbIdentity="123|Broker|XAUUSD|26080204|https://server",WisdoServerBaseUrl="https://server",wbAckMessage;
int account=123;string sym="XAUUSD";
int AccountNumber(){return account;}string AccountServer(){return "Broker";}string Symbol(){return sym;}
bool WBFresh(){return fresh;}bool IsConnected(){return connected;}bool IsTradeAllowed(){return allowed;}bool IsExpertEnabled(){return expert;}bool WBCancelPending(){return cancel;}
void GlobalVariableSet(string,double){}void GlobalVariablesFlush(){}
bool gHT6EinsteinCoreCloseAuthority=false,gHT6EinsteinAddonCloseAuthority=false,h620Mutation=false;
struct Order{int type;bool owned;double net;bool succeeds;};std::vector<Order> orders;int selected=0;std::vector<int> touched;
int OrdersTotal(){return orders.size();}bool OrderSelect(int i,int,int){selected=i;return true;}bool WBOwned(){return orders[selected].owned;}
int OrderType(){return orders[selected].type;}double OrderProfit(){return orders[selected].net;}double OrderSwap(){return 0;}double OrderCommission(){return 0;}
int OrderTicket(){return selected;}double OrderLots(){return .01;}double Bid=100,Ask=101;void RefreshRates(){}
bool HT5CommanderOrderDelete(int i,int){touched.push_back(i);return orders[i].succeeds;}
bool HT5CommanderOrderClose(int i,double,double,int,int){assert(gHT6EinsteinCoreCloseAuthority&&h620Mutation);touched.push_back(i);return orders[i].succeeds;}
'''
main=r'''
int main(){
 assert(WBParse("{\"ok\":true,\"accountNumber\":\"123\",\"magicNumber\":26080204}"));assert(WBGet("magicNumber")=="26080204");
 for(string bad:{"{\"ok\":true,\"ok\":false}","{\"x\":{}}","{\"x\":[]}","{\"ok\":true,}","{\"ok\":true}garbage","{\"x\":nan}"})assert(!WBParse(bad));
 assert(WBParse("{\"x\":\"Broker\\\\Server\"}"));assert(WBGet("x")=="Broker\\Server");
 assert(!WBAllows(OP_BUY));WBExecute("RESUME");assert(wbAckSuccess&&WBAllows(OP_BUY));
 fresh=false;assert(!WBAllows(OP_BUY));fresh=true;
 account=999;assert(!WBAllows(OP_BUY));account=123;
 WBExecute("BUY_ONLY");assert(wbPaused);WBExecute("RESUME");assert(WBAllows(OP_BUY)&&!WBAllows(OP_SELLSTOP));
 orders={{OP_BUY,true,5,true},{OP_SELL,true,-2,false},{OP_BUY,false,10,true},{OP_BUYLIMIT,true,0,true}};
 WBExecute("CLOSE_ALL");assert(!wbAckSuccess&&wbPaused&&wbChanged==2&&wbRequested==3);assert(touched.size()==3);assert(!gHT6EinsteinCoreCloseAuthority&&!h620Mutation);
 touched.clear();WBExecute("CLOSE_PROFITS");assert(wbAckSuccess&&wbRequested==2&&wbChanged==2);assert(touched.size()==2);
 WBExecute("EMERGENCY_STOP");assert(wbEmergency);WBExecute("RESUME");assert(!wbAckSuccess&&wbPaused);
 WBExecute("RESET_EMERGENCY");assert(!wbEmergency&&wbPaused);WBExecute("RESUME");assert(wbAckSuccess);
 allowed=false;WBExecute("CLOSE_ALL");assert(!wbAckSuccess&&wbPaused);allowed=true;
 cancel=false;WBExecute("PAUSE");assert(!wbAckSuccess&&wbPaused);
 WBExecute("UNKNOWN");assert(!wbAckSuccess);
 std::cout<<"Bridge compatibility scenarios passed (parser, scope, entry gates, closes, emergency). Not MetaEditor compilation.\n";
}
'''
with tempfile.TemporaryDirectory() as d:
 p=Path(d)/'bridge.cpp';p.write_text(shim+code+main)
 subprocess.run(['g++','-std=c++17','-Wall','-Wextra','-Wno-unused-parameter',str(p),'-o',d+'/bridge'],check=True)
 subprocess.run([d+'/bridge'],check=True)
# All broker entry paths in uploaded source use the now-gated commander.
assert len(re.findall(r'\bOrderSend\s*\(',src))==1
assert src.index('WBAllows(cmd)',src.index('int HT5CommanderOrderSend('))<src.index('int ticket=OrderSend(')
print('Single OrderSend authority and native bridge event hooks verified.')

assert not re.search(r"\bMagicNumber\s*\(",src), "MagicNumber is an input, not a function"
