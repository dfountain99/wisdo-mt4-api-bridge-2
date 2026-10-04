import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('V17 Command Center is Continuity-first with no character presentation', async () => {
  const runtime=await fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8');
  assert.match(runtime,/WISDO <b>CONTINUITY<\/b>/);
  assert.match(runtime,/What do you want WISDO to do/);
  assert.match(runtime,/YOUR INTENT/);
  assert.match(runtime,/WISDO IS WAITING FOR/);
  assert.match(runtime,/VERIFIED ACTIONS/);
  assert.match(runtime,/createWisdoTimeEngine/);
  assert.doesNotMatch(runtime,/THREE_MODULE_URL|createCampaignCoreRenderer|createRankAscension|createGuardianCommandDeck|createTruthDock|wcV8CharacterChamber|CHARACTER EVOLUTION|LIVE GUARDIAN/i);
});

test('V17 browser delegates natural language to the persistent Continuity interpreter', async () => {
  const [runtime,commandRuntime,continuity]=await Promise.all([
    fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/app/world/command/command-runtime.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../services/wisdoContinuityService.js',import.meta.url),'utf8'),
  ]);
  assert.match(runtime,/runtime\.interpretContinuity/);
  assert.match(runtime,/runtime\.focusContinuity/);
  assert.match(commandRuntime,/\/api\/wisdo\/continuity\/interpret/);
  assert.match(commandRuntime,/\/api\/wisdo\/continuity\/focus/);
  assert.match(continuity,/semanticShortcut/);
  assert.match(continuity,/worldCommandService\.propose/);
  assert.doesNotMatch(runtime,/parseManager|SET_STOP_ATR.*match\(/);
});

test('V17 retains confirmation and verified receipt semantics', async () => {
  const runtime=await fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8');
  assert.match(runtime,/HOLD TO CONFIRM/);
  assert.match(runtime,/runtime\.execute\(/);
  assert.match(runtime,/runtime\.executeContinuity\(/);
  assert.match(runtime,/Waiting for Reporter\/HIGHTOWER acknowledgement/);
  assert.match(runtime,/announceReceipt/);
});

test('V17 loads one Continuity stylesheet and fresh route cache keys', async () => {
  const [runtime,css,workspace,worker]=await Promise.all([
    fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/app/world/command/wisdo-continuity-v17.css',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/js/workspace.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/service-worker.js',import.meta.url),'utf8'),
  ]);
  assert.match(runtime,/wisdo-continuity-v17\.css\?v=20261003-v17/);
  assert.match(css,/\.c-four/);
  assert.match(css,/\.c-story\.waiting/);
  assert.match(css,/\.wisdo-v12-time-layout/);
  assert.match(workspace,/v=20261003-v17-continuity/);
  assert.match(worker,/wisdo-static-v17\.0\.0-continuity/);
});
