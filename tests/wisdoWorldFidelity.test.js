import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('production fidelity keeps the existing World route and renderer contract', () => {
  const index = read('public/app/world/index.html');
  const wrapper = read('public/app/world/world3d-production.js');
  assert.match(index, /world-v2\.js/);
  assert.match(index, /world-living-runtime\.js/);
  assert.match(index, /world3d-production\.js/);
  assert.match(index, /fidelity\.css/);
  assert.match(wrapper, /createWorldExperience as createCoreWorldExperience/);
  assert.match(wrapper, /world3d\.js\?production-core=1/);
  assert.match(wrapper, /installProductionFidelity/);
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

test('fidelity pass is visual-only and contains no direct trading execution route', () => {
  const fidelity = read('public/app/world/production-fidelity-layer.js');
  const wrapper = read('public/app/world/world3d-production.js');
  const combined = `${fidelity}\n${wrapper}`;
  assert.doesNotMatch(combined, /mt4-command-poll|mt4-command-complete|brokerPassword|investorPassword|CLOSE_ALL_TRADES|EMERGENCY_STOP/);
  assert.match(fidelity, /WisdoIdentityMirror/);
  assert.match(fidelity, /ProductionWisdoOperator/);
  assert.match(fidelity, /ProductionTowerSkin/);
  assert.match(fidelity, /ProductionSkyline/);
});
