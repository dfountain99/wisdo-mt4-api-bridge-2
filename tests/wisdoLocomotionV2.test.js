import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest=fs.readFileSync('public/app/world/authored-asset-manifest.js','utf8');
const operator=fs.readFileSync('public/app/world/authored-operator.js','utf8');

const semantic=['idle','idleVariant','walkForward','walkBackward','strafeLeft','strafeRight','jog','sprint','turnLeft','turnRight','jumpStart','jumpLoop','land','stop','interact','sit'];

test('Player V2 manifest declares complete semantic locomotion vocabulary',()=>{
  for(const state of semantic)assert.match(manifest,new RegExp(`\\b${state}\\s*:`),`missing ${state}`);
  assert.match(manifest,/KINEMATIC_IN_PLACE/);
});

test('locomotion v2 exposes fallback transparency rather than pretending clips exist',()=>{
  assert.match(operator,/missingExactAnimations/);
  assert.match(operator,/animationUsingFallback/);
  assert.match(operator,/animationFallbackFrom/);
  assert.match(operator,/resolution:Object\.freeze/);
});

test('locomotion v2 classifies actual movement and supports interaction states',()=>{
  for(const token of ['localVelocity','yawRate','walkBackward','strafeLeft','strafeRight','jumpLoop','land','stop','idleVariant'])assert.match(operator,new RegExp(token));
  assert.match(operator,/playInteraction/);
  assert.match(operator,/dataset\.wisdoLocomotion='v2'/);
});
