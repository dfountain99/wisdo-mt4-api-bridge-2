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
  assert.equal(g.length,9);
  assert.equal(g[0].name,'CEM.WISDO.__ACCOUNT__.XAUUSDm.26080204.ScheduleEnabled');
  assert.equal(g[0].value,2); // fail-closed during update
  assert.equal(g[1].name,'CEM.WISDO.__ACCOUNT__.XAUUSDm.26080204.ScheduleDay0');
  assert.equal(g[7].value,64);
  assert.equal(g[8].name,'CEM.WISDO.__ACCOUNT__.XAUUSDm.26080204.ScheduleEnabled');
  assert.equal(g[8].value,1);
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

test('V18 weekly schedule gate is enforced in the actual HIGHTOWER entry path, not just shown in UI', async()=>{
 const ea=await fs.readFile(new URL('../mql4/HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4',import.meta.url),'utf8');
 const receiver=await fs.readFile(new URL('../mql4/include/WISDO_H620Receiver.mqh',import.meta.url),'utf8');
 assert.match(ea,/bool HT6WeeklyEntryAllowed\(datetime now\)/);
 assert.match(ea,/return configuredWindow && HT6WeeklyEntryAllowed\(now\)/);
 assert.match(ea,/mode!=1\.0\)return false/);
 assert.match(ea,/ScheduleDay/);
 assert.match(receiver,/scheduleVersion\",1/);
 assert.match(receiver,/scheduleDay/);
});

test('V18 does not advertise stop trail or trim controls when manager capability is omitted',()=>{
 const cap=WorldCommandCenterService.prototype.capabilitiesFor.call({}, {
  account:{accountId:'a',ownerUserId:'u'},executionHealth:{commandLinkReady:true},
  campaigns:[{symbol:'XAUUSD',positionCount:2,canTargetByMagic:true,positions:[]}],
  campaignControl:{live:true,scheduleVersion:0}
 },'u');
 for(const key of ['SET_STOP_ATR','SET_TRAIL_ATR','TRIM_CAMPAIGN'])assert.equal(cap[key].available,false,key);
});

test('V19 flat Rewire EA can receive verified website schedule without any open trade campaign',async()=>{
  const service=new WorldCommandCenterService({mt4SyncService:{repository:{}},mt4CommandService:{queueCommandForAccount:async()=>({id:'demo-command'})}});
  service.campaignState={snapshot:async()=>({account:{accountId:'demo-account',ownerUserId:'owner'}, executionHealth:{commandLinkReady:true}, campaigns:[], campaignControl:{live:true,enabled:true,symbol:'XAUUSD',magic:26080204,scheduleVersion:1,managerOpsVersion:1,campaignId:0,phase:0,positions:[]}})};
  const result=await service.propose('owner',{accountId:'demo-account',action:'SET_EA_SCHEDULE',slotMasks:Array(7).fill(0x00ff00)});
  assert.equal(result.action,'SET_EA_SCHEDULE');
  assert.equal(result.proposalId.startsWith('world-proposal:'),true);
  assert.equal(service.proposals.get(result.proposalId).symbol,'XAUUSD');
  assert.equal(service.proposals.get(result.proposalId).magicNumber,26080204);
  assert.equal(result.affectedCount,0);
});

test('V19 Live Manager exposes account-scoped diagnostics instead of silently dead buttons',async()=>{
 const source=await fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8');
 assert.match(source,/WHY ARE MY CONTROLS NOT WORKING/);
 assert.match(source,/lmReceiverDiagnostics/);
 assert.match(source,/managerOpsVersion/);
 assert.match(source,/RewireAllowLiveManager=true/);
 assert.match(source,/scheduleVersion/);
 assert.match(source,/cap\?\.reason/);
});

test('Manual add maps Rewire version 12 or burst-only 0 to precisely one scoped SONIC operation 12', async()=>{
 const {resolveManualAddForEA}=await import('../services/wisdoManualAddProtocol.js');
 for (const version of [0,12]) {
  const state={campaignControl:{live:true,enabled:true,phase:1,managerOpsVersion:version,symbol:'XAUUSD',magic:26080204,campaignId:0},
    campaigns:[{symbol:'XAUUSD',magicNumber:26080204,direction:'BUY',positionCount:1}]};
  const resolution=resolveManualAddForEA(state,'ADD_IF_VALID');
  assert.equal(resolution.action,'ARM_SONIC');
  assert.deepEqual(resolution.params,{burstCount:1,durationSeconds:30,requestedDirection:1});
  const packet=(await import('../services/campaignControlContract.js')).campaignPacket(resolution.action,{...resolution.params,eaCampaignId:0},state);
  assert.equal(packet.operation,12);assert.equal(packet.burstCount,1);assert.equal(packet.durationSeconds,30);
 }
});
test('Manual add cannot cross account campaign symbol/magic or invent a market direction',async()=>{
 const {resolveManualAddForEA}=await import('../services/wisdoManualAddProtocol.js');
 const state={campaignControl:{live:true,enabled:true,phase:1,managerOpsVersion:12,symbol:'XAUUSD',magic:26080204},campaigns:[]};
 assert.throws(()=>resolveManualAddForEA(state,'ADD_IF_VALID'),/matching the EA symbol/);
 state.campaigns=[{symbol:'XAUUSD',magicNumber:26080204,direction:'FLAT',positionCount:2}];
 assert.throws(()=>resolveManualAddForEA(state,'ADD_IF_VALID'),/direction is not verified/);
 state.campaigns[0].direction='SELL';
 assert.equal(resolveManualAddForEA(state,'ADD_IF_VALID').params.requestedDirection,-1);
 state.campaignControl.enabled=false;
 assert.throws(()=>resolveManualAddForEA(state,'ADD_IF_VALID'),/No authenticated/);
});
test('Manual Add button is a confirmed World Command Center operation and text add retains its voice interpretation',async()=>{
 const [ui,voice,world]=await Promise.all(['../public/app/world/command/command-center-runtime.js','../services/wisdoExecutionService.js','../services/worldCommandCenterService.js'].map(file=>fs.readFile(new URL(file,import.meta.url),'utf8')));
 assert.match(ui,/data-manager-action="ADD_IF_VALID"/);
 assert.match(world,/resolveManualAddForEA\(snapshot,action\)/);
 assert.match(world,/resolveManualAddForEA\(current,proposal.action\)/);
 assert.match(voice,/resolveManualAddForEA\(snapshot,action\)/);
 assert.match(voice,/manual-add:/);
});
