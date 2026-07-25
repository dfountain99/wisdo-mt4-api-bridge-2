import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migration = fs.readFileSync(new URL('../scripts/migratePostgres.js', import.meta.url), 'utf8');
const sync = fs.readFileSync(new URL('../services/mt4SyncService.js', import.meta.url), 'utf8');
const store = fs.readFileSync(new URL('../services/postgresMt4Store.js', import.meta.url), 'utf8');

test('v8.0.1 migration uses the configured pool for all SQL blocks', () => {
  assert.doesNotMatch(migration, /await client\.query/);
  assert.ok((migration.match(/await pool\.query/g) || []).length >= 2);
});

test('v8.0.1 snapshot persistence restores and validates pairing code', () => {
  assert.match(sync, /pairingCode: String\(pairingRecord\.pairingCode \|\| snapshot\.pairingCode/);
  assert.match(store, /connectionRecord\?\.pairingCode/);
  assert.match(store, /WISDO_PAIRING_CODE_REQUIRED/);
  assert.match(store, /\[pairingCode, pairing\.discordUserId/);
});


