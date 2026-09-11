import test from 'node:test';
import assert from 'node:assert/strict';

import { WorldEventEngineService, WORLD_SIGNAL_REVIEW_WINDOW_SECONDS } from '../services/worldEventEngineService.js';
import { WorldAvatarIdentityService, sanitizeAvatarConfiguration } from '../services/worldAvatarIdentityService.js';
import { installConfirmedTradeBridge } from '../server/worldLivingIdentityRoutes.js';

function repositoryFixture(seed = {}) {
  let state = structuredClone(seed);
  return {
    async loadState() { return state; },
    async updateState(mutator) {
      state = await mutator(state) || state;
      return state;
    },
    get state() { return state; },
  };
}

function signalFixture(overrides = {}) {
  const tradeTimestamp = new Date(Date.now() - 8_000).toISOString();
  return {
    signalId: 'sig-1001',
    leaderUserId: 'owner-1',
    leaderAccountId: 'acct-1',
    eaName: 'HIGHTOWER SOVEREIGN',
    sourceTicket: '99101',
    symbol: 'XAUUSD',
    side: 'BUY',
    lots: 0.1,
    openPrice: 2368.42,
    stopLoss: 2358.1,
    takeProfit: 2390,
    magicNumber: 26080204,
    tradeTimestamp,
    createdAt: new Date().toISOString(),
    status: 'active',
    ...overrides,
  };
}

test('World Signal Event uses the confirmed trade timestamp and an exact 120-second review window', async () => {
  const repository = repositoryFixture();
  const engine = new WorldEventEngineService({ repository });
  const event = await engine.ingestCreated(signalFixture());

  assert.equal(event.decisionWindowSeconds, WORLD_SIGNAL_REVIEW_WINDOW_SECONDS);
  assert.equal(Date.parse(event.expiresAt) - Date.parse(event.tradeTimestamp), 120_000);
  assert.equal(event.tradeStatus, 'active');
  assert.equal(event.presentationStatus, 'active');
  assert.equal(event.symbol, 'XAUUSD');
  assert.equal(event.direction, 'BUY');
});

test('confirmed MT4 bridge anchors the World countdown to Reporter trade openTime, not browser receipt or signal creation', async () => {
  const repository = repositoryFixture();
  const engine = new WorldEventEngineService({ repository });
  const reportedOpenTime = new Date(Date.now() - 47_000).toISOString();
  const signalCreatedAt = new Date().toISOString();
  const source = {
    async createSignalsBatch() {
      return [signalFixture({ signalId: 'sig-open-time', tradeTimestamp: undefined, createdAt: signalCreatedAt })];
    },
    async createSignal(input) {
      return signalFixture({ signalId: 'sig-direct-open-time', sourceTicket: String(input?.trade?.ticket || '99102'), tradeTimestamp: undefined, createdAt: signalCreatedAt });
    },
    queueSignalClosuresBatch(events) { return { queued: events.length }; },
  };
  installConfirmedTradeBridge(source, engine);

  await source.createSignalsBatch([{ trade: { ticket: '99101', openTime: reportedOpenTime, magicNumber: 26080204, comment: 'HIGHTOWER PRIMARY' } }]);
  const event = repository.state.worldSignalEventsById['world-signal:sig-open-time'];
  assert.ok(event);
  assert.equal(event.tradeTimestamp, reportedOpenTime);
  assert.equal(Date.parse(event.expiresAt) - Date.parse(reportedOpenTime), 120_000);
  assert.equal(event.magicNumber, 26080204);
  assert.equal(event.strategyName, 'HIGHTOWER PRIMARY');
  assert.ok(engine.remainingSeconds(event) <= 73 && engine.remainingSeconds(event) >= 71, `expected about 73 seconds remaining, got ${engine.remainingSeconds(event)}`);
});

