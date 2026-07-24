import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { MemoryPersistenceAdapter, getDatabaseRuntimeHealth } from '../services/persistenceAdapter.js';

test('cloud-only recovery uses memory as a hot cache without restoring JSON file persistence', async () => {
  const persistence = await fs.readFile(path.join(process.cwd(), 'services', 'persistenceAdapter.js'), 'utf8');
  const stateStore = await fs.readFile(path.join(process.cwd(), 'storage', 'stateStore.js'), 'utf8');
  assert.match(persistence, /postgres-with-hot-cache/);
  assert.match(persistence, /WISDO_DB_FAIL_OPEN_READS/);
  assert.match(stateStore, /WISDO_DB_BUFFER_LIVE_WRITES/);
  assert.match(persistence, /pg_try_advisory_xact_lock/);
  assert.match(persistence, /WISDO_DB_CIRCUIT_BREAKER_MS/);
  assert.match(stateStore, /No laptop or JSON files participate/);
  assert.doesNotMatch(stateStore, /atomicJsonFile|jsonStore|writeFile/);
});

test('volatile development adapter preserves all account records together', async () => {
  const adapter = new MemoryPersistenceAdapter(() => ({ accounts: {} }));
  await adapter.atomicUpdate((state) => ({ accounts: { ...state.accounts, one: { id: 'one' } } }));
  await adapter.atomicUpdate((state) => ({ accounts: { ...state.accounts, two: { id: 'two' } } }));
  const state = await adapter.load();
  assert.deepEqual(Object.keys(state.accounts).sort(), ['one', 'two']);
});

test('database health endpoint model is available even before a pool is opened', () => {
  const health = getDatabaseRuntimeHealth();
  assert.equal(typeof health.status, 'string');
  assert.equal(typeof health.poolCount, 'number');
  assert.equal(typeof health.cachedNamespaces, 'number');
});

test('Redis command bridge shares the main PostgreSQL pool', async () => {
  const source = await fs.readFile(path.join(process.cwd(), 'services', 'redisCommandBridge.js'), 'utf8');
  assert.match(source, /getSharedPostgresPool/);
  assert.doesNotMatch(source, /new pg\.Pool/);
});
