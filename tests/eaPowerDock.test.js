import test from 'node:test';
import assert from 'node:assert/strict';
import { EA_POWERS } from '../public/js/ea-power-dock.js';

test('power dock exposes 60 unique behavior powers',()=>{
  assert.equal(EA_POWERS.length,60);
  assert.equal(new Set(EA_POWERS.map(p=>p.id)).size,60);
  assert.equal(new Set(EA_POWERS.map(p=>p.name)).size,60);
});
test('only mapped actions can enter existing command proposal flow',()=>{
  const known=new Set(['ARM_SONIC','AFTER_CAMPAIGN','AFTER_COMPOUND','END_AFTER']);
  for(const p of EA_POWERS)assert.ok(p.action===null||known.has(p.action));
  assert.equal(EA_POWERS.find(p=>p.name==='Sonic Burst')?.action,'ARM_SONIC');
  assert.equal(EA_POWERS.find(p=>p.name==='Burst → Ladder → Burst')?.action,null);
});
