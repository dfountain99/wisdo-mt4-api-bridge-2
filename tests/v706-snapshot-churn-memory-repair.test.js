import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { Mt4SyncService } from '../services/mt4SyncService.js';
import { TradeSignalService } from '../services/tradeSignalService.js';
import { ingestReporterSnapshotToProductState } from '../server/majorUpgradeRoutes.js';

function trade(ticket, overrides = {}) {
  return {
    ticket: String(ticket),
    symbol: 'EURUSD',
    type: 'buy',
    lots: 0.01,
    openPrice: 1.1,
    currentPrice: 1.11,
    stopLoss: 0,
    takeProfit: 0,
    profit: 1,
    swap: 0,
    commission: 0,
    openTime: '2026-07-20T00:00:00.000Z',
    ...overrides,
  };
}

function syncService({ signalService } = {}) {
  const repository = {
    async getMt4State() { return {}; },
    async updateMt4State(updater) { return updater({ signalTrackingByAccountId: {} }); },
  };
  const service = new Mt4SyncService({ api: { publicBaseUrl: '', port: 10000, mt4SyncPath: '/mt4-sync', mt4SyncApiKey: '' } }, repository);
  if (signalService) service.attachTradeSignalService(signalService);
  return service;
}

test('legacy signal tracking keys migrate by account and ticket without 100 false opens and closes', async () => {
  const opens = [];
  const closes = [];
  const signalService = {
    async createSignalsBatch(rows) { opens.push(...rows); return rows.map((row, index) => ({ signalId: `new-${index}` })); },
    queueSignalClosuresBatch(rows) { closes.push(...rows); },
  };
  const service = syncService({ signalService });
  const accountId = '5205295:Coinexx-Demo';
  const openTrades = Array.from({ length: 100 }, (_, index) => trade(index + 1, { openTime: '2026.07.20 00:00:00' }));
  const priorTracking = { openKeys: [], tradeKeyToSignalId: {} };
  for (const row of openTrades) {
    const legacyKey = [accountId, row.ticket, '2026-07-20T00:00:00.000Z', row.symbol, row.type].join('|');
    priorTracking.openKeys.push(legacyKey);
    priorTracking.tradeKeyToSignalId[legacyKey] = `sig-${row.ticket}`;
  }

  const result = await service.processTradeSignals({
    connectionRecord: { accountId, discordUserId: 'owner', accountNumber: '5205295', accountRole: 'leader' },
    latestSnapshotRecord: { snapshot: { openTrades } },
    priorTracking,
  });

  assert.equal(result.opened, 0);
  assert.equal(result.closed, 0);
  assert.equal(opens.length, 0);
  assert.equal(closes.length, 0);
  assert.equal(result.tracking.schemaVersion, 2);
  assert.equal(result.tracking.openKeys.length, 100);
  assert.equal(result.tracking.openKeys[0], `${accountId}|1`);
  assert.equal(result.tracking.tradeKeyToSignalId[`${accountId}|1`], 'sig-1');
});

test('changing open-time formatting does not recreate signals for an existing ticket', async () => {
  let opened = 0;
  let closed = 0;
  const signalService = {
    async createSignalsBatch(rows) { opened += rows.length; return rows.map((_, index) => ({ signalId: `sig-${index}` })); },
    queueSignalClosuresBatch(rows) { closed += rows.length; },
  };
  const service = syncService({ signalService });
  const accountId = 'acct:server';
  const first = await service.processTradeSignals({
    connectionRecord: { accountId, discordUserId: 'owner', accountRole: 'leader' },
    latestSnapshotRecord: { snapshot: { openTrades: [trade(77, { openTime: '2026.07.20 00:00:00' })] } },
    priorTracking: null,
  });
  const second = await service.processTradeSignals({
    connectionRecord: { accountId, discordUserId: 'owner', accountRole: 'leader' },
    latestSnapshotRecord: { snapshot: { openTrades: [trade(77, { openTime: '2026-07-20T00:00:00.000Z' })] } },
    priorTracking: first.tracking,
  });
  assert.equal(first.opened, 1);
  assert.equal(second.opened, 0);
  assert.equal(second.closed, 0);
  assert.equal(opened, 1);
  assert.equal(closed, 0);
});

