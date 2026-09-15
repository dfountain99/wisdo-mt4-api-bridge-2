import crypto from 'node:crypto';
import {
  TRADING_GAME_DEFS,
  TRADING_SIM_MAX_TICKS,
  TRADING_SIM_TICK_MS,
  TRADING_SIM_VERSION,
  getTradingGameDef,
  replayTradingGame,
  tradingGameIds,
} from '../public/app/world/arcade/trading-sim-core.js';
// Legacy imports exist only so an already-started Alpha 1/2 session can still finalize after deploy.
import {BULL_MAN_LESSONS,BULL_MAN_MAX_TICKS,BULL_MAN_TICK_MS,BULL_MAN_VERSION,replayBullMan} from '../public/app/world/arcade/bull-man-core.js';
import {getAlpha2GameDef,replayAlpha2Game} from '../public/app/world/arcade/alpha2-games-core.js';

export const ARCADE_BUILD='ARCADE-ALPHA3';

const GAME_ROWS=[
  ['structure-trader','Market Structure Trader','rookie','structure','Trade a candle replay using structure confirmation, pullback location, stops, targets, and real simulated P/L.','playable'],
  ['trend-continuation-trader','Trend Continuation Trader','rookie','trend','Read higher highs/higher lows or lower highs/lower lows and execute continuation only at valid locations.','planned'],
  ['liquidity-sweep-trader','Liquidity Sweep Trader','structure','liquidity','Trade simulated liquidity sweeps only after reclaim/confirmation instead of entering inside the sweep.','playable'],
  ['breakout-retest-trader','Breakout & Retest Trader','structure','breakouts','Trade actual breakout/retest candle sequences and distinguish acceptance from failed breakout behavior.','playable'],
  ['candle-confirmation-trader','Candle Confirmation Trader','rookie','candles','Use candle closes, wicks, engulfing behavior, and context to decide BUY, SELL, or PASS.','planned'],
  ['risk-manager','Risk Manager','risk','risk','Choose risk before entering and preserve simulated equity through changing stop distances and setups.','playable'],
  ['spread-cost-trader','Spread Cost Trader','execution','costs','Trade the same setup under changing spreads and decide when execution cost destroys the edge.','planned'],
  ['slippage-execution-trader','Slippage Execution Trader','execution','execution','Choose market, limit, or pass while simulated volatility changes fills and slippage.','planned'],
  ['stop-placement-trader','Stop Placement Trader','risk','risk','Place invalidation-based stops and size the position from the resulting stop distance.','planned'],
  ['margin-manager','Margin Manager','risk','margin','Manage multiple simulated positions while protecting free margin and preventing liquidation.','planned'],
  ['bos-execution-trader','BOS Execution Trader','structure','bos','Identify and trade legitimate Break of Structure events rather than every price penetration.','planned'],
  ['choch-reversal-trader','CHOCH Reversal Trader','structure','choch','Trade Change of Character only when reversal evidence matures.','planned'],
  ['fvg-entry-trader','FVG Entry Trader','structure','fvg','Choose which fair value gap has valid structure, location, and directional context.','planned'],
  ['fvg-continuation-trader','FVG Continuation Trader','structure','fvg','Manage continuation entries as price revisits and accepts a valid imbalance.','planned'],
  ['order-block-trader','Order Block Trader','structure','order-blocks','Select contextual order blocks and execute only after reaction/confirmation.','planned'],
  ['liquidity-pool-trader','Liquidity Pool Trader','structure','liquidity','Map equal highs/lows and choose which pool price is most likely to attack before a setup matures.','planned'],
  ['stop-hunt-reversal-trader','Stop Hunt Reversal Trader','structure','liquidity','Wait through a stop run and trade the confirmed reversal, not the first wick.','planned'],
  ['trend-strength-trader','Trend Strength Trader','structure','trend','Use sequence, displacement, and pullback depth to decide continuation versus exhaustion.','planned'],
  ['pullback-entry-trader','Pullback Entry Trader','structure','pullbacks','Wait for price to return to a planned location before entering a trend.','planned'],
  ['momentum-trader','Momentum Trader','execution','momentum','Trade acceleration and deceleration while avoiding entries after momentum exhaustion.','planned'],
  ['atr-stop-trader','ATR Stop Trader','risk','volatility','Adapt stop distance and size to changing ATR instead of using one fixed stop for every regime.','planned'],
  ['volatility-regime-trader','Volatility Regime Trader','risk','volatility','Change execution and risk behavior as the simulated market moves between compression and expansion.','planned'],
  ['news-risk-trader','News Risk Trader','execution','news','Manage or avoid trades around simulated high-impact releases and spread expansion.','planned'],
  ['economic-calendar-trader','Economic Calendar Trader','execution','news','Plan a full simulated session around event timing and decide when not to trade.','planned'],
  ['session-selection-trader','Session Selection Trader','execution','sessions','Choose the correct session for a setup based on liquidity, volatility, and instrument behavior.','planned'],
  ['london-open-trader','London Open Trader','structure','sessions','Trade post-Asia liquidity behavior around the London open using real candle scenarios.','planned'],
  ['new-york-reversal-trader','New York Reversal Trader','structure','sessions','Decide whether New York is continuing, sweeping, or reversing the London move.','planned'],
  ['support-resistance-trader','Support & Resistance Trader','rookie','levels','Trade level reactions, breaks, retests, and role reversals from simulated candles.','planned'],
  ['trendline-break-trader','Trendline Break Trader','structure','channels','Use trendline pressure plus structure confirmation instead of trading a line break by itself.','planned'],
  ['channel-trader','Channel Trader','structure','channels','Trade channel boundaries, failed breaks, and accepted breaks with defined invalidation.','planned'],
  ['fibonacci-pullback-trader','Fibonacci Pullback Trader','structure','fibonacci','Use Fibonacci as a location tool only when structure and invalidation support the entry.','planned'],
  ['golden-pocket-trader','Golden Pocket Trader','structure','fibonacci','Evaluate whether the golden pocket has confluence before risking simulated capital.','planned'],
  ['r-multiple-planner','R-Multiple Planner','risk','expectancy','Choose entries, stops, and targets to understand realized R and expectancy.','planned'],
  ['position-size-trader','Position Size Trader','risk','position-sizing','Calculate size from balance, risk percentage, stop distance, and instrument value before entry.','planned'],
  ['lot-size-trader','Lot Size Trader','risk','position-sizing','Translate risk dollars and stop distance into correct lot size across instruments.','planned'],
  ['compounding-manager','Compounding Manager','professional','compounding','Run a simulated account across many campaigns while balancing compounding and capital protection.','planned'],
  ['drawdown-manager','Drawdown Manager','risk','drawdown','Manage losing sequences and adapt risk without revenge-sizing the next trade.','planned'],
  ['equity-protection-trader','Equity Protection Trader','risk','profit-protection','Protect account equity across open positions without choking every trade prematurely.','planned'],
  ['profit-protection-trader','Profit Protection Trader','risk','profit-protection','Manage winners with structure-based protection so profitable trades do not become uncontrolled losses.','planned'],
  ['psychology-decision-trader','Psychology Decision Trader','psychology','psychology','Make actual trade/pass/size decisions while fear, greed, and recent outcomes pressure the plan.','planned'],
  ['entry-discipline-trader','Entry Discipline Trader','psychology','entry-discipline','Trade a real candle replay where chasing extended price is penalized and waiting for location is rewarded.','playable'],
  ['revenge-control-trader','Revenge Trade Control','psychology','revenge','Continue a simulated session after losses without increasing risk or forcing low-quality entries.','planned'],
  ['journal-review-challenge','Journal Review Challenge','professional','journaling','Review a simulated trading day, label mistakes, and propose the next-session rule changes.','planned'],
  ['trade-autopsy-challenge','Trade Autopsy Challenge','professional','review','Reconstruct entry, stop, target, context, execution, and outcome to diagnose why a trade failed.','planned'],
  ['chart-scenario-trader','Chart Scenario Trader','professional','probability','Trade incomplete candle sequences by choosing the highest-quality scenario instead of predicting certainty.','planned'],
  ['multi-timeframe-trader','Multi-Timeframe Trader','professional','multi-timeframe','Combine Daily/H4/H1 context with lower-timeframe execution and avoid timeframe conflict.','planned'],
  ['correlation-risk-manager','Correlation Risk Manager','professional','portfolio-risk','Manage simultaneous positions while detecting duplicated USD, gold, index, or FX exposure.','planned'],
  ['hedge-risk-manager','Hedge Risk Manager','professional','hedging','Use hedges only when they actually reduce portfolio risk after cost and correlation are considered.','planned'],
  ['liquidity-map-trader','Liquidity Map Trader','professional','liquidity','Build the liquidity map first, then trade the sweep/reclaim/continuation sequence.','planned'],
  ['championship-simulation','WISDO Trading Championship','championship','mastery','A multi-session verified trading simulation combining structure, risk, execution, psychology, and review.','planned'],
];

