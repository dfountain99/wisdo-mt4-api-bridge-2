import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('visual fidelity V2 installs stable hero objects from the reference art direction',()=>{
  const source=read('public/app/world/world-visual-fidelity-v2.js');
  for(const name of ['WisdoVisualFidelityV2','WisdoArcadeWorldHeroBillboard','WisdoArcadeTowerCrown','WisdoModeBridge','WisdoCommandGlobe','WisdoEcosystemDistrictLabels']){
    assert.ok(source.includes(name),`missing V2 hero object ${name}`);
  }
  assert.match(source,/WISDO_CYBER_LUXURY_FINANCIAL_CITY/);
  assert.match(source,/ARCADE WORLD/);
  assert.match(source,/2D DASHBOARD/);
  assert.match(source,/3D WORLD/);
  assert.match(source,/WAR ROOM/);
  assert.doesNotMatch(source,/mt4CommandService|executeTrade|placeOrder|closeOrder/);
});

test('production fidelity owns V2 lifecycle without moving trade execution into visuals',()=>{
  const fidelity=read('public/app/world/production-fidelity-layer.js');
  assert.match(fidelity,/installWisdoVisualFidelityV2/);
  assert.match(fidelity,/visualFidelityV2Active/);
  assert.match(fidelity,/visualV2\?\.update/);
  assert.match(fidelity,/visualV2\?\.destroy/);
  assert.match(fidelity,/executionFromVisualLayer:false/);
});

test('mobile V2 composition prioritizes map, financial HUD and a compact world interface',()=>{
  const css=read('public/app/world/visual-fidelity-v2.css');
  assert.match(css,/wisdo-financial-hud/);
  assert.match(css,/wisdo-activity-ribbon/);
  assert.match(css,/wisdo-game-step\.current/);
  assert.match(css,/#wisdoMultiplayer/);
  assert.match(css,/@media\(max-width:700px\)/);
});

test('authored Operator receives WISDO V2 visual identity while retaining the licensed GLTF pipeline',()=>{
  const operator=read('public/app/world/authored-operator.js');
  const manifest=read('public/app/world/authored-asset-manifest.js');
  assert.match(operator,/WISDOOperatorV2Branding/);
  assert.match(operator,/WISDOOperatorBackMark/);
  assert.match(operator,/WISDO_OPERATOR_V2_SKIN/);
  assert.match(manifest,/CC0-1\.0/);
  assert.match(operator,/installAuthoredOperator/);
});
