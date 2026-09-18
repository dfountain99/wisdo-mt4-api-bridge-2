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
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('World entrypoint uses the runtime-recovery production renderer and one release cache identity', () => {
  const primary = read('public/app/world/index.html');
  const html = read('public/app/world/legacy.html');
  const cacheId = escapeRegex(WORLD_BUILD_ID);
  assert.match(primary, /\/app\/world\/babylon-city\/\?entry=production-v1/);
  assert.match(html, new RegExp(`world3d-production\\.js\\?v=${cacheId}`));
  assert.match(html, new RegExp(`world-interior3d-v2\\.js\\?v=${cacheId}`));
  assert.match(html, new RegExp(`market-billboard-manager-v2\\.js\\?v=${cacheId}`));
  assert.match(html, /PRODUCTION-CITY-V1/);
  const versionTags = html.match(new RegExp(`v=${cacheId}`, 'g')) || [];
  assert.ok(versionTags.length >= 10, 'all active World entry assets should share the current release cache identity');
  assert.doesNotMatch(html, /runtime-recovery-v2/);
});

test('production fidelity uses resilient cinematic and Arcade installers without blocking on market refresh', () => {
  const fidelity = read('public/app/world/production-fidelity-layer.js');
  assert.match(fidelity, /installResilientCinematicWorldLayer/);
  assert.match(fidelity, /installResilientArcadeCityVerticalSlice/);
  assert.match(fidelity, /executionFromVisualLayer:false/);
  assert.match(fidelity, /void refreshMarkets\(\)/);
  assert.doesNotMatch(fidelity, /await refreshMarkets\(\)/);
});

test('cinematic layer and recovery preserve stable hero scene names', () => {
  const cinematic = read('public/app/world/world-cinematic-layer.js');
  const recovery = read('public/app/world/world-cinematic-recovery.js');
  for (const name of ['WISDOCinematicVisualDirector', 'WISDOCinematicCentralCrown', 'WISDOCinematicTradingSpine']) {
    assert.ok(cinematic.includes(name), `missing cinematic scene object ${name}`);
    assert.ok(recovery.includes(name), `missing recovery scene object ${name}`);
  }
  assert.ok(cinematic.includes('WISDOCinematicFallbackOperator'));
  assert.match(recovery, /cinematic-city-recovery-v2/);
  assert.doesNotMatch(`${cinematic}\n${recovery}`, /mt4CommandService|executeTrade|placeOrder/);
});

test('Arcade Plaza and its recovery expose businesses, population, Coach and read-only financial presentation', () => {
  const plaza = read('public/app/world/world-arcade-plaza.js');
  const recovery = read('public/app/world/world-arcade-recovery.js');
  for (const name of ['WisdoBrew', 'WisdoArcade', 'WisdoGym', 'WisdoChillPlaza', 'WisdoCoachHologram', 'WisdoLiveTradeHologram', 'wisdoFinancialHud', 'wisdoActivityRibbon']) {
    assert.ok(plaza.includes(name), `missing Arcade Plaza contract ${name}`);
    assert.ok(recovery.includes(name), `missing Arcade recovery contract ${name}`);
  }
  assert.match(plaza, /NO LIVE ACCOUNT/);
  assert.match(plaza, /\/api\/world\/state/);
  assert.match(recovery, /\/api\/world\/state/);
  assert.match(recovery, /componentErrors/);
  assert.match(recovery, /publishRegistry/);
  assert.doesNotMatch(`${plaza}\n${recovery}`, /12,480|12,673|193\.59/);
  assert.doesNotMatch(`${plaza}\n${recovery}`, /mt4CommandService|executeTrade|placeOrder/);
});

test('Three compatibility layer prevents a missing CapsuleGeometry from killing all Arcade systems', () => {
  const compat = read('public/app/world/world-runtime-compat.js');
  assert.match(compat, /CapsuleGeometryCompat/);
  assert.match(compat, /property === 'CapsuleGeometry'/);
  assert.match(compat, /publishVisualRuntimeError/);
});

test('authored Operator starts before optional fidelity work and publishes the asset URL before loading', () => {
  const production = read('public/app/world/world3d-production.js');
  const operatorStart = production.indexOf('installAuthoredOperatorV4({THREE,scene,renderer,camera');
  const fidelityStart = production.indexOf('fidelity=await installProductionFidelityV4');
  assert.ok(operatorStart >= 0 && fidelityStart >= 0 && operatorStart < fidelityStart, 'Operator must start before optional fidelity initialization');
  assert.match(production, /status:'V4_QUEUED'/);
  assert.match(production, /assetUrl:asset\.url/);
  assert.match(production, /status:'V4_FALLBACK'|status:'PROCEDURAL_FALLBACK_ACTIVE'/);
  const fallback = read('public/app/world/world-operator-fallback.js');
  assert.match(fallback, /WISDOEmergencyOperatorV2/);
  assert.doesNotMatch(fallback, /mt4CommandService|executeTrade|placeOrder/);
});

test('debug runtime exposes exact visual errors and deterministic execution boundary', () => {
  const debug = read('public/app/world/world-debug-runtime.js');
  assert.match(debug, /WisdoVisualRuntimeErrors/);
  assert.match(debug, /CIN ERR/);
  assert.match(debug, /ARC ERR/);
  assert.match(debug, /ARC PARTS/);
  assert.match(debug, /WisdoWorldSafetyDiagnostics/);
  assert.match(debug, /safety\.executionFromVisuals === false \? 'NO' : 'UNVERIFIED'/);
  assert.match(debug, /wisdo:visual-runtime-error/);
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
