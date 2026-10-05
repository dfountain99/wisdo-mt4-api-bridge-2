import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('V11 Truth Dock module imports cleanly and owns requested sections', async () => {
  const mod=await import('../public/app/world/command/truth-dock.js');
  assert.equal(typeof mod.createTruthDock,'function');
  const source=await fs.readFile(new URL('../public/app/world/command/truth-dock.js',import.meta.url),'utf8');
  assert.match(source,/LIVE TRUTH DOCK/);
  assert.match(source,/wcV7Progress/);
  assert.match(source,/wcV7Sense/);
  assert.match(source,/wcV7Protocol/);
  assert.match(source,/wisdo-v8-victories/);
  assert.match(source,/wcV11EvolutionTop/);
});

test('V11 Command Center inherits the workspace-selected account explicitly', async () => {
  const [workspace,runtime,state]=await Promise.all([
    fs.readFile(new URL('../public/js/workspace.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/app/world/command/command-runtime.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../services/worldCampaignStateService.js',import.meta.url),'utf8'),
  ]);
  assert.match(workspace,/startCampaignCommandCenter\(\{ initialAccountId \}\)/);
  assert.match(runtime,/initialAccountId = ''/);
  assert.match(runtime,/let accountId = String\(initialAccountId \|\| ''\)/);
  assert.match(state,/legacyAccountId/);
  assert.match(state,/mt4Login/);
  assert.match(state,/accounts\.length === 1 \? accounts\[0\] : null/);
});

test('V15 active runtime removes guardian gestures and keeps verified proposals', async () => {
  const runtime=await fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8');
  assert.doesNotMatch(runtime,/beginGuardianGesture|finishGuardianGesture|guardianDeck|wcV8CharacterChamber/);
  assert.match(runtime,/runtime\.propose\(/);
  assert.match(runtime,/runtime\.execute\(/);
});

test('V15 shows only live trading telemetry in the active Command Center', async () => {
  const runtime=await fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8');
  assert.doesNotMatch(runtime,/Camera gestures|CHARACTER EVOLUTION|guardian|rank ascension/i);
  assert.match(runtime,/CAMPAIGN BASE/);
  assert.match(runtime,/NEXT TARGET/);
  assert.match(runtime,/Protection & Market Sense/);
});

test('V15 release assets are cache-busted and load only the Live Manager stylesheet', async () => {
  const [workspace,worker,runtime]=await Promise.all([
    fs.readFile(new URL('../public/js/workspace.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/service-worker.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8'),
  ]);
  assert.match(workspace,/v=20261005-v20-scalp-hold/);
  assert.match(worker,/wisdo-static-v17\.0\.0-intent-os/);
  assert.match(runtime,/wisdo-live-manager-v15\.css/);
  assert.doesNotMatch(runtime,/wisdo-core-v11-truth-dock\.css|wisdo-core-v8-rank-ascension\.css/);
});
