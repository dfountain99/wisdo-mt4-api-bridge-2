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
  assert.equal(catalog.defaultSpawn, 'home');
  assert.equal(catalog.architecture, 'persistent-smart-home-civilization');
  assert.ok(catalog.homeRooms.some((item) => item.id === 'trading-room'));
  assert.ok(catalog.homeRooms.some((item) => item.id === 'reporter-room'));
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

test('Smart Home-first World bundle stays playable, preserves production Central, and has a Lite safety path', () => {
  for (const file of [
    'index.html', 'world.css', 'home.css', 'world-v2.js', 'home3d.js', 'world-data-runtime.js',
    'world3d.js', 'world3d-core.js', 'world3d-production-core.js', 'world3d-production.js', 'world-production-city.js',
    'world-pbr-materials.js', 'world-config.js', 'input-manager.js', 'world-lite.js',
    'authored-asset-manifest.js', 'authored-operator.js', 'ASSET_LICENSES.md',
  ]) {
    assert.equal(fs.existsSync(path.join(worldRoot, file)), true, `${file} must exist`);
  }

  const primary = source('index.html');
  const html = source('legacy.html');
  const app = source('world-v2.js');
  const home = source('home3d.js');
  const runtime = source('world-data-runtime.js');
  const centralEntry = source('world3d.js');
  const productionCore = source('world3d-production-core.js');
  const productionCity = source('world-production-city.js');
  const production = source('world3d-production.js');
  const authored = source('authored-operator.js');
  const manifest = source('authored-asset-manifest.js');
  const licenses = source('ASSET_LICENSES.md');
  const input = source('input-manager.js');

  assert.match(primary, /\/app\/world\/babylon-city\/\?entry=production-v1/);
  assert.match(primary, /\/app\/world\/legacy\.html/);

  assert.match(html, /\/app\/world\/world\.css/);
  assert.match(html, /\/app\/world\/home\.css/);
  assert.match(html, /\/app\/world\/world-v2\.js/);
  assert.match(html, /"three":"https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.185\.1\/build\/three\.module\.min\.js"/);
  assert.match(html, /YOUR WISDO SMART HOME/);
  assert.match(html, /id="canvasMount"/);
  assert.match(html, /id="moveStick"/);
  assert.match(html, /id="lookZone"/);

  assert.match(app, /\/api\/world\/catalog/);
  assert.match(app, /\/api\/world\/me/);
  assert.match(app, /createWorldDataRuntime/);
  assert.match(app, /createHomeExperience/);
  assert.match(app, /createWorldExperience/);
  assert.match(app, /createLiteWorld/);
  assert.match(app, /state\.scene\s*=\s*state\.guest\s*\?\s*'central'/);

  assert.match(home, /TRADING ROOM/);
  assert.match(home, /REPORTER MESH/);
  assert.match(home, /ACCOUNT VAULT/);
  assert.match(home, /WISDO will not fabricate chart candles/);
  assert.match(home, /WORLD_CONFIG\.world\.fixedDt/);
  assert.doesNotMatch(home, /mt4-command|broker password|DISCORD_TOKEN|MT4_SYNC_API_KEY/i);

  assert.match(runtime, /position\.opened/);
  assert.match(runtime, /position\.updated/);
  assert.match(runtime, /position\.closed/);
  assert.match(runtime, /reporter\.online/);
  assert.match(runtime, /account\.selected/);

  assert.match(centralEntry, /world3d-production\.js/);
  assert.match(production, /world3d-production-core\.js/);
  assert.match(production, /installProductionFidelity/);
  assert.match(production, /installAuthoredOperator/);
  assert.match(productionCore, /THREE_MODULE_URL/);
  assert.match(productionCore, /Raycaster/);
  assert.match(productionCore, /fixedDt/);
  assert.match(productionCore, /buildProductionCity/);
  assert.match(productionCity, /TradingTowerDistrict/);
  assert.match(productionCity, /WISDOCentralHeadquarters/);

  assert.match(authored, /GLTFLoader/);
  assert.match(authored, /AnimationMixer/);
  assert.match(authored, /WISDOAuthoredOperatorMount/);
  assert.match(authored, /procedural fallback|fallback/i);
  assert.match(manifest, /wisdo-default-operator-v1/);
  assert.match(manifest, /suited\.glb/);
  assert.match(manifest, /CC0-1\.0/);
  assert.match(manifest, /3f97faf85e46d2f9a122b0a8b8d3ccc0af598f91/);
  assert.match(licenses, /Default authored WISDO Operator/);
  assert.match(licenses, /MakeHuman \/ MPFB 2/);

  assert.match(input, /requestPointerLock/);
  assert.match(input, /jumpPressed/);
  assert.match(input, /interactPressed/);
  assert.doesNotMatch(`${centralEntry}\n${production}\n${productionCore}\n${productionCity}\n${authored}`, /mt4-command|order placement|broker password|DISCORD_TOKEN|MT4_SYNC_API_KEY/i);
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
