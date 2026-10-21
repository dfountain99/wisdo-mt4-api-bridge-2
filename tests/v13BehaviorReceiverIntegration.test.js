import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCampaignControl,campaignPacket } from '../services/campaignControlContract.js';
import { readFileSync } from 'node:fs';
const state=(overrides={})=>({campaignControl:{live:true,symbol:'XAUUSD',magic:26080204,campaignId:42,direction:1,phase:1,positions:[{ticket:123,role:1}],pendingId:0,ackId:0,behaviorVersion:13,behaviorActive:false,...overrides}});
test('V13 chain defaults closed for older/missing receiver',()=>{
  const c=normalizeCampaignControl({version:1,symbol:'XAUUSD',magic:7,behaviorVersion:13,behaviorActive:true,behaviorWave:2,behaviorFilled:5});
  assert.equal(c.behaviorVersion,13);assert.equal(c.behaviorActive,true);assert.equal(c.behaviorFilled,5);
  assert.throws(()=>campaignPacket('CHAIN_ARM',{chainWaves:2,chainPerWave:2,chainSpacingPips:5},state({behaviorVersion:0})),/receiver/);
});
test('V13 chain uses noncolliding pinned zero expected and rejects risky size',()=>{
  const packet=campaignPacket('CHAIN_ARM',{chainWaves:3,chainPerWave:2,chainSpacingPips:5},state());
  assert.equal(packet.operation,21);assert.equal(packet.eaCampaignId,0);assert.equal(packet.chainWaves,3);assert.equal(packet.chainPerWave,2);assert.equal(packet.chainSpacingPips,5);
  for(const bad of [{chainWaves:5,chainPerWave:1,chainSpacingPips:5},{chainWaves:4,chainPerWave:11,chainSpacingPips:5},{chainWaves:3,chainPerWave:3,chainSpacingPips:0}])assert.throws(()=>campaignPacket('CHAIN_ARM',bad,state()));
  assert.throws(()=>campaignPacket('CHAIN_ARM',{chainWaves:2,chainPerWave:2,chainSpacingPips:5},state({behaviorActive:true})));
});
test('V13 does not route legacy op 21 or 22 as counter/directional request',()=>{
  assert.throws(()=>campaignPacket('COUNTER_IF_VALID',{eaCampaignId:42,counterDirection:-1,referencePrice:200},state()),/conflict/);
  assert.throws(()=>campaignPacket('DIRECTIONAL_ENTRY_IF_VALID',{eaCampaignId:42,requestedDirection:1},state()),/conflict/);
  const p=campaignPacket('CHAIN_PAUSE',{},state({behaviorActive:true}));
  assert.equal(p.operation,23);
});
test('Reporter writes chain mailbox and publishes versioned telemetry',()=>{
  const reporter=readFileSync(new URL('../mql4/include/WISDO_ReporterCampaign.mqh',import.meta.url),'utf8');
  for(const key of ['chainWaves','chainPerWave','chainSpacingPips','behaviorVersion','behaviorActive','behaviorFilled'])assert.ok(reporter.includes(key),key);
  const runtime=readFileSync(new URL('../public/app/world/command/command-runtime.js',import.meta.url),'utf8');
  for(const key of ['chainWaves: options.chainWaves','chainPerWave: options.chainPerWave','chainSpacingPips: options.chainSpacingPips'])assert.ok(runtime.includes(key),key);
});
