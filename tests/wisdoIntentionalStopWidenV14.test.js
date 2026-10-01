import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { WisdoIntentService } from '../services/wisdoIntentService.js';
import { WisdoSafetyService } from '../services/wisdoSafetyService.js';
import { campaignPacket } from '../services/campaignControlContract.js';
import { WORLD_COMMAND_DEFINITIONS } from '../services/worldCommandCenterService.js';

const control = () => ({
  live: true, version: 1, symbol: 'XAUUSD', magic: 880099, campaignId: 42, phase: 1, direction: 1,
  rail: 2300, pendingId: 0, ackId: 0,
  positions: [{ ticket: 101, role: 0 }, { ticket: 102, role: 1 }],
  levels: [],
  runtime: { overrideMask: 0, scope: 0, stopAtr: 1.5, trailStartAtr: 1, trailDistanceAtr: 0.75, trailStepAtr: 0.15 },
});

test('V14 voice grammar separates ordinary stop policy from intentional widening', () => {
  const service = new WisdoIntentService();

  const widen = service.deterministic('Wisdo, intentionally widen my existing stop losses to 16 ATR');
  assert.equal(widen.intent, 'WIDEN_EXISTING_STOPS');
  assert.equal(widen.commandName, 'WISDO_CAMPAIGN');
  assert.equal(widen.parameters.action, 'WIDEN_EXISTING_STOPS');
  assert.equal(widen.parameters.stopAtr, 16);
  assert.equal(widen.riskIncreasing, true);
  assert.equal(widen.requiresExplicitConfirmation, true);

  const ordinary = service.deterministic('Wisdo, move stop losses to 16 ATR');
  assert.equal(ordinary.intent, 'SET_STOP_ATR');

  const missingValue = service.deterministic('Wisdo, widen my existing stops');
  assert.equal(missingValue.intent, 'WIDEN_EXISTING_STOPS');
  assert.equal(missingValue.parameters.stopAtr, null);
  assert.ok(missingValue.confidence < service.confidenceThreshold);

  const trail = service.deterministic('Wisdo, loosen the trailer a little');
  assert.equal(trail.intent, 'SET_TRAIL_ATR');

  const restore = service.deterministic('Wisdo, return stops to normal EA management');
  assert.equal(restore.intent, 'CLEAR_RUNTIME_OVERRIDES');
});

test('V14 stop widening is a strong-confirmation risk-increasing command', () => {
  const safety = new WisdoSafetyService();
  const level = safety.classify({ type: 'ACTION', intent: 'WIDEN_EXISTING_STOPS', commandName: 'WISDO_CAMPAIGN' });
  assert.equal(level, 'DANGEROUS');
  assert.equal(safety.requiresConfirmation(level), true);
  assert.equal(safety.requiresStrongConfirmation(level), true);

  const definition = WORLD_COMMAND_DEFINITIONS.WIDEN_EXISTING_STOPS;
  assert.equal(definition.level, 3);
  assert.notEqual(definition.directManager, true);
});

test('V14 campaign packet bounds and scopes intentional stop widening', () => {
  const state = { campaignControl: control() };
  const packet = campaignPacket('WIDEN_EXISTING_STOPS', { eaCampaignId: 42, stopAtr: 16 }, state);
  assert.equal(packet.operation, 20);
  assert.equal(packet.stopAtr, 16);
  assert.equal(packet.symbol, 'XAUUSD');
  assert.equal(packet.magicNumber, 880099);
  assert.equal(packet.runtimeScope, 0);

  assert.throws(() => campaignPacket('WIDEN_EXISTING_STOPS', { eaCampaignId: 42, stopAtr: 0 }, state), /between 0.05 and 20/);
  assert.throws(() => campaignPacket('WIDEN_EXISTING_STOPS', { eaCampaignId: 42, stopAtr: 21 }, state), /between 0.05 and 20/);
  assert.throws(() => campaignPacket('WIDEN_EXISTING_STOPS', { eaCampaignId: 41, stopAtr: 16 }, state), /Campaign changed/);
});

test('V14 MQL bridge keeps widened stops under explicit ticket authority until restored', async () => {
  const [ea, receiver, bridge, reporter, conversation, commandUi] = await Promise.all([
    fs.readFile(new URL('../mql4/HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4', import.meta.url), 'utf8'),
    fs.readFile(new URL('../mql4/include/WISDO_H620Receiver.mqh', import.meta.url), 'utf8'),
    fs.readFile(new URL('../mql4/include/WISDO_ReporterCampaign.mqh', import.meta.url), 'utf8'),
    fs.readFile(new URL('../mql4/CultureCoin_MT4_Reporter.mq4', import.meta.url), 'utf8'),
    fs.readFile(new URL('../services/wisdoConversationService.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../public/app/world/command/command-center-runtime.js', import.meta.url), 'utf8'),
  ]);

  assert.match(receiver, /WcoWidenExistingStops/);
  assert.match(receiver, /manualWideStop/);
  assert.match(receiver, /op==20/);
  assert.match(receiver, /return requested==0 \|\| changed==requested|return changed==requested/);
  assert.match(ea, /manualWideStop/);
  assert.match(ea, /protection may not tighten the stop/);
  assert.match(bridge, /op>20/);
  assert.match(reporter, /REPORTER_VERSION = "1\.62"/);
  assert.match(reporter, /verified intentional stop widening/);
  assert.match(conversation, /increase the maximum loss/);
  assert.match(commandUi, /WIDEN_EXISTING_STOPS/);
  assert.match(commandUi, /WIDEN_EXISTING_STOPS/);
  assert.match(commandUi, /Intentional stop widening can increase maximum loss/);
});
