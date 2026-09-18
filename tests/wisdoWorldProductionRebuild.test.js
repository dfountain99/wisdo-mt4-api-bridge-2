import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('production World entry removes HUD-first holographic skin and loads production presentation',()=>{
  const primary=read('public/app/world/index.html');
  const html=read('public/app/world/legacy.html');
  assert.match(primary,/\/app\/world\/babylon-city\/\?entry=production-v1/);
  assert.match(html,/production-world\.css/);
  assert.match(html,/world-minimap-runtime\.js/);
  assert.match(html,/PRODUCTION-CITY-V1/);
  assert.doesNotMatch(html,/holo-ai-theme\.css|holo-ai-theme\.js/);
});

test('production wrapper uses rebuilt Central city core and preserves authored operator + live fidelity systems',()=>{
  const wrapper=read('public/app/world/world3d-production.js');
  assert.match(wrapper,/world3d-production-core\.js/);
  assert.match(wrapper,/installAuthoredOperator/);
  assert.match(wrapper,/installProductionFidelity/);
  assert.match(wrapper,/production-city-v1/);
});

test('production city has reusable PBR surfaces, landmarks, density systems and traffic',()=>{
  const city=read('public/app/world/world-production-city.js');
  const materials=read('public/app/world/world-pbr-materials.js');
  assert.match(city,/WISDOCentralHeadquarters/);
  assert.match(city,/TradingTowerDistrict/);
  assert.match(city,/SmartHomeExterior/);
  assert.match(city,/MarketDistrictArchitecture/);
  assert.match(city,/InstancedMesh/);
  assert.match(city,/ProductionTraffic/);
  assert.match(city,/DirectionalLight/);
  assert.match(city,/FogExp2/);
  assert.match(materials,/CanvasTexture/);
  assert.match(materials,/MeshPhysicalMaterial/);
  assert.match(materials,/bumpMap/);
  assert.match(materials,/clearcoat/);
});

test('production player fallback is humanoid architecture instead of capsule/sphere placeholder',()=>{
  const core=read('public/app/world/world3d-production-core.js');
  assert.match(core,/createFallbackOperator/);
  assert.match(core,/leftArm/);
  assert.match(core,/leftLeg/);
  assert.match(core,/cameraRay/);
  assert.match(core,/slopeLimitDegrees/);
  assert.doesNotMatch(core,/CapsuleGeometry|SphereGeometry/);
});

test('production Central preserves destination interaction and mobile input architecture',()=>{
  const core=read('public/app/world/world3d-production-core.js');
  const html=read('public/app/world/legacy.html');
  assert.match(core,/WORLD_LOCATIONS/);
  assert.match(core,/onInteract/);
  assert.match(core,/InputManager/);
  assert.match(core,/moveStick/);
  assert.match(core,/lookZone/);
  assert.match(html,/moveStick/);
  assert.match(html,/lookZone/);
  assert.match(html,/interactBtn/);
});

test('fidelity layer remains authoritative live-market presentation and no longer builds a second city',()=>{
  const fidelity=read('public/app/world/production-fidelity-layer.js');
  assert.match(fidelity,/api\/world\/markets\/active/);
  assert.match(fidelity,/createMarketBillboardManager/);
  assert.doesNotMatch(fidelity,/enhanceGround|buildStreetFurniture|skinDestinationBuildings|buildEnhancedOperator/);
});

test('minimap consumes player state and mission progression without storing financial data',()=>{
  const map=read('public/app/world/world-minimap-runtime.js');
  assert.match(map,/wisdo:world-player-state/);
  assert.match(map,/WisdoWorldGame/);
  assert.match(map,/ACTIVE WAYPOINT/);
  assert.doesNotMatch(map,/balance|equity|ticket|lots|floatingPL|accountNumber/i);
});
