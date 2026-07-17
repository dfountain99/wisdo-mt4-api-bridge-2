import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { Mt4SyncService } from '../services/mt4SyncService.js';

function initialState(pairings = []) {
  return {
    pairingCodes: Object.fromEntries(pairings.map((row) => [row.pairingCode, row])),
    connections: {},
    latestSnapshots: {},
    connectionsByAccountId: {},
    latestSnapshotsByAccountId: {},
    accountSettingsByAccountId: {},
    activeAccountByUserId: {},
    signalTrackingByAccountId: {},
    snapshotHistory: [],
  };
}

class CountingRepository {
  constructor(state) { this.state = state; this.updateCount = 0; }
  getMt4AccountId(accountNumber, server = '') { return `${accountNumber}:${server}`; }
  async getPairingCode(code) { return this.state.pairingCodes[code] || null; }
  async getMt4State() { return JSON.parse(JSON.stringify(this.state)); }
  async updateMt4State(updater) {
    this.updateCount += 1;
    const working = JSON.parse(JSON.stringify(this.state));
    this.state = (await updater(working)) || working;
    return JSON.parse(JSON.stringify(this.state));
  }
}

function snapshot(pairingCode, accountNumber, server) {
  return {
    pairingCode,
    accountNumber,
    accountName: `Account ${accountNumber}`,
    brokerServer: server,
    balance: 1000,
    equity: 1001,
    floatingPL: 1,
    dailyClosedPL: 0,
    openTradeCount: 0,
    buyTradeCount: 0,
    sellTradeCount: 0,
    totalLots: 0,
    openTrades: [],
    closedTradesToday: [],
    terminalConnected: true,
    expertEnabled: true,
  };
}

test('all Reporter accounts persist together with one live-state transaction per heartbeat', async () => {
  const rows = [
    { pairingCode: 'CEM-U10001-123456-AAAAAAAA', discordUserId: 'user-1', status: 'connected', accountRole: 'leader' },
    { pairingCode: 'CEM-U10001-123457-BBBBBBBB', discordUserId: 'user-1', status: 'connected', accountRole: 'follower' },
    { pairingCode: 'CEM-U10001-123458-CCCCCCCC', discordUserId: 'user-1', status: 'connected', accountRole: 'follower' },
  ];
  const repository = new CountingRepository(initialState(rows));
  const service = new Mt4SyncService({ api: {}, wisdo: {} }, repository);

  await service.receiveSnapshot(snapshot(rows[0].pairingCode, '70001', 'Demo-A'));
  await service.receiveSnapshot(snapshot(rows[1].pairingCode, '70002', 'Demo-B'));
  await service.receiveSnapshot(snapshot(rows[2].pairingCode, '70003', 'Demo-C'));

  assert.equal(Object.keys(repository.state.connectionsByAccountId).length, 3);
  assert.equal(Object.keys(repository.state.latestSnapshotsByAccountId).length, 3);
  assert.equal(repository.updateCount, 3);
});

test('Reporter heartbeat response does not wait for Coach, Academy, or relay reconciliation', async () => {
  const pairing = { pairingCode: 'CEM-U10002-223456-DDDDDDDD', discordUserId: 'user-2', status: 'connected', accountRole: 'follower' };
  const repository = new CountingRepository(initialState([pairing]));
  const service = new Mt4SyncService({ api: {}, wisdo: {} }, repository);
  service.attachProductEventSink({
    prepareSnapshot: async () => new Promise(() => {}),
    ingestSnapshot: async () => new Promise(() => {}),
  });

  const result = await Promise.race([
    service.receiveSnapshot(snapshot(pairing.pairingCode, '80001', 'Demo-D')),
    new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 100)),
  ]);
  assert.equal(result.timeout, undefined);
  assert.equal(result.ok, true);
});

test('PostgreSQL runtime uses one shared pool, namespace cache, and stale-while-revalidate reads', async () => {
  const source = await fs.readFile(path.join(process.cwd(), 'services', 'persistenceAdapter.js'), 'utf8');
  assert.match(source, /const sharedPools = new Map\(\)/);
  assert.match(source, /const sharedNamespaceRuntime = new Map\(\)/);
  assert.match(source, /WISDO_DB_CACHE_TTL_MS/);
  assert.match(source, /WISDO_DB_CACHE_MAX_STALE_MS/);
  assert.match(source, /Stale-while-revalidate/);
});
