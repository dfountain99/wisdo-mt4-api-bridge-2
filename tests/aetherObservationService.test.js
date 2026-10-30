import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAetherObservation } from '../services/aetherObservationService.js';

const snapshot = (overrides = {}) => ({
  account: { accountId: 'acct-demo' },
  financial: { balance: 1000, equity: 950, floatingPL: -50, margin: null, freeMargin: null, marginLevel: null },
  executionHealth: { reporter: 'LIVE', lastSyncAt: new Date().toISOString(), commandLinkReady: true },
  campaigns: [{ campaignId: 'derived:XAUUSD:BUY:1:EA', campaignIdentitySource: 'derived_grouping', symbol: 'XAUUSD', direction: 'BUY', positionCount: 1, positions: [{ ticket: 10 }] }],
  ...overrides,
});

test('fresh Reporter observations are not mislabeled as broker execution truth', () => {
  const observation = buildAetherObservation(snapshot());
  assert.equal(observation.connection, 'LIVE');
  assert.equal(observation.confidenceGrade, 'B');
  assert.equal(observation.authority, 'reporter_observation_not_broker_receipt');
  assert.equal(observation.eaReceiverReady, false);
  assert.equal(observation.fields.equity.value, 950);
  assert.equal(observation.fields.marginLevel.value, null);
  assert.equal(observation.fields.marginLevel.grade, 'U');
  assert.deepEqual(observation.missingCriticalFields, ['marginLevel']);
  assert.equal(observation.campaigns[0].identityVerified, false);
});

test('stale telemetry cannot advertise a ready command link or EA receiver', () => {
  const observation = buildAetherObservation(snapshot({
    executionHealth: { reporter: 'STALE', lastSyncAt: new Date(Date.now() - 120000).toISOString(), commandLinkReady: true },
    campaignControl: { live: true },
  }));
  assert.equal(observation.connection, 'STALE');
  assert.equal(observation.confidenceGrade, 'D');
  assert.equal(observation.commandLinkReady, false);
  assert.equal(observation.eaReceiverReady, false);
});

test('explicit EA campaign identity is distinguished from inferred grouping', () => {
  const observation = buildAetherObservation(snapshot({
    campaigns: [{ campaignId: 'ea-campaign-7', campaignIdentitySource: 'backend_campaign', symbol: 'XAUUSD', direction: 'SELL', positionCount: 2, positions: [{ ticket: 2 }, { ticket: 1 }] }],
  }));
  assert.equal(observation.campaigns[0].identitySource, 'ea_explicit');
  assert.equal(observation.campaigns[0].identityVerified, true);
  assert.deepEqual(observation.campaigns[0].tickets, ['1', '2']);
  assert.match(observation.fingerprint, /^[a-f0-9]{64}$/);
});

test('no selected account produces unknown observations without inventing financial data', () => {
  const observation = buildAetherObservation({});
  assert.equal(observation.accountId, null);
  assert.equal(observation.connection, 'UNAVAILABLE');
  assert.equal(observation.fields.balance.value, null);
  assert.equal(observation.commandLinkReady, false);
  assert.equal(observation.eaReceiverReady, false);
});
