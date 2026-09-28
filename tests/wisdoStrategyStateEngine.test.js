import test from 'node:test';
import assert from 'node:assert/strict';
import { WISDO_STATES, normalizeStrategyState, transitionStrategy, applyStrategyIntent, compileStrategyToEa } from '../services/wisdoStrategyStateEngine.js';

test('strategy states normalize to safe WATCHING defaults', () => {
  const s=normalizeStrategyState({});
  assert.equal(s.state,WISDO_STATES.WATCHING);
  assert.equal(s.entry.enabled,true);
});

test('PRESSING raises behavior without changing hard exposure ceiling', () => {
  const before=normalizeStrategyState({limits:{maxExposurePct:42}});
  const after=transitionStrategy(before,'PRESSING');
  assert.equal(after.state,'PRESSING');
  assert.equal(after.dimensions.pressure,80);
  assert.equal(after.limits.maxExposurePct,42);
});

test('boost is bounded by configured maxBoostEntries', () => {
  const before=normalizeStrategyState({limits:{maxBoostEntries:2}});
  const after=applyStrategyIntent(before,{type:'BOOST_ENTRY',count:8});
  assert.equal(after.entry.boostCapacity,2);
  const plan=compileStrategyToEa(before,after,{exposurePct:20});
  const boost=plan.actions.find(x=>x.action==='BOOST_ENTRY');
  assert.equal(boost.maxAdditionalEntries,2);
  assert.equal(plan.executionPolicy,'propose_preview_hold_confirm_ea_ack');
});

test('boost produces no EA action when exposure ceiling is already reached', () => {
  const before=normalizeStrategyState({limits:{maxExposurePct:40,maxBoostEntries:3}});
  const after=applyStrategyIntent(before,{type:'BOOST_ENTRY',count:2});
  const plan=compileStrategyToEa(before,after,{exposurePct:40});
  assert.equal(plan.actions.some(x=>x.action==='BOOST_ENTRY'),false);
});

test('defend stops entries and proposes protection', () => {
  const before=normalizeStrategyState({state:'BUILDING'});
  const after=applyStrategyIntent(before,{type:'DEFEND'});
  const plan=compileStrategyToEa(before,after,{exposurePct:10});
  assert.equal(after.entry.enabled,false);
  assert.equal(plan.actions.some(x=>x.action==='STOP_ENTRIES'),true);
  assert.equal(plan.actions.some(x=>x.action==='PROTECT_RAIL'),true);
});
