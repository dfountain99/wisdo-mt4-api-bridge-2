import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Core Experience is mounted by the existing /app/world orchestrator', () => {
  const world = read('public/app/world/world-v2.js');
  assert.match(world, /world-scene-router\.js/);
  assert.match(world, /world-game-runtime\.js/);
  assert.match(world, /world-director\.js/);
  assert.match(world, /world-telemetry\.js/);
  assert.doesNotMatch(world, /world-v3|second-world/i);
});

test('normal World destinations remain inside the persistent 3D route', () => {
  const world = read('public/app/world/world-v2.js');
  const router = read('public/app/world/world-scene-router.js');
  assert.match(world, /switchScene\(sceneForDestination\(destination\)/);
  assert.doesNotMatch(world, /window\.location\.assign\(destination\.route\)/);
  assert.match(world, /startInterior3d/);
  assert.match(world, /createWorldInterior/);
  assert.match(router, /trading-tower/);
  assert.match(router, /academy/);
  assert.match(router, /marketplace/);
});

test('Fast Mode and secure billing remain deliberate exits instead of implicit destination navigation', () => {
  const world = read('public/app/world/world-v2.js');
  assert.match(world, /case 'fast-mode'.*window\.location\.assign\('\/member\/home'\)/s);
  assert.match(world, /data-world-external="billing"/);
  assert.match(world, /Open Fast Mode/);
});

test('destination interiors use the same third-person input and authored Operator pipeline', () => {
  const interior = read('public/app/world/world-interior3d.js');
  assert.match(interior, /InputManager/);
  assert.match(interior, /installAuthoredOperator/);
  assert.match(interior, /WisdoOperator/);
  assert.match(interior, /instanceId/);
  assert.match(interior, /WisdoWorldRenderInstance/);
  assert.match(interior, /RETURN TO CENTRAL/);
});

test('game loop progression never stores financial or trade execution state', () => {
  const game = read('public/app/world/world-game-runtime.js');
  assert.match(game, /FIRST SHIFT/);
  assert.match(game, /Enter your WISDO Smart Home/);
  assert.match(game, /Enter Trading Tower/);
  assert.match(game, /Return to your Smart Home/);
  const saveBody = game.match(/localStorage\.setItem\(STORAGE_KEY,JSON\.stringify\(([^;]+)\)/s)?.[1] || '';
  assert.doesNotMatch(saveBody, /balance|equity|accountNumber|lot|ticket|profit|position/i);
});

test('real signal events can affect World presentation without fabricating signals', () => {
  const game = read('public/app/world/world-game-runtime.js');
  const director = read('public/app/world/world-director.js');
  assert.match(game, /wisdo:bot\.signal\.created/);
  assert.match(director, /wisdo:bot\.signal\.created/);
  assert.doesNotMatch(game, /Math\.random\(\).*signal|fake.*signal|mock.*signal/i);
});

test('World market and signal inspection use authoritative APIs and explicit standby states', () => {
  const world = read('public/app/world/world-v2.js');
  assert.match(world, /\/api\/world\/markets\/active/);
  assert.match(world, /\/api\/world\/signals\/active/);
  assert.match(world, /No authorized active markets/);
  assert.match(world, /No active signal events/);
});

test('WebGL capability probes are cached and explicitly release temporary contexts', () => {
  const quality = read('public/app/world/world-quality.js');
  assert.match(quality, /WEBGL2_CACHE/);
  assert.match(quality, /WEBGL_lose_context/);
  assert.match(quality, /loseContext/);
});

test('authored Operator completion is isolated to its render instance', () => {
  const production = read('public/app/world/world3d-production.js');
  const operator = read('public/app/world/authored-operator.js');
  const interior = read('public/app/world/world-interior3d.js');
  assert.match(production, /WisdoWorldRenderInstance/);
  assert.match(production, /instanceId/);
  assert.match(operator, /WisdoWorldRenderInstance/);
  assert.match(operator, /isCurrent/);
  assert.match(interior, /WisdoWorldRenderInstance/);
});

test('telemetry allowlist excludes account and trading payloads', () => {
  const telemetry = read('public/app/world/world-telemetry.js');
  assert.match(telemetry, /ALLOWED/);
  assert.doesNotMatch(telemetry.match(/const ALLOWED[^\n]+/)?.[0] || '', /balance|equity|account|lot|ticket|profit|position/i);
});

test('research atlas separates public GTA evidence from WISDO engineering decisions', () => {
  const atlas = read('docs/research/WISDO_OPEN_WORLD_ENGINEERING_ATLAS.md');
  assert.match(atlas, /does \*\*not\*\* claim access to Rockstar proprietary source code/i);
  assert.match(atlas, /Rockstar Games/);
  assert.match(atlas, /WISDO translation/);
  assert.match(atlas, /Core Experience V1/);
});
