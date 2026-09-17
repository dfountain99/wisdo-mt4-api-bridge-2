import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { animationTimeScale, normalizeLocomotionState, OPERATOR_ANIMATION_STATES } from '../public/app/world/operator-animation-graph.js';
import { WISDO_VISUAL_FIDELITY_V4_REVISION } from '../public/app/world/world-visual-fidelity-v4.js';
import { evaluateVisualFidelityRuntime, VISUAL_FIDELITY_ACCEPTANCE_THRESHOLD } from '../public/app/world/visual-fidelity-benchmark.js';

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
  const source=read('public/app/world/operator-animation-graph.js');
  assert.match(source,/clip\.clone\(\)/);
  assert.match(source,/fallbackStates/);
  assert.match(source,/coreAnimationCoverage/);
});

test('Visual Fidelity V4 declares the Academy cinematic vertical slice',()=>{
  assert.equal(WISDO_VISUAL_FIDELITY_V4_REVISION,'2026.09.17.visual-fidelity-v4');
  const source=read('public/app/world/world-visual-fidelity-v4.js');
  for(const marker of ['WisdoV4AcademyHeroEntrance','WisdoV4MasterChamberPortal','WisdoV4ReflectionCourt','PMREMGenerator','MeshPhysicalMaterial','WisdoV4OperatorContactShadow'])assert.match(source,new RegExp(marker));
  assert.match(source,/const damp=/);
  assert.match(source,/desktopTargetFps:60/);
  assert.match(source,/mobileTargetFps:30/);
});

test('Production World selects V4 systems through the stable renderer entrypoint and retains fallbacks',()=>{
  const world=read('public/app/world/world3d.js');
  const production=read('public/app/world/world3d-production.js');
  const v4Alias=read('public/app/world/world3d-production-v4.js');
  assert.match(world,/world3d-production\.js\?v=2026\.09\.17\.visual-fidelity-v4/);
  assert.match(world,/installVisualFidelityBenchmarkRuntime/);
  assert.match(production,/installAuthoredOperatorV4/);
  assert.match(production,/installLegacyAuthoredOperator/);
  assert.match(production,/installProductionFidelityV4/);
  assert.match(production,/executionFromVisuals:false/);
  assert.match(v4Alias,/world3d-production\.js/);
});

test('Operator V4 responds to real player state and reports asset/animation fidelity',()=>{
  const source=read('public/app/world/authored-operator-v4.js');
  assert.match(source,/wisdo:world-player-state/);
  assert.match(source,/wisdo:operator-action/);
  assert.match(source,/createOperatorAnimationGraph/);
  assert.match(source,/lookAt:true/);
  assert.match(source,/productionAsset/);
  assert.match(source,/coreAnimationCoverage/);
  assert.doesNotMatch(source,/mt4CommandService|CLOSE_ALL|broker.*password/i);
});

test('Visual acceptance separates technical readiness from release approval',()=>{
  const fixture={
    operator:{active:true,renderer:'AUTHORED_GLTF_V4',animationGraph:true,secondaryMotion:true,lookAt:true,productionAsset:true,coreAnimationCoverage:1},
    v4:{active:true,touchLike:false,environmentPbr:true,target:{academyEntrance:true,masterChamberPortal:true,reflectiveCourt:true},objects:['WisdoV4AtmosphereParticles']},
    render:{fps:60,player:{state:'IDLE'}},
    safety:{executionFromVisuals:false},
  };
  const runtime=evaluateVisualFidelityRuntime(fixture);
  assert.equal(VISUAL_FIDELITY_ACCEPTANCE_THRESHOLD,80);
  assert.equal(runtime.runtimeReady,true);
  assert.equal(runtime.total,100);
  assert.equal(runtime.releaseReady,false);
  assert.equal(runtime.gates.humanReviewComplete,false);
  assert.match(runtime.note,/requires human screenshot and animation review/i);

  const approved=evaluateVisualFidelityRuntime({...fixture,review:{screenshotApproved:true,animationApproved:true}});
  assert.equal(approved.releaseReady,true);
  assert.equal(approved.gates.humanReviewComplete,true);
});
