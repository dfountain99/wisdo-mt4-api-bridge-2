import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('V15 Command Center is a trading-first Live Manager with no character presentation', async () => {
  const runtime=await fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8');
  assert.match(runtime,/WISDO <b>LIVE MANAGER<\/b>/);
  assert.match(runtime,/Tell WISDO what to do/);
  assert.match(runtime,/CAMPAIGN BASE/);
  assert.match(runtime,/Protection & Market Sense/);
  assert.match(runtime,/Open Positions/);
  assert.match(runtime,/Last Verified Receipt/);
  assert.match(runtime,/createWisdoTimeEngine/);
  assert.doesNotMatch(runtime,/THREE_MODULE_URL|createCampaignCoreRenderer|createRankAscension|createGuardianCommandDeck|createTruthDock|wcV8CharacterChamber|CHARACTER EVOLUTION|LIVE GUARDIAN/i);
});

test('V15 puts new live-manager commands at the center of the UI', async () => {
  const runtime=await fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8');
  for(const command of ['SET_STOP_ATR','SET_TRAIL_ATR','TRIM_CAMPAIGN','ADD_IF_VALID','WIDEN_EXISTING_STOPS','CLEAR_RUNTIME_OVERRIDES']){
    assert.match(runtime,new RegExp(command));
  }
  assert.match(runtime,/tighten the trailer a little/i);
  assert.match(runtime,/intentionally widen my existing stop losses to 2 ATR/i);
  assert.match(runtime,/return stops to normal EA management/i);
  assert.match(runtime,/same verified command bus and HIGHTOWER acknowledgement path/i);
});

test('V15 retains proposal confirmation and verified receipt semantics', async () => {
  const runtime=await fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8');
  assert.match(runtime,/runtime\.propose\(/);
  assert.match(runtime,/runtime\.execute\(/);
  assert.match(runtime,/HOLD TO CONFIRM/);
  assert.match(runtime,/Waiting for HIGHTOWER acknowledgement/);
  assert.match(runtime,/announceReceipt/);
});

test('V15 loads one purpose-built stylesheet and fresh route cache keys', async () => {
  const [runtime,css,workspace,worker]=await Promise.all([
    fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/app/world/command/wisdo-live-manager-v15.css',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/js/workspace.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/service-worker.js',import.meta.url),'utf8'),
  ]);
  assert.match(runtime,/wisdo-live-manager-v15\.css\?v=20261001-v15/);
  assert.match(css,/\.lm-command-card/);
  assert.match(css,/\.lm-risk-grid/);
  assert.match(css,/\.wisdo-v12-time-layout/);
  assert.match(workspace,/v=20261001-v15-live-manager/);
  assert.match(worker,/wisdo-static-v15\.0\.0-live-manager/);
});
