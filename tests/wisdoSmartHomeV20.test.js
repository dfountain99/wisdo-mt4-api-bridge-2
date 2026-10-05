import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSmartHomeIntent } from '../services/wisdoSmartHomeIntentService.js';
import { smartHomeRiskFloor, WisdoUniversalControlService } from '../services/wisdoUniversalControlService.js';

test('V20 parses everyday smart-home commands without AI fallback',()=>{
  const light=parseSmartHomeIntent('Turn on the living room lights');
  assert.equal(light.type,'HOME_ACTION');
  assert.equal(light.parameters.action,'turn_on');
  assert.equal(light.parameters.target.type,'light');
  assert.equal(light.parameters.target.alias,'living room lights');

  const dim=parseSmartHomeIntent('Dim the office lights to 35 percent');
  assert.equal(dim.parameters.action,'set_brightness');
  assert.equal(dim.parameters.parameters.brightness_pct,35);

  const thermostat=parseSmartHomeIntent('Set the thermostat to 72 degrees');
  assert.equal(thermostat.parameters.action,'set_temperature');
  assert.equal(thermostat.parameters.target.type,'climate');
  assert.equal(thermostat.parameters.parameters.temperature,72);

  const scene=parseSmartHomeIntent('trading mode');
  assert.equal(scene.parameters.action,'activate');
  assert.equal(scene.parameters.target.type,'scene');
  assert.equal(scene.parameters.target.alias,'trading');

  const generic=parseSmartHomeIntent('Turn on the coffee maker');
  assert.equal(generic.parameters.action,'turn_on');
  assert.equal(generic.parameters.target.alias,'coffee maker');
});

test('V20 parses security-sensitive home commands at elevated risk',()=>{
  const unlock=parseSmartHomeIntent('Unlock the front door');
  assert.equal(unlock.parameters.action,'unlock');
  assert.equal(unlock.parameters.riskLevel,5);
  assert.equal(unlock.parameters.target.type,'lock');

  const garage=parseSmartHomeIntent('Open the garage door');
  assert.equal(garage.parameters.riskLevel,4);
  assert.equal(garage.parameters.target.type,'cover');

  const alarm=parseSmartHomeIntent('Arm the security away');
  assert.equal(alarm.parameters.action,'arm_away');
  assert.equal(alarm.parameters.riskLevel,5);
});

test('V20 server risk floor cannot be lowered by a client',()=>{
  assert.equal(smartHomeRiskFloor({component_type:'lock',name:'Front Door'},'unlock'),5);
  assert.equal(smartHomeRiskFloor({component_type:'cover',name:'Garage Door',metadata:{device_class:'garage'}},'open'),4);
  assert.equal(smartHomeRiskFloor({component_type:'light',name:'Office Light'},'turn_on'),1);
});

test('V20 high-risk physical actions require explicit confirmation',async()=>{
  const service=new WisdoUniversalControlService({pool:{}});
  service.resolveComponents=async()=>[{
    component_id:'ha:lock.front_door',
    component_type:'lock',
    name:'Front Door',
    capabilities:{actions:['lock','unlock']},
    state:{state:'locked'},
    metadata:{provider:'home_assistant'},
  }];
  await assert.rejects(
    service.execute({owner_user_id:'u1',device_id:'voice-1'},{action:'unlock',target:{alias:'front door'},riskLevel:1}),
    (error)=>error.code==='home_confirmation_required'
  );
});
