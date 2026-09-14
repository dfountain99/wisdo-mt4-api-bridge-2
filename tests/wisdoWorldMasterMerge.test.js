import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('one production World route loads the master runtime and explicit Fast Mode escape only',()=>{
  const html=read('public/app/world/index.html');
  assert.match(html,/MASTER-WORLD-V1/);
  assert.match(html,/world-master-runtime\.js/);
  assert.match(html,/world3d-master\.js/);
  assert.match(html,/world-interior3d-master\.js/);
  assert.match(html,/data-world-external="fast-mode"/);
  assert.doesNotMatch(html,/world-v3\.html|second-world|prototype-world/i);
});

test('master runtime composes existing game, director and telemetry instead of forking them',()=>{
  const master=read('public/app/world/world-master-runtime.js');
  assert.match(master,/world-game-runtime\.js/);
  assert.match(master,/world-director\.js/);
  assert.match(master,/world-telemetry\.js/);
  assert.match(master,/world-companion-dashboard\.js/);
  assert.match(master,/world-audio-runtime\.js/);
  assert.match(master,/world-population-runtime\.js/);
  assert.match(master,/world-atmosphere-runtime\.js/);
  assert.match(master,/financialAuthority:\s*'SERVER'/);
  assert.match(master,/realPresenceFabricated:\s*false/);
});

test('spatial wrappers expose the active production scene without replacing production renderers',()=>{
  const central=read('public/app/world/world3d-master.js');
  const interior=read('public/app/world/world-interior3d-master.js');
  assert.match(central,/world3d-production\.js/);
  assert.match(interior,/world-interior3d-v2\.js/);
  assert.match(central,/WisdoWorldSpatialContext/);
  assert.match(interior,/WisdoWorldSpatialContext/);
  assert.match(central,/spatial-context-destroyed/);
  assert.match(interior,/spatial-context-destroyed/);
});

test('Companion Dashboard consumes authorized World state and supports privacy without trade execution authority',()=>{
  const companion=read('public/app/world/world-companion-dashboard.js');
  assert.match(companion,/world-event-bus\.js/);
  assert.match(companion,/\/api\/world\/state/);
  assert.match(companion,/STREAMER MODE/);
  assert.match(companion,/WISDO COMPANION/);
  assert.match(companion,/privateOwnerUi/);
  assert.match(companion,/bot\.signal\.created/);
  assert.doesNotMatch(companion,/brokerPassword|mt4Password|jwtSecret|privateKey|sendOrder|OrderSend|executeTrade/i);
  assert.doesNotMatch(companion,/Math\.random\(\).*balance|Math\.random\(\).*equity|fake.*profit|mock.*account/i);
});

test('ambient population is explicitly non-player and uses deterministic purpose routes',()=>{
  const population=read('public/app/world/world-population-runtime.js');
  assert.match(population,/AMBIENT_NPC/);
  assert.match(population,/isRealOperator\s*=\s*false/);
  assert.match(population,/DETERMINISTIC_PURPOSE_ROUTES/);
  assert.match(population,/WISDOAutonomousShuttle/);
  assert.doesNotMatch(population,/onlineUsers|fakeOperator|fakePlayerCount|Math\.random/);
});

test('audio requires a user gesture and signal sounds do not execute anything',()=>{
  const audio=read('public/app/world/world-audio-runtime.js');
  assert.match(audio,/pointerdown/);
  assert.match(audio,/keydown/);
  assert.match(audio,/bot\.signal\.created/);
  assert.match(audio,/footstepSurface/);
  assert.doesNotMatch(audio,/autoplay|OrderSend|executeTrade|closePosition/i);
});

test('environment defaults to blue hour and is explicitly decorative, not a market session signal',()=>{
  const atmosphere=read('public/app/world/world-atmosphere-runtime.js');
  assert.match(atmosphere,/blue_hour/);
  assert.match(atmosphere,/marketSessionLinked:false/);
  assert.match(atmosphere,/weatherModes/);
  assert.doesNotMatch(atmosphere,/BUY|SELL|bullish|bearish/);
});
