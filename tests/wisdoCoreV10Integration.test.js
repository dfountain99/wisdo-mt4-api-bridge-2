import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('V10 browser modules import cleanly', async () => {
  const deck=await import('../public/app/world/command/guardian-command-deck.js');
  const time=await import('../public/app/world/command/wisdo-time-engine.js');
  assert.equal(typeof deck.createGuardianCommandDeck,'function');
  assert.equal(typeof time.createWisdoTimeEngine,'function');
});

test('V15 Command Center keeps WISDO Time and the safe proposal path without guardian presentation', async () => {
  const runtime=await fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8');
  assert.doesNotMatch(runtime,/createGuardianCommandDeck|createRankAscension|createCampaignCoreRenderer/);
  assert.match(runtime,/createWisdoTimeEngine/);
  assert.match(runtime,/runtime\.propose\(/);
  assert.match(runtime,/runtime\.execute\(/);
  assert.match(runtime,/HOLD TO CONFIRM/);
});

test('V15 route/cache versions prevent stale character UI from masking Live Manager', async () => {
  const [workspace,worker]=await Promise.all([
    fs.readFile(new URL('../public/js/workspace.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/service-worker.js',import.meta.url),'utf8'),
  ]);
  assert.match(workspace,/v=20261005-v20-scalp-hold/);
  assert.match(worker,/wisdo-static-v17\.0\.0-intent-os/);
});
