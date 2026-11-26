import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWeeklyMasks,buildWeeklyScheduleGlobals,normalizeScheduleClock,supportsScheduleClock} from '../services/wisdoWeeklySchedule.js';

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

test('Eastern mode requires version 2 with explicit clock telemetry and commits mode 3',()=>{
  assert.equal(normalizeScheduleClock(),'BROKER_CLOCK');
  assert.throws(()=>normalizeScheduleClock('LOCAL'),{statusCode:400});
  for(const receiver of [{live:true,scheduleVersion:1},{live:true,scheduleVersion:2},{live:false,scheduleVersion:2,scheduleClockMode:0}]){
    assert.equal(supportsScheduleClock(receiver,'EASTERN'),false);
  }
  assert.equal(supportsScheduleClock({live:true,scheduleVersion:1}),true);
  assert.equal(supportsScheduleClock({live:true,scheduleVersion:2,scheduleClockMode:0},'EASTERN'),true);
  const masks=[0,62456,62456,62456,62456,62456,0];
  const commands=buildWeeklyScheduleGlobals({symbol:'XAUUSD',magicNumber:123,masks,clock:'EASTERN'});
  assert.equal(commands[0].value,2);
  assert.deepEqual(commands.slice(1,-1).map(command=>command.value),masks);
  assert.equal(commands.at(-1).value,3);
});
