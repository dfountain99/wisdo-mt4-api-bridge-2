import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BULL_MAN_MAX_TICKS,
  createBullManState,
  replayBullMan,
  tickBullMan,
} from '../public/app/world/arcade/bull-man-core.js';
import {
  ALPHA2_GAME_DEFS,
  createAlpha2State,
  replayAlpha2Game,
  tickAlpha2Game,
} from '../public/app/world/arcade/alpha2-games-core.js';
import {
  ARCADE_BUILD,
  ARCADE_CATALOG,
  arcadeEconomyPolicy,
  computeArcadeReward,
  computeBullManReward,
  scoreArcadeEducation,
  scoreBullManEducation,
} from '../services/wisdoArcadeService.js';

test('Arcade Alpha 2 keeps the 50-game roadmap and exposes five playable cabinets',()=>{
  assert.equal(ARCADE_BUILD,'ARCADE-ALPHA2');
  assert.equal(ARCADE_CATALOG.length,50);
  assert.equal(ARCADE_CATALOG[0].id,'bull-man');
  assert.deepEqual(ARCADE_CATALOG.filter((game)=>game.status==='playable').map((game)=>game.id),[
    'bull-man','liquidity-ghosts','breakout-breaker','risk-runner','fomo-frogger',
  ]);
  assert.equal(ARCADE_CATALOG.every((game)=>game.wagering===false),true);
});

test('Bull-Man replay remains deterministic and bounded',()=>{
  const inputs=Array.from({length:120},(_,index)=>['right','down','left','up'][Math.floor(index/30)%4]);
  assert.deepEqual(replayBullMan('12345',inputs),replayBullMan('12345',inputs));
  const oversized=Array.from({length:BULL_MAN_MAX_TICKS+500},()=> 'right');
  assert.ok(replayBullMan('1',oversized).ticks<=BULL_MAN_MAX_TICKS);
});

test('Bull-Man never accepts arbitrary movement through walls',()=>{
  const state=createBullManState('wall-test');
  const start={...state.player};
  tickBullMan(state,'up');
  assert.equal(state.player.y,start.y);
});

test('all four Alpha 2 cores replay deterministically and stop at their tick ceilings',()=>{
  for(const [id,def] of Object.entries(ALPHA2_GAME_DEFS)){
    const pattern=id==='risk-runner'?['up','hold','down','hold']:id==='breakout-breaker'?['left','hold','right','hold']:['up','right','down','left','hold'];
    const inputs=Array.from({length:def.maxTicks+50},(_,i)=>pattern[i%pattern.length]);
    const first=replayAlpha2Game(id,'alpha2-seed',inputs);
    const second=replayAlpha2Game(id,'alpha2-seed',inputs);
    assert.deepEqual(first,second,id);
    assert.ok(first.ticks<=def.maxTicks,id);
    assert.equal(Number.isFinite(first.score),true,id);
  }
});

test('Alpha 2 state transitions remain bounded by each game world',()=>{
  const liquidity=createAlpha2State('liquidity-ghosts','bounds');
  for(let i=0;i<40;i+=1)tickAlpha2Game('liquidity-ghosts',liquidity,'left');
  assert.ok(liquidity.player.x>=0&&liquidity.player.x<=14);
  const risk=createAlpha2State('risk-runner','bounds');
  for(let i=0;i<20;i+=1)tickAlpha2Game('risk-runner',risk,'up');
  assert.equal(risk.lane,0);
  const frog=createAlpha2State('fomo-frogger','bounds');
  for(let i=0;i<20;i+=1)tickAlpha2Game('fomo-frogger',frog,'left');
  assert.ok(frog.player.x>=0&&frog.player.x<=8);
});

test('browser lesson payloads do not expose correct-answer keys',()=>{
  for(const def of Object.values(ALPHA2_GAME_DEFS)){
    for(const lesson of def.lessons)assert.equal(Object.hasOwn(lesson,'correct'),false);
  }
});

test('education scores are derived from server-known answer keys',()=>{
  const base={ticks:100,completion:.5,hits:1,lives:2,status:'playing'};
  assert.equal(scoreBullManEducation(base,[1,0,1]).knowledge,100);
  assert.equal(scoreBullManEducation(base,[0,1,0]).knowledge,0);
  assert.equal(scoreArcadeEducation('breakout-breaker',base,[0,1,1]).knowledge,100);
  assert.equal(scoreArcadeEducation('risk-runner',{...base,equity:82},[0,1,1]).riskDiscipline,82);
});

test('Culture Coin policy never enables wagering and redemption is opt-in',()=>{
  const policy=arcadeEconomyPolicy({WISDO_ARCADE_DAILY_COIN_CAP:'50',WISDO_ARCADE_MAX_COIN_PER_SESSION:'12'});
  assert.equal(policy.wagering,false);
  assert.equal(policy.serverAuthoritative,true);
  assert.equal(policy.redemptionEnabled,false);
  assert.equal(policy.dailyEarnCap,50);
  assert.equal(policy.maxCoinsPerSession,12);
});

test('reward computation respects per-session cap for legacy and Alpha 2 games',()=>{
  const bull={ticks:200,completion:1,hits:0,lives:3,status:'won'};
  assert.equal(computeBullManReward(bull,[1,0,1],{maxCoinsPerSession:9}).coins,9);
  const frog={ticks:200,completion:1,hits:0,mistakes:0,lives:3,status:'won'};
  const reward=computeArcadeReward('fomo-frogger',frog,[1,1,1],{maxCoinsPerSession:8});
  assert.equal(reward.eligible,true);
  assert.equal(reward.coins,8);
});
