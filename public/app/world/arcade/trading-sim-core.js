export const TRADING_SIM_VERSION='3.0.0';
export const TRADING_SIM_TICK_MS=850;
export const TRADING_SIM_MAX_TICKS=180;

export const TRADING_GAME_DEFS=Object.freeze({
  'structure-trader':Object.freeze({
    id:'structure-trader',name:'Market Structure Trader',floor:'rookie',skill:'structure',version:'3.0.0-structure',
    objective:'Trade only after structure confirms direction. Use BUY, SELL, HOLD, and CLOSE on a live candle replay.',
    lessons:Object.freeze([
      Object.freeze({prompt:'What should a break of structure change?',choices:Object.freeze(['Your directional evidence','Your account leverage automatically','The spread to zero']),lesson:'Structure changes evidence, not risk rules.'}),
      Object.freeze({prompt:'After a bullish break, what usually offers a better entry than chasing the breakout candle?',choices:Object.freeze(['A controlled pullback that holds structure','Buying every green candle','Removing the stop']),lesson:'A pullback can improve location while preserving invalidation.'}),
      Object.freeze({prompt:'If structure does not confirm your idea, what is a valid action?',choices:Object.freeze(['Hold / no trade','Double size','Enter anyway to avoid missing it']),lesson:'No trade is a professional decision when evidence is incomplete.'}),
    ]),
  }),
  'liquidity-sweep-trader':Object.freeze({
    id:'liquidity-sweep-trader',name:'Liquidity Sweep Trader',floor:'structure',skill:'liquidity',version:'3.0.0-liquidity',
    objective:'Read equal highs/lows, survive the sweep, then trade only after price reclaims and confirms.',
    lessons:Object.freeze([
      Object.freeze({prompt:'A wick sweeps an obvious low and immediately reclaims. What does that tell you first?',choices:Object.freeze(['Liquidity was taken; wait for confirmation','A buy is guaranteed','Stops no longer matter']),lesson:'A sweep is information. Confirmation determines whether it becomes an entry.'}),
      Object.freeze({prompt:'What is usually dangerous?',choices:Object.freeze(['Entering during the sweep before reclaim','Waiting for the candle to close','Defining invalidation']),lesson:'The sweep itself can continue. Reclaim and acceptance matter.'}),
      Object.freeze({prompt:'Where should invalidation be logically related?',choices:Object.freeze(['The structure that proves the idea wrong','A random fixed number only','Your desired profit']),lesson:'Stops should relate to the setup invalidation, then size should adapt to that distance.'}),
    ]),
  }),
  'breakout-retest-trader':Object.freeze({
    id:'breakout-retest-trader',name:'Breakout & Retest Trader',floor:'structure',skill:'breakouts',version:'3.0.0-breakout',
    objective:'Separate true acceptance from a fake breakout, then execute the retest instead of chasing the first break.',
    lessons:Object.freeze([
      Object.freeze({prompt:'What makes a breakout stronger?',choices:Object.freeze(['Acceptance beyond the level','One wick through the level','More leverage']),lesson:'Acceptance beyond structure is stronger than a single penetration.'}),
      Object.freeze({prompt:'Why wait for a retest?',choices:Object.freeze(['To see whether the broken level holds its new role','To guarantee profit','To eliminate spread']),lesson:'Retests test acceptance and improve location.'}),
      Object.freeze({prompt:'Price breaks a level then closes back inside immediately. This is most consistent with…',choices:Object.freeze(['A failed breakout','Guaranteed continuation','A position-size signal']),lesson:'Failure to hold beyond the level is a major fakeout clue.'}),
    ]),
  }),
  'risk-manager':Object.freeze({
    id:'risk-manager',name:'Risk Manager',floor:'risk',skill:'risk',version:'3.0.0-risk',
    objective:'Select risk before entering. Preserve simulated capital while still taking valid setups.',
    lessons:Object.freeze([
      Object.freeze({prompt:'If stop distance doubles and risk dollars stay fixed, position size should…',choices:Object.freeze(['Decrease','Increase','Stay identical']),lesson:'Position size must shrink as stop distance expands when risk is fixed.'}),
      Object.freeze({prompt:'What should determine risk per trade?',choices:Object.freeze(['A predefined account-risk rule','How confident you feel after a win','How much money you lost previously']),lesson:'Risk should be defined before emotion enters the trade.'}),
      Object.freeze({prompt:'What is the purpose of a risk cap?',choices:Object.freeze(['Prevent one idea from threatening the account','Guarantee every setup wins','Make drawdown impossible']),lesson:'Risk caps limit damage; they do not remove uncertainty.'}),
    ]),
  }),
  'entry-discipline-trader':Object.freeze({
    id:'entry-discipline-trader',name:'Entry Discipline Trader',floor:'psychology',skill:'entry-discipline',version:'3.0.0-discipline',
    objective:'Do not chase extended candles. Wait for a new location, then execute only if structure still supports the trade.',
    lessons:Object.freeze([
      Object.freeze({prompt:'Price already expanded far beyond your planned entry. What is disciplined?',choices:Object.freeze(['Wait for a new setup or pass','Chase immediately','Increase size to compensate']),lesson:'Missing an entry is cheaper than changing the plan after price runs.'}),
      Object.freeze({prompt:'What happens to reward-to-risk when you chase far from invalidation?',choices:Object.freeze(['It often worsens','It always improves','It becomes irrelevant']),lesson:'Late entry often increases distance to logical invalidation while reducing remaining target distance.'}),
      Object.freeze({prompt:'If price never returns to your area?',choices:Object.freeze(['Accept no trade','Force an entry','Remove the stop']),lesson:'No trade is a valid outcome.'}),
    ]),
  }),
});

