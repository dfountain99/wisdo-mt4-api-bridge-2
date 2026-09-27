import test from 'node:test';
import assert from 'node:assert/strict';
import {CITY_ZONES,cityZone,localRaceResult} from '../public/app/world/experiences/street-sprint-circuit.js';

test('city course covers one complete lap and returns to downtown at the seam',()=>{
  assert.equal(CITY_ZONES[0].from,0);assert.equal(CITY_ZONES.at(-1).to,1);
  for(let i=1;i<CITY_ZONES.length;i++)assert.equal(CITY_ZONES[i].from,CITY_ZONES[i-1].to);
  assert.deepEqual([.1,.25,.4,.62,.88,1.1].map(p=>cityZone(p).id),
    ['downtown','office','market','parking','tower','downtown']);
});

test('solo four-slot result ranks banked coins and never grants browser rewards',()=>{
  const result=localRaceResult([
    {id:'you',banked:19,checkpoints:3},{id:'ai-1',banked:27,checkpoints:2},
    {id:'ai-2',banked:19,checkpoints:2},{id:'ai-3',banked:4,checkpoints:4},
  ],300);
  assert.deepEqual(result.placements.map(r=>r.id),['ai-1','you','ai-2','ai-3']);
  assert.equal(result.rewardStatus,'unverified');assert.equal(result.cultureCoinAwarded,0);
  assert.equal(result.xpAwarded,0);assert.equal(result.durationSeconds,300);
});
