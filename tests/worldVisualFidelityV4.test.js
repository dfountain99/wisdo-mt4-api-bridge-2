import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('visual fidelity V4 creates the hero city objects needed by the latest production acceptance frame',()=>{
  const source=read('public/app/world/world-visual-fidelity-v4.js');
  for(const name of ['WisdoVisualFidelityV4','WisdoV4TradingTowerFacade','WisdoV4TowerHeroScreen','WisdoV4HeroPlazaSurface','WisdoV4Skybridge','WisdoV4ForegroundCrowd'])assert.ok(source.includes(name),`missing V4 hero object ${name}`);
  assert.match(source,/WISDO BREW/);
  assert.match(source,/WISDO GYM/);
  assert.match(source,/WISDO LOUNGE/);
  assert.match(source,/ARCADE/);
  assert.match(source,/WISDO_ARCADE_CITY_HERO_COMPOSITION_V4/);
  assert.doesNotMatch(source,/mt4CommandService|executeTrade|placeOrder|closeOrder/);
});

test('V4 keeps the mobile city populated without multiplying full character rigs',()=>{
  const source=read('public/app/world/world-visual-fidelity-v4.js');
  assert.match(source,/InstancedMesh/);
  assert.match(source,/touchLike\?8:12/);
  assert.match(source,/palmCount/);
  assert.match(source,/storefrontCount/);
  assert.match(source,/executionFromVisualLayer:false/);
});

test('production fidelity installs, updates and destroys V4 independently',()=>{
  const fidelity=read('public/app/world/production-fidelity-layer.js');
  assert.match(fidelity,/installWisdoVisualFidelityV4/);
  assert.match(fidelity,/visualFidelityV4Active/);
  assert.match(fidelity,/visualV4\?\.update/);
  assert.match(fidelity,/visualV4\?\.destroy/);
  assert.match(fidelity,/executionFromVisualLayer:false/);
});

test('V4 mobile composition removes secondary chrome so the city remains the hero',()=>{
  const css=read('public/app/world/visual-fidelity-v4.css');
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/\.status-panel\{display:none!important\}/);
  assert.match(css,/\.dock\{display:none!important\}/);
  assert.match(css,/\.wisdo-link-orb\{display:none!important\}/);
  assert.match(css,/wisdo-financial-hud/);
  assert.match(css,/wisdo-activity-ribbon/);
});

test('V4 release identity is explicit and production-visible',()=>{
  const build=read('public/app/world/world-build.js');
  const html=read('public/app/world/index.html');
  const debug=read('public/app/world/world-debug-runtime.js');
  assert.match(build,/3\.3\.0-visual-fidelity-v4-alpha/);
  assert.match(build,/cinematic-city-v5-visual-fidelity-v4/);
  assert.match(build,/arcade-central-04/);
  assert.match(html,/visual-fidelity-v4\.css/);
  assert.match(debug,/VISUAL V4/);
});
