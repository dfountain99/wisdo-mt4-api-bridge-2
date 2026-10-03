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

test('V15 mobile layout is CSS-first and no longer maintains a character chamber viewport mode', async () => {
  const runtime = await fs.readFile(new URL('../public/app/world/command/command-center-runtime.js', import.meta.url), 'utf8');
  const css = await fs.readFile(new URL('../public/app/world/command/wisdo-live-manager-v15.css', import.meta.url), 'utf8');
  assert.doesNotMatch(runtime, /syncViewportMode|mobile-command-chamber|visualViewport|wisdo-core-v10-1-mobile/);
  assert.match(css, /@media\(max-width:650px\)/);
  assert.match(css, /\.lm-grid\{grid-template-columns:1fr\}/);
});

test('V15 keeps one command composer on phone instead of a hidden multimodal character menu', async () => {
  const runtime = await fs.readFile(new URL('../public/app/world/command/command-center-runtime.js', import.meta.url), 'utf8');
  assert.match(runtime, /lmComposer/);
  assert.match(runtime, /lmIntentInput/);
  assert.doesNotMatch(runtime, /wcMobileInputToggle|mobile-input-open|data-mobile-input/);
});

test('V10.2 release assets use fresh deterministic-mobile versions', async () => {
  const [workspace, worker, runtime] = await Promise.all([
    fs.readFile(new URL('../public/js/workspace.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../public/app/world/command/command-center-runtime.js', import.meta.url), 'utf8'),
  ]);
  assert.match(workspace, /v=20261002-v17-intent-os/);
  assert.match(worker, /wisdo-static-v17\.0\.0-intent-os/);
  assert.match(runtime, /wisdo-live-manager-v15\.css\?v=20261002-v17-intent-os/);
  assert.doesNotMatch(runtime, /wisdo-core-v10-living-controls|wisdo-core-v11-truth-dock/);
});
