import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { Mt4CommandService } from '../services/mt4CommandService.js';
import { Mt4SyncService } from '../services/mt4SyncService.js';
import { SignalGridService } from '../services/signalGridService.js';

function clone(value) { return structuredClone(value); }

class CountingPersistenceAdapter {
  constructor(state = {}) { this.state = clone(state); this.atomicUpdates = 0; this.loads = 0; }
  async load() { this.loads += 1; return clone(this.state); }
  async save(next) { this.state = clone(next); return clone(this.state); }
  async atomicUpdate(updater) {
    this.atomicUpdates += 1;
    const working = clone(this.state);
    this.state = clone((await updater(working)) || working);
    return clone(this.state);
  }
}

function emptyCommandState() {
  return { commandsByUserId: {}, commandsByAccountId: {}, commandQueue: [], commandAuditLog: [] };
}

test('101 copier commands enter the MT4 queue in one persistence mutation', async () => {
  const persistenceAdapter = new CountingPersistenceAdapter(emptyCommandState());
  const service = new Mt4CommandService({ persistenceAdapter });
  const inputs = Array.from({ length: 101 }, (_, index) => ({
    userId: 'receiver-user',
    accountId: 'receiver-account',
    command: 'COPY_OPEN_TRADE',
    payload: { accountId: 'receiver-account', signalId: `sig_${index}`, symbol: 'EURUSD', lots: 0.01 },
  }));
  const queued = await service.queueCommandsForAccountsBatch(inputs);
  assert.equal(queued.length, 101);
  assert.equal(persistenceAdapter.atomicUpdates, 1);
  assert.equal((await persistenceAdapter.load()).commandQueue.length, 101);
});

test('empty command polls and status reads are read-only', async () => {
  const persistenceAdapter = new CountingPersistenceAdapter(emptyCommandState());
  const service = new Mt4CommandService({ persistenceAdapter });
  assert.equal(await service.getPendingCommand('user-1', { accountId: 'account-1' }), null);
  assert.equal(await service.getCommandStatus('user-1', 'missing', 'account-1'), null);
  assert.deepEqual(await service.getAllPendingCommands('user-1'), []);
  await service.getQueueStatus('user-1', 'account-1');
  assert.equal(persistenceAdapter.atomicUpdates, 0, 'Reporter idle polling must not write the command namespace');
});

test('terminal command history is bounded while active commands are preserved', async () => {
  const previous = process.env.WISDO_MT4_COMMAND_HISTORY_LIMIT;
  process.env.WISDO_MT4_COMMAND_HISTORY_LIMIT = '100';
  const completed = Array.from({ length: 180 }, (_, index) => ({
    id: `old_${index}`, userId: 'user-1', accountId: 'account-1', command: 'COPY_OPEN_TRADE', payload: {},
    status: 'completed', priority: 10, createdAt: new Date(Date.now() - index * 1000).toISOString(), completedAt: new Date(Date.now() - index * 1000).toISOString(),
  }));
  const active = { id: 'active_1', userId: 'user-1', accountId: 'account-1', command: 'COPY_OPEN_TRADE', payload: {}, status: 'pending', priority: 100, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString() };
  const state = emptyCommandState();
  state.commandQueue = [active, ...completed];
  state.commandsByUserId['user-1'] = [active, ...completed];
  state.commandsByAccountId['account-1'] = [active, ...completed];
  const persistenceAdapter = new CountingPersistenceAdapter(state);
  const service = new Mt4CommandService({ persistenceAdapter });
  await service.queueCommandForAccount('user-1', 'account-1', 'COPY_OPEN_TRADE', { accountId: 'account-1', symbol: 'GBPUSD', lots: 0.01 });
  const saved = await persistenceAdapter.load();
  assert.equal(saved.commandQueue.filter((row) => row.status === 'pending').length, 2);
  assert.equal(saved.commandQueue.filter((row) => row.status === 'completed').length, 100);
  if (previous === undefined) delete process.env.WISDO_MT4_COMMAND_HISTORY_LIMIT; else process.env.WISDO_MT4_COMMAND_HISTORY_LIMIT = previous;
});

test('101 signal-grid cells persist in one repository update', async () => {
  const repository = {
    state: {}, updates: 0,
    async updateState(updater) { this.updates += 1; this.state = (await updater(this.state)) || this.state; return this.state; },
  };
  const service = new SignalGridService({ repository, logger: { info() {}, warn() {}, error() {} } });
  const payloads = Array.from({ length: 101 }, (_, index) => ({
    id: `sig_${index}`, sourceId: 'leader-1', botId: 'wisdo', symbol: index % 2 ? 'EURUSD' : 'XAUUSD',
    direction: 'buy', balance: 1000, equity: 1000, openTradeCount: 1,
  }));
  const saved = await service.updateSignalCellsBatch(payloads);
  assert.equal(saved.length, 101);
  assert.equal(repository.updates, 1);
  assert.equal(Object.keys(repository.state.signalGridCellsById).length, 101);
});

test('concurrent signed-pairing recovery is coalesced into one state write', async () => {
  const previous = process.env.MT4_PAIRING_SIGNING_SECRET;
  process.env.MT4_PAIRING_SIGNING_SECRET = 'stable-test-secret';
  const repository = {
    state: { pairingCodes: {} }, updates: 0,
    async getPairingCode(code) { await new Promise((resolve) => setTimeout(resolve, 10)); return this.state.pairingCodes[code] || null; },
    async updateMt4State(updater) { this.updates += 1; this.state = (await updater(this.state)) || this.state; return this.state; },
    async flushMt4State() { return this.state; },
  };
  const service = new Mt4SyncService({ api: { mt4SyncApiKey: 'current' }, wisdo: {} }, repository);
  const code = service.buildSignedPairingCode('518140439489019906');
  const rows = await Promise.all(Array.from({ length: 8 }, () => service.getOrRecoverPairingCode(code)));
  assert.equal(new Set(rows.map((row) => row.discordUserId)).size, 1);
  assert.equal(repository.updates, 1);
  if (previous === undefined) delete process.env.MT4_PAIRING_SIGNING_SECRET; else process.env.MT4_PAIRING_SIGNING_SECRET = previous;
});

test('server enables compression, bounded JSON bodies, and pressure health telemetry', () => {
  const source = fs.readFileSync(path.resolve('server/apiServer.js'), 'utf8');
  assert.match(source, /import compression from 'compression'/);
  assert.match(source, /WISDO_JSON_BODY_LIMIT \|\| '4mb'/);
  assert.match(source, /\/health\/performance/);
  assert.match(source, /Slow HTTP request/);
  assert.doesNotMatch(source, /express\.json\(\{ limit: '200mb'/);
});
