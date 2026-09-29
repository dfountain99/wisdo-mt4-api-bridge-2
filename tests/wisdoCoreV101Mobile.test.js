import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('V10.2 keeps Initiate rank progress non-negative', async () => {
  const source = await fs.readFile(new URL('../public/app/world/command/rank-ascension.js', import.meta.url), 'utf8');
  assert.match(source, /Math\.max\(0,rawGrowth\)/);
});

test('V10.2 portrait hierarchy is authored in the primary V10 stylesheet', async () => {
  const css = await fs.readFile(new URL('../public/app/world/command/wisdo-core-v10-living-controls.css', import.meta.url), 'utf8');
  assert.match(css, /mobile-command-chamber/);
  const controls = css.lastIndexOf('top:790px!important');
  const time = css.lastIndexOf('top:914px!important');
  const evolution = css.lastIndexOf('top:1210px!important');
  const composer = css.lastIndexOf('top:1328px!important');
  const protocol = css.lastIndexOf('top:1392px!important');
  assert.ok(controls >= 0 && controls < time);
  assert.ok(time < evolution);
  assert.ok(evolution < composer);
  assert.ok(composer < protocol);
});

test('V10.2 runtime explicitly controls mobile chamber state from viewport width', async () => {
  const runtime = await fs.readFile(new URL('../public/app/world/command/command-center-runtime.js', import.meta.url), 'utf8');
  assert.match(runtime, /function syncViewportMode\(\)/);
  assert.match(runtime, /mobile-command-chamber/);
  assert.match(runtime, /window\.visualViewport\?\.width/);
  assert.match(runtime, /viewportWidth <= 760/);
  assert.doesNotMatch(runtime, /wisdo-core-v10-1-mobile\.css/);
  assert.match(runtime, /existing\.href !== expected/);
});

test('V10.2 mobile input modes stay collapsed behind the dedicated toggle', async () => {
  const runtime = await fs.readFile(new URL('../public/app/world/command/command-center-runtime.js', import.meta.url), 'utf8');
  const css = await fs.readFile(new URL('../public/app/world/command/wisdo-core-v10-living-controls.css', import.meta.url), 'utf8');
  assert.match(runtime, /wcMobileInputToggle/);
  assert.match(runtime, /mobile-input-open/);
  assert.match(css, /mobile-command-chamber\.mobile-input-open \.wisdo-v7-inputs\{display:block!important\}/);
});

test('V10.2 release assets use fresh deterministic-mobile versions', async () => {
  const [workspace, worker, runtime] = await Promise.all([
    fs.readFile(new URL('../public/js/workspace.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../public/app/world/command/command-center-runtime.js', import.meta.url), 'utf8'),
  ]);
  assert.match(workspace, /v=20260929-v11-1-live-session/);
  assert.match(worker, /wisdo-static-v11\.1\.0-live-session-engine/);
  assert.match(runtime, /wisdo-core-v10-living-controls\.css\?v=20260928-v10-3-guardian-handoff/);
  assert.match(runtime, /wisdo-core-v11-truth-dock\.css\?v=20260929-v11-1-live-session/);
});
