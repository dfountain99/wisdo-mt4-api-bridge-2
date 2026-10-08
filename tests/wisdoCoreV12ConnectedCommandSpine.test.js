import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { normalizeCampaignControl } from '../services/campaignControlContract.js';

test('V12 normalizes live Chronos session and hard trading windows from Reporter', () => {
  const value=normalizeCampaignControl({
    version:1,symbol:'XAUUSD',magic:880099,ageSeconds:1,enabled:true,
    campaignId:42,phase:1,direction:1,rail:3000,goal:2,paused:false,remainingSeconds:0,banked:1,
    sessionId:3,sessionQuality:1.14,brokerHour:13,brokerMinute:25,windowMode:2,
    window1Start:7,window1End:11,window2Start:13,window2End:16,
    scheduleEnforced:true,windowAllowed:true,entryAllowed:true,
    campaignBase:100,campaignRealized:4,campaignFloating:2,milestonePercent:10,targetEquity:110,
    levels:[],positions:[],acknowledgements:[]
  });
  assert.equal(value.session.reported,true);
  assert.equal(value.session.name,'LONDON/NY OVERLAP');
  assert.equal(value.session.entryAllowed,true);
  assert.deepEqual(value.session.windows.map(x=>[x.startHour,x.endHour]),[[7,11],[13,16]]);
  assert.equal(value.progress.targetEquity,110);
});

test('V12 HIGHTOWER owns the real entry-window enforcement and publishes Chronos truth', async () => {
  const [ea,receiver,reporter]=await Promise.all([
    fs.readFile(new URL('../mql4/HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4',import.meta.url),'utf8'),
    fs.readFile(new URL('../mql4/include/WISDO_H620Receiver.mqh',import.meta.url),'utf8'),
    fs.readFile(new URL('../mql4/include/WISDO_ReporterCampaign.mqh',import.meta.url),'utf8'),
  ]);
  assert.match(ea,/HT6_TradingWindowMode/);
  assert.match(ea,/HT6DirectTradingWindowAllows\(TimeCurrent\(\)\)/);
  assert.match(ea,/AllowNewEntries=\(DirectAllowNewEntries && directTimeWindowAllowed && !wisdoTradingPaused\)/);
  assert.match(receiver,/sessionQuality/);
  assert.match(receiver,/scheduleEnforced/);
  assert.match(receiver,/entryAllowed/);
  assert.match(receiver,/wisdoTradingPaused/);
  assert.match(receiver,/campaignBase/);
  assert.match(receiver,/targetEquity/);
  assert.match(reporter,/sessionId/);
  assert.match(reporter,/windowAllowed/);
  assert.match(reporter,/targetEquity/);
});

test('V12 Time displays bot session, active hours and blocked hours without inventing missing telemetry', async () => {
  const source=await fs.readFile(new URL('../public/app/world/command/wisdo-time-engine.js',import.meta.url),'utf8');
  assert.match(source,/CURRENT SESSION/);
  assert.match(source,/ACTIVE HOURS · BOT ALLOWS NEW ENTRIES/);
  assert.match(source,/BLOCKED HOURS · MANAGE ONLY/);
  assert.match(source,/EA SESSION NOT REPORTED/);
  assert.match(source,/session\.entryAllowed/);
  assert.match(source,/windowMode===0/);
  assert.match(source,/ARM 2-MIN SCALP/);
  assert.match(source,/onScalpHold/);
  assert.match(source,/scalpHoldMs=2000/);
  assert.match(source,/BOT TRADING SCHEDULE/);
  assert.match(source,/wcV12W1Start/);
  assert.match(source,/wcV12W2End/);
  assert.match(source,/HOLD 2\.0s · APPLY SCHEDULE/);
  assert.match(source,/onScheduleHold/);
});

test('V12 right menu binds stable account IDs, verified broker victories and active EA protocol', async () => {
  const [dock,state]=await Promise.all([
    fs.readFile(new URL('../public/app/world/command/truth-dock.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../services/worldCampaignStateService.js',import.meta.url),'utf8'),
  ]);
  assert.match(dock,/const value=a\.accountId/);
  assert.match(dock,/VERIFIED WIN/);
  assert.match(dock,/protocolLabel/);
  assert.match(state,/victoryEvents/);
  assert.match(state,/expertEnabled !== false/);
});

test('V15 voice/text manager uses the same verified proposal and acknowledgement path without guardian controls', async () => {
  const runtime=await fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8');
  assert.match(runtime,/VOICE \+ TEXT → VERIFIED EA COMMANDS/);
  assert.match(runtime,/WIDEN_EXISTING_STOPS/);
  assert.match(runtime,/SET_TRAIL_ATR/);
  assert.match(runtime,/TRIM_CAMPAIGN/);
  assert.match(runtime,/runtime\.propose\(/);
  assert.match(runtime,/runtime\.execute\(/);
  assert.match(runtime,/HOLD TO CONFIRM/);
  assert.match(runtime,/ARM_TWO_MIN_SCALP/);
  assert.match(runtime,/durationSeconds:120/);
  assert.match(runtime,/SET_TRADING_SCHEDULE/);
  assert.match(runtime,/CLEAR_TRADING_SCHEDULE/);
  assert.match(runtime,/handleScheduleHold/);
  assert.doesNotMatch(runtime,/GESTURE RECOGNIZED|guardianDeck|wcV8CharacterChamber/);
});

test('V15 release assets are cache-busted and the old CORE cascade is retired', async () => {
  const [workspace,worker,runtime]=await Promise.all([
    fs.readFile(new URL('../public/js/workspace.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/service-worker.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8'),
  ]);
  assert.match(workspace,/v=20261005-v20-scalp-hold/);
  assert.match(worker,/wisdo-static-v20\.0\.0-scalp-hold/);
  assert.match(runtime,/wisdo-live-manager-v15\.css\?v=20261005-v20-scalp-hold/);
  assert.doesNotMatch(runtime,/wisdo-core-v12-connected\.css|wisdo-core-v8-rank-ascension\.css/);
});
