import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { OperatorDeskRepository } from '../storage/operatorDeskRepository.js';
import { Mt4SyncService } from '../services/mt4SyncService.js';
import { GrowthFunnelService } from '../services/growthFunnelService.js';
import { NotificationDeliveryService } from '../services/notificationDeliveryService.js';

async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'wisdo-stability-'));
}

function logger() {
  return { info() {}, warn() {}, error() {} };
}

test('MT4 signal tracking survives repository normalization and prevents duplicate opens', async () => {
  const dataDir = await makeTempDir();
  const repository = new OperatorDeskRepository(dataDir);
  const service = new Mt4SyncService({ api: {}, wisdo: {} }, repository);
  let sequence = 0;
  const closes = [];
  service.attachTradeSignalService({
    async createSignal({ trade }) { sequence += 1; return { signalId: `signal-${trade.ticket}-${sequence}` }; },
    async queueAutoCopyCloseRoutes(payload) { closes.push(payload); return []; },
  });

  const connectionRecord = { accountId: '10001:Demo', discordUserId: 'user-1', accountNumber: '10001', brokerServer: 'Demo', accountRole: 'leader' };
  const snapshot = (tickets) => ({ snapshot: { eaName: 'Test EA', eaVersion: '1', openTrades: tickets.map((ticket) => ({ ticket, symbol: 'EURUSD', type: 'buy', lots: 0.01, openTime: '2026-07-14T00:00:00.000Z' })) } });

  const first = await service.processTradeSignals({ connectionRecord, latestSnapshotRecord: snapshot([11, 12]) });
  const second = await service.processTradeSignals({ connectionRecord, latestSnapshotRecord: snapshot([11, 12]) });
  const third = await service.processTradeSignals({ connectionRecord, latestSnapshotRecord: snapshot([12]) });

  assert.equal(first.opened, 2);
  assert.equal(second.opened, 0);
  assert.equal(second.closed, 0);
  assert.equal(third.opened, 0);
  assert.equal(third.closed, 1);
  assert.equal(closes.length, 1);
  assert.equal(closes[0].sourceTicket, '11');

  const state = await repository.getMt4State();
  assert.deepEqual(state.signalTrackingByAccountId['10001:Demo'].openKeys.length, 1);
  assert.ok(state.signalTrackingByAccountId['10001:Demo'].tradeKeyToSignalId[state.signalTrackingByAccountId['10001:Demo'].openKeys[0]]);
});


test('MT4 rapid duplicate snapshots are coalesced instead of throwing HTTP 429', async () => {
  const dataDir = await makeTempDir();
  const repository = new OperatorDeskRepository(dataDir);
  const service = new Mt4SyncService({ api: {}, wisdo: {} }, repository);
  const first = service.checkRateLimit('CEM-TEST:10001');
  const second = service.checkRateLimit('CEM-TEST:10001');
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
  assert.ok(second.retryAfterMs > 0);
});

test('MT4 history is compacted and does not retain full trade arrays', async () => {
  const dataDir = await makeTempDir();
  const repository = new OperatorDeskRepository(dataDir);
  await repository.updateMt4State((state) => {
    state.snapshotHistory = [{
      discordUserId: 'user-1', accountId: '10001:Demo', receivedAt: new Date().toISOString(),
      snapshot: { accountNumber: '10001', brokerServer: 'Demo', balance: 1000, equity: 999, openTradeCount: 100, openTrades: Array.from({ length: 100 }, (_, i) => ({ ticket: i, comment: 'x'.repeat(1000) })), closedTradesToday: Array.from({ length: 100 }, (_, i) => ({ ticket: i })) },
    }];
    state.signalTrackingByAccountId['10001:Demo'] = { openKeys: ['key-1'], tradeKeyToSignalId: { 'key-1': 'signal-1', stale: 'signal-stale' }, updatedAt: new Date().toISOString() };
    return state;
  });
  const state = await repository.getMt4State();
  assert.equal(state.snapshotHistory.length, 1);
  assert.equal('openTrades' in state.snapshotHistory[0].snapshot, false);
  assert.equal('closedTradesToday' in state.snapshotHistory[0].snapshot, false);
  assert.deepEqual(state.signalTrackingByAccountId['10001:Demo'].tradeKeyToSignalId, { 'key-1': 'signal-1' });
  const raw = await fs.readFile(path.join(dataDir, 'mt4.json'), 'utf8');
  assert.ok(raw.length < 10_000);
});

