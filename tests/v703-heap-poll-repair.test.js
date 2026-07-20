import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { Mt4CommandService } from '../services/mt4CommandService.js';

function clone(value) { return structuredClone(value); }

class CountingAdapter {
  constructor(state = {}) { this.state = clone(state); this.loads = 0; this.atomicUpdates = 0; }
  async load() { this.loads += 1; return clone(this.state); }
  async save(next) { this.state = clone(next); return clone(this.state); }
  async atomicUpdate(updater) {
    this.atomicUpdates += 1;
    const working = clone(this.state);
    this.state = clone((await updater(working)) || working);
    return clone(this.state);
  }
}

function command(index, status = 'completed') {
  return {
    id: `cmd_${index}`,
    userId: index % 2 ? 'user-a' : 'user-b',
    accountId: index % 2 ? 'account-a' : 'account-b',
    command: 'COPY_OPEN_TRADE',
    status,
    priority: 10,
    createdAt: new Date(Date.now() - index * 1000).toISOString(),
    completedAt: status === 'completed' ? new Date(Date.now() - index * 1000).toISOString() : undefined,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    payload: { symbol: 'EURUSD', copyRisk: { allowedSymbols: Array.from({ length: 20 }, (_, n) => `SYM${n}`) } },
  };
}

function legacyState(count = 300) {
  const rows = Array.from({ length: count }, (_, index) => command(index));
  const pending = command(count + 1, 'pending');
  pending.id = 'pending-command';
  pending.userId = 'user-a';
  pending.accountId = 'account-a';
  const all = [pending, ...rows];
  return {
    commandQueue: clone(all),
    commandsByUserId: {
      'user-a': clone(all.filter((row) => row.userId === 'user-a')),
      'user-b': clone(all.filter((row) => row.userId === 'user-b')),
    },
    commandsByAccountId: {
      'account-a': clone(all.filter((row) => row.accountId === 'account-a')),
      'account-b': clone(all.filter((row) => row.accountId === 'account-b')),
    },
    commandAuditLog: [],
  };
}

test('one thousand idle Reporter polls share one hot command-state read and perform zero writes', async () => {
  const adapter = new CountingAdapter(legacyState());
  const service = new Mt4CommandService({ persistenceAdapter: adapter });
  await Promise.all(Array.from({ length: 1000 }, () => service.getPendingCommandForAnyUser(['missing-user'], { accountId: 'missing-account' })));
  assert.equal(adapter.loads, 1);
  assert.equal(adapter.atomicUpdates, 0);
});

test('command persistence migrates legacy triple indexes into one compact durable queue', async () => {
  const original = legacyState();
  const adapter = new CountingAdapter(original);
  const service = new Mt4CommandService({ persistenceAdapter: adapter });
  const found = await service.getPendingCommandForAnyUser(['user-a'], { accountId: 'account-a' });
  assert.equal(found.command.id, 'pending-command');
  await service.markCommandDeliveredForAnyUser(['user-a'], found.command.id, 'account-a');
  assert.ok(Array.isArray(adapter.state.commandQueue));
  assert.equal(adapter.state.commandsByUserId, undefined);
  assert.equal(adapter.state.commandsByAccountId, undefined);
  assert.equal(adapter.state.schemaVersion, 2);
  assert.ok(JSON.stringify(adapter.state).length < JSON.stringify(original).length * 0.55);
});

test('performance health uses compact metrics and server sheds noncritical reads under heap pressure', () => {
  const source = fs.readFileSync(path.resolve('server/apiServer.js'), 'utf8');
  assert.match(source, /getQueueMetrics/);
  assert.doesNotMatch(source, /const commandState = await mt4CommandService\?\.load/);
  assert.match(source, /WISDO_MEMORY_PRESSURE_SHED/);
  assert.match(source, /criticalMemoryPaths/);
  assert.match(source, /scheduleReporterHeartbeat/);
  assert.doesNotMatch(source, /await redisCommandBridge\.heartbeat\(\{[\s\S]*?poll: true/);
});

test('persistence cloning avoids JSON stringify heap spikes and exposes a read-only hot peek', () => {
  const source = fs.readFileSync(path.resolve('services/persistenceAdapter.js'), 'utf8');
  assert.match(source, /globalThis\.structuredClone/);
  assert.match(source, /peek\(\) \{ return this\.runtime\.state; \}/);
  assert.match(source, /One working copy is enough/);
});
