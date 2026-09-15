import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NEXT_WORLD_BUILDS, WORLD_BUILD_PROGRAM } from '../public/app/world/world-build-program.js';
import { WORLD_BUILD, WORLD_BUILD_ID, WORLD_PROGRAM_BUILD, WORLD_PROGRAM_ID } from '../public/app/world/world-build.js';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const worldRoot = path.join(root, 'public', 'app', 'world');

function source(name) {
  return fs.readFileSync(path.join(worldRoot, name), 'utf8');
}

test('WISDO World Next 100 program is complete, ordered, and uniquely identified', () => {
  assert.equal(WORLD_BUILD_PROGRAM.id, 'wisdo-world-next-100-v1');
  assert.equal(WORLD_BUILD_PROGRAM.totalBuilds, 100);
  assert.equal(NEXT_WORLD_BUILDS.length, 100);
  assert.equal(WORLD_BUILD_PROGRAM.phases.length, 10);

  const ids = new Set();
  NEXT_WORLD_BUILDS.forEach((build, index) => {
    assert.equal(build.number, index + 1);
    assert.equal(build.id, `W${String(index + 1).padStart(3, '0')}`);
    assert.ok(build.title.length >= 5);
    assert.ok(build.outcome.length >= 20);
    assert.ok(build.phase.length >= 2);
    assert.ok(build.phaseName.length >= 5);
    ids.add(build.id);
  });
  assert.equal(ids.size, 100);

  WORLD_BUILD_PROGRAM.phases.forEach((phase, index) => {
    assert.equal(phase.firstBuild, index * 10 + 1);
    assert.equal(phase.lastBuild, index * 10 + 10);
  });
});

test('Build W001 is the shipped control-plane foundation and build identity matches it', () => {
  const shipped = NEXT_WORLD_BUILDS.filter((build) => build.status === 'shipped');
  assert.equal(shipped.length, 1);
  assert.equal(shipped[0].id, 'W001');
  assert.match(shipped[0].title, /control plane/i);
  assert.equal(WORLD_BUILD_PROGRAM.shippedBuilds, 1);
  assert.equal(WORLD_BUILD_PROGRAM.currentBuild.id, 'W001');
  assert.equal(WORLD_PROGRAM_ID, WORLD_BUILD_PROGRAM.id);
  assert.equal(WORLD_PROGRAM_BUILD, 'W001');
  assert.equal(WORLD_BUILD.programId, WORLD_BUILD_PROGRAM.id);
  assert.equal(WORLD_BUILD.programBuild, 'W001');
  assert.equal(WORLD_BUILD_ID, '2026.09.15.next100-build001');
});

test('World page visibly loads and exposes the Next 100 runtime with a cache-busted build marker', () => {
  const html = source('index.html');
  const runtime = source('world-build-program-runtime.js');

  assert.match(html, /id="worldProgramStatus"/);
  assert.match(html, /NEXT 100 · LOADING PROGRAM/);
  assert.match(html, /world-build-program-runtime\.js\?v=2026\.09\.15\.next100-build001/);
  assert.match(html, /data-world-build="2026\.09\.15\.next100-build001"/);
  assert.match(html, /BUILD NEXT100-W001/);

  assert.match(runtime, /WISDO_WORLD_BUILD_PROGRAM/);
  assert.match(runtime, /wisdo:world-build-program-ready/);
  assert.match(runtime, /worldProgramStatus/);
  assert.doesNotMatch(runtime, /mt4-command|broker password|DISCORD_TOKEN|MT4_SYNC_API_KEY/i);
});