test('growth funnel tracks attribution, deduplicates leads, and calculates the 1000-lead pace', async () => {
  let state = {};
  const service = new GrowthFunnelService({
    loadEcosystemState: async () => structuredClone(state),
    saveEcosystemState: async (next) => { state = structuredClone(next); },
    logger: logger(),
  });
  await service.recordVisit({ source: 'discord', medium: 'community', campaign: 'launch' });
  const first = await service.recordLead({ name: 'Member', email: 'member@example.com', source: 'discord', campaign: 'launch', smsConsent: true });
  const second = await service.recordLead({ name: 'Member Updated', email: 'member@example.com', source: 'discord', campaign: 'launch', smsConsent: true });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(Object.keys(state.funnelLeadsById).length, 1);
  const dashboard = await service.dashboard(new Date('2026-07-14T12:00:00Z'));
  assert.equal(dashboard.target, 1000);
  assert.equal(dashboard.leads, 1);
  assert.equal(dashboard.visits, 1);
  assert.equal(dashboard.requiredVisitors, 5000);
});

test('signup delivery queues email and consent-based SMS when providers are not configured', async () => {
  const previous = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,
  };
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_FROM_NUMBER;
  let state = {};
  const service = new NotificationDeliveryService({
    loadEcosystemState: async () => structuredClone(state),
    saveEcosystemState: async (next) => { state = structuredClone(next); },
    logger: logger(),
    publicBaseUrl: 'https://wisdo.example',
  });
  const queued = await service.queueSignupWelcome({ user: { id: 'u1', email: 'member@example.com', username: 'Member' }, phone: '(904) 555-1212', smsConsent: true });
  assert.equal(queued.length, 2);
  assert.equal(Object.values(state.notificationOutboxById).length, 2);
  assert.ok(Object.values(state.notificationOutboxById).every((item) => item.status === 'retrying'));
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test('personal lead learning token resolves safely and tracks video and AI engagement', async () => {
  const previousSecret = process.env.WISDO_LEAD_PORTAL_SECRET;
  process.env.WISDO_LEAD_PORTAL_SECRET = 'test-lead-portal-secret';
  let state = {};
  const service = new GrowthFunnelService({
    loadEcosystemState: async () => structuredClone(state),
    saveEcosystemState: async (next) => { state = structuredClone(next); },
    logger: logger(),
  });
  const { lead } = await service.recordLead({ name: 'Learner', email: 'learner@example.com', campaign: 'education', marketingConsent: true });
  const access = service.createAccessBundle(lead, 'https://wisdo.example');
  assert.match(access.portalUrl, /^https:\/\/wisdo\.example\/learn\//);
  assert.equal(access.resources.length >= 5, true);
  const resolved = await service.getLeadByToken(access.token);
  assert.equal(resolved.lead.id, lead.id);
  await service.recordEngagement({ token: access.token, type: 'video_completed', resourceId: 'reporter-setup-video', metadata: { duration: 120 } });
  await service.recordEngagement({ token: access.token, type: 'ai_question', resourceId: 'portable-ai' });
  const dashboard = await service.dashboard(new Date());
  assert.equal(dashboard.engagedLeads, 1);
  assert.equal(dashboard.engagementByType.video_completed, 1);
  assert.equal(dashboard.engagementByType.ai_question, 1);
  assert.equal(state.funnelLeadsById[lead.id].stage, 'engaged');
  if (previousSecret === undefined) delete process.env.WISDO_LEAD_PORTAL_SECRET; else process.env.WISDO_LEAD_PORTAL_SECRET = previousSecret;
});

test('consenting funnel leads receive an immediate learning-room email plus four scheduled lessons', async () => {
  const previous = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    WISDO_FUNNEL_SEQUENCE_STEP_MINUTES: process.env.WISDO_FUNNEL_SEQUENCE_STEP_MINUTES,
  };
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
  process.env.WISDO_FUNNEL_SEQUENCE_STEP_MINUTES = '1';
  let state = {};
  const service = new NotificationDeliveryService({
    loadEcosystemState: async () => structuredClone(state),
    saveEcosystemState: async (next) => { state = structuredClone(next); },
    logger: logger(),
    publicBaseUrl: 'https://wisdo.example',
  });
  const lead = { id: 'lead-education', name: 'Learner', email: 'learner@example.com', campaign: 'education', marketingConsent: true };
  const resources = [
    { id: 'reporter-setup-video', trackedUrl: 'https://wisdo.example/r/reporter' },
    { id: 'copier-safety-video', trackedUrl: 'https://wisdo.example/r/copier' },
    { id: 'ai-learning-room', trackedUrl: 'https://wisdo.example/r/ai' },
  ];
  const queued = await service.queueLeadConfirmation({ lead, marketingConsent: true, portalUrl: 'https://wisdo.example/learn/token', resources, unsubscribeUrl: 'https://wisdo.example/unsubscribe' });
  assert.equal(queued.length, 5);
  const outbox = Object.values(state.notificationOutboxById);
  assert.equal(outbox.filter((item) => item.template === 'lead_confirmation').length, 1);
  assert.equal(outbox.filter((item) => item.category === 'marketing_education').length, 4);
  assert.equal(outbox.filter((item) => item.category === 'marketing_education' && item.status === 'pending').length, 4);
  assert.equal(outbox.find((item) => item.template === 'lead_confirmation').status, 'retrying');
  const cancelled = await service.cancelLeadMarketing({ leadId: lead.id, email: lead.email });
  assert.equal(cancelled, 4);
  assert.equal(Object.values(state.notificationOutboxById).filter((item) => item.status === 'cancelled').length, 4);
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test('live relay repository accepts verified linked identities while preserving website route ownership', async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wisdo-relay-alias-'));
  t.after(() => fs.rm(dataDir, { recursive: true, force: true }));
  const repository = new OperatorDeskRepository(dataDir);
  await repository.initialize();
  await repository.updateMt4State((state) => {
    state.connectionsByAccountId['100:Demo'] = { accountId: '100:Demo', accountNumber: '100', brokerServer: 'Demo', discordUserId: 'discord-linked' };
    state.connectionsByAccountId['200:Demo'] = { accountId: '200:Demo', accountNumber: '200', brokerServer: 'Demo', discordUserId: 'discord-linked' };
    return state;
  });
  const rejected = await repository.upsertCopyRoute('website-user', { routeId: 'route-rejected', leaderAccountId: '100:Demo', followerAccountId: '200:Demo', status: 'active', risk: {} });
  assert.equal(rejected, null);
  const saved = await repository.upsertCopyRoute('website-user', { routeId: 'route-linked', leaderAccountId: '100:Demo', followerAccountId: '200:Demo', authorizedOwnerUserIds: ['discord-linked'], status: 'active', risk: {} });
  assert.equal(saved.ownerUserId, 'website-user');
  assert.equal(saved.leaderAccountId, '100:Demo');
  assert.equal(saved.followerAccountId, '200:Demo');
  const routes = await repository.getCopyRoutesForUser('website-user');
  assert.equal(routes.length, 1);
  assert.equal(routes[0].routeId, 'route-linked');
});
