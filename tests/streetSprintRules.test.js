import test from 'node:test';
import assert from 'node:assert/strict';
import {raceDuration,collectCoin,depositCheckpoint,applyHit,rankByBanked,seededCoins,COINS_PER_LAP} from '../public/app/world/experiences/street-sprint-rules.js';

test('five or fifteen minutes are explicit and invalid durations fail',()=>{
  assert.equal(raceDuration(5),300);assert.equal(raceDuration(15),900);
  assert.throws(()=>raceDuration(0),RangeError);
});

test('coins count only after the next checkpoint deposits up to its capacity',()=>{
  let player={carried:19,banked:2,collected:19,nextCheckpoint:0,checkpoints:0};
  player=collectCoin(player,3);assert.equal(player.carried,22);
  assert.equal(depositCheckpoint(player,1).banked,2);
  player=depositCheckpoint(player,0);assert.equal(player.banked,22);assert.equal(player.carried,2);assert.equal(player.nextCheckpoint,1);
  assert.equal(rankByBanked([{name:'A',banked:22},{name:'B',banked:23}])[0].name,'B');
});

test('perfect hits drop all carried coins but never take banked score',()=>{
  const player={carried:16,banked:27,cleanSeconds:12};
  assert.equal(applyHit(player,{perfect:true}).carried,0);
  const glancing=applyHit(player);assert.ok(glancing.carried>0);assert.equal(glancing.banked,27);
});

test('bounded seeded pickup layout is repeatable',()=>{
  const a=seededCoins(),b=seededCoins();assert.equal(a.length,COINS_PER_LAP);assert.deepEqual(a,b);
  assert.ok(a.every(c=>c.progress>=0&&c.progress<1&&Math.abs(c.lane)<7.5));
});
