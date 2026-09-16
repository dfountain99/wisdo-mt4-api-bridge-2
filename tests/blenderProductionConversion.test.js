import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { validateJob } from '../tools/blender/bridge/protocol.mjs';
import {
  BLENDER_PRODUCTION_ASSETS,
  INTERACTION_DESTINATION_MAP,
  productionAssetReadiness,
  semanticFromNodeName,
} from '../public/app/world/blender-production-contract.js';

const repo = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('trusted Blender recipe source validates only under checked-in recipe root', () => {
  const job = validateJob({
    assetId: 'wisdo-central-v1',
    assetType: 'building',
    source: { recipe: 'tools/blender/recipes/wisdo_central_v1.py' },
    output: 'public/world-assets/interiors/wisdo-central-v1/wisdo_central_v1.glb',
    report: 'public/world-assets/interiors/wisdo-central-v1/wisdo_central_v1.report.json',
    registerTarget: 'interior',
  });
  assert.equal(job.source.kind, 'recipe');
  assert.equal(job.registerTarget, 'interior');
  assert.throws(() => validateJob({
    assetId: 'bad', assetType: 'building', source: { recipe: '../evil.py' },
    output: 'public/world-assets/bad.glb', report: 'public/world-assets/bad.json', registerTarget: 'building',
  }), /repository-relative|tools\/blender\/recipes|escape/);
});

test('production milestone requires Operator, Central and terminal before full readiness', () => {
  const empty = productionAssetReadiness({ players: { default: null }, interiors: {}, props: {} });
  assert.equal(empty.ready, false);
  assert.deepEqual(empty.missing.sort(), ['wisdo-central-v1','wisdo-operator-v1','wisdo-terminal-v1'].sort());
  const ready = productionAssetReadiness({
    players: { default: { id: 'wisdo-operator-v1' } },
    interiors: { 'wisdo-central-v1': { id: 'wisdo-central-v1' } },
    props: { 'wisdo-terminal-v1': { id: 'wisdo-terminal-v1' } },
  });
  assert.equal(ready.ready, true);
  assert.deepEqual(ready.missing, []);
});

test('semantic Blender node names survive WISDO prefixing', () => {
  assert.equal(semanticFromNodeName('WISDO_CENTRAL_V1_INTERACT_TRADING_TOWER'), 'TRADING_TOWER');
  assert.equal(semanticFromNodeName('WISDO_TERMINAL_V1_INTERACT_TERMINAL_LOD2'), 'TERMINAL');
  assert.equal(INTERACTION_DESTINATION_MAP.TRADING_TOWER.destinationId, 'trading-tower');
  assert.equal(BLENDER_PRODUCTION_ASSETS.central.collection, 'interiors');
});

test('production runtime preserves fallback and never gains trading authority', () => {
  const runtime = repo('public/app/world/production-asset-runtime.js');
  const world3d = repo('public/app/world/world3d.js');
  assert.match(runtime, /fallbackPreserved:\s*true/);
  assert.match(runtime, /executionFromVisuals:\s*false/);
  assert.match(runtime, /wisdo:production-interact/);
  assert.match(runtime, /WisdoGeneratedCollisionBoxes/);
  assert.match(world3d, /installProductionAssetRuntime/);
  assert.doesNotMatch(runtime, /mt4CommandService|CLOSE_ALL|placeOrder|sendOrder/i);
});

test('production Blender recipes expose semantic Central and terminal nodes', () => {
  const central = repo('tools/blender/recipes/wisdo_central_v1.py');
  const terminal = repo('tools/blender/recipes/wisdo_terminal_v1.py');
  for (const semantic of ['INTERACT_TRADING_TOWER','INTERACT_MARKET_ARCADE','INTERACT_REPORTER_COMMAND','INTERACT_SMART_HOME','INTERACT_VAULT','SPAWN_MAIN','SCREEN_WELCOME_HOME']) {
    assert.match(central, new RegExp(semantic));
  }
  assert.match(terminal, /INTERACT_TERMINAL/);
  assert.match(terminal, /SCREEN_TERMINAL/);
});

test('Operator runtime uses blended animation state machine with fallback clip resolution', () => {
  const stateMachine = repo('public/app/world/operator-animation-state-machine.js');
  const operator = repo('public/app/world/authored-operator.js');
  for (const state of ['walkBackward','strafeLeft','strafeRight','turnLeft','turnRight','terminalUse','sprint']) assert.match(stateMachine, new RegExp(state));
  assert.match(stateMachine, /fadeIn/);
  assert.match(stateMachine, /fadeOut/);
  assert.match(operator, /BLENDED_STATE_MACHINE_V1/);
  assert.match(operator, /wisdo:operator-action/);
});
