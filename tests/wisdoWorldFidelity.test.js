import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('production fidelity keeps the existing World route and uses the rebuilt production renderer entrypoint', () => {
  const primary = read('public/app/world/index.html');
  const index = read('public/app/world/legacy.html');
  const entry = read('public/app/world/world3d.js');
  const wrapper = read('public/app/world/world3d-production.js');
  const core = read('public/app/world/world3d-production-core.js');
  const city = read('public/app/world/world-production-city.js');
  assert.match(primary, /\/app\/world\/babylon-city\/\?entry=production-v1/);
  assert.match(index, /world-v2\.js/);
  assert.match(index, /world-living-runtime\.js/);
  assert.match(index, /production-world\.css/);
  assert.match(entry, /world3d-production\.js/);
  assert.match(wrapper, /createWorldExperience as createCoreWorldExperience/);
  assert.match(wrapper, /world3d-production-core\.js/);
  assert.match(wrapper, /installProductionFidelity/);
  assert.match(wrapper, /wisdoFidelity/);
  assert.match(core, /buildProductionCity/);
  assert.match(core, /createFallbackOperator/);
  assert.match(city, /buildTradingTower/);
  assert.match(city, /buildWisdoCentral/);
});

test('fidelity layer uses authorized World market state and existing billboard manager', () => {
  const fidelity = read('public/app/world/production-fidelity-layer.js');
  const manager = read('public/app/world/markets/market-billboard-manager.js');
  assert.match(fidelity, /\/api\/world\/markets\/active/);
  assert.match(fidelity, /createMarketBillboardManager/);
  assert.match(fidelity, /fakeCandlesAllowed:\s*false/);
  assert.doesNotMatch(fidelity, /Math\.random\(\).*candle/i);
  assert.match(manager, /REAL CHART FEED UNAVAILABLE/);
  assert.match(manager, /WISDO WILL NOT GENERATE FAKE CANDLES/);
});

test('fidelity pass is visual-only and no longer builds a duplicate prototype city or character', () => {
  const fidelity = read('public/app/world/production-fidelity-layer.js');
  const wrapper = read('public/app/world/world3d-production.js');
  const city = read('public/app/world/world-production-city.js');
  const combined = `${fidelity}\n${wrapper}`;
  assert.doesNotMatch(combined, /mt4-command-poll|mt4-command-complete|brokerPassword|investorPassword|CLOSE_ALL_TRADES|EMERGENCY_STOP/);
  assert.doesNotMatch(fidelity, /enhanceGround|buildStreetFurniture|skinDestinationBuildings|buildEnhancedOperator|ProductionWisdoOperator|ProductionTowerSkin/);
  assert.match(city, /ProductionSkyline/);
  assert.match(city, /WISDOCentralHeadquarters/);
  assert.match(wrapper, /installAuthoredOperator/);
});
