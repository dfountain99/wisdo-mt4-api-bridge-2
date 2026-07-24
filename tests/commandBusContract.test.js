import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const service = fs.readFileSync(new URL('../services/wisdoCommandBusService.js', import.meta.url), 'utf8');
const routes = fs.readFileSync(new URL('../server/commandBusRoutes.js', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../scripts/migratePostgres.js', import.meta.url), 'utf8');

test('command bus uses PostgreSQL row-level tables', () => {
  for (const table of ['wisdo_devices','wisdo_bots','wisdo_commands','wisdo_command_audit']) assert.match(migration, new RegExp(table));
  assert.doesNotMatch(service, /structuredClone\s*\(/);
});

test('device, bot, command, lease and completion routes exist', () => {
  for (const path of ['/api/device/v1/enroll','/api/device/v1/bots/register','/api/device/v1/commands','/api/agent/v1/commands/lease','/complete']) assert.match(routes, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('leases use SKIP LOCKED and bounded attempts', () => {
  assert.match(service, /FOR UPDATE SKIP LOCKED/);
  assert.match(service, /attempts < \$2/);
  assert.match(service, /lease_expires_at/);
});
