import test from 'node:test';
import assert from 'node:assert/strict';

import {BULL_MAN_MAX_TICKS,replayBullMan} from '../public/app/world/arcade/bull-man-core.js';
import {
  TRADING_GAME_DEFS,
  TRADING_SIM_MAX_TICKS,
  createTradingState,
  replayTradingGame,
  summarizeTradingState,
  tickTradingGame,
  tradingGameIds,
  tradingSimulationCapabilities,
} from '../public/app/world/arcade/trading-sim-release.js';
import {
  ARCADE_BUILD_TRAIN,
  ARCADE_RELEASE_RANGE,
  ARCADE_RELEASE_TRAIN,
  arcadeBuildTrainSummary,
} from '../public/app/world/arcade/arcade-build-train.js';
import {
  ACHIEVEMENTS,
  ARCADE_ALPHA3_BUILD,
  dailyChallenges,
  enrichCatalogForLevel,
  floorUnlockState,
  levelFromXp,
  levelProgress,
  masteryHeatmap,
  masteryTier,
  xpForLevel,
} from '../public/app/world/arcade/alpha3-progression-core.js';
import {
  ARCADE_BUILD,
  ARCADE_CATALOG,
  arcadeEconomyPolicy,
  computeArcadeReward,
  computeBullManReward,
  scoreArcadeEducation,
} from '../services/wisdoArcadeService.js';

test('Build train contains exactly builds 004 through 112',()=>{
  assert.equal(ARCADE_RELEASE_TRAIN,'ARCADE-BUILD-112');
  assert.deepEqual(ARCADE_RELEASE_RANGE,{from:4,to:112,count:109});
  assert.equal(ARCADE_BUILD_TRAIN.length,109);
  assert.equal(ARCADE_BUILD_TRAIN[0].number,4);
  assert.equal(ARCADE_BUILD_TRAIN.at(-1).number,112);
  assert.equal(new Set(ARCADE_BUILD_TRAIN.map((build)=>build.id)).size,109);
  assert.equal(ARCADE_BUILD_TRAIN.every((build)=>build.status==='shipped'),true);
  assert.deepEqual(arcadeBuildTrainSummary(),{release:'ARCADE-BUILD-112',from:4,to:112,count:109,shipped:109,gameBuilds:45,platformBuilds:64});
});

test('Builds 004-048 map every previously planned game to a real simulator',()=>{
  const gameBuilds=ARCADE_BUILD_TRAIN.filter((build)=>build.category==='game');
  assert.equal(gameBuilds.length,45);
  for(const build of gameBuilds)assert.ok(TRADING_GAME_DEFS[build.evidence],`${build.number}:${build.evidence}`);
});

test('Build 112 catalog exposes 50 real trading simulations and no arcade reskins',()=>{
  assert.equal(ARCADE_BUILD,'ARCADE-BUILD-112');
  assert.equal(ARCADE_ALPHA3_BUILD,'ARCADE-BUILD-112');
  assert.equal(ARCADE_CATALOG.length,50);
  assert.equal(tradingGameIds().length,50);
  assert.equal(ARCADE_CATALOG.every((game)=>game.status==='playable'),true);
  assert.equal(ARCADE_CATALOG.every((game)=>game.gameType==='trading_simulation'),true);
  assert.equal(ARCADE_CATALOG.every((game)=>game.wagering===false),true);
  assert.equal(ARCADE_CATALOG.some((game)=>/frogger|breaker|pac-man|space invader/i.test(game.name)),false);
});

test('all 50 trading simulators replay deterministically with market and risk metrics',()=>{
  for(const id of tradingGameIds()){
    const pattern=['hold','risk1','hold','buy','hold','hold','close','modeLimit','sell','hold','close','target3','stopStructure'];
    const inputs=Array.from({length:105},(_,i)=>pattern[i%pattern.length]);
    const first=replayTradingGame(id,'same-market-seed',inputs);
    const second=replayTradingGame(id,'same-market-seed',inputs);
    assert.deepEqual(first,second,id);
    assert.ok(first.ticks<=TRADING_SIM_MAX_TICKS,id);
    assert.equal(Number.isFinite(first.balance),true,id);
    assert.equal(Number.isFinite(first.realizedR),true,id);
    assert.equal(Number.isFinite(first.maxDrawdownPct),true,id);
    assert.equal(Number.isFinite(first.expectancyR),true,id);
    assert.equal(Number.isFinite(first.profitFactor),true,id);
    assert.equal(typeof first.replayFingerprint,'string',id);
    assert.equal(typeof first.journal?.headline,'string',id);
    assert.equal(Array.isArray(first.tradeAutopsy),true,id);
  }
});