test('World Signal Event ingestion is idempotent and cannot create a duplicate sky burst', async () => {
  const repository = repositoryFixture();
  const engine = new WorldEventEngineService({ repository });
  const signal = signalFixture();
  const first = await engine.ingestCreated(signal);
  const second = await engine.ingestCreated(signal);

  assert.equal(first.eventId, second.eventId);
  assert.deepEqual(repository.state.worldSignalEventIds, [first.eventId]);
  assert.equal(Object.keys(repository.state.worldSignalEventsById).length, 1);
});

test('World Signal Event permissions are enforced on the server projection', async () => {
  const repository = repositoryFixture();
  const engine = new WorldEventEngineService({ repository });
  const event = await engine.ingestCreated(signalFixture());

  const owner = await engine.getForViewer(event.eventId, { userId: 'owner-1' });
  const stranger = await engine.getForViewer(event.eventId, { userId: 'other-member' });
  assert.equal(owner.accountScope, 'acct-1');
  assert.equal(owner.lotSize, 0.1);
  assert.equal(stranger, null);

  const membersEvent = await engine.ingestCreated(signalFixture({ signalId: 'sig-members', visibility: 'MEMBERS' }));
  const member = await engine.getForViewer(membersEvent.eventId, { userId: 'other-member' });
  assert.equal(member.symbol, 'XAUUSD');
  assert.equal('accountScope' in member, false);
  assert.equal('lotSize' in member, false);
});

test('World Signal close transitions remove active sky state without deleting archive truth', async () => {
  const repository = repositoryFixture();
  const engine = new WorldEventEngineService({ repository });
  const created = await engine.ingestCreated(signalFixture());
  const closed = await engine.ingestClosed({ signalId: 'sig-1001' });

  assert.equal(closed.tradeStatus, 'closed');
  assert.equal(closed.presentationStatus, 'closed');
  const active = await engine.activeForViewer({ userId: 'owner-1' });
  assert.equal(active.events.length, 0);
  const archive = await engine.archiveForViewer({ userId: 'owner-1' });
  assert.equal(archive.events.some((event) => event.eventId === created.eventId && event.tradeStatus === 'closed'), true);
});

test('World presentation can aggregate rapid same-campaign signals while preserving every trade event', async () => {
  const repository = repositoryFixture();
  const engine = new WorldEventEngineService({ repository });
  await engine.ingestCreated(signalFixture({ signalId: 'sig-a', sourceTicket: '1', campaignId: 'campaign-7', signalType: 'PRIMARY_ENTRY' }));
  await engine.ingestCreated(signalFixture({ signalId: 'sig-b', sourceTicket: '2', campaignId: 'campaign-7', signalType: 'ADD_ON' }));

  const active = await engine.activeForViewer({ userId: 'owner-1' });
  assert.equal(active.events.length, 2);
  assert.equal(active.presentation.length, 1);
  assert.equal(active.presentation[0].aggregateCount, 2);
  assert.deepEqual(new Set(active.presentation[0].signalIds), new Set(['sig-a', 'sig-b']));
});

test('World Event Engine bridges confirmed TradeSignalService results and emits one normalized event', async () => {
  const repository = repositoryFixture();
  const engine = new WorldEventEngineService({ repository });
  const source = {
    async createSignalsBatch() { return [signalFixture({ signalId: 'sig-bridge' })]; },
    async createSignal() { return signalFixture({ signalId: 'sig-direct' }); },
    queueSignalClosuresBatch(events) { return { queued: events.length }; },
  };
  const delivered = [];
  engine.subscribe({ userId: 'owner-1' }, (event) => delivered.push(event));
  engine.attachTradeSignalSource(source);

  await source.createSignalsBatch([]);
  assert.equal(delivered.filter((event) => event.type === 'bot.signal.created').length, 1);
  await source.createSignalsBatch([]);
  assert.equal(delivered.filter((event) => event.type === 'bot.signal.created').length, 1, 'duplicate confirmed signal must not broadcast twice');

  source.queueSignalClosuresBatch([{ signalId: 'sig-bridge', sourceTicket: '99101' }]);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(delivered.some((event) => event.type === 'bot.signal.updated' && event.detail?.tradeStatus === 'closed'), true);
});

