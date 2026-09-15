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
} from '../public/app/world/arcade/trading-sim-core.js';
import {
  ACHIEVEMENTS,
  ARCADE_ALPHA3_BUILD,
  dailyChallenges,
  enrichCatalogForLevel,
  floorUnlockState,
  levelFromXp,
  levelProgress,
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

test('Alpha 3 catalog is 50 real trading challenges with five trading simulators live',()=>{
  assert.equal(ARCADE_BUILD,'ARCADE-ALPHA3');
  assert.equal(ARCADE_ALPHA3_BUILD,'ARCADE-ALPHA3');
  assert.equal(ARCADE_CATALOG.length,50);
  assert.equal(ARCADE_CATALOG[0].id,'structure-trader');
  assert.deepEqual(ARCADE_CATALOG.filter((game)=>game.status==='playable').map((game)=>game.id),[
    'structure-trader','liquidity-sweep-trader','breakout-retest-trader','risk-manager','entry-discipline-trader',
  ]);
  assert.equal(ARCADE_CATALOG.every((game)=>game.gameType==='trading_simulation'),true);
  assert.equal(ARCADE_CATALOG.every((game)=>game.wagering===false),true);
  assert.equal(ARCADE_CATALOG.some((game)=>/frogger|breaker|pac-man/i.test(game.name)),false);
});

test('all five Alpha 3 trading simulators replay deterministically',()=>{
  for(const id of tradingGameIds()){
    const pattern=['hold','hold','risk1','buy','hold','hold','close','hold','sell','hold','close'];
    const inputs=Array.from({length:100},(_,i)=>pattern[i%pattern.length]);
    const first=replayTradingGame(id,'same-market-seed',inputs);
    const second=replayTradingGame(id,'same-market-seed',inputs);
    assert.deepEqual(first,second,id);
    assert.ok(first.ticks<=TRADING_SIM_MAX_TICKS,id);
    assert.equal(Number.isFinite(first.balance),true,id);
    assert.equal(Number.isFinite(first.realizedR),true,id);
    assert.equal(Number.isFinite(first.maxDrawdownPct),true,id);
  }
});

test('trading game actions create positions, stops, targets, P/L and R instead of arcade movement',()=>{
  const state=createTradingState('structure-trader','trade-state');
  tickTradingGame(state,'risk1');
  tickTradingGame(state,'buy');
  assert.equal(state.openPosition?.side,'buy');
  assert.ok(state.openPosition.stop<state.openPosition.entry);
  assert.ok(state.openPosition.target>state.openPosition.entry);
  assert.ok(state.openPosition.quantity>0);
  for(let i=0;i<30&&state.status==='playing';i+=1)tickTradingGame(state,'hold');
  const summary=summarizeTradingState(state);
  assert.equal(Number.isFinite(summary.pnl),true);
  assert.equal(Number.isFinite(summary.realizedR),true);
  assert.equal(Number.isFinite(summary.riskScore),true);
});

test('5 percent risk is measured as a risk violation',()=>{
  const state=createTradingState('risk-manager','risk-test');
  tickTradingGame(state,'risk5');
  tickTradingGame(state,'buy');
  const summary=summarizeTradingState(state);
  assert.ok(summary.riskViolations>=1);
  assert.ok(summary.riskScore<100);
});

test('entry discipline game can distinguish chase windows from patient holds',()=>{
  const chasing=createTradingState('entry-discipline-trader','discipline-seed');
  while(chasing.index<24)tickTradingGame(chasing,'hold');
  tickTradingGame(chasing,'buy');
  const chased=summarizeTradingState(chasing);
  assert.ok(chased.chaseEntries>=1);

  const patient=createTradingState('entry-discipline-trader','discipline-seed');
  while(patient.index<32)tickTradingGame(patient,'hold');
  tickTradingGame(patient,'buy');
  const waited=summarizeTradingState(patient);
  assert.equal(waited.chaseEntries,0);
  assert.ok(waited.goodEntries>=1);
});

test('browser trading lessons never contain answer keys',()=>{
  for(const def of Object.values(TRADING_GAME_DEFS))for(const lesson of def.lessons)assert.equal(Object.hasOwn(lesson,'correct'),false);
});

test('server-only knowledge keys score the new trading simulators',()=>{
  const result={ticks:60,executionScore:80,riskScore:90,disciplineScore:85,realizedR:2};
  assert.equal(scoreArcadeEducation('structure-trader',result,[0,0,0]).knowledge,100);
  assert.equal(scoreArcadeEducation('structure-trader',result,[1,1,1]).knowledge,0);
  assert.equal(scoreArcadeEducation('risk-manager',result,[0,0,0]).riskDiscipline,90);
});

test('Culture Coin reward is capped and requires demonstrated trading skill',()=>{
  const result={ticks:100,trades:3,goodEntries:2,executionScore:95,riskScore:95,disciplineScore:95,realizedR:4,status:'complete'};
  const reward=computeArcadeReward('structure-trader',result,[0,0,0],{maxCoinsPerSession:9});
  assert.equal(reward.eligible,true);
  assert.equal(reward.eligibility.demonstratedTradingSkill,true);
  assert.equal(reward.coins,9);
});

test('perfect quiz and patient holding cannot farm Culture Coin without an actual quality trade',()=>{
  const noTrade={ticks:100,trades:0,goodEntries:0,executionScore:90,riskScore:100,disciplineScore:100,realizedR:0,status:'complete'};
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

test('progression level curve, floor gates, mastery and daily challenges are deterministic',()=>{
  assert.equal(xpForLevel(1),0);
  assert.equal(levelFromXp(0),1);
  assert.equal(levelFromXp(xpForLevel(10)),10);
  assert.equal(levelProgress(xpForLevel(4)).level,4);
  assert.equal(floorUnlockState(1).risk.unlocked,false);
  assert.equal(floorUnlockState(4).psychology.unlocked,true);
  assert.equal(masteryTier(93),'MASTER');
  assert.equal(dailyChallenges(new Date('2026-09-15T12:00:00Z')).length,3);
  assert.deepEqual(dailyChallenges(new Date('2026-09-15T01:00:00Z')),dailyChallenges(new Date('2026-09-15T23:59:00Z')));
  assert.ok(ACHIEVEMENTS.length>=8);
});

test('catalog enrichment locks playable games by progression floor without changing planned games',()=>{
  const levelOne=enrichCatalogForLevel(ARCADE_CATALOG,1);
  assert.equal(levelOne.find((g)=>g.id==='structure-trader').status,'playable');
  assert.equal(levelOne.find((g)=>g.id==='risk-manager').status,'locked');
  assert.equal(levelOne.find((g)=>g.id==='entry-discipline-trader').status,'locked');
  assert.equal(levelOne.find((g)=>g.id==='trend-continuation-trader').status,'planned');
  const levelFour=enrichCatalogForLevel(ARCADE_CATALOG,4);
  assert.equal(levelFour.find((g)=>g.id==='risk-manager').status,'playable');
  assert.equal(levelFour.find((g)=>g.id==='entry-discipline-trader').status,'playable');
});

test('legacy Bull-Man verifier stays available only for in-flight compatibility',()=>{
  const inputs=Array.from({length:120},()=> 'right');
  assert.ok(replayBullMan('legacy',inputs).ticks<=BULL_MAN_MAX_TICKS);
  const legacy={ticks:200,completion:1,hits:0,lives:3,status:'won'};
  assert.equal(computeBullManReward(legacy,[1,0,1],{maxCoinsPerSession:8}).coins<=8,true);
});
