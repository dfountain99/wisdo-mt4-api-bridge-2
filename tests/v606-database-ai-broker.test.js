import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

import { connectMetaApiAccount, ensureBrokerApiState, sanitizeBrokerApiConnection } from '../services/brokerApiConnectionService.js';
import { enqueueCoachNotifications, generateWisdoCoachMessage, setWisdoCoachPreferences } from '../services/wisdoAiCoachService.js';
import { createPersistenceAdapter, MemoryPersistenceAdapter } from '../services/persistenceAdapter.js';
import { NotificationDeliveryService } from '../services/notificationDeliveryService.js';

process.env.ENCRYPTION_KEY = 'v606-test-encryption-key-abcdefghijklmnopqrstuvwxyz';

test('MetaApi broker connection imports a live snapshot into PostgreSQL-shaped state without exposing credentials', async () => {
  const state = { tradingAccounts: {}, accountTelemetry: {}, trades: {} };
  ensureBrokerApiState(state);
  const fetchImpl = async (url) => {
    const path = String(url);
    if (path.includes('/account-information')) return new Response(JSON.stringify({ login: 555001, platform: 'mt4', broker: 'Test Broker', server: 'Broker-Live', balance: 10000, equity: 10025, margin: 150, freeMargin: 9875, currency: 'USD', leverage: 100, tradeAllowed: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (path.includes('/positions')) return new Response(JSON.stringify([{ id: 'P-1', symbol: 'XAUUSD', type: 'POSITION_TYPE_BUY', volume: 0.1, openPrice: 2400, currentPrice: 2401, profit: 10 }]), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await connectMetaApiAccount({ state, userId: 'user-1', token: 'secret-provider-token', accountId: 'provider-account', region: 'new-york', deskRole: 'lead', nickname: 'API Lead', fetchImpl });
  assert.equal(result.account.balance, 10000);
  assert.equal(result.account.open_trades, 1);
  assert.equal(result.account.execution_transport, 'monitor_only');
  assert.equal(result.account.api_execution_enabled, false);
  assert.equal(result.account.reporter_connected, false);
  assert.equal(sanitizeBrokerApiConnection(result.connection).encryptedCredentials, undefined);
  assert.equal(JSON.stringify(sanitizeBrokerApiConnection(result.connection)).includes('secret-provider-token'), false);
});

test('WISDO coach grounds education in lane snapshots and stores shared learning memory in database state', async () => {
  delete process.env.OPENAI_API_KEY;
  const state = {
    profiles: { 'user-1': { email: 'member@example.com', phone: '+19045550100', discord_id: '1234567890' } },
    tradingAccounts: {
      lead: { id: 'lead', user_id: 'user-1', balance: 1000, equity: 980, floating_pl: -20, open_trades: 2, reporter_connected: true, status: 'connected' },
      follow: { id: 'follow', user_id: 'user-1', balance: 500, equity: 495, floating_pl: -5, open_trades: 2, reporter_connected: true, status: 'connected' },
    },
    accountTelemetry: {
      lead: { receivedAt: new Date().toISOString(), balance: 1000, equity: 980, floatingPL: -20, openTrades: [] },
      follow: { receivedAt: new Date().toISOString(), balance: 500, equity: 495, floatingPL: -5, openTrades: [] },
    },
    cultureLanesById: { lane: { laneId: 'lane', ownerUserId: 'user-1', name: 'Test Lane', leaderAccountId: 'lead', followerAccountIds: ['follow'], accountIds: ['lead', 'follow'], status: 'active' } },
    trades: {
      t1: { id: 't1', account_id: 'lead', symbol: 'XAUUSD', status: 'closed', close_time: new Date().toISOString(), profit: 25 },
      t2: { id: 't2', account_id: 'lead', symbol: 'GBPUSD', status: 'closed', close_time: new Date().toISOString(), profit: -10 },
    },
  };
  const message = await generateWisdoCoachMessage(state, { userId: 'user-1', laneId: 'lane', mode: 'academy', question: 'Teach me from this lane.' });
  assert.equal(message.aiGenerated, false);
  assert.match(message.summary, /combined equity/i);
  assert.match(message.education, /closed trades/i);
  assert.equal(Object.keys(state.wisdoCoachMessagesById).length, 1);
  assert.equal(Object.keys(state.wisdoSharedLearningMemoryById).length, 1);
  setWisdoCoachPreferences(state, 'user-1', { enabled: true, email: true, sms: true, discordDm: true, minimumSeverity: 'info' });
  message.shouldNotify = true;
  message.notificationSeverity = 'warning';
  const notifications = enqueueCoachNotifications(state, message);
  assert.deepEqual(notifications.map((row) => row.channel).sort(), ['discord_dm', 'email', 'sms']);
});

test('production persistence refuses JSON files while local tests use volatile memory', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDatabase = process.env.DATABASE_URL;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    assert.throws(() => createPersistenceAdapter({ persistence: { mode: 'json' } }, { defaultState: () => ({}) }), /DATABASE_URL/);
    process.env.NODE_ENV = 'test';
    const adapter = createPersistenceAdapter({ persistence: { mode: 'json' } }, { defaultState: () => ({}) });
    assert.ok(adapter instanceof MemoryPersistenceAdapter);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    if (previousDatabase === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousDatabase;
  }
});

test('WISDO notification delivery advertises opt-in Discord DM support', () => {
  const previous = process.env.DISCORD_TOKEN;
  process.env.DISCORD_TOKEN = 'test-token';
  const service = new NotificationDeliveryService({ loadEcosystemState: async () => ({}), saveEcosystemState: async () => undefined });
  assert.equal(service.providerHealth().discordDmConfigured, true);
  if (previous === undefined) delete process.env.DISCORD_TOKEN; else process.env.DISCORD_TOKEN = previous;
});

test('member UI exposes Broker API, active Lane Coach, contextual Academy AI, and Reporter v1.58 resilience', async () => {
  const [workspace, reporter, config, routes] = await Promise.all([
    fs.readFile(new URL('../public/js/workspace.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../mql4/CultureCoin_MT4_Reporter.mq4', import.meta.url), 'utf8'),
    fs.readFile(new URL('../config.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../server/majorUpgradeRoutes.js', import.meta.url), 'utf8'),
  ]);
  assert.match(workspace, /Connect without Reporter/);
  assert.match(workspace, /Active WISDO portfolio coach/);
  assert.match(workspace, /Build lesson from my lane/);
  assert.match(reporter, /#property version\s+"1\.58"/);
  assert.match(reporter, /NetworkBackoffMaxSeconds/);
  assert.match(config, /databaseRequired = isProductionRuntime/);
  assert.match(routes, /sync-broker-apis/);
});

test('active WISDO services use database state stores and background AI/broker workers are registered', async () => {
  const files = await Promise.all([
    fs.readFile(new URL('../storage/operatorDeskRepository.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../services/tradeSignalService.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../services/botRegistryService.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../services/rankService.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../services/deskDashboardService.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../server/majorUpgradeRoutes.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../server/extendedProductRoutes.js', import.meta.url), 'utf8'),
  ]);
  for (const source of files.slice(0, 5)) {
    assert.doesNotMatch(source, /atomicWriteJson|JsonFileStore|readFile\(this\.filePath/);
  }
  assert.match(files[5], /WISDO_BACKGROUND_WORKERS_ENABLED/);
  assert.match(files[5], /runBrokerApiSync/);
  assert.match(files[5], /runProactiveCoach/);
  assert.match(files[6], /wisdoSharedLearningMemoryById/);
  assert.match(files[6], /source: 'academy_tutor'/);
});
