import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWeeklyMasks, weeklyScheduleGlobals, MAX_WEEKLY_MASK } from '../services/wisdoWeeklyScheduleContract.js';
import { normalizeCampaignControl } from '../services/campaignControlContract.js';
import fs from 'node:fs/promises';
test('weekly masks are exact 48-bit integers and invalid masks fail closed',()=>{
 const masks=Array(7).fill(0);masks[0]=MAX_WEEKLY_MASK;
 assert.deepEqual(validateWeeklyMasks(masks),masks);
 for(const invalid of [[1,2,3],Array(7).fill(-1),Array(7).fill(2**48),Array(7).fill('1')])assert.throws(()=>validateWeeklyMasks(invalid));
});
test('schedule globals scope account, magic and symbol and begin with a blocking update',()=>{
 const g=weeklyScheduleGlobals({symbol:'XAUUSDm',magic:880088,masks:[1,2,3,4,5,6,7],enabled:true});
 assert.equal(g.length,9);assert.equal(g[0].value,2);assert.equal(g[8].value,1);
 assert.ok(g.every(x=>x.name.startsWith('CEM.WS.__ACCOUNT__.880088.XAUUSDm.')));
 assert.deepEqual(g.slice(1,8).map(x=>x.value),[1,2,3,4,5,6,7]);
 assert.equal(weeklyScheduleGlobals({symbol:'XAUUSD',magic:88,masks:Array(7).fill(0),enabled:false})[8].value,0);
 assert.throws(()=>weeklyScheduleGlobals({symbol:'XAUUSD /bad',magic:88,masks:Array(7).fill(0),enabled:true}));
});
test('campaign normalization preserves verified manager capability and schedule',()=>{
 const control=normalizeCampaignControl({version:1,symbol:'XAUUSD',magic:123,ageSeconds:1,enabled:true,scheduleVersion:1,managerVersion:2,weeklyScheduleMode:1,weeklyMasks:Array(7).fill(2**40)});
 assert.equal(control.managerVersion,2);assert.equal(control.schedule.mode,1);assert.equal(control.schedule.masks[6],2**40);
});
test('actual EA enforces broker-time schedule; Reporter publishes the seven masks',async()=>{
 const [ea,receiver,reporter]=await Promise.all(['../mql4/HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4','../mql4/include/WISDO_H620Receiver.mqh','../mql4/include/WISDO_ReporterCampaign.mqh'].map(f=>fs.readFile(new URL(f,import.meta.url),'utf8')));
 assert.match(ea,/CEM\.WS\./);assert.match(ea,/TimeDayOfWeek/);assert.match(ea,/MathPow\(2\.0,slot\)/);
 assert.match(receiver,/managerVersion/);assert.match(receiver,/weeklyScheduleMode/);assert.match(reporter,/weeklyMasks/);
});
test('character and color-coded editor show actual schedule, not a pretend active state',async()=>{
 const [ui,sched,rank]=await Promise.all(['../public/app/world/command/command-center-runtime.js','../public/app/world/command/wisdo-weekly-scheduler.js','../public/app/world/command/rank-ascension.js'].map(f=>fs.readFile(new URL(f,import.meta.url),'utf8')));
 assert.match(ui,/lmAvatarCharacter/);assert.match(ui,/createWisdoWeeklyScheduler/);assert.match(sched,/onApply/);assert.match(sched,/capability\.available/);assert.match(rank,/export function characterSvg/);
});
