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

test('V11 guardian gestures are real pointer gestures and still use verified proposals', async () => {
  const [runtime,deck]=await Promise.all([
    fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/app/world/command/guardian-command-deck.js',import.meta.url),'utf8'),
  ]);
  assert.match(runtime,/beginGuardianGesture/);
  assert.match(runtime,/finishGuardianGesture/);
  assert.match(runtime,/requestGestureControl/);
  assert.match(runtime,/guardianDeck\.requestControl\(control\)/);
  assert.match(deck,/requestControl,/);
  assert.match(runtime,/proposal = await runtime\.propose\(/);
  assert.match(runtime,/latestReceipt = await runtime\.execute\(/);
});

test('V11 removes misleading camera-gesture and hardcoded progress claims', async () => {
  const [runtime,rank]=await Promise.all([
    fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/app/world/command/rank-ascension.js',import.meta.url),'utf8'),
  ]);
  assert.match(runtime,/Camera gestures · NOT CONNECTED/);
  assert.doesNotMatch(runtime,/c\?\.positionCount \? '68%'/);
  assert.match(runtime,/goalProgress/);
  assert.match(rank,/rankBaselineEstablished/);
});

test('V11 release assets are cache-busted', async () => {
  const [workspace,worker,runtime]=await Promise.all([
    fs.readFile(new URL('../public/js/workspace.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/service-worker.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8'),
  ]);
  assert.match(workspace,/v=20260929-v12-connected-command-spine/);
  assert.match(worker,/wisdo-static-v12\.0\.0-connected-command-spine/);
  assert.match(runtime,/wisdo-core-v11-truth-dock\.css\?v=20260929-v12-connected-command-spine/);
});
