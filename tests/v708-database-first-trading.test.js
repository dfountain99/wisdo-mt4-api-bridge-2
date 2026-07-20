import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { Mt4SyncService } from '../services/mt4SyncService.js';
import { PostgresMt4Store } from '../services/postgresMt4Store.js';

function snapshot(pairingCode, openTradeCount = 100) {
  return {
    pairingCode, accountNumber: '5205295', accountName: 'DB Test', brokerServer: 'Coinexx-Demo',
    balance: 10000, equity: 10010, margin: 100, freeMargin: 9910, marginLevel: 10000,
    floatingPL: 10, dailyClosedPL: 0, openTradeCount, buyTradeCount: openTradeCount, sellTradeCount: 0,
    totalLots: openTradeCount * 0.01, terminalConnected: true, expertEnabled: true,
    openTrades: Array.from({ length: openTradeCount }, (_, index) => ({
      ticket: String(index + 1), symbol: 'EURUSD', type: 'buy', lots: 0.01, openPrice: 1.1,
      currentPrice: 1.101, profit: 0.1, openTime: '2026-07-20T00:00:00.000Z',
    })),
  };
}

test('Reporter heartbeat uses narrow database context and one row-level commit', async () => {
  const pairingCode = 'CEM-DB708A';
  let contextReads = 0;
  let commits = 0;
  const repository = {
    async getPairingCode() { return { pairingCode, discordUserId: 'owner', channelId: 'desk', status: 'connected', accountNumber: '5205295', brokerServer: 'Coinexx-Demo', accountRole: 'private', expiresAt: '2036-01-01T00:00:00.000Z' }; },
    getMt4AccountId(account, server) { return `${account}:${server}`; },
    async getMt4SnapshotContext() { contextReads += 1; return { connection: null, settings: { accountRole: 'private' }, tracking: null, activeAccountId: null }; },
    async persistMt4Snapshot(payload) { commits += 1; assert.equal(payload.connectionRecord.accountId, '5205295:Coinexx-Demo'); return payload.latestSnapshotRecord; },
    async getMt4State() { assert.fail('full MT4 state must not be loaded'); },
    async updateMt4State() { assert.fail('full MT4 state must not be updated'); },
  };
  const service = new Mt4SyncService({ api: { mt4SyncApiKey: '' }, wisdo: {} }, repository);
  const result = await service.receiveSnapshot(snapshot(pairingCode));
  assert.equal(result.ok, true);
  assert.equal(contextReads, 1);
  assert.equal(commits, 1);
});

test('PostgreSQL snapshot transaction touches only normalized MT4 tables', async () => {
  const queries = [];
  const client = {
    async query(sql, params) { queries.push({ sql: String(sql), params }); return { rows: [] }; },
    release() {},
  };
  const store = new PostgresMt4Store({ databaseUrl: 'postgres://test', ssl: false });
  store.ready = Promise.resolve(true);
  store.pool = async () => ({ connect: async () => client, query: async (sql, params) => { queries.push({ sql: String(sql), params }); return { rows: [] }; } });
  await store.persistSnapshot({
    pairingRecord: { pairingCode: 'CEM-DB708A', discordUserId: 'owner', status: 'connected' },
    connectionRecord: { accountId: '1:Demo', discordUserId: 'owner', accountNumber: '1', brokerServer: 'Demo' },
    latestSnapshotRecord: { accountId: '1:Demo', discordUserId: 'owner', receivedAt: new Date().toISOString(), snapshot: { balance: 100, equity: 101 } },
    settings: {}, tracking: { openKeys: [] }, appendHistory: false,
  });
  const sql = queries.map((row) => row.sql).join('\n');
  assert.match(sql, /wisdo_mt4_pairings/);
  assert.match(sql, /wisdo_mt4_accounts/);
  assert.match(sql, /wisdo_mt4_signal_tracking/);
  assert.doesNotMatch(sql, /wisdo_state_sections/);
});

test('migration and runtime define relational trading tables', () => {
  const migration = fs.readFileSync(new URL('../scripts/migratePostgres.js', import.meta.url), 'utf8');
  const syncSource = fs.readFileSync(new URL('../services/mt4SyncService.js', import.meta.url), 'utf8');
  for (const table of ['wisdo_mt4_accounts', 'wisdo_mt4_pairings', 'wisdo_mt4_commands', 'wisdo_trade_signals']) {
    assert.match(migration, new RegExp(table));
  }
  assert.match(syncSource, /getMt4SnapshotContext/);
  assert.match(syncSource, /persistMt4Snapshot/);
});
