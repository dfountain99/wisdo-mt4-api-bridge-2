import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migrationSource = readFileSync(new URL('../scripts/migratePostgres.js', import.meta.url), 'utf8');

test('v8.0.1 migration uses the configured pool for all SQL blocks', () => {
  const poolQueryCount = migrationSource.match(/\bpool\.query\s*\(/g)?.length ?? 0;
  assert.ok(poolQueryCount >= 2, `Expected at least two pool.query calls, found ${poolQueryCount}.`);
  assert.equal(migrationSource.includes('client.query('), false);
});

test('v8.0.1 snapshot persistence restores and validates pairing code', () => {
  const storeSource = readFileSync(new URL('../services/postgresMt4Store.js', import.meta.url), 'utf8');
  const syncSource = readFileSync(new URL('../services/mt4SyncService.js', import.meta.url), 'utf8');
  assert.match(storeSource, /pairingCode|pairing_code/);
  assert.match(syncSource, /snapshot\.pairingCode|connectionRecord\.pairingCode|pairingRecord\.pairingCode/);
});
