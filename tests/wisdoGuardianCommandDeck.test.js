import test from 'node:test';
import assert from 'node:assert/strict';
import { GUARDIAN_CONTROL_DEFS, GUARDIAN_CONTROL_STATES, resolveGuardianControlAction, createGuardianCommandDeck } from '../public/app/world/command/guardian-command-deck.js';

test('V10 guardian deck exposes only bounded supported visual controls', () => {
  assert.deepEqual(Object.keys(GUARDIAN_CONTROL_DEFS), ['AUTO','PROTECT','TAKE_PROFIT']);
  assert.ok(GUARDIAN_CONTROL_STATES.includes('summoning'));
  assert.ok(GUARDIAN_CONTROL_STATES.includes('active:protect'));
});

test('V10 guardian controls map only to existing proposal actions', () => {
  assert.equal(resolveGuardianControlAction('AUTO',{ bot:{ enabled:false } }), 'RESUME_BOT');
  assert.equal(resolveGuardianControlAction('AUTO',{ bot:{ enabled:true } }), 'RESUME_NEW_ENTRIES');
  assert.equal(resolveGuardianControlAction('PROTECT',{}), 'STOP_NEW_ENTRIES');
  assert.equal(resolveGuardianControlAction('TAKE_PROFIT',{}), 'CLOSE_PROFIT');
  assert.equal(resolveGuardianControlAction('UNKNOWN',{}), null);
});

test('guardian deck fails closed without a mounted overlay', () => {
  const deck=createGuardianCommandDeck();
  assert.equal(typeof deck.setState,'function');
  assert.equal(typeof deck.retractAll,'function');
});