test('trading actions create positions, stops, targets, sizing, costs and R instead of arcade movement',()=>{
  const state=createTradingState('structure-trader','trade-state');
  while(state.index<state.scenario.signals[0].start)tickTradingGame(state,'hold');
  tickTradingGame(state,'risk1');
  tickTradingGame(state,'target3');
  tickTradingGame(state,'stopStructure');
  tickTradingGame(state,'buy');
  assert.equal(state.openPosition?.side,'buy');
  assert.ok(state.openPosition.stop<state.openPosition.entry);
  assert.ok(state.openPosition.target>state.openPosition.entry);
  assert.ok(state.openPosition.quantity>0);
  assert.equal(state.openPosition.targetR,3);
  assert.equal(state.openPosition.stopMode,'structure');
  for(let i=0;i<28&&state.status==='playing';i+=1)tickTradingGame(state,'hold');
  if(state.openPosition)tickTradingGame(state,'close');
  const summary=summarizeTradingState(state);
  assert.ok(summary.trades>=1);
  assert.ok(summary.totalCosts>0);
  assert.equal(Number.isFinite(summary.pnl),true);
  assert.equal(Number.isFinite(summary.realizedR),true);
  assert.equal(Number.isFinite(summary.averageMaeR),true);
  assert.equal(Number.isFinite(summary.averageMfeR),true);
  assert.equal(Number.isFinite(summary.championshipScore),true);
});

test('market realism includes instrument, session, regime, spread, slippage and news context',()=>{
  const state=createTradingState('news-risk-trader','context-seed');
  assert.ok(state.scenario.instrument.symbol);
  const context=state.scenario.context;
  assert.equal(context.length,state.scenario.series.length);
  assert.ok(context.some((row)=>row.session==='ASIA'));
  assert.ok(context.some((row)=>row.session==='LONDON'));
  assert.ok(context.some((row)=>row.session==='NEW_YORK'));
  assert.ok(context.some((row)=>row.event==='HIGH_IMPACT'));
  assert.ok(context.every((row)=>Number.isFinite(row.spread)&&row.spread>0));
  assert.ok(context.every((row)=>Number.isFinite(row.slippage)&&row.slippage>=0));
});

test('risk, stop, target and execution controls are stateful decision inputs',()=>{
  const state=createTradingState('risk-manager','controls');
  tickTradingGame(state,'risk0.25');
  assert.equal(state.riskPct,.25);
  tickTradingGame(state,'risk1.5');
  assert.equal(state.riskPct,1.5);
  tickTradingGame(state,'stopTight');
  assert.equal(state.stopMode,'tight');
  tickTradingGame(state,'target1');
  assert.equal(state.targetR,1);
  tickTradingGame(state,'modeLimit');
  assert.equal(state.executionMode,'limit');
  tickTradingGame(state,'risk5');
  assert.ok(state.riskViolations>=1);
});

test('news-window entries and late chase entries are measured as discipline failures',()=>{
  const news=createTradingState('news-risk-trader','news-seed');
  while(news.index<29)tickTradingGame(news,'hold');
  tickTradingGame(news,'buy');
  assert.ok(summarizeTradingState(news).eventEntries>=1);

  const chasing=createTradingState('entry-discipline-trader','discipline-seed');
  while(chasing.index<24)tickTradingGame(chasing,'hold');
  tickTradingGame(chasing,'buy');
  assert.ok(summarizeTradingState(chasing).chaseEntries>=1);

  const patient=createTradingState('entry-discipline-trader','discipline-seed');
  while(patient.index<32)tickTradingGame(patient,'hold');
  tickTradingGame(patient,'buy');
  const waited=summarizeTradingState(patient);
  assert.equal(waited.chaseEntries,0);
  assert.ok(waited.goodEntries>=1);
});

test('advanced analytics attribute performance and produce coaching output',()=>{
  const state=createTradingState('session-selection-trader','analytics');
  const first=state.scenario.signals[0];
  while(state.index<first.start)tickTradingGame(state,'hold');
  tickTradingGame(state,first.side);
  for(let i=0;i<22&&state.status==='playing';i+=1)tickTradingGame(state,'hold');
  if(state.openPosition)tickTradingGame(state,'close');
  const summary=summarizeTradingState(state);
  assert.equal(typeof summary.bySession,'object');
  assert.equal(typeof summary.byRegime,'object');
  assert.equal(typeof summary.byDirection,'object');
  assert.equal(typeof summary.bySetup,'object');
  assert.equal(typeof summary.skillMatrix,'object');
  assert.ok(summary.coachingPriorities.length>=1);
  assert.ok(summary.journal.next.length>=1);
  assert.ok(summary.tradeAutopsy.length>=1);
});

test('browser lessons never contain answer keys and every new game has three lessons',()=>{
  for(const def of Object.values(TRADING_GAME_DEFS)){
    assert.equal(def.lessons.length,3,def.id);
    for(const lesson of def.lessons)assert.equal(Object.hasOwn(lesson,'correct'),false,def.id);
  }
});

test('server-only knowledge keys score all 50 trading simulators',()=>{
  const result={ticks:60,trades:2,goodEntries:1,executionScore:80,riskScore:90,disciplineScore:85,contextScore:80,maxDrawdownPct:2,realizedR:2};
  for(const id of tradingGameIds())assert.equal(scoreArcadeEducation(id,result,[0,0,0]).knowledge,100,id);
  assert.equal(scoreArcadeEducation('structure-trader',result,[1,1,1]).knowledge,0);
});

