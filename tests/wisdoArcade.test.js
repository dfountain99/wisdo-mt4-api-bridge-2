import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BULL_MAN_LESSONS,
  BULL_MAN_MAX_TICKS,
  createBullManState,
  replayBullMan,
  scoreBullManEducation,
  tickBullMan,
} from '../public/app/world/arcade/bull-man-core.js';
import { ARCADE_CATALOG, arcadeEconomyPolicy, computeBullManReward } from '../services/wisdoArcadeService.js';

test('arcade catalog contains exactly 50 education games and Bull-Man is the launch cabinet',()=>{
  assert.equal(ARCADE_CATALOG.length,50);
  assert.equal(ARCADE_CATALOG[0].id,'bull-man');
  assert.equal(ARCADE_CATALOG[0].status,'playable');
  assert.equal(ARCADE_CATALOG.every((game)=>game.wagering===false),true);
});

test('Bull-Man replay is deterministic and bounded',()=>{
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

test('education score is derived from server-known correct answers',()=>{
  const result={ticks:100,completion:.5,hits:1,lives:2,status:'playing'};
  const correct=BULL_MAN_LESSONS.map((q)=>q.correct);
  const wrong=BULL_MAN_LESSONS.map((q)=>(q.correct+1)%q.choices.length);
  assert.equal(scoreBullManEducation(result,correct).knowledge,100);
  assert.equal(scoreBullManEducation(result,wrong).knowledge,0);
});

test('Culture Coin policy never enables wagering and redemption is opt-in',()=>{
  const policy=arcadeEconomyPolicy({WISDO_ARCADE_DAILY_COIN_CAP:'50',WISDO_ARCADE_MAX_COIN_PER_SESSION:'12'});
  assert.equal(policy.wagering,false);
  assert.equal(policy.serverAuthoritative,true);
  assert.equal(policy.redemptionEnabled,false);
  assert.equal(policy.dailyEarnCap,50);
  assert.equal(policy.maxCoinsPerSession,12);
});

test('reward computation respects per-session cap',()=>{
  const result={ticks:200,completion:1,hits:0,lives:3,status:'won'};
  const answers=BULL_MAN_LESSONS.map((q)=>q.correct);
  const reward=computeBullManReward(result,answers,{maxCoinsPerSession:9});
  assert.equal(reward.eligible,true);
  assert.equal(reward.coins,9);
});
