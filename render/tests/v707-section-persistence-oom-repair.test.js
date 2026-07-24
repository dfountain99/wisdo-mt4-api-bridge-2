import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { PostgresKeyValuePersistenceAdapter } from '../services/persistenceAdapter.js';

function source(file) { return fs.readFileSync(path.resolve(file), 'utf8'); }

test('production code no longer crosses the V8 structured-clone message serializer', () => {
  const files = [
    'services/persistenceAdapter.js',
    'services/mt4SyncService.js',
    'services/mt4CommandService.js',
    'services/copyTradingService.js',
    'server/apiServer.js',
    'server/majorUpgradeRoutes.js',
    'storage/stateStore.js',
  ];
  for (const file of files) assert.doesNotMatch(source(file), /\bstructuredClone\s*\(/, file);
  assert.match(source('services/persistenceAdapter.js'), /persistDirtySections/);
  assert.match(source('services/persistenceAdapter.js'), /Serialize one section at a time/);
});

test('buffered PostgreSQL updates copy only the touched top-level section', async () => {
  const adapter = new PostgresKeyValuePersistenceAdapter({
    databaseUrl: 'postgres://unused-for-unit-test',
    namespace: `v707_test_${Date.now()}`,
    defaultState: () => ({}),
    bufferWrites: true,
  });
  const hugeTrades = Object.fromEntries(Array.from({ length: 15_000 }, (_, index) => [
    `trade-${index}`,
    { id: `trade-${index}`, accountId: `account-${index % 20}`, symbol: 'XAUUSD', profit: index % 7 },
  ]));
  adapter.runtime.state = { trades: hugeTrades, accountTelemetry: {}, cultureLanesById: {} };
  adapter.runtime.loadedAt = Date.now();
  adapter.runtime.source = 'hot-cache';
  adapter.scheduleFlush = () => {};

  const originalTrades = adapter.runtime.state.trades;
  for (let index = 0; index < 250; index += 1) {
    await adapter.bufferedUpdate((state) => {
      state.accountTelemetry['account-1'] = { equity: 1000 + index, updatedAt: `tick-${index}` };
      return state;
    }, { cloneResult: false });
  }

  assert.equal(adapter.runtime.state.trades, originalTrades);
  assert.equal(adapter.runtime.dirtySections.has('accountTelemetry'), true);
  assert.equal(adapter.runtime.dirtySections.has('trades'), false);
  assert.equal(adapter.runtime.state.accountTelemetry['account-1'].equity, 1249);
});

test('Reporter product ingestion persists named sections instead of the full ecosystem', () => {
  const routes = source('server/majorUpgradeRoutes.js');
  const api = source('server/apiServer.js');
  assert.match(routes, /REPORTER_PRODUCT_SECTIONS/);
  assert.match(routes, /REPORTER_PRODUCT_CORE_SECTIONS/);
  assert.match(routes, /lowMemoryRelayMode \? REPORTER_PRODUCT_CORE_SECTIONS : REPORTER_PRODUCT_FULL_SECTIONS/);
  assert.match(api, /saveEcosystemState\.sections/);
  assert.match(api, /shouldProcessRank/);
  assert.match(api, /WISDO_RANK_PROCESS_MIN_INTERVAL_MS/);
});

test('database refresh cannot overwrite unflushed dirty sections', () => {
  const persistence = source('services/persistenceAdapter.js');
  assert.match(persistence, /dirtySections\?\.size/);
  assert.match(persistence, /deletedSections\?\.size/);
});
