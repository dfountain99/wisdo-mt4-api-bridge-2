import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCultureIntelligenceReport, computeCultureLaneVault, createCultureLane, createHarvestCycle,
  createTradePassport, ensureCultureLaneState, evaluateLaneHarvest, finalizeTradePassport,
  resolveLaneSymbol, setHarvestPolicy, setLaneSymbolPolicy, upsertBrokerSymbolInventory,
} from '../services/cultureLaneOperatingSystemService.js';

function state(){
  return ensureCultureLaneState({
    tradingAccounts:{
      lead:{id:'lead',user_id:'u1',balance:10000,equity:10100,reporter_connected:true,status:'connected'},
      follow:{id:'follow',user_id:'u1',balance:5000,equity:5050,reporter_connected:true,status:'connected'},
    },
    accountTelemetry:{
      lead:{latest:{balance:10000,equity:10100,floatingPL:100,closedProfitToday:50,openTradeCount:1},receivedAt:new Date().toISOString()},
      follow:{latest:{balance:5000,equity:5050,floatingPL:50,closedProfitToday:25,openTradeCount:1},receivedAt:new Date().toISOString()},
    },
  });
}

test('Culture Lane Vault, Harvest, Genome and timeline share one durable state model',()=>{
  const s=state();
  const lane=createCultureLane(s,'u1',{name:'Alpha',leaderAccountId:'lead',followerAccountIds:['follow'],status:'active'});
  setHarvestPolicy(s,lane.laneId,'u1',{goalType:'percent_gain',goalValue:1,mode:'harvest_once'});
  const vault=computeCultureLaneVault(s,lane.laneId,'u1');
  assert.equal(vault.balance,15000);
  assert.equal(vault.equity,15150);
  assert.equal(vault.combinedProfit,225);
  assert.equal(vault.executionStatus,'healthy');
  const evaluation=evaluateLaneHarvest(s,lane.laneId,'u1');
  assert.equal(evaluation.triggered,true);
  const cycle=createHarvestCycle(s,lane.laneId,'u1',evaluation,['cmd1','cmd2']);
  assert.equal(cycle.commandIds.length,2);
  assert.ok(Object.values(s.laneTimelineEventsById).some((event)=>event.eventType==='harvest.triggered'));
  assert.ok(lane.currentGenomeId);
});

test('Smart Symbol Routing uses broker inventory, aliases, and skip behavior',()=>{
  const s=state();
  const lane=createCultureLane(s,'u1',{leaderAccountId:'lead',followerAccountIds:['follow']});
  upsertBrokerSymbolInventory(s,'u1','follow',{symbols:[{symbol:'US500',minLot:.01,maxLot:100,tradeAllowed:true}]});
  setLaneSymbolPolicy(s,lane.laneId,'u1',{autoMatch:true,aliases:{SPXUSD:'US500'}});
  const matched=resolveLaneSymbol(s,lane.laneId,'follow','SPXUSD');
  assert.equal(matched.eligible,true);
  assert.equal(matched.followerSymbol,'US500');
  assert.equal(matched.translated,true);
  const missing=resolveLaneSymbol(s,lane.laneId,'follow','XAUUSD');
  assert.equal(missing.eligible,false);
  assert.equal(missing.reason,'no_compatible_symbol');
});

test('Trade Passports are finalized once and feed DNA/Intelligence confidence',()=>{
  const s=state();
  const lane=createCultureLane(s,'u1',{leaderAccountId:'lead',followerAccountIds:['follow']});
  const passport=createTradePassport(s,lane.laneId,'u1',{leaderOrder:{ticket:'55'},followerOrders:[{ticket:'88'}]});
  const finalized=finalizeTradePassport(s,passport.passportId,'u1',{profit:250,durationMinutes:45});
  assert.equal(finalized.status,'finalized');
  assert.equal(finalizeTradePassport(s,passport.passportId,'u1',{profit:999}),null);
  const report=buildCultureIntelligenceReport(s,lane.laneId,'u1');
  assert.equal(report.laneId,lane.laneId);
  assert.ok(report.dnaSnapshotId);
  assert.ok(report.observations.length);
});

test('clickable symbol highlights enforce the saved allowed-symbol policy',()=>{
  const s=state();
  const lane=createCultureLane(s,'u1',{leaderAccountId:'lead',followerAccountIds:['follow']});
  upsertBrokerSymbolInventory(s,'u1','follow',{symbols:['XAUUSD','EURUSD']});
  setLaneSymbolPolicy(s,lane.laneId,'u1',{allowedSymbols:['XAUUSD'],blockedSymbols:['EURUSD'],autoMatch:true});
  assert.equal(resolveLaneSymbol(s,lane.laneId,'follow','XAUUSD').eligible,true);
  assert.equal(resolveLaneSymbol(s,lane.laneId,'follow','EURUSD').reason,'blocked_symbol');
  assert.equal(resolveLaneSymbol(s,lane.laneId,'follow','GBPUSD').reason,'symbol_not_allowed');
});
