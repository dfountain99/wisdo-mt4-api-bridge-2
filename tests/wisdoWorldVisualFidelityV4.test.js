import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { animationTimeScale, normalizeLocomotionState, OPERATOR_ANIMATION_STATES } from '../public/app/world/operator-animation-graph.js';
import { WISDO_VISUAL_FIDELITY_V4_REVISION } from '../public/app/world/world-visual-fidelity-v4.js';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Operator V4 animation graph exposes production locomotion and semantic states',()=>{
  assert.equal(normalizeLocomotionState('sprint'),'SPRINT');
  assert.equal(normalizeLocomotionState('garbage'),'IDLE');
  assert.ok(OPERATOR_ANIMATION_STATES.locomotion.includes('JUMP'));
  assert.ok(OPERATOR_ANIMATION_STATES.locomotion.includes('LAND'));
  assert.ok(OPERATOR_ANIMATION_STATES.semantic.includes('GREET'));
  assert.ok(OPERATOR_ANIMATION_STATES.semantic.includes('POINT'));
  assert.ok(animationTimeScale('WALK',3.2)>=.95);
  assert.ok(animationTimeScale('SPRINT',7.5)>=.95);
});

test('Visual Fidelity V4 declares the Academy cinematic vertical slice',()=>{
  assert.equal(WISDO_VISUAL_FIDELITY_V4_REVISION,'2026.09.17.visual-fidelity-v4');
  const source=read('public/app/world/world-visual-fidelity-v4.js');
  for(const marker of ['WisdoV4AcademyHeroEntrance','WisdoV4MasterChamberPortal','WisdoV4ReflectionCourt','PMREMGenerator','MeshPhysicalMaterial','WisdoV4OperatorContactShadow'])assert.match(source,new RegExp(marker));
  assert.match(source,/desktopTargetFps:60/);
  assert.match(source,/mobileTargetFps:30/);
});

test('Production World selects V4 renderer while retaining fallbacks',()=>{
  const world=read('public/app/world/world3d.js');
  const production=read('public/app/world/world3d-production-v4.js');
  assert.match(world,/world3d-production-v4\.js/);
  assert.match(production,/installAuthoredOperatorV4/);
  assert.match(production,/installLegacyAuthoredOperator/);
  assert.match(production,/installProductionFidelityV4/);
  assert.match(production,/executionFromVisuals:false/);
});

test('Operator V4 responds to real player state and semantic actions',()=>{
  const source=read('public/app/world/authored-operator-v4.js');
  assert.match(source,/wisdo:world-player-state/);
  assert.match(source,/wisdo:operator-action/);
  assert.match(source,/createOperatorAnimationGraph/);
  assert.match(source,/lookAt:true/);
  assert.doesNotMatch(source,/mt4CommandService|CLOSE_ALL|broker.*password/i);
});