test('Culture Coin reward is capped and requires demonstrated trading skill and risk eligibility',()=>{
  const result={ticks:100,trades:3,goodEntries:2,executionScore:95,riskScore:95,disciplineScore:95,contextScore:95,maxDrawdownPct:3,realizedR:4,status:'complete'};
  const reward=computeArcadeReward('structure-trader',result,[0,0,0],{maxCoinsPerSession:9});
  assert.equal(reward.eligible,true);
  assert.equal(reward.eligibility.demonstratedTradingSkill,true);
  assert.equal(reward.eligibility.riskEligible,true);
  assert.equal(reward.coins,9);
});

test('perfect quiz and patient holding cannot farm Culture Coin without an actual quality trade',()=>{
  const noTrade={ticks:100,trades:0,goodEntries:0,executionScore:90,riskScore:100,disciplineScore:100,contextScore:100,maxDrawdownPct:0,realizedR:0,status:'complete'};
  const reward=computeArcadeReward('structure-trader',noTrade,[0,0,0],{maxCoinsPerSession:15});
  assert.equal(reward.eligible,false);
  assert.equal(reward.eligibility.demonstratedTradingSkill,false);
  assert.equal(reward.coins,0);
});

test('Culture Coin policy remains server-authoritative, no-wager, and redemption opt-in',()=>{
  const policy=arcadeEconomyPolicy({WISDO_ARCADE_DAILY_COIN_CAP:'50',WISDO_ARCADE_MAX_COIN_PER_SESSION:'12'});
  assert.equal(policy.wagering,false);
  assert.equal(policy.serverAuthoritative,true);
  assert.equal(policy.redemptionEnabled,false);
  assert.equal(policy.dailyEarnCap,50);
  assert.equal(policy.maxCoinsPerSession,12);
});

test('progression, floor gates, mastery heatmap and daily challenges stay deterministic',()=>{
  assert.equal(xpForLevel(1),0);
  assert.equal(levelFromXp(0),1);
  assert.equal(levelFromXp(xpForLevel(10)),10);
  assert.equal(levelProgress(xpForLevel(4)).level,4);
  assert.equal(floorUnlockState(1).risk.unlocked,false);
  assert.equal(floorUnlockState(4).psychology.unlocked,true);
  assert.equal(masteryTier(93),'MASTER');
  assert.equal(dailyChallenges(new Date('2026-09-15T12:00:00Z')).length,3);
  assert.deepEqual(dailyChallenges(new Date('2026-09-15T01:00:00Z')),dailyChallenges(new Date('2026-09-15T23:59:00Z')));
  assert.ok(ACHIEVEMENTS.length>=12);
  assert.deepEqual(masteryHeatmap([{gameId:'structure-trader',bestMastery:93}]),[{gameId:'structure-trader',score:93,tier:'MASTER',intensity:.93}]);
});

test('floor gates lock by player level while every catalog game remains actually implemented',()=>{
  const levelOne=enrichCatalogForLevel(ARCADE_CATALOG,1);
  assert.equal(levelOne.find((g)=>g.id==='structure-trader').status,'playable');
  assert.equal(levelOne.find((g)=>g.id==='risk-manager').status,'locked');
  assert.equal(levelOne.find((g)=>g.id==='entry-discipline-trader').status,'locked');
  assert.equal(levelOne.find((g)=>g.id==='trend-continuation-trader').status,'playable');
  const levelTen=enrichCatalogForLevel(ARCADE_CATALOG,10);
  assert.equal(levelTen.every((g)=>g.status==='playable'),true);
});

test('capability contract exposes market realism, analytics, review and all 50 games',()=>{
  const caps=tradingSimulationCapabilities();
  assert.equal(caps.gameCount,50);
  assert.deepEqual(caps.buildRange,{from:4,to:112,count:109});
  assert.ok(caps.instruments.length>=6);
  assert.ok(caps.marketRealism.includes('variable-spread'));
  assert.ok(caps.analytics.includes('expectancy'));
  assert.ok(caps.review.includes('trade-autopsy'));
  assert.ok(caps.actions.includes('stopstructure'));
  assert.ok(caps.actions.includes('modelimit'));
  assert.ok(caps.actions.includes('stopStructure'));
  assert.ok(caps.actions.includes('modeLimit'));
});

test('legacy Bull-Man verifier stays available only for in-flight compatibility',()=>{
  const inputs=Array.from({length:120},()=> 'right');
  assert.ok(replayBullMan('legacy',inputs).ticks<=BULL_MAN_MAX_TICKS);
  const legacy={ticks:200,completion:1,hits:0,lives:3,status:'won'};
  assert.equal(computeBullManReward(legacy,[1,0,1],{maxCoinsPerSession:8}).coins<=8,true);
});
