import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWeeklyMasks, buildWeeklyScheduleGlobals } from '../services/wisdoWeeklySchedule.js';
import { WorldCommandCenterService } from '../services/worldCommandCenterService.js';
import fs from 'node:fs/promises';

test('V18 weekly calendar validates exactly seven broker-time 24-hour masks',()=>{
  assert.deepEqual(normalizeWeeklyMasks(Array(7).fill(0)),Array(7).fill(0));
  assert.deepEqual(normalizeWeeklyMasks(Array(7).fill(16777215)),Array(7).fill(16777215));
  assert.throws(()=>normalizeWeeklyMasks(Array(6).fill(0)),/seven broker-time/i);
  assert.throws(()=>normalizeWeeklyMasks([0,0,0,0,0,0,16777216]),/Invalid 24-hour mask/);
  assert.throws(()=>normalizeWeeklyMasks([0,0,0,0,0,0,1.5]),/Invalid 24-hour mask/);
});
test('V18 emits account-scoped 7 weekday masks and activation LAST',()=>{
  const g=buildWeeklyScheduleGlobals({symbol:'XAUUSDm',magicNumber:26080204,masks:[1,2,4,8,16,32,64]});
  assert.equal(g.length,8);
  assert.equal(g[0].name,'CEM.WISDO.__ACCOUNT__.XAUUSDm.26080204.ScheduleDay0');
  assert.equal(g[6].value,64);
  assert.equal(g[7].name,'CEM.WISDO.__ACCOUNT__.XAUUSDm.26080204.ScheduleEnabled');
  assert.equal(g[7].value,1);
  assert.throws(()=>buildWeeklyScheduleGlobals({symbol:'',magicNumber:26080204,masks:Array(7).fill(0)}),/Exact EA symbol/);
});
test('V18 controls are not advertised on old Rewire V6.11 receiver',()=>{
  const cap=WorldCommandCenterService.prototype.capabilitiesFor.call({},{
    account:{accountId:'a',ownerUserId:'u'},executionHealth:{commandLinkReady:true},
    campaigns:[{symbol:'XAUUSD',positionCount:4,canTargetByMagic:true,positions:[]}],
    campaignControl:{live:true,managerOpsVersion:0,scheduleVersion:0}
  },'u');
  assert.equal(cap.SET_STOP_ATR.available,false);
  assert.equal(cap.SET_TRAIL_ATR.available,false);
  assert.equal(cap.TRIM_CAMPAIGN.available,false);
  assert.equal(cap.SET_EA_SCHEDULE.available,false);
  assert.equal(cap.PAUSE_BOT.available,true);
});
test('V18 UI uses code-verified Guardian and a confirmed broker-clock schedule editor',async()=>{
  const [runtime,schedule,receiver,bridge]=await Promise.all([
    fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/app/world/command/wisdo-weekly-schedule-editor.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../mql4/include/WISDO_H620Receiver.mqh',import.meta.url),'utf8'),
    fs.readFile(new URL('../mql4/include/WISDO_ReporterCampaign.mqh',import.meta.url),'utf8')
  ]);
  assert.match(runtime,/characterSvg\(rankVisual/);
  assert.match(runtime,/createWisdoWeeklyScheduleEditor/);
  assert.match(runtime,/capability\('SET_EA_SCHEDULE'\)/);
  assert.match(runtime,/button\.disabled=!cap\?\.available/);
  assert.match(runtime,/REPORTER ONLY/);
  assert.match(schedule,/DRAFT ONLY/);
  assert.match(schedule,/pointerdown/);
  assert.match(schedule,/slotMasks/);
  assert.match(receiver,/managerOpsVersion/);
  assert.match(bridge,/scheduleVersion/);
});
