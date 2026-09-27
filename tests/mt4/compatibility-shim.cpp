#include <string>
#include <vector>
#include <map>
#include <cmath>
#include <algorithm>
#include <cassert>
#include <iostream>
using string=std::string;using datetime=long long;using uint=unsigned int;
#define input
const int DIR_BUY=1,DIR_SELL=-1,DIR_FLAT=0,OP_BUY=0,OP_SELL=1,SELECT_BY_POS=0,SELECT_BY_TICKET=1,MODE_TRADES=0,MODE_HISTORY=1;
const int MODE_TICKSIZE=2,MODE_TICKVALUE=3,MODE_LOTSTEP=4,MODE_MINLOT=5,MODE_MAXLOT=6,MODE_STOPLEVEL=7,MODE_FREEZELEVEL=8,MODE_HIGH=9,MODE_LOW=10;
const int INIT_SUCCEEDED=0,INIT_FAILED=1,INIT_PARAMETERS_INCORRECT=2,clrNONE=0;
double Point=.01,Bid=110,Ask=110.02,bal=1000,equity=1000,atr=1;int Digits=2,SignalTF=1,MagicNumber=99;datetime now=10000;
double tick=.01,tickValue=1,lotStep=.01,minLot=.01,maxLot=100;
double DirectMaximumOpenRiskPercent=5,DirectMaximumSingleTradeRiskPercent=1,DirectRiskPercentEveryTrade=.5;
double DirectAdaptiveTPMinimumR=1.1,DirectAdaptiveTPMaximumR=2.25,DirectBreakEvenTriggerR=.75,DirectBreakEvenLockR=.05,DirectTrailStartATR=1,DirectTrailDistanceATR=.75,DirectTrailStepATR=.15,DirectStructureBreakBufferATR=.02;
int DirectATRStopPeriod=14,DirectMaximumTotalOpenTrades=12;
bool DirectUseBreakEven=true,DirectUseATRTrailingStop=true,gWisdoPaused=false,gWisdoEmergencyLatched=false,AllowNewEntries=true;
bool gHT6StructureHoldOrderContext=false,gHT6ContinuationAddOrderContext=false,gHT6DoubleCampaignActive=false;
double gHT6DoubleCampaignStartBalance=0,gHT6DoubleCampaignTargetEquity=0;string gHT6DoubleState;
struct Flow{double upperRail=110,lowerRail=109,pendingStructureStop=0;int primaryDirection=1,leg=1,lastBreakDirection=0,pendingStructureDirection=0,pendingStructureLeg=0;bool continuationDefense=false,boxReady=true,structureEntryPending=false;datetime lastBreakBar=0;}gHT6Flow;
struct Order{int id,type;double open,sl,tp,lots,profit=0,swap=0,commission=0;datetime closed=0;string comment="HT6_CORE_BUY";};
std::vector<Order> live,history;Order selected;std::map<string,double> globals;bool modifyOK=true,closeOK=true;int opens=0,mods=0;double intent=.9;
template<class A,class B>double MathMax(A a,B b){return std::max((double)a,(double)b);}template<class A,class B>double MathMin(A a,B b){return std::min((double)a,(double)b);}
double MathAbs(double x){return std::abs(x);}double MathFloor(double x){return std::floor(x);}double MathCeil(double x){return std::ceil(x);}double MathLog(double x){return std::log(x);}double MathPow(double x,double y){return std::pow(x,y);}double NormalizeDouble(double x,int n){double v=std::pow(10,n);return std::round(x*v)/v;}
string IntegerToString(int x){return std::to_string(x);}string DoubleToString(double x,int n){return std::to_string(x);}int StringFind(string x,string y){auto p=x.find(y);return p==string::npos?-1:(int)p;}int StringLen(string s){return s.size();}int StringGetCharacter(string s,int i){return s.at(i);}string Symbol(){return "XAUUSD";}string AccountServer(){return "test";}int AccountNumber(){return 1234;}
void GlobalVariableSet(string k,double v){assert(k.size()<=63);globals[k]=v;}double GlobalVariableGet(string k){return globals[k];}bool GlobalVariableCheck(string k){return globals.count(k)>0;}void GlobalVariablesFlush(){}
string HT5Key(string s){return s;}bool HT6EinsteinEnabled(){return true;}double HTExecutionATR(int,int){return atr;}double HT5Clamp(double x,double a,double b){return std::max(a,std::min(x,b));}
double MarketInfo(string,int mode){switch(mode){case MODE_TICKSIZE:return tick;case MODE_TICKVALUE:return tickValue;case MODE_LOTSTEP:return lotStep;case MODE_MINLOT:return minLot;case MODE_MAXLOT:return maxLot;default:return 0;}}
double AccountBalance(){return bal;}double AccountEquity(){return equity;}datetime TimeCurrent(){return now;}void RefreshRates(){}
int OrdersTotal(){return live.size();}int OrdersHistoryTotal(){return history.size();}
bool OrderSelect(int x,int how,int pool=MODE_TRADES){if(how==SELECT_BY_TICKET){for(auto o:live)if(o.id==x){selected=o;return true;}for(auto o:history)if(o.id==x){selected=o;return true;}return false;}auto &v=pool==MODE_TRADES?live:history;if(x<0||x>=(int)v.size())return false;selected=v[x];return true;}
bool OurOrder(){return selected.type==OP_BUY||selected.type==OP_SELL;}int OrderTicket(){return selected.id;}int OrderType(){return selected.type;}datetime OrderCloseTime(){return selected.closed;}string OrderComment(){return selected.comment;}double OrderOpenPrice(){return selected.open;}double OrderStopLoss(){return selected.sl;}double OrderTakeProfit(){return selected.tp;}double OrderLots(){return selected.lots;}double OrderProfit(){return selected.profit;}double OrderSwap(){return selected.swap;}double OrderCommission(){return selected.commission;}
int TradeCount(){return live.size();}int HT6StructureHoldCount(int dir){int n=0;for(auto o:live)if(o.comment.find("HT6_CORE_")==0&&(o.type==OP_BUY?1:-1)==dir)n++;return n;}
std::vector<double> highs(600,110),lows(600,108),closes(600,109);
int iBars(string,int){return 600;}double iHigh(string,int,int s){return highs.at(s);}double iLow(string,int,int s){return lows.at(s);}double iClose(string,int,int s){return closes.at(s);}datetime iTime(string,int,int s){return now-now%60-s*60;}int iBarShift(string,int,datetime t,bool){return (iTime("",0,0)-t)/60;}
int iHighest(string,int,int,int count,int start){return std::max_element(highs.begin()+start,highs.begin()+start+count)-highs.begin();}int iLowest(string,int,int,int count,int start){return std::min_element(lows.begin()+start,lows.begin()+start+count)-lows.begin();}
double HT6CampaignIntentScore(int){return intent;}void HT6EndDoubleCampaignState(string,bool){gHT6DoubleCampaignActive=false;}void HT6SequenceClear(string){}void HT6EinsteinReset(string){gHT6Flow=Flow();}
double HT6DirectInitialStopPrice(int d,double p){return p-d*1.5;}
bool HT5CommanderOrderModify(int ticket,double,double sl,double tp,int,int){mods++;if(!modifyOK)return false;for(auto &o:live)if(o.id==ticket){o.sl=sl;o.tp=tp;return true;}return false;}
bool HT6EinsteinCloseDirection(int dir,string){if(!closeOK)return false;for(auto it=live.begin();it!=live.end();){if((it->type==OP_BUY?1:-1)==dir){it->closed=now;history.push_back(*it);it=live.erase(it);}else ++it;}return true;}
bool HT6EinsteinOpenStructureHold(int){opens++;return false;}template<class...T>void Print(T...args){}


datetime TimeLocal(){return now;}datetime TimeGMT(){return now;}bool IsConnected(){return true;}bool IsExpertEnabled(){return true;}double MathRound(double v){return std::round(v);}double iOpen(string,int,int){return 110;}bool gHT6SonicFlowOrderContext=false;

bool IsTesting(){return false;}bool IsOptimization(){return false;}
