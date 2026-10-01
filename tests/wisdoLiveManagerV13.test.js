import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { WisdoIntentService } from '../services/wisdoIntentService.js';
import { WisdoSafetyService, voiceExecutionMode } from '../services/wisdoSafetyService.js';
import { campaignPacket } from '../services/campaignControlContract.js';

function control() {
  return {
    live: true, version: 1, symbol: 'XAUUSD', magic: 880099, campaignId: 42, phase: 1, direction: 1,
    rail: 2300, pendingId: 0, ackId: 0,
    positions: [{ ticket: 101, role: 0 }, { ticket: 102, role: 1 }],
    levels: [],
    runtime: { overrideMask: 0, scope: 0, stopAtr: 1.5, trailStartAtr: 1, trailDistanceAtr: 0.75, trailStepAtr: 0.15 },
  };
}

test('V13 live manager parses exact ATR, bounded natural trail steps, trims, and gated adds', () => {
  const service = new WisdoIntentService();
  const stop = service.deterministic('Wisdo, move stop losses to 16 ATR');
  assert.equal(stop.intent, 'SET_STOP_ATR');
  assert.equal(stop.commandName, 'WISDO_CAMPAIGN');
  assert.equal(stop.parameters.stopAtr, 16);

  const tighter = service.deterministic('tighten the trailer a little');
  assert.equal(tighter.intent, 'SET_TRAIL_ATR');
  assert.equal(tighter.parameters.trailDeltaAtr, -0.25);

  const trim = service.deterministic('trim half of this position', { selectedTicket: 102 });
  assert.equal(trim.intent, 'TRIM_CAMPAIGN');
  assert.equal(trim.parameters.trimPercent, 50);
  assert.deepEqual(trim.parameters.tickets, [102]);

  const ambiguous = service.deterministic('trim half of this position');
  assert.equal(ambiguous.parameters.tickets, null);

  const add = service.deterministic('add another position now');
  assert.equal(add.intent, 'ADD_POSITION_IF_VALID');
  assert.equal(add.parameters.action, 'ADD_IF_VALID');
});

test('V13 campaign packet resolves manager step against live EA telemetry and bounds runtime commands', () => {
  const state = { campaignControl: control() };
  const stop = campaignPacket('SET_STOP_ATR', { eaCampaignId: 42, stopAtr: 16 }, state);
  assert.equal(stop.operation, 15);
  assert.equal(stop.stopAtr, 16);
  assert.equal(stop.runtimeScope, 1);

  const trail = campaignPacket('SET_TRAIL_ATR', { eaCampaignId: 42, trailDeltaAtr: -0.25 }, state);
  assert.equal(trail.operation, 16);
  assert.equal(trail.trailDistanceAtr, 0.5);

  const trim = campaignPacket('TRIM_CAMPAIGN', { eaCampaignId: 42, trimPercent: 50, tickets: [102] }, state);
  assert.equal(trim.operation, 17);
  assert.equal(trim.trimPercent, 50);
  assert.equal(trim.tickets, '102');

  assert.equal(campaignPacket('ADD_IF_VALID', { eaCampaignId: 42 }, state).operation, 18);
  assert.equal(campaignPacket('CLEAR_RUNTIME_OVERRIDES', { eaCampaignId: 42 }, state).operation, 19);
  assert.throws(() => campaignPacket('SET_STOP_ATR', { eaCampaignId: 42, stopAtr: 21 }, state), /between 0.05 and 20/);
});

test('V13 authority envelope keeps manager adjustments direct but exposure additions strong-confirmation', () => {
  const safety = new WisdoSafetyService();
  assert.equal(safety.classify({ type: 'ACTION', intent: 'TRIM_CAMPAIGN', commandName: 'WISDO_CAMPAIGN' }), 'DIRECT_MANAGER');
  assert.equal(safety.requiresConfirmation('DIRECT_MANAGER'), false);
  assert.equal(safety.classify({ type: 'ACTION', intent: 'SET_TRAIL_ATR', commandName: 'WISDO_CAMPAIGN' }), 'DIRECT_MANAGER');
  assert.equal(safety.classify({ type: 'ACTION', intent: 'ADD_POSITION_IF_VALID', commandName: 'WISDO_CAMPAIGN' }), 'DANGEROUS');
  assert.equal(safety.requiresStrongConfirmation('DANGEROUS'), true);
  assert.equal(voiceExecutionMode('live_authorized'), 'LIVE_AUTHORIZED');
  assert.throws(() => safety.assertVoiceExecutionMode([], 'anything_else'), /Unknown WISDO voice execution mode/);
});

test('V13 MQL bridge waits for HIGHTOWER acknowledgement and runtime overrides survive Direct input refresh', async () => {
  const [ea, receiver, reporter, bridge] = await Promise.all([
    fs.readFile(new URL('../mql4/HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4', import.meta.url), 'utf8'),
    fs.readFile(new URL('../mql4/include/WISDO_H620Receiver.mqh', import.meta.url), 'utf8'),
    fs.readFile(new URL('../mql4/CultureCoin_MT4_Reporter.mq4', import.meta.url), 'utf8'),
    fs.readFile(new URL('../mql4/include/WISDO_ReporterCampaign.mqh', import.meta.url), 'utf8'),
  ]);
  assert.match(ea, /gWisdoRuntimeStopATR/);
  assert.match(ea, /StopATRMultiplierValue=MathMax\(0\.05,MathMin\(20\.0,gWisdoRuntimeStopATR\)\)/);
  assert.match(ea, /WcoEffectiveTrailDistanceATR/);
  assert.match(ea, /WcoClearRuntime\(false\)/);
  assert.match(receiver, /op==15/);
  assert.match(receiver, /op==16/);
  assert.match(receiver, /op==17/);
  assert.match(receiver, /op==18/);
  assert.match(receiver, /op==19/);
  assert.match(receiver, /Never loosen an existing broker stop/);
  assert.match(reporter, /TryCompletePendingCampaignCommand/);
  assert.match(reporter, /completion deferred until EA acknowledgement/);
  assert.match(bridge, /op>20/);
  assert.match(bridge, /trimPercent/);
});
