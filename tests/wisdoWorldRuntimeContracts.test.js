import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const world = (name) => fs.readFileSync(path.join(root, 'public', 'app', 'world', name), 'utf8');

test('production quality policy does not equate coarse pointer with LOW', () => {
  const config = world('world-config.js');
  const fidelity = world('production-fidelity-layer.js');
  const policy = world('world-quality.js');

  assert.match(config, /world-quality\.js/);
  assert.match(fidelity, /chooseAutoQuality/);
  assert.match(fidelity, /getWorldCapabilities/);
  assert.doesNotMatch(fidelity, /if\s*\(\s*coarse\s*\|\|/);
  assert.doesNotMatch(fidelity, /deviceMemory\s*\|\|\s*4/);
  assert.match(policy, /Touch\/coarse input by itself never does/);
  assert.match(policy, /return 'medium'/);
});

test('authored Operator exposes diagnosable resilient loading with a real humanoid fallback', () => {
  const authored = world('authored-operator.js');
  const production = world('world3d-production.js');
  const productionCore = world('world3d-production-core.js');
  const debug = world('world-debug-runtime.js');
  const html = world('index.html');

  assert.match(authored, /WisdoOperatorDiagnostics/);
  assert.match(authored, /FETCHING/);
  assert.match(authored, /FETCH_FAILED/);
  assert.match(authored, /PARSE_FAILED/);
  assert.match(authored, /45_000/);
  assert.match(authored, /parseAsync/);
  assert.match(authored, /skinnedMeshCount/);
  assert.match(authored, /triangle/);
  assert.match(production, /loading-authored-glb/);
  assert.match(production, /WISDO_HUMANOID_FALLBACK|wisdo-humanoid-fallback/);
  assert.match(productionCore, /createFallbackOperator/);
  assert.match(productionCore, /leftArm/);
  assert.match(productionCore, /leftLeg/);
  assert.match(debug, /AUTHORED_GLTF|PROCEDURAL_FALLBACK|WISDO_HUMANOID_FALLBACK/);
  assert.match(debug, /failureReason/);
  assert.match(html, /world-debug-runtime\.js/);
});

test('automatic quality adaptation is telemetry driven and user overrides remain authoritative', () => {
  const production = world('world3d-production.js');
  assert.match(production, /createAdaptiveQualityController/);
  assert.match(production, /adaptive\?\.sample/);
  assert.match(production, /requestedQuality\s*===\s*'auto'/);
  assert.match(production, /adaptive\?\.setEnabled\?\.\(false\)/);
  assert.match(production, /rendererWidth/);
  assert.match(production, /rendererHeight/);
  assert.match(production, /shadowMap/);
});