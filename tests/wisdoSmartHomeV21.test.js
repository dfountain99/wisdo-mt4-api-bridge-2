import test from 'node:test';
import assert from 'node:assert/strict';

import { compatibilityPlan, normalizeUniversalDevice, WISDO_ADAPTERS } from '../services/wisdoUniversalDeviceFabricService.js';
import { WisdoUniversalControlService } from '../services/wisdoUniversalControlService.js';
import { parseSmartHomeIntent } from '../services/wisdoSmartHomeIntentService.js';

test('V21 maps protocols to a universal adapter plan without pretending proximity is ownership',()=>{
  const zwave=compatibilityPlan({protocol:'z-wave',deviceClass:'thermostat'});
  assert.equal(zwave.deviceClass,'THERMOSTAT');
  assert.equal(zwave.policy.discoveryDoesNotAuthorize,true);
  assert.equal(zwave.policy.proximityDoesNotAuthorize,true);
  assert.equal(zwave.policy.approvalRequired,true);
  assert.ok(zwave.adapters.some((adapter)=>adapter.id==='z-wave-controller'));
  assert.ok(zwave.adapters.some((adapter)=>adapter.id==='home-assistant'));

  const legacy=compatibilityPlan({protocol:'ir',deviceClass:'IR_APPLIANCE'});
  assert.equal(legacy.legacy,true);
  assert.ok(legacy.adapters.some((adapter)=>adapter.id==='ir-rf-bridge'));
  assert.ok(WISDO_ADAPTERS.some((adapter)=>adapter.id==='relay-bridge'));
});

test('V21 normalizes different thermostat transports into one WISDO class',()=>{
  for(const protocol of ['matter','z-wave','zigbee','wifi','home-assistant']){
    const normalized=normalizeUniversalDevice({componentType:'climate',protocols:[protocol],name:`${protocol} thermostat`});
    assert.equal(normalized.deviceClass,'THERMOSTAT');
    assert.ok(normalized.capabilities.normalizedActions.includes('set_temperature'));
    assert.ok(normalized.capabilities.normalizedActions.includes('set_hvac_mode'));
  }
});

test('V21 recognizes thermostat mode and fan language consistently',()=>{
  const mode=parseSmartHomeIntent('set the thermostat mode to cool');
  assert.equal(mode.type,'HOME_ACTION');
  assert.equal(mode.parameters.action,'set_hvac_mode');
  assert.equal(mode.parameters.parameters.hvac_mode,'cool');
  const fan=parseSmartHomeIntent('set the thermostat fan to auto');
  assert.equal(fan.parameters.action,'set_fan_mode');
  assert.equal(fan.parameters.parameters.fan_mode,'auto');
});

test('V21 registration quarantines discovered devices by default',async()=>{
  const calls=[];
  const pool={query:async(sql,args)=>{calls.push({sql,args});return{rows:[{component_id:args[0],approval_status:args[10]}]};}};
  const service=new WisdoUniversalControlService({pool});
  const row=await service.registerComponent({owner_user_id:'u1',device_id:'edge-1'},{
    componentId:'ha:edge-1:light.office',
    componentType:'light',
    name:'Office Light',
    adapterId:'home-assistant',
    protocols:['home-assistant'],
    capabilities:{actions:['turn_on','turn_off']},
  });
  assert.equal(row.approval_status,'pending');
  assert.equal(calls[0].args[10],'pending');
});

test('V21 resolution only returns approved devices',async()=>{
  let captured='';
  const pool={query:async(sql)=>{captured=sql;return{rows:[]};}};
  const service=new WisdoUniversalControlService({pool});
  await service.resolveComponents({owner_user_id:'u1'},{alias:'office light'});
  assert.match(captured,/approval_status='approved'/);
});

test('V21 approval and revoke are explicit owner-scoped operations',async()=>{
  const seen=[];
  const pool={query:async(sql,args)=>{
    seen.push({sql,args});
    if(sql.includes('FROM wisdo_homes'))return{rows:[{home_id:'home-1'}]};
    if(sql.includes('AS source_bound'))return{rows:[{component_id:'c1',device_id:'edge-1',adapter_id:'home-assistant',source_instance_id:null,source_bound:false}]};
    if(sql.includes("approval_status='approved'"))return{rows:[{component_id:'c1',owner_user_id:'u1',approval_status:'approved'}]};
    if(sql.includes("approval_status='revoked'"))return{rows:[{component_id:'c1',owner_user_id:'u1',approval_status:'revoked'}]};
    return{rows:[]};
  }};
  const service=new WisdoUniversalControlService({pool});
  const device={owner_user_id:'u1',device_id:'settings-device'};
  const approved=await service.approveComponent(device,'c1',{homeId:'home-1'});
  assert.equal(approved.approval_status,'approved');
  const revoked=await service.revokeComponent(device,'c1');
  assert.equal(revoked.approval_status,'revoked');
  assert.ok(seen.every((call)=>call.args.includes('u1')));
});


test('V21 refuses approval when a discovered source is not bound to the owned home',async()=>{
  const pool={query:async(sql)=>{
    if(sql.includes('FROM wisdo_homes'))return{rows:[{home_id:'home-1'}]};
    if(sql.includes('AS source_bound'))return{rows:[{component_id:'c1',device_id:'edge-ha',adapter_id:'home-assistant',source_instance_id:'ha-source-1',source_bound:false}]};
    return{rows:[]};
  }};
  const service=new WisdoUniversalControlService({pool});
  await assert.rejects(
    service.approveComponent({owner_user_id:'u1',device_id:'settings-device'},'c1',{homeId:'home-1'}),
    (error)=>error.code==='adapter_binding_required'
  );
});
