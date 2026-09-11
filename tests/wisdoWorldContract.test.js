import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveWorldTier, worldCatalog } from '../server/worldRoutes.js';
import { WORLD_CONFIG, WORLD_VERSION } from '../public/app/world/world-config.js';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const worldRoot = path.join(root, 'public', 'app', 'world');

function source(name) {
  return fs.readFileSync(path.join(worldRoot, name), 'utf8');
}

test('WISDO World catalog exposes immersive destinations without trade execution authority', () => {
  const catalog = worldCatalog();
  assert.equal(catalog.ok, true);
  assert.equal(catalog.executionFromWorldEnabled, false);
  assert.equal(catalog.billingConnected, false);
  assert.ok(catalog.destinations.length >= 10);
  assert.ok(catalog.destinations.some((item) => item.id === 'trading-tower' && item.route === '/member/command-center'));
  assert.ok(catalog.destinations.some((item) => item.id === 'academy' && item.route === '/member/education'));
  assert.ok(catalog.destinations.some((item) => item.id === 'war-room' && item.minTier === 'Commander'));
});

test('WISDO World tier resolver maps existing WISDO identity roles conservatively', () => {
  assert.equal(resolveWorldTier({ id: '1', roles: ['member'] }, {}).label, 'Member');
  assert.equal(resolveWorldTier({ id: '2', roles: ['premium_member'] }, {}).label, 'Sovereign');
  assert.equal(resolveWorldTier({ id: '3', roles: ['vip_member'] }, {}).label, 'Elite');
  assert.equal(resolveWorldTier({ id: '4', roles: ['owner'] }, {}).label, 'Commander');
});

test('third-person World bundle is route-local, playable, and has a Lite safety path', () => {
  for (const file of ['index.html','world.css','world.js','world3d.js','world-config.js','input-manager.js','world-lite.js']) {
    assert.equal(fs.existsSync(path.join(worldRoot, file)), true, `${file} must exist`);
  }
  const html = source('index.html');
  const app = source('world.js');
  const game = source('world3d.js');
  const input = source('input-manager.js');
  assert.match(html, /\/app\/world\/world\.css/);
  assert.match(html, /\/app\/world\/world\.js/);
  assert.match(html, /id="canvasMount"/);
  assert.match(html, /id="moveStick"/);
  assert.match(html, /id="lookZone"/);
  assert.match(app, /\/api\/world\/catalog/);
  assert.match(app, /\/api\/world\/me/);
  assert.match(app, /createLiteWorld/);
  assert.match(app, /createWorldExperience/);
  assert.match(game, /THREE_MODULE_URL/);
  assert.match(game, /Raycaster/);
  assert.match(game, /fixedDt/);
  assert.match(game, /buildTradingTower/);
  assert.match(input, /requestPointerLock/);
  assert.match(input, /jumpPressed/);
  assert.match(input, /interactPressed/);
  assert.doesNotMatch(game, /mt4-command|order placement|broker password/i);
});

test('World gameplay constants keep fixed-step physics and intended first-district tuning', () => {
  assert.equal(WORLD_VERSION, '2.0.0-third-person');
  assert.equal(WORLD_CONFIG.world.fixedDt, 1 / 60);
  assert.equal(WORLD_CONFIG.player.sprintSpeed, 7.5);
  assert.equal(WORLD_CONFIG.player.gravity, -24);
  assert.equal(WORLD_CONFIG.camera.fieldOfView, 68);
  assert.equal(WORLD_CONFIG.camera.sprintFieldOfView, 74);
  assert.ok(WORLD_CONFIG.world.halfSize >= 75 && WORLD_CONFIG.world.halfSize <= 150);
});
