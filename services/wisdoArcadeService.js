import crypto from 'node:crypto';
import {
  TRADING_SIM_MAX_TICKS,
  TRADING_SIM_TICK_MS,
  TRADING_SIM_VERSION,
  getTradingGameDef,
  replayTradingGame,
  tradingGameCatalog,
  tradingGameIds,
  tradingSimulationCapabilities,
} from '../public/app/world/arcade/trading-sim-release.js';
import {arcadeBuildTrainSummary} from '../public/app/world/arcade/arcade-build-train.js';
// Legacy imports exist only so already-started Alpha 1/2 sessions can still finalize after deploy.
import {BULL_MAN_LESSONS,BULL_MAN_MAX_TICKS,BULL_MAN_TICK_MS,BULL_MAN_VERSION,replayBullMan} from '../public/app/world/arcade/bull-man-core.js';
import {getAlpha2GameDef,replayAlpha2Game} from '../public/app/world/arcade/alpha2-games-core.js';

export const ARCADE_BUILD='ARCADE-BUILD-112';
export const ARCADE_CATALOG=Object.freeze(tradingGameCatalog());

function clean(value,max=200){return String(value??'').replace(/\u0000/g,'').trim().slice(0,max);}
function asBool(value){return value===true||['1','true','yes','on'].includes(String(value||'').toLowerCase());}
function integer(value,min,max,fallback=0){const n=Math.trunc(Number(value));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function gameById(id){return ARCADE_CATALOG.find((game)=>game.id===clean(id,80))||null;}

const NEW_KEYS=Object.fromEntries(tradingGameIds().map((id)=>[id,Object.freeze([0,0,0])]));
const ANSWER_KEYS=Object.freeze({
  ...NEW_KEYS,
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
  const answerList=Array.isArray(answers)?answers:[],correct=key.reduce((sum,expected,index)=>sum+(Number(answerList[index])===expected?1:0),0),knowledge=Math.round(correct/key.length*100);
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
export function scoreBullManEducation(result,answers,policy){return computeArcadeReward('bull-man',result,answers,policy);}

export function arcadeEconomyPolicy(env=process.env){
  const centsRaw=Number(env.WISDO_CULTURE_COIN_USD_CENTS);
  return Object.freeze({currency:'CULTURE_COIN',wagering:false,serverAuthoritative:true,dailyEarnCap:integer(env.WISDO_ARCADE_DAILY_COIN_CAP,1,100000,60),maxCoinsPerSession:integer(env.WISDO_ARCADE_MAX_COIN_PER_SESSION,1,1000,15),redemptionEnabled:asBool(env.WISDO_CULTURE_COIN_REDEMPTION_ENABLED),usdCentsPerCoin:Number.isFinite(centsRaw)&&centsRaw>0?integer(centsRaw,1,100000,null):null,notice:'Culture Coin rewards are earned from verified trading-simulation skill and are never wagered. Cash redemption is available only when an authorized redemption policy is explicitly enabled.'});
}

export function computeArcadeReward(gameId,result,answers,policy=arcadeEconomyPolicy({})){
  const education=scoreArcadeEducation(gameId,result,answers),verifier=verifierFor(gameId);
  const enoughDecisions=Number(result?.ticks||0)>=Number(verifier?.minTicks||20);
  const demonstratedTradingSkill=verifier?.gameType!=='trading_simulation'||(Number(result?.trades||0)>=1&&Number(result?.goodEntries||0)>=1);
  const riskEligible=verifier?.gameType!=='trading_simulation'||(Number(result?.riskScore||0)>=35&&Number(result?.maxDrawdownPct||0)<30);
  const eligible=enoughDecisions&&education.weighted>=40&&demonstratedTradingSkill&&riskEligible;
  let coins=eligible?Math.floor(education.weighted/10):0;
  if(eligible&&Number.isFinite(Number(result?.realizedR)))coins+=Math.min(3,Math.floor(Math.max(0,Number(result.realizedR))));
  if(eligible&&Number(result?.riskScore||0)>=90)coins+=2;
  if(eligible&&Number(result?.contextScore||0)>=90)coins+=1;
  coins=Math.max(0,Math.min(Number(policy.maxCoinsPerSession||15),coins));
  return Object.freeze({eligible,coins,education,eligibility:{enoughDecisions,demonstratedTradingSkill,riskEligible}});
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
    await this.ensureSchema();const game=gameById(gameId);if(!game){const error=new Error('Trading game not found.');error.statusCode=404;throw error;}if(game.status!=='playable'){const error=new Error(`${game.name} is not playable in this release.`);error.statusCode=409;throw error;}
    const verifier=verifierFor(game.id);if(!verifier){const error=new Error('This trading game does not have a server verifier.');error.statusCode=409;throw error;}
    const sessionId=crypto.randomUUID(),seed=crypto.randomInt(1,2_000_000_000),expiresAt=new Date(Date.now()+45*60*1000),result=await this.pool.query(`INSERT INTO wisdo_arcade_sessions(session_id,user_id,game_id,game_version,seed,expires_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING session_id,user_id,game_id,game_version,seed,status,started_at,expires_at`,[sessionId,clean(userId,200),game.id,verifier.version,seed,expiresAt]);
    return {...result.rows[0],build:ARCADE_BUILD,releaseTrain:arcadeBuildTrainSummary(),gameType:'trading_simulation',tickMs:verifier.tickMs,maxTicks:verifier.maxTicks,minTicks:verifier.minTicks,lessons:verifier.lessons,objective:verifier.objective||game.description,policy:this.policy()};
  }
  async finishSession(userId,sessionId,payload={}){
    await this.ensureSchema();const client=await this.pool.connect();
    try{
      await client.query('BEGIN');const selected=await client.query(`SELECT * FROM wisdo_arcade_sessions WHERE session_id=$1 AND user_id=$2 FOR UPDATE`,[clean(sessionId,100),clean(userId,200)]),row=selected.rows[0];
      if(!row){const error=new Error('Arcade session not found.');error.statusCode=404;throw error;}
      if(row.status==='finalized'){await client.query('COMMIT');return{sessionId:row.session_id,gameId:row.game_id,status:row.status,result:row.result,cultureCoinAwarded:row.culture_coin_awarded,idempotent:true,policy:this.policy()};}
      if(new Date(row.expires_at).getTime()<Date.now()){await client.query(`UPDATE wisdo_arcade_sessions SET status='expired',updated_at=NOW() WHERE session_id=$1`,[row.session_id]);await client.query('COMMIT');const error=new Error('Arcade session expired.');error.statusCode=410;throw error;}
      const verifier=verifierFor(row.game_id);if(!verifier){const error=new Error('This session does not have a verifier in the current build.');error.statusCode=409;throw error;}
      const inputs=Array.isArray(payload.inputs)?payload.inputs.slice(0,verifier.maxTicks).map((x)=>clean(x,24).toLowerCase()):[],answers=Array.isArray(payload.quizAnswers)?payload.quizAnswers.slice(0,verifier.lessons.length).map((x)=>integer(x,-1,10,-1)):[];
      if(inputs.length<verifier.minTicks){const error=new Error('Not enough verified market-replay decisions to finalize this session.');error.statusCode=400;throw error;}
      const elapsedMs=Date.now()-new Date(row.started_at).getTime(),perTickFloor=verifier.legacy?Math.max(24,Math.min(70,Number(verifier.tickMs||100)*.42)):110,minimumElapsedMs=Math.min(24000,Math.max(2500,Math.round(inputs.length*perTickFloor)));
      if(elapsedMs<minimumElapsedMs){const error=new Error('Trading simulation completed faster than the verification envelope allows.');error.statusCode=422;throw error;}
      const verified=verifier.replay(String(row.seed),inputs),policy=this.policy(),reward=computeArcadeReward(row.game_id,verified,answers,policy),daily=await client.query(`SELECT COALESCE(SUM(amount),0)::int AS earned FROM wisdo_culture_coin_ledger WHERE user_id=$1 AND source_type='arcade' AND amount>0 AND created_at>=date_trunc('day',NOW())`,[clean(userId,200)]);
      const already=Number(daily.rows[0]?.earned||0),remaining=Math.max(0,policy.dailyEarnCap-already),award=Math.min(reward.coins,remaining),digest=crypto.createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
      const result={verified,education:reward.education,antiCheat:{serverReplay:true,replayFingerprint:verified.replayFingerprint,gameVersion:row.game_version,inputDigest:digest,inputTicks:inputs.length,elapsedMs,minimumElapsedMs},reward:{rawCoins:reward.coins,eligible:reward.eligible,eligibility:reward.eligibility,dailyBefore:already,dailyRemainingAfter:Math.max(0,remaining-award),capped:award<reward.coins},releaseTrain:arcadeBuildTrainSummary()};
      if(award>0)await client.query(`INSERT INTO wisdo_culture_coin_ledger(ledger_id,user_id,source_type,source_id,amount,metadata) VALUES($1,$2,'arcade',$3,$4,$5::jsonb) ON CONFLICT(source_type,source_id) DO NOTHING`,[crypto.randomUUID(),clean(userId,200),row.session_id,award,JSON.stringify({gameId:row.game_id,gameVersion:row.game_version,score:verified.score,weighted:reward.education.weighted,realizedR:verified.realizedR??null,riskScore:verified.riskScore??null,championshipScore:verified.championshipScore??null})]);
      await client.query(`UPDATE wisdo_arcade_sessions SET status='finalized',replay=$2::jsonb,result=$3::jsonb,culture_coin_awarded=$4,finalized_at=NOW(),updated_at=NOW() WHERE session_id=$1`,[row.session_id,JSON.stringify({inputDigest:digest,inputTicks:inputs.length,replayFingerprint:verified.replayFingerprint}),JSON.stringify(result),award]);await client.query('COMMIT');
      return{sessionId:row.session_id,gameId:row.game_id,status:'finalized',result,cultureCoinAwarded:award,idempotent:false,policy,releaseTrain:arcadeBuildTrainSummary()};
    }catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}finally{client.release();}
  }
  async profile(userId){
    await this.ensureSchema();const [ledger,sessions]=await Promise.all([
      this.pool.query(`SELECT COALESCE(SUM(amount),0)::int AS balance,COALESCE(SUM(amount) FILTER(WHERE source_type='arcade' AND created_at>=date_trunc('day',NOW())),0)::int AS earned_today FROM wisdo_culture_coin_ledger WHERE user_id=$1`,[clean(userId,200)]),
      this.pool.query(`SELECT COUNT(*)::int AS sessions,COUNT(*) FILTER(WHERE status='finalized')::int AS finalized,COALESCE(MAX((result->'verified'->>'score')::int),0)::int AS best_score FROM wisdo_arcade_sessions WHERE user_id=$1`,[clean(userId,200)]),
    ]);
    return{cultureCoinBalance:Number(ledger.rows[0]?.balance||0),earnedToday:Number(ledger.rows[0]?.earned_today||0),sessions:Number(sessions.rows[0]?.sessions||0),finalized:Number(sessions.rows[0]?.finalized||0),bestArcadeScore:Number(sessions.rows[0]?.best_score||0),policy:this.policy()};
  }
  async leaderboard(gameId='structure-trader',limit=20){
    await this.ensureSchema();const game=gameById(gameId);if(!game){const error=new Error('Trading game not found.');error.statusCode=404;throw error;}
    const result=await this.pool.query(`SELECT user_id,MAX((result->'verified'->>'score')::int)::int AS score,MAX((result->'education'->>'weighted')::int)::int AS mastery,COUNT(*)::int AS sessions FROM wisdo_arcade_sessions WHERE game_id=$1 AND status='finalized' GROUP BY user_id ORDER BY score DESC,mastery DESC LIMIT $2`,[game.id,integer(limit,1,100,20)]);
    return result.rows.map((row)=>({player:`OP-${crypto.createHash('sha256').update(String(row.user_id)).digest('hex').slice(0,8).toUpperCase()}`,score:Number(row.score||0),mastery:Number(row.mastery||0),sessions:Number(row.sessions||0)}));
  }
  async health(){
    await this.ensureSchema();const result=await this.pool.query(`SELECT COUNT(*)::int AS sessions FROM wisdo_arcade_sessions`);
    return{ok:true,service:'wisdo-arcade',build:ARCADE_BUILD,tradingSimVersion:TRADING_SIM_VERSION,gameType:'trading_simulation',catalogGames:ARCADE_CATALOG.length,playableGames:ARCADE_CATALOG.filter((g)=>g.status==='playable').length,playableIds:tradingGameIds(),releaseTrain:arcadeBuildTrainSummary(),capabilities:tradingSimulationCapabilities(),liveExecutionAuthority:false,sessions:Number(result.rows[0]?.sessions||0),policy:this.policy()};
  }
}
