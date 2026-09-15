import crypto from 'node:crypto';
import {
  BULL_MAN_LESSONS,
  BULL_MAN_MAX_TICKS,
  BULL_MAN_TICK_MS,
  BULL_MAN_VERSION,
  replayBullMan,
} from '../public/app/world/arcade/bull-man-core.js';

const GAME_ROWS = [
  ['bull-man','Bull-Man','rookie','structure','Pac-Man style liquidity maze. Read structure, collect liquidity, avoid trading-behavior ghosts.','playable'],
  ['bear-man','Bear-Man','rookie','structure','Navigate bearish structure, lower highs, lower lows, and squeeze risk.','planned'],
  ['liquidity-ghosts','Liquidity Ghosts','structure','liquidity','Learn stop hunts, news spikes, spread expansion, and FOMO through distinct ghost behaviors.','planned'],
  ['breakout-breaker','Breakout Breaker','structure','breakouts','Brick-breaker where support and resistance must be broken with valid confirmation.','planned'],
  ['candle-stack','Candle Stack','rookie','candles','Tetris-like candle sequencing that teaches price-action patterns in context.','planned'],
  ['risk-runner','Risk Runner','risk','risk','Endless runner where account survival depends on correct risk sizing.','planned'],
  ['spread-sprint','Spread Sprint','execution','costs','Race through instruments while spread changes alter speed and execution cost.','planned'],
  ['slippage-speedway','Slippage Speedway','execution','execution','Race market conditions and learn market orders, limits, and slippage.','planned'],
  ['stop-loss-defender','Stop-Loss Defender','risk','risk','Tower defense where stop placement protects account equity.','planned'],
  ['margin-fortress','Margin Fortress','risk','margin','Defend equity while every deployed unit consumes margin.','planned'],
  ['bos-hunter','BOS Hunter','structure','bos','Identify legitimate Break of Structure gates while moving through price.','planned'],
  ['choch-chase','CHOCH Chase','structure','choch','React to Change of Character before the market path switches direction.','planned'],
  ['fvg-finder','FVG Finder','structure','fvg','Locate relevant fair value gaps before the timer expires.','planned'],
  ['fvg-portal','FVG Portal','structure','fvg','Use valid FVGs as platform-game portals; bad imbalances become traps.','planned'],
  ['order-block-raiders','Order Block Raiders','structure','order-blocks','Dungeon exploration where contextual order blocks contain the real treasure.','planned'],
  ['liquidity-lake','Liquidity Lake','structure','liquidity','Fishing game that teaches where liquidity clusters around highs, lows, and ranges.','planned'],
  ['stop-hunt-survival','Stop Hunt Survival','structure','liquidity','Survive sweeps by waiting for confirmation instead of entering first.','planned'],
  ['trend-surfer','Trend Surfer','structure','trend','Ride momentum waves without entering at exhaustion.','planned'],
  ['pullback-surfer','Pullback Surfer','structure','pullbacks','Wait for the pullback instead of chasing the initial expansion.','planned'],
  ['market-rhythm','Market Rhythm','execution','momentum','Rhythm game using acceleration, deceleration, burst, and exhaustion.','planned'],
  ['atr-dash','ATR Dash','risk','volatility','Obstacle distances change with ATR so fixed-risk thinking becomes visual.','planned'],
  ['volatility-volcano','Volatility Volcano','risk','volatility','Manage exposure as market pressure builds from volatility and liquidity.','planned'],
  ['news-ninja','News Ninja','execution','news','Avoid economic-news shockwaves while learning event risk.','planned'],
  ['economic-calendar-command','Economic Calendar Command','execution','news','Plan a trading day around high-, medium-, and low-impact events.','planned'],
  ['session-racer','Session Racer','execution','sessions','Race Asian, London, and New York session characteristics.','planned'],
  ['london-breakout-escape','London Breakout Escape','structure','sessions','Navigate Asia compression and London expansion.','planned'],
  ['new-york-reversal','New York Reversal','structure','sessions','Determine whether New York continues, sweeps, or reverses London.','planned'],
  ['support-resistance-pong','Support & Resistance Pong','rookie','levels','Pong where levels break, retest, and flip roles.','planned'],
  ['trendline-tennis','Trendline Tennis','structure','channels','Play channel touches, breaks, and retests as a tennis match.','planned'],
  ['channel-racer','Channel Racer','structure','channels','Drive within price channels and switch modes on confirmed breaks.','planned'],
  ['fib-climber','Fib Climber','structure','fibonacci','Climb retracement ledges and continuation zones.','planned'],
  ['golden-pocket-quest','Golden Pocket Quest','structure','fibonacci','Find high-quality retracement zones only when structure supports them.','planned'],
  ['r-multiple-rescue','R-Multiple Rescue','risk','expectancy','Choose rescue missions by risk cost and expected reward.','planned'],
  ['position-size-lab','Position Size Lab','risk','position-sizing','Combine balance, risk percent, and stop distance to create correct size.','planned'],
  ['lot-size-launcher','Lot Size Launcher','risk','position-sizing','Launch based on balance, stop distance, and risk; oversizing overshoots.','planned'],
  ['compound-kingdom','Compound Kingdom','professional','compounding','City builder balancing reinvestment, withdrawal, and drawdown.','planned'],
  ['drawdown-dungeon','Drawdown Dungeon','risk','drawdown','Roguelike where health is equity and survival requires drawdown control.','planned'],
  ['equity-shield','Equity Shield','risk','profit-protection','Protect floating profit before adverse movement returns.','planned'],
  ['profit-lock-pinball','Profit Lock Pinball','risk','profit-protection','Secure profit checkpoints while deciding whether to continue the run.','planned'],
  ['psychology-boss-fight','Trader Psychology Boss Fight','psychology','psychology','Fight Fear, Greed, Revenge, FOMO, Overconfidence, and Hesitation.','planned'],
  ['fomo-frogger','FOMO Frogger','psychology','fomo','Cross candle traffic by waiting for confirmation instead of chasing.','planned'],
  ['revenge-trade-rampage','Revenge Trade Rampage','psychology','revenge','Rapid emotional entries strengthen enemies; discipline weakens them.','planned'],
  ['journal-detective','Journal Detective','professional','journaling','Investigate losing weeks using entries, exits, screenshots, and notes.','planned'],
  ['trade-autopsy','Trade Autopsy','professional','review','Diagnose why a finished trade failed using structure, timing, stop, and execution.','planned'],
  ['chart-detective','Chart Detective','professional','probability','Study partial charts and choose the highest-probability scenario.','planned'],
  ['multi-timeframe-tower','Multi-Timeframe Tower','professional','multi-timeframe','Collect higher-timeframe clues before taking lower-timeframe entries.','planned'],
  ['correlation-crisis','Correlation Crisis','professional','portfolio-risk','Solve linked-market gears and identify duplicated exposure.','planned'],
  ['hedge-maze','Hedge Maze','professional','hedging','Move linked positions through a maze and learn why hedging is not automatically safe.','planned'],
  ['market-maker-maze','Market Maker Maze','professional','liquidity','Anticipate which liquidity pool is attacked, survive the sweep, then act.','planned'],
  ['arcade-championship','WISDO Trading Arcade Championship','championship','mastery','Seasonal rotation across arcade disciplines using verified skill scoring.','planned'],
];

