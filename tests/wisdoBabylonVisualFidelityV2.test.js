import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root='public/app/world/babylon-city';
const read=(name)=>fs.readFileSync(`${root}/${name}`,'utf8');

test('Babylon city V2 installs production visual fidelity systems',()=>{
  const fidelity=read('fidelity.js');
  assert.match(fidelity,/DefaultRenderingPipeline/);
  assert.match(fidelity,/SSAO2RenderingPipeline/);
  assert.match(fidelity,/CreateFromPrefilteredData/);
  assert.match(fidelity,/TONEMAPPING_ACES/);
  assert.match(fidelity,/targetFps:low\?30:60/);
});

test('Babylon city V2 has animation graph and generated Blender asset path',()=>{
  const chars=read('character-runtime.js');
  assert.match(chars,/IDLE/);assert.match(chars,/WALK/);assert.match(chars,/RUN/);assert.match(chars,/SPRINT/);
  assert.match(chars,/generated-asset-registry\.js/);
  assert.match(chars,/getGeneratedPlayerV2/);
  assert.match(chars,/og-master-wisdo/);
  assert.match(chars,/ImportMeshAsync/);
});

test('visual acceptance requires human review instead of CI-only success',()=>{
  const acceptance=read('visual-acceptance.js');
  assert.match(acceptance,/REQUIRED_SCORE=80/);
  assert.match(acceptance,/PENDING_HUMAN_VISUAL_REVIEW/);
  assert.match(acceptance,/releaseReady:false/);
  assert.match(acceptance,/Technical score never overrides human visual acceptance/);
});

test('Babylon city runtime wires fidelity, character animation and acceptance',()=>{
  const world=read('world.js');
  const html=read('index.html');
  assert.match(world,/WISDOBabylonFidelity/);
  assert.match(world,/WISDOBabylonCharacters/);
  assert.match(world,/WisdoBabylonDiagnostics/);
  assert.match(html,/fidelity\.js/);
  assert.match(html,/character-runtime\.js/);
  assert.match(html,/visual-acceptance\.js/);
  assert.doesNotMatch(world,/mt4CommandService|CLOSE_ALL|placeOrder|OrderSend/);
});