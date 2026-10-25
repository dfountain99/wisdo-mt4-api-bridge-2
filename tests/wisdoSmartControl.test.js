import test from 'node:test';
import assert from 'node:assert/strict';
import { compileWisdoCommand, toMt4Line, assertExecutionAllowed } from '../services/wisdoSmartControlService.js';

test('skip five trades', () => assert.equal(toMt4Line(compileWisdoCommand('Wisdo skip 5 trades')), 'SKIP|5'));
test('return to auto', () => assert.equal(toMt4Line(compileWisdoCommand('Wisdo go to auto mode')), 'AUTO'));
test('arm institutional level with FVG', () => {
  const plan=compileWisdoCommand('Wait until price reaches the institutional heat map near the fair value gap at level 3000 then start looking for signals');
  assert.equal(plan.action,'ARM_LEVEL'); assert.equal(plan.args[0],3000); assert.equal(plan.requireFvg,true);
});
test('unknown speech cannot execute', () => assert.equal(compileWisdoCommand('do the thing').action,'UNRESOLVED'));
test('live voice is blocked under DEMO_ONLY', () => assert.throws(()=>assertExecutionAllowed({demoOnly:true,accountMode:'LIVE',confirmed:true}),/DEMO_ONLY/));
