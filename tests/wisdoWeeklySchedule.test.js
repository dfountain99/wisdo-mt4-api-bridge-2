import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWeeklyMasks,buildWeeklyScheduleGlobals} from '../services/wisdoWeeklySchedule.js';

test('weekly masks accept seven explicit valid 24-bit integers',()=>{
  assert.deepEqual(normalizeWeeklyMasks([0,1,'2',3,4,5,0xFFFFFF]),[0,1,2,3,4,5,0xFFFFFF]);
});
test('weekly masks reject malformed or missing values',()=>{
  for(const invalid of [null,undefined,true,false,'',' ','0x10',[],{},-1,1.5,0x1000000,Infinity]){
    assert.throws(()=>normalizeWeeklyMasks([0,0,0,invalid,0,0,0]),{statusCode:400});
  }
  assert.throws(()=>normalizeWeeklyMasks(new Array(7)),{statusCode:400});
  assert.throws(()=>normalizeWeeklyMasks([0]),{statusCode:400});
});
test('schedule commands target the exact lane and keep entries blocked until all seven masks are written',()=>{
  const masks=[0,1,2,3,4,5,6];
  const prefix='CEM.WISDO.__ACCOUNT__.XAUUSD.123.';
  assert.deepEqual(buildWeeklyScheduleGlobals({symbol:'XAUUSD',magicNumber:123,masks}),[
    {name:prefix+'ScheduleEnabled',value:2},
    ...masks.map((value,day)=>({name:prefix+'ScheduleDay'+day,value})),
    {name:prefix+'ScheduleEnabled',value:1}
  ]);
  for(const magicNumber of [true,null,'','0x7b',[],0,-1,1.5]){
    assert.throws(()=>buildWeeklyScheduleGlobals({symbol:'XAUUSD',magicNumber,masks}),{statusCode:409});
  }
});