const GAME_IDS=Object.freeze(Object.keys(TRADING_GAME_DEFS));
const ACTIONS=new Set(['hold','buy','sell','close','risk0.5','risk1','risk2','risk5']);

function seedNumber(seed){let h=2166136261>>>0;for(const ch of String(seed)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h||1;}
function rand(state){let t=(state.rng+=0x6D2B79F5)>>>0;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;}
function clamp(n,min,max){return Math.max(min,Math.min(max,Number(n)||0));}
function round(n,d=5){const p=10**d;return Math.round(Number(n)*p)/p;}
function normalizeAction(input){const action=String(input||'hold').toLowerCase();return ACTIONS.has(action)?action:'hold';}

function candle(open,delta,wickUp,wickDown){
  const close=open+delta;
  return Object.freeze({open:round(open),high:round(Math.max(open,close)+Math.abs(wickUp)),low:round(Math.min(open,close)-Math.abs(wickDown)),close:round(close)});
}

function baseNoise(state,scale=.45){return (rand(state)-.5)*scale;}
function pushCandle(series,state,delta,vol=.35){const open=series.length?series[series.length-1].close:100;series.push(candle(open,delta+baseNoise(state,vol*.35),vol*(.35+rand(state)*.5),vol*(.35+rand(state)*.5)));}

function generateStructure(state){
  const series=[];
  for(let i=0;i<24;i++)pushCandle(series,state,.18,.42);
  for(let i=0;i<8;i++)pushCandle(series,state,-.16,.48);
  for(let i=0;i<7;i++)pushCandle(series,state,.34,.52);
  for(let i=0;i<5;i++)pushCandle(series,state,-.24,.44);
  for(let i=0;i<18;i++)pushCandle(series,state,.27,.50);
  for(let i=0;i<18;i++)pushCandle(series,state,-.05,.55);
  return {series,signals:[{start:39,end:45,side:'buy',label:'bullish BOS + pullback'}],chase:[{start:35,end:38}]};
}
function generateLiquidity(state){
  const series=[];
  for(let i=0;i<22;i++)pushCandle(series,state,.03,.38);
  for(let i=0;i<8;i++)pushCandle(series,state,-.03,.34);
  const priorLow=series.at(-1).low;
  for(let i=0;i<4;i++)pushCandle(series,state,-.10,.42);
  const open=series.at(-1).close;series.push(Object.freeze({open:round(open),high:round(open+.32),low:round(priorLow-1.05),close:round(open+.45)}));
  for(let i=0;i<5;i++)pushCandle(series,state,.28,.48);
  for(let i=0;i<18;i++)pushCandle(series,state,.22,.48);
  for(let i=0;i<18;i++)pushCandle(series,state,-.03,.55);
  return {series,signals:[{start:35,end:40,side:'buy',label:'sell-side sweep + reclaim'}],chase:[{start:34,end:34}]};
}
function generateBreakout(state){
  const series=[];
  for(let i=0;i<26;i++)pushCandle(series,state,(i%4<2?.08:-.08),.32);
  for(let i=0;i<6;i++)pushCandle(series,state,.36,.48);
  for(let i=0;i<4;i++)pushCandle(series,state,-.30,.42);
  for(let i=0;i<4;i++)pushCandle(series,state,.18,.38);
  for(let i=0;i<18;i++)pushCandle(series,state,.25,.47);
  for(let i=0;i<18;i++)pushCandle(series,state,-.04,.52);
  return {series,signals:[{start:35,end:40,side:'buy',label:'breakout retest acceptance'}],chase:[{start:28,end:32}]};
}
function generateRisk(state){
  const series=[];
  for(let i=0;i<15;i++)pushCandle(series,state,.10,.40);
  for(let i=0;i<8;i++)pushCandle(series,state,-.14,.45);
  for(let i=0;i<16;i++)pushCandle(series,state,.20,.46);
  for(let i=0;i<10;i++)pushCandle(series,state,-.24,.50);
  for(let i=0;i<18;i++)pushCandle(series,state,.19,.45);
  for(let i=0;i<13;i++)pushCandle(series,state,-.03,.50);
  return {series,signals:[{start:23,end:28,side:'buy',label:'controlled continuation'},{start:47,end:52,side:'sell',label:'controlled reversal'}],chase:[]};
}
function generateDiscipline(state){
  const series=[];
  for(let i=0;i<22;i++)pushCandle(series,state,.05,.34);
  for(let i=0;i<5;i++)pushCandle(series,state,.62,.62);
  for(let i=0;i<6;i++)pushCandle(series,state,-.30,.43);
  for(let i=0;i<18;i++)pushCandle(series,state,.24,.46);
  for(let i=0;i<24;i++)pushCandle(series,state,-.02,.52);
  return {series,signals:[{start:32,end:37,side:'buy',label:'post-expansion pullback'}],chase:[{start:24,end:29}]};
}

function generateScenario(gameId,state){
  if(gameId==='structure-trader')return generateStructure(state);
  if(gameId==='liquidity-sweep-trader')return generateLiquidity(state);
  if(gameId==='breakout-retest-trader')return generateBreakout(state);
  if(gameId==='risk-manager')return generateRisk(state);
  return generateDiscipline(state);
}

function trueRange(candle,previousClose){return Math.max(candle.high-candle.low,Math.abs(candle.high-previousClose),Math.abs(candle.low-previousClose));}
function atrAt(series,index,period=10){
  const start=Math.max(1,index-period+1);let total=0,count=0;
  for(let i=start;i<=index;i++){total+=trueRange(series[i],series[i-1].close);count+=1;}
  return count?total/count:Math.max(.5,series[index].high-series[index].low);
}
function signalAt(scenario,index){return scenario.signals.find((signal)=>index>=signal.start&&index<=signal.end)||null;}
function chaseAt(scenario,index){return scenario.chase.some((window)=>index>=window.start&&index<=window.end);}

export function createTradingState(gameId,seed='1'){
  if(!GAME_IDS.includes(gameId))throw new Error('Unknown trading simulator.');
  const state={
    gameId,rng:seedNumber(seed),ticks:0,status:'playing',index:10,balance:10000,equity:10000,peakEquity:10000,maxDrawdownPct:0,
    riskPct:1,openPosition:null,closedTrades:[],score:0,setupEntries:0,goodEntries:0,badEntries:0,chaseEntries:0,riskViolations:0,
    holds:0,patientHolds:0,totalSignals:0,signalWindowsUsed:new Set(),lastAction:'hold',events:[],
  };
  state.scenario=generateScenario(gameId,state);
  state.totalSignals=state.scenario.signals.length;
  return state;
}

function markToMarket(state,price){
  if(!state.openPosition){state.equity=state.balance;return;}
  const p=state.openPosition,move=p.side==='buy'?price-p.entry:p.entry-price;
  state.equity=state.balance+move*p.quantity;
  state.peakEquity=Math.max(state.peakEquity,state.equity);
  state.maxDrawdownPct=Math.max(state.maxDrawdownPct,(state.peakEquity-state.equity)/Math.max(1,state.peakEquity)*100);
}
function closePosition(state,price,reason='manual'){
  const p=state.openPosition;if(!p)return;
  const move=p.side==='buy'?price-p.entry:p.entry-price;
  const pnl=move*p.quantity;const r=p.riskDollars>0?pnl/p.riskDollars:0;
  state.balance+=pnl;state.equity=state.balance;
  state.closedTrades.push(Object.freeze({side:p.side,entry:round(p.entry),exit:round(price),pnl:round(pnl,2),r:round(r,2),reason,entryIndex:p.entryIndex,exitIndex:state.index,riskPct:p.riskPct,setup:p.setup||null}));
  state.score+=Math.round(r*90);state.openPosition=null;
}
function resolveStops(state,candle){
  const p=state.openPosition;if(!p)return;
  if(p.side==='buy'){
    if(candle.low<=p.stop){closePosition(state,p.stop,'stop');return;}
    if(candle.high>=p.target){closePosition(state,p.target,'target');return;}
  }else{
    if(candle.high>=p.stop){closePosition(state,p.stop,'stop');return;}
    if(candle.low<=p.target){closePosition(state,p.target,'target');return;}
  }
}
function openPosition(state,side,price){
  if(state.openPosition)return;
  const signal=signalAt(state.scenario,state.index),isGood=Boolean(signal&&signal.side===side),isChase=chaseAt(state.scenario,state.index);
  const atr=Math.max(.2,atrAt(state.scenario.series,state.index));
  const stopDistance=Math.max(.25,atr*1.15);const riskDollars=state.balance*(state.riskPct/100);const quantity=riskDollars/stopDistance;
  const stop=side==='buy'?price-stopDistance:price+stopDistance;const target=side==='buy'?price+stopDistance*2:price-stopDistance*2;
  state.openPosition={side,entry:price,stop,target,quantity,riskDollars,riskPct:state.riskPct,entryIndex:state.index,setup:signal?.label||null};
  state.setupEntries+=1;
  if(isGood){state.goodEntries+=1;state.score+=80;state.signalWindowsUsed.add(`${signal.start}:${signal.side}`);}else{state.badEntries+=1;state.score-=45;}
  if(isChase){state.chaseEntries+=1;state.score-=100;}
  if(state.riskPct>2){state.riskViolations+=1;state.score-=120;}
}

export function tickTradingGame(state,input='hold'){
  if(!state||state.status!=='playing')return state;
  const action=normalizeAction(input);state.lastAction=action;state.ticks+=1;
  const candle=state.scenario.series[state.index];
  if(!candle){state.status='complete';return state;}
  resolveStops(state,candle);markToMarket(state,candle.close);

  if(action.startsWith('risk')){
    const risk=Number(action.replace('risk',''));if([.5,1,2,5].includes(risk))state.riskPct=risk;
    if(risk>2)state.riskViolations+=1;
  }else if(action==='buy'||action==='sell'){
    if(state.openPosition)closePosition(state,candle.close,'reverse');
    openPosition(state,action,candle.close);
  }else if(action==='close')closePosition(state,candle.close,'manual');
  else{
    state.holds+=1;
    const signal=signalAt(state.scenario,state.index);
    if(!signal||chaseAt(state.scenario,state.index))state.patientHolds+=1;
  }

  markToMarket(state,candle.close);
  state.index+=1;
  if(state.index>=state.scenario.series.length){
    const last=state.scenario.series.at(-1);if(state.openPosition)closePosition(state,last.close,'end');state.status='complete';
  }
  if(state.balance<=7000){if(state.openPosition)closePosition(state,candle.close,'risk-stop');state.status='failed';}
  return state;
}

export function summarizeTradingState(state){
  const trades=state.closedTrades||[];const realizedR=trades.reduce((sum,t)=>sum+Number(t.r||0),0);
  const wins=trades.filter((t)=>t.pnl>0).length;const losses=trades.filter((t)=>t.pnl<0).length;
  const setupAccuracy=state.setupEntries?state.goodEntries/state.setupEntries:0;
  const patienceScore=state.holds?state.patientHolds/state.holds:1;
  const signalCapture=state.totalSignals?state.signalWindowsUsed.size/state.totalSignals:0;
  const completion=clamp((state.index-10)/Math.max(1,state.scenario.series.length-10),0,1);
  const riskScore=clamp(100-state.maxDrawdownPct*12-state.riskViolations*18-state.chaseEntries*10,0,100);
  const executionScore=clamp(setupAccuracy*55+signalCapture*30+Math.max(0,Math.min(15,realizedR*3)),0,100);
  const disciplineScore=clamp(patienceScore*70+(state.chaseEntries===0?30:0),0,100);
  const score=Math.max(0,Math.round(500+realizedR*120+executionScore*4+riskScore*3+disciplineScore*2-state.badEntries*45));
  return Object.freeze({
    gameId:state.gameId,status:state.status,ticks:state.ticks,score,completion:round(completion,4),balance:round(state.balance,2),equity:round(state.equity,2),
    pnl:round(state.balance-10000,2),realizedR:round(realizedR,2),wins,losses,trades:trades.length,goodEntries:state.goodEntries,badEntries:state.badEntries,
    chaseEntries:state.chaseEntries,riskViolations:state.riskViolations,maxDrawdownPct:round(state.maxDrawdownPct,2),setupAccuracy:round(setupAccuracy,4),
    signalCapture:round(signalCapture,4),patienceScore:round(patienceScore,4),riskScore:Math.round(riskScore),executionScore:Math.round(executionScore),disciplineScore:Math.round(disciplineScore),
    selectedRiskPct:state.riskPct,closedTrades:trades.slice(-12),
  });
}

export function replayTradingGame(gameId,seed,inputs=[]){
  const state=createTradingState(gameId,seed);const list=Array.isArray(inputs)?inputs.slice(0,TRADING_SIM_MAX_TICKS):[];
  for(const input of list){if(state.status!=='playing')break;tickTradingGame(state,input);}
  return summarizeTradingState(state);
}

export function getTradingGameDef(gameId){return TRADING_GAME_DEFS[String(gameId)]||null;}
export function tradingGameIds(){return [...GAME_IDS];}
