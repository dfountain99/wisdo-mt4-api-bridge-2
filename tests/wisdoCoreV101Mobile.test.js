import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('V10.1 clamps displayed rank growth so Initiate never shows negative progress', async () => {
  const source = await fs.readFile(new URL('../public/app/world/command/rank-ascension.js', import.meta.url), 'utf8');
  assert.match(source, /Math\.max\(0,rawGrowth\)/);
});

test('V10.1 portrait hierarchy puts Guardian Controls before Time, Evolution, Composer and Protocol', async () => {
  const css = await fs.readFile(new URL('../public/app/world/command/wisdo-core-v10-1-mobile.css', import.meta.url), 'utf8');
  const controls = css.indexOf('top:804px!important');
  const time = css.indexOf('top:930px!important');
  const evolution = css.indexOf('top:1248px!important');
  const composer = css.indexOf('top:1368px!important');
  const protocol = css.indexOf('top:1432px!important');
  assert.ok(controls >= 0 && controls < time);
  assert.ok(time < evolution);
  assert.ok(evolution < composer);
  assert.ok(composer < protocol);
});

test('V10.1 mobile input modes are collapsed behind a dedicated toggle', async () => {
  const runtime = await fs.readFile(new URL('../public/app/world/command/command-center-runtime.js', import.meta.url), 'utf8');
  const css = await fs.readFile(new URL('../public/app/world/command/wisdo-core-v10-1-mobile.css', import.meta.url), 'utf8');
  assert.match(runtime, /wcMobileInputToggle/);
  assert.match(runtime, /mobile-input-open/);
  assert.match(css, /mobile-input-open .*wisdo-v7-inputs\{display:block!important\}/);
});

test('V10.1 release assets use fresh semantic cache/module versions', async () => {
  const [workspace, worker, runtime] = await Promise.all([
    fs.readFile(new URL('../public/js/workspace.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../public/app/world/command/command-center-runtime.js', import.meta.url), 'utf8'),
  ]);
  assert.match(workspace, /v=20260928-v10-1-mobile-command-chamber/);
  assert.match(worker, /wisdo-static-v10\.1\.0-mobile-command-chamber/);
  assert.match(runtime, /wisdo-core-v10-1-mobile\.css\?v=20260928-v10-1-mobile-command-chamber/);
});
