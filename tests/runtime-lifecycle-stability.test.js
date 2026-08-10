import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeLifecycle } from '../services/runtimeLifecycle.js';

function silentLogger() {
  return { info() {}, error() {} };
}

test('graceful shutdown drains HTTP, application resources, and Discord before exit', async () => {
  const calls = [];
  const timer = setInterval(() => {}, 60_000);
  const server = {
    close(callback) { calls.push('server'); setImmediate(callback); },
    closeIdleConnections() { calls.push('idle'); },
    wisdo: { async closeResources() { calls.push('resources'); } },
  };
  const client = { destroy() { calls.push('discord'); } };
  const exits = [];
  const lifecycle = createRuntimeLifecycle({ server, client, timers: [timer], logger: silentLogger(), exit: (code) => exits.push(code), timeoutMs: 1000 });

  const first = lifecycle.shutdown('SIGTERM');
  const second = lifecycle.shutdown('SIGINT');
  assert.strictEqual(first, second);
  const result = await first;

  assert.equal(result.outcome, 'drained');
  assert.deepEqual(exits, [0]);
  assert.deepEqual(new Set(calls), new Set(['server', 'idle', 'resources', 'discord']));
  assert.equal(timer._destroyed, true);
});

test('fatal runtime failures drain once and exit nonzero', async () => {
  let closes = 0;
  const exits = [];
  const server = { close(callback) { closes += 1; callback(); }, wisdo: { closeResources() { closes += 1; } } };
  const lifecycle = createRuntimeLifecycle({ server, logger: silentLogger(), exit: (code) => exits.push(code), timeoutMs: 1000 });

  await Promise.all([
    lifecycle.fatal(new Error('boom'), 'uncaughtException'),
    lifecycle.fatal(new Error('again'), 'unhandledRejection'),
  ]);

  assert.equal(closes, 2);
  assert.deepEqual(exits, [1]);
});
