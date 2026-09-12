import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Core Experience runtime is mounted by the existing /app/world entry', () => {
  const html = read('public/app/world/index.html');
  assert.match(html, /world-core-game-runtime\.js/);
  assert.match(html, /data-world-external="fast-mode"/);
  assert.doesNotMatch(html, /second-world|world-v3/i);
});

test('normal World destinations are intercepted and explicit Fast Mode remains external', () => {
  const router = read('public/app/world/world-destination-router.js');
  assert.match(router, /captureKey/);
  assert.match(router, /captureClick/);
  assert.match(router, /stopImmediatePropagation/);
  assert.match(router, /data-world-external|worldExternal/);
  assert.match(router, /trading-tower/);
  assert.match(router, /Signal Observatory/i);
  assert.match(router, /No qualifying active signal event is visible right now/);
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

test('WebGL capability probes are cached and explicitly release temporary contexts', () => {
  const quality = read('public/app/world/world-quality.js');
  assert.match(quality, /WEBGL2_CACHE/);
  assert.match(quality, /WEBGL_lose_context/);
  assert.match(quality, /loseContext/);
});

test('authored Operator completion is isolated to its render instance', () => {
  const production = read('public/app/world/world3d-production.js');
  const operator = read('public/app/world/authored-operator.js');
  assert.match(production, /WisdoWorldRenderInstance/);
  assert.match(production, /instanceId/);
  assert.match(operator, /WisdoWorldRenderInstance/);
  assert.match(operator, /isCurrent/);
});

test('telemetry allowlist excludes account and trading payloads', () => {
  const telemetry = read('public/app/world/world-telemetry.js');
  assert.match(telemetry, /ALLOWED/);
  assert.doesNotMatch(telemetry.match(/const ALLOWED[^\n]+/)?.[0] || '', /balance|equity|account|lot|ticket|profit|position/i);
});
