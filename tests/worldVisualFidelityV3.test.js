import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Visual Fidelity V3 builds the bright cyber-luxury city layer with stable hero nodes',()=>{
  const source=read('public/app/world/world-visual-fidelity-v3.js');
  for(const name of ['WisdoVisualFidelityV3','WisdoV3HeroSkyline','WisdoV3ArcadeGateway','WisdoV3ArcadeWorldScreen','WisdoV3LuminousPlazaDeck','WisdoV3CrowdBodies','WisdoOperatorV3Lighting']){
    assert.ok(source.includes(name),`missing V3 object ${name}`);
  }
  assert.match(source,/WISDO_CYBER_LUXURY_CITY_V3/);
  assert.match(source,/targetMobileFps:30/);
  assert.match(source,/crowdCount/);
  assert.match(source,/toneMappingExposure/);
  assert.doesNotMatch(source,/mt4CommandService|executeTrade|placeOrder|closeOrder|orderSend/);
});

test('V3 integrates the existing Operator mark instead of adding another floating billboard',()=>{
  const source=read('public/app/world/world-visual-fidelity-v3.js');
  assert.match(source,/WISDOOperatorV2Branding/);
  assert.match(source,/WISDOOperatorFrontMark/);
  assert.match(source,/front\.visible=false/);
  assert.match(source,/WISDOOperatorBackMark/);
  assert.match(source,/operatorBrandingIntegrated/);
});

test('V3 mobile composition hides secondary chrome and keeps gameplay-critical UI compact',()=>{
  const css=read('public/app/world/visual-fidelity-v3.css');
  assert.match(css,/@media\(max-width:900px\)/);
  assert.match(css,/status-panel/);
  assert.match(css,/wisdo-link-orb/);
  assert.match(css,/wisdo-game-step\.current/);
  assert.match(css,/wisdo-financial-hud/);
  assert.match(css,/wisdo-activity-ribbon/);
  assert.match(css,/#wisdoMultiplayer/);
  assert.match(css,/\.dock/);
});

test('production fidelity owns V3 lifecycle and preserves visual execution isolation',()=>{
  const fidelity=read('public/app/world/production-fidelity-layer.js');
  assert.match(fidelity,/installWisdoVisualFidelityV3/);
  assert.match(fidelity,/visualFidelityV3Active/);
  assert.match(fidelity,/visualV3\?\.update/);
  assert.match(fidelity,/visualV3\?\.destroy/);
  assert.match(fidelity,/executionFromVisualLayer:false/);
});

test('V3 release identity is coherent across build, renderer and HTML entrypoint',()=>{
  const build=read('public/app/world/world-build.js');
  const html=read('public/app/world/index.html');
  assert.match(build,/3\.2\.0-visual-fidelity-v3-alpha/);
  assert.match(build,/2026\.09\.15\.visual-fidelity-v3/);
  assert.match(build,/cinematic-city-v4-visual-fidelity-v3/);
  assert.match(build,/arcade-central-03/);
  assert.match(html,/visual-fidelity-v3\.css\?v=2026\.09\.15\.visual-fidelity-v3/);
  assert.match(html,/data-world-build="2026\.09\.15\.visual-fidelity-v3"/);
});