test('Avatar configuration accepts render parameters but rejects raw biometric-adjacent capture payloads', () => {
  const avatar = sanitizeAvatarConfiguration({
    headPreset: 'angular',
    morphParameters: { faceWidth: 0.25, jawWidth: -0.1, unknownMorph: 10 },
    skinMaterial: 'neutral-5',
    hairPreset: 'waves',
    facialHairPreset: 'short-beard',
    bodyPreset: 'athletic',
    heightSetting: 'tall',
    outfit: 'cem-operator-black-gold',
    accessories: ['watch-gold'],
  });
  assert.equal(avatar.topology, 'wisdo-operator-standard-v1');
  assert.equal(avatar.morphParameters.faceWidth, 0.25);
  assert.equal('unknownMorph' in avatar.morphParameters, false);
  assert.throws(() => sanitizeAvatarConfiguration({ rawImage: 'data:image/jpeg;base64,abc' }), /Raw facial capture data is not accepted/);
  assert.throws(() => sanitizeAvatarConfiguration({ faceLandmarks: [1, 2, 3] }), /Raw facial capture data is not accepted/);
});

test('Avatar phone pairing token is scoped, short-lived, single-use, and never persisted as account access', async () => {
  const repository = repositoryFixture();
  const engine = new WorldEventEngineService({ repository });
  const identity = new WorldAvatarIdentityService({ repository, eventEngine: engine, sessionTtlMs: 60_000 });
  const user = { id: 'owner-1', username: 'Operator' };
  const session = identity.createScanSession(user, 'https://wisdo.example');

  assert.match(session.captureUrl, /\/world\/avatar-scan#token=/);
  assert.equal(session.purpose, 'world-avatar-scan');
  assert.equal(JSON.stringify(repository.state).includes(session.token), false);

  const completed = identity.submitScanDraft(session.token, {
    avatar: { headPreset: 'oval', skinMaterial: 'neutral-4', hairPreset: 'short-curls', bodyPreset: 'balanced' },
    quality: { faceDetected: true, lighting: 'good', blur: 'good', posesCompleted: 5, processor: 'browser-face-detector' },
  });
  assert.equal(completed.status, 'ready_for_preview');
  assert.throws(() => identity.submitScanDraft(session.token, { avatar: {} }), /already been used|not found/i);

  const preview = identity.getOwnedSession(user, session.sessionId);
  assert.equal(preview.draftAvatar.headPreset, 'oval');
  assert.equal(preview.rawCaptureStored, false);
  const accepted = await identity.acceptScanSession(user, session.sessionId);
  assert.equal(accepted.operator.operatorId, 'operator:owner-1');
  assert.equal(accepted.operator.source, 'scan_derived');
  assert.equal(accepted.rawCaptureStored, false);
  assert.equal(JSON.stringify(repository.state).match(/rawImage|faceLandmark|embedding|biometric/i), null);
});

test('Avatar update publishes avatar.updated only to the owning World member', async () => {
  const repository = repositoryFixture();
  const engine = new WorldEventEngineService({ repository });
  const identity = new WorldAvatarIdentityService({ repository, eventEngine: engine });
  const ownerEvents = [];
  const strangerEvents = [];
  engine.subscribe({ userId: 'owner-1' }, (event) => ownerEvents.push(event));
  engine.subscribe({ userId: 'other-member' }, (event) => strangerEvents.push(event));

  await identity.saveManualOperator({ id: 'owner-1', username: 'Operator' }, {
    headPreset: 'standard', skinMaterial: 'neutral-4', hairPreset: 'close', bodyPreset: 'balanced', outfit: 'cem-operator-black-gold',
  });

  assert.equal(ownerEvents.some((event) => event.type === 'avatar.updated'), true);
  assert.equal(strangerEvents.some((event) => event.type === 'avatar.updated'), false);
});