export const ARCADE_CATALOG=Object.freeze(GAME_ROWS.map(([id,name,floor,skill,description,status],index)=>Object.freeze({id,name,floor,skill,description,status,number:index+1,rewardMode:'skill_verified',wagering:false,gameType:'trading_simulation'})));

function clean(value,max=200){return String(value??'').replace(/\u0000/g,'').trim().slice(0,max);}
function asBool(value){return value===true||['1','true','yes','on'].includes(String(value||'').toLowerCase());}
function integer(value,min,max,fallback=0){const n=Math.trunc(Number(value));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function gameById(id){return ARCADE_CATALOG.find((game)=>game.id===clean(id,80))||null;}

const ANSWER_KEYS=Object.freeze({
  'structure-trader':Object.freeze([0,0,0]),
  'liquidity-sweep-trader':Object.freeze([0,0,0]),
  'breakout-retest-trader':Object.freeze([0,0,0]),
  'risk-manager':Object.freeze([0,0,0]),
  'entry-discipline-trader':Object.freeze([0,0,0]),
  // legacy-only keys
  'bull-man':Object.freeze([1,0,1]),
  'liquidity-ghosts':Object.freeze([1,0,1]),
  'breakout-breaker':Object.freeze([0,1,1]),
  'risk-runner':Object.freeze([0,1,1]),
  'fomo-frogger':Object.freeze([1,1,1]),
});

function legacyVerifier(gameId){
  if(gameId==='bull-man')return{gameId,version:BULL_MAN_VERSION,tickMs:BULL_MAN_TICK_MS,maxTicks:BULL_MAN_MAX_TICKS,minTicks:20,lessons:BULL_MAN_LESSONS,replay:(seed,inputs)=>replayBullMan(seed,inputs),legacy:true};
  const def=getAlpha2GameDef(gameId);if(!def)return null;
  return{gameId,version:def.version,tickMs:def.tickMs,maxTicks:def.maxTicks,minTicks:def.minTicks,lessons:def.lessons,replay:(seed,inputs)=>replayAlpha2Game(gameId,seed,inputs),legacy:true};
}
function verifierFor(gameId){
  const def=getTradingGameDef(gameId);
  if(def)return{gameId,version:def.version,tickMs:TRADING_SIM_TICK_MS,maxTicks:TRADING_SIM_MAX_TICKS,minTicks:25,lessons:def.lessons,replay:(seed,inputs)=>replayTradingGame(gameId,seed,inputs),objective:def.objective,gameType:'trading_simulation'};
  return legacyVerifier(gameId);
}

export function scoreArcadeEducation(gameId,result={},answers=[]){
  const key=ANSWER_KEYS[gameId];if(!key)throw new Error('No education verifier exists for this trading game.');
  const answerList=Array.isArray(answers)?answers:[];const correct=key.reduce((sum,expected,index)=>sum+(Number(answerList[index])===expected?1:0),0);
  const knowledge=Math.round(correct/key.length*100);
  let execution,riskDiscipline,consistency;
  if(Number.isFinite(Number(result.executionScore))){
    execution=Math.round(Math.max(0,Math.min(100,Number(result.executionScore))));
    riskDiscipline=Math.round(Math.max(0,Math.min(100,Number(result.riskScore))));
    consistency=Math.round(Math.max(0,Math.min(100,Number(result.disciplineScore))));
  }else{
    execution=Math.round(Math.max(0,Math.min(1,Number(result.completion||0)))*100);
    const hits=Math.max(0,Number(result.hits||0)),mistakes=Math.max(0,Number(result.mistakes||0));
    riskDiscipline=Math.max(0,Math.min(100,100-hits*18-mistakes*9));
    if(Number.isFinite(Number(result.equity)))riskDiscipline=Math.round(Math.max(0,Math.min(100,Number(result.equity))));
    consistency=Math.max(0,Math.min(100,Math.round((execution+riskDiscipline)/2)));
  }
  const weighted=Math.round(knowledge*.30+execution*.30+riskDiscipline*.25+consistency*.15);
  return Object.freeze({knowledge,execution,riskDiscipline,consistency,weighted,correctAnswers:correct,totalQuestions:key.length});
}
export function scoreBullManEducation(result={},answers=[]){return scoreArcadeEducation('bull-man',result,answers);}

export function arcadeEconomyPolicy(env=process.env){
  const centsRaw=Number(env.WISDO_CULTURE_COIN_USD_CENTS);
  return Object.freeze({currency:'CULTURE_COIN',wagering:false,serverAuthoritative:true,dailyEarnCap:integer(env.WISDO_ARCADE_DAILY_COIN_CAP,1,100000,60),maxCoinsPerSession:integer(env.WISDO_ARCADE_MAX_COIN_PER_SESSION,1,1000,15),redemptionEnabled:asBool(env.WISDO_CULTURE_COIN_REDEMPTION_ENABLED),usdCentsPerCoin:Number.isFinite(centsRaw)&&centsRaw>0?integer(centsRaw,1,100000,null):null,notice:'Culture Coin rewards are earned from verified trading-simulation skill and are never wagered. Cash redemption is available only when an authorized redemption policy is explicitly enabled.'});
}

export function computeArcadeReward(gameId,result,answers,policy=arcadeEconomyPolicy({})){
  const education=scoreArcadeEducation(gameId,result,answers),verifier=verifierFor(gameId);
  const eligible=Number(result?.ticks||0)>=Number(verifier?.minTicks||20)&&education.weighted>=40;
  let coins=eligible?Math.floor(education.weighted/10):0;
  if(Number.isFinite(Number(result?.realizedR)))coins+=Math.min(3,Math.floor(Math.max(0,Number(result.realizedR))));
  if(Number(result?.riskScore||0)>=90)coins+=2;
  else if(result?.status==='won')coins+=2;
  coins=Math.max(0,Math.min(Number(policy.maxCoinsPerSession||15),coins));
  return Object.freeze({eligible,coins,education});
}
export function computeBullManReward(result,answers,policy=arcadeEconomyPolicy({})){return computeArcadeReward('bull-man',result,answers,policy);}

export class WisdoArcadeService{
  constructor({pool,logger=console,env=process.env}={}){if(!pool?.query)throw new TypeError('WisdoArcadeService requires a PostgreSQL pool.');this.pool=pool;this.logger=logger;this.env=env;this.schemaPromise=null;}
  policy(){return arcadeEconomyPolicy(this.env);} catalog(){return ARCADE_CATALOG;} game(id){return gameById(id);}
  async ensureSchema(){
    if(this.schemaPromise)return this.schemaPromise;
    this.schemaPromise=this.pool.query(`
      CREATE TABLE IF NOT EXISTS wisdo_arcade_sessions (session_id UUID PRIMARY KEY,user_id TEXT NOT NULL,game_id TEXT NOT NULL,game_version TEXT NOT NULL,seed BIGINT NOT NULL,status TEXT NOT NULL DEFAULT 'active',replay JSONB NOT NULL DEFAULT '{}'::jsonb,result JSONB NOT NULL DEFAULT '{}'::jsonb,culture_coin_awarded INTEGER NOT NULL DEFAULT 0,started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ NOT NULL,finalized_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE INDEX IF NOT EXISTS idx_wisdo_arcade_sessions_user ON wisdo_arcade_sessions(user_id,created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_wisdo_arcade_sessions_game ON wisdo_arcade_sessions(game_id,status,created_at DESC);
      CREATE TABLE IF NOT EXISTS wisdo_culture_coin_ledger (ledger_id UUID PRIMARY KEY,user_id TEXT NOT NULL,source_type TEXT NOT NULL,source_id TEXT NOT NULL,amount INTEGER NOT NULL,metadata JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(source_type,source_id));
      CREATE INDEX IF NOT EXISTS idx_wisdo_culture_coin_user ON wisdo_culture_coin_ledger(user_id,created_at DESC);
    `).catch((error)=>{this.schemaPromise=null;throw error;});return this.schemaPromise;
  }
  async startSession(userId,gameId='structure-trader'){
    await this.ensureSchema();const game=gameById(gameId);if(!game){const error=new Error('Trading game not found.');error.statusCode=404;throw error;}if(game.status!=='playable'){const error=new Error(`${game.name} is in the trading-game roadmap but is not playable in this build yet.`);error.statusCode=409;throw error;}
    const verifier=verifierFor(game.id);if(!verifier){const error=new Error('This trading game does not have a server verifier.');error.statusCode=409;throw error;}
    const sessionId=crypto.randomUUID(),seed=crypto.randomInt(1,2_000_000_000),expiresAt=new Date(Date.now()+45*60*1000);
    const result=await this.pool.query(`INSERT INTO wisdo_arcade_sessions(session_id,user_id,game_id,game_version,seed,expires_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING session_id,user_id,game_id,game_version,seed,status,started_at,expires_at`,[sessionId,clean(userId,200),game.id,verifier.version,seed,expiresAt]);
    return {...result.rows[0],build:ARCADE_BUILD,gameType:'trading_simulation',tickMs:verifier.tickMs,maxTicks:verifier.maxTicks,minTicks:verifier.minTicks,lessons:verifier.lessons,objective:verifier.objective||game.description,policy:this.policy()};
  }
  async finishSession(userId,sessionId,payload={}){
    await this.ensureSchema();const client=await this.pool.connect();
    try{
      await client.query('BEGIN');const selected=await client.query(`SELECT * FROM wisdo_arcade_sessions WHERE session_id=$1 AND user_id=$2 FOR UPDATE`,[clean(sessionId,100),clean(userId,200)]);const row=selected.rows[0];
      if(!row){const error=new Error('Arcade session not found.');error.statusCode=404;throw error;}
      if(row.status==='finalized'){await client.query('COMMIT');return{sessionId:row.session_id,gameId:row.game_id,status:row.status,result:row.result,cultureCoinAwarded:row.culture_coin_awarded,idempotent:true,policy:this.policy()};}
      if(new Date(row.expires_at).getTime()<Date.now()){await client.query(`UPDATE wisdo_arcade_sessions SET status='expired',updated_at=NOW() WHERE session_id=$1`,[row.session_id]);await client.query('COMMIT');const error=new Error('Arcade session expired.');error.statusCode=410;throw error;}
      const verifier=verifierFor(row.game_id);if(!verifier){const error=new Error('This session does not have a verifier in the current build.');error.statusCode=409;throw error;}
      const inputs=Array.isArray(payload.inputs)?payload.inputs.slice(0,verifier.maxTicks).map((x)=>clean(x,20).toLowerCase()):[];const answers=Array.isArray(payload.quizAnswers)?payload.quizAnswers.slice(0,verifier.lessons.length).map((x)=>integer(x,-1,10,-1)):[];
      if(inputs.length<verifier.minTicks){const error=new Error('Not enough verified market-replay decisions to finalize this session.');error.statusCode=400;throw error;}
      const elapsedMs=Date.now()-new Date(row.started_at).getTime();const perTickFloor=verifier.legacy?Math.max(24,Math.min(70,Number(verifier.tickMs||100)*.42)):110;const minimumElapsedMs=Math.min(24000,Math.max(2500,Math.round(inputs.length*perTickFloor)));
      if(elapsedMs<minimumElapsedMs){const error=new Error('Trading simulation completed faster than the verification envelope allows.');error.statusCode=422;throw error;}
      const verified=verifier.replay(String(row.seed),inputs),policy=this.policy(),reward=computeArcadeReward(row.game_id,verified,answers,policy);
      const daily=await client.query(`SELECT COALESCE(SUM(amount),0)::int AS earned FROM wisdo_culture_coin_ledger WHERE user_id=$1 AND source_type='arcade' AND amount>0 AND created_at>=date_trunc('day',NOW())`,[clean(userId,200)]);
      const already=Number(daily.rows[0]?.earned||0),remaining=Math.max(0,policy.dailyEarnCap-already),award=Math.min(reward.coins,remaining),digest=crypto.createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
      const result={verified,education:reward.education,antiCheat:{serverReplay:true,gameVersion:row.game_version,inputDigest:digest,inputTicks:inputs.length,elapsedMs,minimumElapsedMs},reward:{rawCoins:reward.coins,dailyBefore:already,dailyRemainingAfter:Math.max(0,remaining-award),capped:award<reward.coins}};
      if(award>0)await client.query(`INSERT INTO wisdo_culture_coin_ledger(ledger_id,user_id,source_type,source_id,amount,metadata) VALUES($1,$2,'arcade',$3,$4,$5::jsonb) ON CONFLICT(source_type,source_id) DO NOTHING`,[crypto.randomUUID(),clean(userId,200),row.session_id,award,JSON.stringify({gameId:row.game_id,gameVersion:row.game_version,score:verified.score,weighted:reward.education.weighted,realizedR:verified.realizedR??null,riskScore:verified.riskScore??null})]);
      await client.query(`UPDATE wisdo_arcade_sessions SET status='finalized',replay=$2::jsonb,result=$3::jsonb,culture_coin_awarded=$4,finalized_at=NOW(),updated_at=NOW() WHERE session_id=$1`,[row.session_id,JSON.stringify({inputDigest:digest,inputTicks:inputs.length}),JSON.stringify(result),award]);await client.query('COMMIT');
      return{sessionId:row.session_id,gameId:row.game_id,status:'finalized',result,cultureCoinAwarded:award,idempotent:false,policy};
    }catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}finally{client.release();}
  }
  async profile(userId){
    await this.ensureSchema();const [ledger,sessions]=await Promise.all([
      this.pool.query(`SELECT COALESCE(SUM(amount),0)::int AS balance,COALESCE(SUM(amount) FILTER(WHERE source_type='arcade' AND created_at>=date_trunc('day',NOW())),0)::int AS earned_today FROM wisdo_culture_coin_ledger WHERE user_id=$1`,[clean(userId,200)]),
      this.pool.query(`SELECT COUNT(*)::int AS sessions,COUNT(*) FILTER(WHERE status='finalized')::int AS finalized,COALESCE(MAX((result->'verified'->>'score')::int),0)::int AS best_score FROM wisdo_arcade_sessions WHERE user_id=$1`,[clean(userId,200)]),
    ]);
    return{cultureCoinBalance:Number(ledger.rows[0]?.balance||0),earnedToday:Number(ledger.rows[0]?.earned_today||0),sessions:Number(sessions.rows[0]?.sessions||0),finalized:Number(sessions.rows[0]?.finalized||0),bestArcadeScore:Number(sessions.rows[0]?.best_score||0),policy:this.policy()};
  }
  async leaderboard(gameId='structure-trader',limit=20){await this.ensureSchema();const game=gameById(gameId);if(!game){const error=new Error('Trading game not found.');error.statusCode=404;throw error;}const result=await this.pool.query(`SELECT user_id,MAX((result->'verified'->>'score')::int)::int AS score,MAX((result->'education'->>'weighted')::int)::int AS mastery,COUNT(*)::int AS sessions FROM wisdo_arcade_sessions WHERE game_id=$1 AND status='finalized' GROUP BY user_id ORDER BY score DESC,mastery DESC LIMIT $2`,[game.id,integer(limit,1,100,20)]);return result.rows.map((row)=>({player:`OP-${crypto.createHash('sha256').update(String(row.user_id)).digest('hex').slice(0,8).toUpperCase()}`,score:Number(row.score||0),mastery:Number(row.mastery||0),sessions:Number(row.sessions||0)}));}
  async health(){await this.ensureSchema();const result=await this.pool.query(`SELECT COUNT(*)::int AS sessions FROM wisdo_arcade_sessions`);return{ok:true,service:'wisdo-arcade',build:ARCADE_BUILD,tradingSimVersion:TRADING_SIM_VERSION,gameType:'trading_simulation',catalogGames:ARCADE_CATALOG.length,playableGames:ARCADE_CATALOG.filter((g)=>g.status==='playable').length,playableIds:tradingGameIds(),sessions:Number(result.rows[0]?.sessions||0),policy:this.policy()};}
}