export const ARCADE_CATALOG = Object.freeze(GAME_ROWS.map(([id,name,floor,skill,description,status],index)=>Object.freeze({
  id,name,floor,skill,description,status,number:index+1,
  rewardMode:'skill_verified', wagering:false,
})));

function clean(value,max=200){return String(value??'').replace(/\u0000/g,'').trim().slice(0,max);}
function asBool(value){return value===true||['1','true','yes','on'].includes(String(value||'').toLowerCase());}
function integer(value,min,max,fallback=0){const n=Math.trunc(Number(value));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function gameById(id){return ARCADE_CATALOG.find((game)=>game.id===clean(id,80))||null;}

const BULL_MAN_ANSWER_KEY = Object.freeze([1,0,1]);

export function scoreBullManEducation(result={},answers=[]){
  const answerList=Array.isArray(answers)?answers:[];
  const correct=BULL_MAN_ANSWER_KEY.reduce((sum,expected,index)=>sum+(Number(answerList[index])===expected?1:0),0);
  const knowledge=Math.round(correct/BULL_MAN_ANSWER_KEY.length*100);
  const execution=Math.round(Math.max(0,Math.min(1,Number(result.completion||0)))*100);
  const riskDiscipline=Math.max(0,Math.min(100,100-Number(result.hits||0)*28+(Number(result.lives||0)>=3?8:0)));
  const consistency=Math.max(0,Math.min(100,Math.round((execution+riskDiscipline)/2)));
  const weighted=Math.round(knowledge*.35+execution*.30+riskDiscipline*.25+consistency*.10);
  return Object.freeze({knowledge,execution,riskDiscipline,consistency,weighted,correctAnswers:correct,totalQuestions:BULL_MAN_ANSWER_KEY.length});
}

export function arcadeEconomyPolicy(env=process.env){
  const centsRaw=Number(env.WISDO_CULTURE_COIN_USD_CENTS);
  return Object.freeze({
    currency:'CULTURE_COIN',
    wagering:false,
    serverAuthoritative:true,
    dailyEarnCap:integer(env.WISDO_ARCADE_DAILY_COIN_CAP,1,100000,60),
    maxCoinsPerSession:integer(env.WISDO_ARCADE_MAX_COIN_PER_SESSION,1,1000,15),
    redemptionEnabled:asBool(env.WISDO_CULTURE_COIN_REDEMPTION_ENABLED),
    usdCentsPerCoin:Number.isFinite(centsRaw)&&centsRaw>0?integer(centsRaw,1,100000,null):null,
    notice:'Culture Coin arcade rewards are skill-earned and never wagered. Cash/redemption value is available only when an authorized redemption policy is explicitly enabled.',
  });
}

export function computeBullManReward(result,answers,policy=arcadeEconomyPolicy({})){
  const education=scoreBullManEducation(result,answers);
  const eligible=Number(result?.ticks||0)>=20&&education.weighted>=35;
  let coins=eligible?Math.floor(education.weighted/10):0;
  if(result?.status==='won')coins+=3;
  coins+=Math.floor(Math.max(0,Math.min(1,Number(result?.completion||0)))*3);
  coins=Math.max(0,Math.min(Number(policy.maxCoinsPerSession||15),coins));
  return Object.freeze({eligible,coins,education});
}

export class WisdoArcadeService{
  constructor({pool,logger=console,env=process.env}={}){
    if(!pool?.query)throw new TypeError('WisdoArcadeService requires a PostgreSQL pool.');
    this.pool=pool;this.logger=logger;this.env=env;this.schemaPromise=null;
  }
  policy(){return arcadeEconomyPolicy(this.env);}
  catalog(){return ARCADE_CATALOG;}
  async ensureSchema(){
    if(this.schemaPromise)return this.schemaPromise;
    this.schemaPromise=this.pool.query(`
      CREATE TABLE IF NOT EXISTS wisdo_arcade_sessions (
        session_id UUID PRIMARY KEY,
        user_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        game_version TEXT NOT NULL,
        seed BIGINT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        replay JSONB NOT NULL DEFAULT '{}'::jsonb,
        result JSONB NOT NULL DEFAULT '{}'::jsonb,
        culture_coin_awarded INTEGER NOT NULL DEFAULT 0,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        finalized_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_wisdo_arcade_sessions_user ON wisdo_arcade_sessions(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_wisdo_arcade_sessions_game ON wisdo_arcade_sessions(game_id, status, created_at DESC);
      CREATE TABLE IF NOT EXISTS wisdo_culture_coin_ledger (
        ledger_id UUID PRIMARY KEY,
        user_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(source_type, source_id)
      );
      CREATE INDEX IF NOT EXISTS idx_wisdo_culture_coin_user ON wisdo_culture_coin_ledger(user_id, created_at DESC);
    `).catch((error)=>{this.schemaPromise=null;throw error;});
    return this.schemaPromise;
  }
  async startSession(userId,gameId='bull-man'){
    await this.ensureSchema();
    const game=gameById(gameId);
    if(!game){const error=new Error('Arcade game not found.');error.statusCode=404;throw error;}
    if(game.status!=='playable'){const error=new Error(`${game.name} is in the 50-game roadmap but is not playable in this build yet.`);error.statusCode=409;throw error;}
    const sessionId=crypto.randomUUID();
    const seed=crypto.randomInt(1,2_000_000_000);
    const expiresAt=new Date(Date.now()+30*60*1000);
    const result=await this.pool.query(`INSERT INTO wisdo_arcade_sessions(session_id,user_id,game_id,game_version,seed,expires_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING session_id,user_id,game_id,game_version,seed,status,started_at,expires_at`,[sessionId,clean(userId,200),game.id,BULL_MAN_VERSION,seed,expiresAt]);
    return {...result.rows[0],tickMs:BULL_MAN_TICK_MS,maxTicks:BULL_MAN_MAX_TICKS,lessons:BULL_MAN_LESSONS,policy:this.policy()};
  }
  async finishSession(userId,sessionId,payload={}){
    await this.ensureSchema();
    const inputs=Array.isArray(payload.inputs)?payload.inputs.slice(0,BULL_MAN_MAX_TICKS).map((x)=>clean(x,10).toLowerCase()):[];
    const answers=Array.isArray(payload.quizAnswers)?payload.quizAnswers.slice(0,BULL_MAN_LESSONS.length).map((x)=>integer(x,-1,10,-1)):[];
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      const selected=await client.query(`SELECT * FROM wisdo_arcade_sessions WHERE session_id=$1 AND user_id=$2 FOR UPDATE`,[clean(sessionId,100),clean(userId,200)]);
      const row=selected.rows[0];
      if(!row){const error=new Error('Arcade session not found.');error.statusCode=404;throw error;}
      if(row.status==='finalized'){
        await client.query('COMMIT');
        return {sessionId:row.session_id,gameId:row.game_id,status:row.status,result:row.result,cultureCoinAwarded:row.culture_coin_awarded,idempotent:true,policy:this.policy()};
      }
      if(new Date(row.expires_at).getTime()<Date.now()){
        await client.query(`UPDATE wisdo_arcade_sessions SET status='expired',updated_at=NOW() WHERE session_id=$1`,[row.session_id]);
        await client.query('COMMIT');
        const error=new Error('Arcade session expired.');error.statusCode=410;throw error;
      }
      if(row.game_id!=='bull-man'){const error=new Error('This game does not have a verifier in the current build.');error.statusCode=409;throw error;}
      if(inputs.length<20){const error=new Error('Not enough verified gameplay ticks to finalize this session.');error.statusCode=400;throw error;}
      const elapsedMs=Date.now()-new Date(row.started_at).getTime();
      const minimumElapsedMs=Math.min(12_000,Math.max(2_000,inputs.length*55));
      if(elapsedMs<minimumElapsedMs){const error=new Error('Gameplay completed faster than the verification envelope allows.');error.statusCode=422;throw error;}
      const verified=replayBullMan(String(row.seed),inputs);
      const policy=this.policy();
      const reward=computeBullManReward(verified,answers,policy);
      const daily=await client.query(`SELECT COALESCE(SUM(amount),0)::int AS earned FROM wisdo_culture_coin_ledger WHERE user_id=$1 AND source_type='arcade' AND amount>0 AND created_at>=date_trunc('day',NOW())`,[clean(userId,200)]);
      const already=Number(daily.rows[0]?.earned||0);
      const remaining=Math.max(0,policy.dailyEarnCap-already);
      const award=Math.min(reward.coins,remaining);
      const digest=crypto.createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
      const result={verified,education:reward.education,antiCheat:{serverReplay:true,inputDigest:digest,inputTicks:inputs.length,elapsedMs,minimumElapsedMs},reward:{rawCoins:reward.coins,dailyBefore:already,dailyRemainingAfter:Math.max(0,remaining-award),capped:award<reward.coins}};
      if(award>0){
        await client.query(`INSERT INTO wisdo_culture_coin_ledger(ledger_id,user_id,source_type,source_id,amount,metadata) VALUES($1,$2,'arcade',$3,$4,$5::jsonb) ON CONFLICT(source_type,source_id) DO NOTHING`,[crypto.randomUUID(),clean(userId,200),row.session_id,award,JSON.stringify({gameId:row.game_id,gameVersion:row.game_version,score:verified.score,weighted:reward.education.weighted})]);
      }
      await client.query(`UPDATE wisdo_arcade_sessions SET status='finalized',replay=$2::jsonb,result=$3::jsonb,culture_coin_awarded=$4,finalized_at=NOW(),updated_at=NOW() WHERE session_id=$1`,[row.session_id,JSON.stringify({inputDigest:digest,inputTicks:inputs.length}),JSON.stringify(result),award]);
      await client.query('COMMIT');
      return {sessionId:row.session_id,gameId:row.game_id,status:'finalized',result,cultureCoinAwarded:award,idempotent:false,policy};
    }catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}finally{client.release();}
  }
  async profile(userId){
    await this.ensureSchema();
    const [ledger,sessions]=await Promise.all([
      this.pool.query(`SELECT COALESCE(SUM(amount),0)::int AS balance,COALESCE(SUM(amount) FILTER(WHERE source_type='arcade' AND created_at>=date_trunc('day',NOW())),0)::int AS earned_today FROM wisdo_culture_coin_ledger WHERE user_id=$1`,[clean(userId,200)]),
      this.pool.query(`SELECT COUNT(*)::int AS sessions,COUNT(*) FILTER(WHERE status='finalized')::int AS finalized,COALESCE(MAX((result->'verified'->>'score')::int),0)::int AS best_score FROM wisdo_arcade_sessions WHERE user_id=$1`,[clean(userId,200)]),
    ]);
    return {cultureCoinBalance:Number(ledger.rows[0]?.balance||0),earnedToday:Number(ledger.rows[0]?.earned_today||0),sessions:Number(sessions.rows[0]?.sessions||0),finalized:Number(sessions.rows[0]?.finalized||0),bestBullManScore:Number(sessions.rows[0]?.best_score||0),policy:this.policy()};
  }
  async leaderboard(gameId='bull-man',limit=20){
    await this.ensureSchema();
    const game=gameById(gameId);if(!game){const error=new Error('Arcade game not found.');error.statusCode=404;throw error;}
    const result=await this.pool.query(`SELECT user_id,MAX((result->'verified'->>'score')::int)::int AS score,MAX((result->'education'->>'weighted')::int)::int AS mastery,COUNT(*)::int AS sessions FROM wisdo_arcade_sessions WHERE game_id=$1 AND status='finalized' GROUP BY user_id ORDER BY score DESC,mastery DESC LIMIT $2`,[game.id,integer(limit,1,100,20)]);
    return result.rows.map((row)=>({player:`OP-${crypto.createHash('sha256').update(String(row.user_id)).digest('hex').slice(0,8).toUpperCase()}`,score:Number(row.score||0),mastery:Number(row.mastery||0),sessions:Number(row.sessions||0)}));
  }
  async health(){
    await this.ensureSchema();
    const result=await this.pool.query(`SELECT COUNT(*)::int AS sessions FROM wisdo_arcade_sessions`);
    return {ok:true,service:'wisdo-arcade',catalogGames:ARCADE_CATALOG.length,playableGames:ARCADE_CATALOG.filter((g)=>g.status==='playable').length,sessions:Number(result.rows[0]?.sessions||0),policy:this.policy()};
  }
}