test('slow deferred work keeps its worker slot until the real task settles', async () => {
  const service = new TradeSignalService({ config: {}, client: null, repository: {}, mt4CommandService: {}, copyTradingService: null, operatorDeskService: null, logger: { warn() {} } });
  service.backgroundConcurrency = 1;
  service.backgroundTaskTimeoutMs = 15;
  const events = [];
  service.enqueueBackgroundTask('first', async () => {
    events.push('first-start');
    await new Promise((resolve) => setTimeout(resolve, 80));
    events.push('first-end');
  });
  service.enqueueBackgroundTask('second', async () => { events.push('second-start'); });
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.deepEqual(events, ['first-start']);
  await new Promise((resolve) => setTimeout(resolve, 90));
  assert.deepEqual(events, ['first-start', 'first-end', 'second-start']);
});

test('post-snapshot work is coalesced per account instead of retaining every heartbeat', async () => {
  const service = syncService();
  service.postSnapshotWorkerRunning = true;
  for (let index = 0; index < 100; index += 1) {
    service.enqueuePostSnapshotWork({
      connectionRecord: { accountId: 'acct-1', discordUserId: 'owner' },
      latestSnapshotRecord: { accountId: 'acct-1', receivedAt: new Date(index).toISOString(), snapshot: { balance: index, openTrades: [trade(index + 1)] } },
      signalSummary: { opened: index },
    });
  }
  assert.equal(service.postSnapshotQueueByAccount.size, 1);
  assert.equal(service.postSnapshotQueueByAccount.get('acct-1').latestSnapshotRecord.snapshot.balance, 99);
  service.postSnapshotQueueByAccount.clear();
  service.postSnapshotWorkerRunning = false;
});

test('product ledger indexes account trades once and remains bounded during a 200-trade reconciliation', async () => {
  const state = {
    tradingAccounts: {}, accountTelemetry: {}, trades: {}, alerts: {}, liveTradeEventKeys: {}, accountHealthState: {}, relayDiagnostics: [], leaderCloseDetectionByTicket: {},
  };
  for (let index = 0; index < 4000; index += 1) {
    const id = `legacy-${index}`;
    state.trades[id] = { id, account_id: `other-${index % 20}`, external_ticket: String(index), status: 'closed', updated_at: new Date(index).toISOString() };
  }
  const openTrades = Array.from({ length: 100 }, (_, index) => trade(index + 1));
  const closedTradesToday = Array.from({ length: 100 }, (_, index) => trade(index + 101, { closeTime: '2026-07-20T01:00:00.000Z', closePrice: 1.12 }));
  const result = await ingestReporterSnapshotToProductState({
    connectionRecord: { accountId: 'leader-1', discordUserId: 'owner', accountNumber: '1', brokerServer: 'Demo' },
    latestSnapshotRecord: { receivedAt: '2026-07-20T01:00:00.000Z', snapshot: { balance: 1000, equity: 1000, openTradeCount: 100, openTrades, closedTradesToday, terminalConnected: true, expertEnabled: true } },
    signalSummary: { opened: 100, closed: 100 },
    loadEcosystemState: async () => state,
    saveEcosystemState: async () => state,
  });
  assert.equal(result.openUpserts, 100);
  assert.equal(result.closedUpserts, 100);
  assert.equal(Object.values(state.trades).filter((row) => row.account_id === 'leader-1').length, 200);
  const source = fs.readFileSync(new URL('../server/majorUpgradeRoutes.js', import.meta.url), 'utf8');
  const upsertSource = source.slice(source.indexOf('function upsertSnapshotTrade'), source.indexOf('export async function ingestReporterSnapshotToProductState'));
  assert.doesNotMatch(upsertSource, /Object\.values\(state\.trades\)\.find/);
});

test('buffered authoritative saves do not structured-clone the discarded previous namespace', () => {
  const source = fs.readFileSync(new URL('../services/persistenceAdapter.js', import.meta.url), 'utf8');
  assert.match(source, /Replacing a complete authoritative snapshot does not require cloning/);
  assert.doesNotMatch(source, /if \(this\.bufferWrites\) return this\.bufferedUpdate\(\(\) => snapshot/);
});
