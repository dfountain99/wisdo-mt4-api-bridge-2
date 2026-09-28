import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('V10 browser modules import cleanly', async () => {
  const deck=await import('../public/app/world/command/guardian-command-deck.js');
  const time=await import('../public/app/world/command/wisdo-time-engine.js');
  assert.equal(typeof deck.createGuardianCommandDeck,'function');
  assert.equal(typeof time.createWisdoTimeEngine,'function');
});

test('Command Center wires V10 through the existing safe proposal path', async () => {
  const runtime=await fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8');
  assert.match(runtime,/createGuardianCommandDeck/);
  assert.match(runtime,/createWisdoTimeEngine/);
  assert.match(runtime,/onRequest:\s*\(\{ action \}\) => arm\(action\)/);
  assert.match(runtime,/proposal = await runtime\.propose\(/);
  assert.match(runtime,/latestReceipt = await runtime\.execute\(/);
  assert.match(runtime,/HOLD TO CONFIRM/);
});

test('V10 route/cache versions prevent stale guardian UI from masking release', async () => {
  const [workspace,worker]=await Promise.all([
    fs.readFile(new URL('../public/js/workspace.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/service-worker.js',import.meta.url),'utf8'),
  ]);
  assert.match(workspace,/v=20260928-v10-living-guardian-time/);
  assert.match(worker,/wisdo-static-v10\.0\.0-living-guardian-controls/);
});
