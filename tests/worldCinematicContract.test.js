import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { worldBuildSnapshot } from '../server/worldBuildRoutes.js';
import { WORLD_BUILD_ID, WORLD_RENDERER } from '../public/app/world/world-build.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('World entrypoint uses the cinematic production renderer and one release cache identity', () => {
  const html = read('public/app/world/index.html');
  assert.match(html, /world3d-production\.js\?v=2026\.09\.14\.cinematic-v1/);
  assert.match(html, /world-interior3d-v2\.js\?v=2026\.09\.14\.cinematic-v1/);
  assert.match(html, /market-billboard-manager-v2\.js\?v=2026\.09\.14\.cinematic-v1/);
  const versionTags = html.match(/v=2026\.09\.14\.cinematic-v1/g) || [];
  assert.ok(versionTags.length >= 10, 'all active World entry assets should share the release cache identity');
});

test('production fidelity installs cinematic director and Arcade Plaza into the active scene', () => {
  const fidelity = read('public/app/world/production-fidelity-layer.js');
  assert.match(fidelity, /installCinematicWorldLayer/);
  assert.match(fidelity, /installArcadeCityVerticalSlice/);
  assert.match(fidelity, /executionFromVisualLayer:false/);
});

test('cinematic layer exposes stable hero scene names', () => {
  const cinematic = read('public/app/world/world-cinematic-layer.js');
  for (const name of ['WISDOCinematicVisualDirector', 'WISDOCinematicCentralCrown', 'WISDOCinematicTradingSpine', 'WISDOCinematicFallbackOperator']) {
    assert.ok(cinematic.includes(name), `missing cinematic scene object ${name}`);
  }
  assert.doesNotMatch(cinematic, /mt4CommandService|executeTrade|placeOrder/);
});

test('Arcade Plaza exposes visible businesses, population, Coach, HUD and live-trade hologram without fake balances', () => {
  const plaza = read('public/app/world/world-arcade-plaza.js');
  for (const name of ['WisdoBrew', 'WisdoArcade', 'WisdoGym', 'WisdoChillPlaza', 'WisdoCoachHologram', 'WisdoLiveTradeHologram', 'wisdoFinancialHud', 'wisdoActivityRibbon']) {
    assert.ok(plaza.includes(name), `missing Arcade Plaza contract ${name}`);
  }
  assert.match(plaza, /NO LIVE ACCOUNT/);
  assert.match(plaza, /\/api\/world\/state/);
  assert.match(plaza, /\/api\/world\/build/);
  assert.doesNotMatch(plaza, /12,480|12,673|193\.59/);
  assert.doesNotMatch(plaza, /mt4CommandService|executeTrade|placeOrder/);
});

test('activity ribbon feeds the real minimap waypoint runtime', () => {
  const minimap = read('public/app/world/world-minimap-runtime.js');
  assert.match(minimap, /wisdo:set-waypoint/);
  assert.match(minimap, /manualWaypoint/);
});

test('World build diagnostics are public-safe and identify the active renderer', () => {
  const build = worldBuildSnapshot();
  assert.equal(build.ok, true);
  assert.equal(build.buildId, WORLD_BUILD_ID);
  assert.equal(build.renderer, WORLD_RENDERER);
  assert.equal(build.executionFromVisualLayer, false);
  assert.ok(!('databaseUrl' in build));
  assert.ok(!('clientSecret' in build));
  assert.ok(!('sessionSecret' in build));
  const kernel = read('server/kernelRouteRegistry.js');
  assert.match(kernel, /registerWorldBuildRoutes/);
  assert.match(kernel, /build_api/);
});
