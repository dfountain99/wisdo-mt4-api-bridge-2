import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { campaignPacket, normalizeCampaignControl } from '../services/campaignControlContract.js';

function liveState(){
  return {
    campaignControl:{
      live:true,pendingId:0,ackId:0,campaignId:42,phase:0,symbol:'XAUUSD',magic:880099,
      positions:[],levels:[],direction:0,rail:0,
    },
  };
}

test('V12.1 CONFIGURE_WINDOWS builds a bounded campaign mailbox packet', () => {
  const packet=campaignPacket('CONFIGURE_WINDOWS',{
    eaCampaignId:42,windowMode:2,window1Start:8,window1End:11,window2Start:13,window2End:16,
  },liveState());
  assert.equal(packet.operation,15);
  assert.equal(packet.windowMode,2);
  assert.deepEqual([packet.window1Start,packet.window1End,packet.window2Start,packet.window2End],[8,11,13,16]);
  assert.throws(()=>campaignPacket('CONFIGURE_WINDOWS',{
    eaCampaignId:42,windowMode:2,window1Start:24,window1End:11,window2Start:13,window2End:16,
  },liveState()),/broker hours/);
});

test('V12.1 Reporter telemetry carries seconds and configured windows back to CORE', () => {
  const control=normalizeCampaignControl({
    version:1,symbol:'XAUUSD',magic:880099,ageSeconds:1,enabled:true,campaignId:42,phase:0,direction:0,
    brokerHour:9,brokerMinute:15,brokerSecond:37,windowMode:2,window1Start:8,window1End:11,window2Start:13,window2End:16,
    sessionId:1,sessionQuality:1,scheduleEnforced:true,windowAllowed:true,entryAllowed:true,
    levels:[],positions:[],acknowledgements:[],
  });
  assert.equal(control.session.brokerSecond,37);
  assert.deepEqual(control.session.windows.map((w)=>[w.startHour,w.endHour]),[[8,11],[13,16]]);
});

test('V12.1 HIGHTOWER persists WISDO window overrides and enforces the runtime values', async () => {
  const [ea,receiver,reporter]=await Promise.all([
    fs.readFile(new URL('../mql4/HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4',import.meta.url),'utf8'),
    fs.readFile(new URL('../mql4/include/WISDO_H620Receiver.mqh',import.meta.url),'utf8'),
    fs.readFile(new URL('../mql4/include/WISDO_ReporterCampaign.mqh',import.meta.url),'utf8'),
  ]);
  assert.match(ea,/gHT6RuntimeWindowMode=-1/);
  assert.match(ea,/HT6ActiveWindowMode\(\)/);
  assert.match(ea,/H620Get\("windowOverride"\)==1/);
  assert.match(receiver,/op>15/);
  assert.match(receiver,/else if\(op==15\)/);
  assert.match(receiver,/H620Set\("windowOverride",1\)/);
  assert.match(receiver,/WcoWrite\(p,"windowMode",HT6ActiveWindowMode\(\)\)/);
  assert.match(receiver,/brokerSecond/);
  assert.match(reporter,/op>15/);
  assert.match(reporter,/JsonGetInt\(json,"windowMode",0\)/);
  assert.match(reporter,/brokerSecond/);
});

test('V12.1 Session Hours uses the existing verified proposal and hold-confirm flow', async () => {
  const [time,runtime,client]=await Promise.all([
    fs.readFile(new URL('../public/app/world/command/wisdo-time-engine.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/app/world/command/command-runtime.js',import.meta.url),'utf8'),
  ]);
  assert.match(time,/SESSION TIMER/);
  assert.match(time,/SESSION HOURS · BROKER TIME/);
  assert.match(time,/PREVIEW EA HOURS/);
  assert.match(time,/nextSessionBoundary/);
  assert.match(runtime,/onConfigureWindows: \(params\) => arm\('CONFIGURE_WINDOWS', params\)/);
  assert.match(runtime,/HOLD TO CONFIRM/);
  assert.match(runtime,/latestReceipt = await runtime\.execute\(/);
  assert.match(client,/windowMode: options\.windowMode/);
  assert.match(client,/window2End: options\.window2End/);
});

test('V12.1 release cache points to the live session command build', async () => {
  const [workspace,worker,runtime]=await Promise.all([
    fs.readFile(new URL('../public/js/workspace.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/service-worker.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8'),
  ]);
  assert.match(workspace,/v=20260929-v12-1-live-session-command/);
  assert.match(worker,/wisdo-static-v12\.1\.0-live-session-command/);
  assert.match(runtime,/wisdo-core-v12-1-session-command\.css\?v=20260929-v12-1-live-session-command/);
});
