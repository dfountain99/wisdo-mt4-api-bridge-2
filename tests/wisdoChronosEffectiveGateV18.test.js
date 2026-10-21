import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { buildWeeklyScheduleGlobals } from '../services/wisdoWeeklySchedule.js';

test('website weekly schedule uses fail-closed update sentinel and final activation',()=>{
 const c=buildWeeklyScheduleGlobals({symbol:'XAUUSD',magicNumber:880088,masks:Array(7).fill(1)});
 assert.equal(c.length,9);assert.equal(c[0].value,2);assert.equal(c.at(-1).value,1);
 assert.equal(c[0].name,c.at(-1).name);
});
test('MT4 enforces scheduled broker hours and keeps legacy gate when disabled',async()=>{
 const [ea,receiver]=await Promise.all(['../mql4/HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4','../mql4/include/WISDO_H620Receiver.mqh'].map(x=>fs.readFile(new URL(x,import.meta.url),'utf8')));
 assert.match(ea,/input bool RewireEnableWeeklySchedule=false/);
 assert.match(ea,/TimeDayOfWeek\(now\)/);
 assert.match(ea,/ScheduleEnabled/);
 assert.match(ea,/mode==2\)return false/);
 assert.match(ea,/MathPow\(2\.0,hour\)/);
 assert.match(receiver,/scheduleVersion",RewireEnableWeeklySchedule\?1:0/);
 assert.match(receiver,/scheduleDay/);
 assert.match(receiver,/scheduleActive/);
});
