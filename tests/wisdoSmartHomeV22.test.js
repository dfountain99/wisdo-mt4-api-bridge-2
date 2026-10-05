import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { WisdoUniversalControlService } from '../services/wisdoUniversalControlService.js';

test('V22 onboarding snapshot separates pending/approved and flags duplicate candidates without merging',async()=>{
  const components=[
    {component_id:'c1',device_id:'edge-1',component_type:'light',name:'Office Light',aliases:[],capabilities:{},state:{state:'on'},metadata:{wisdo_device_class:'LIGHT',source_instance_id:'ha-1'},status:'online',approval_status:'pending',adapter_id:'home-assistant',home_id:null},
    {component_id:'c2',device_id:'edge-1',component_type:'light',name:'Office Light',aliases:[],capabilities:{},state:{state:'off'},metadata:{wisdo_device_class:'LIGHT',source_instance_id:'ha-1'},status:'online',approval_status:'approved',adapter_id:'home-assistant',home_id:'home-1'},
    {component_id:'c3',device_id:'edge-1',component_type:'climate',name:'Hall Thermostat',aliases:[],capabilities:{},state:{state:'cool'},metadata:{wisdo_device_class:'THERMOSTAT',source_instance_id:'ha-1'},status:'online',approval_status:'approved',adapter_id:'home-assistant',home_id:'home-1'},
  ];
  const pool={query:async(sql)=>{
    if(sql.includes('FROM wisdo_homes'))return{rows:[{home_id:'home-1',name:'My Home',status:'active'}]};
    if(sql.includes('FROM wisdo_adapter_bindings'))return{rows:[{edge_device_id:'edge-1',adapter_id:'home-assistant',source_instance_id:'ha-1',home_id:'home-1',status:'active'}]};
    if(sql.includes('FROM wisdo_components'))return{rows:components};
    if(sql.includes('FROM wisdo_devices'))return{rows:[{device_id:'edge-1',device_name:'Office Edge',status:'active'}]};
    throw new Error('Unexpected SQL: '+sql);
  }};
  const service=new WisdoUniversalControlService({pool});
  const snapshot=await service.onboardingSnapshot({owner_user_id:'u1',device_id:'web:u1'});
  assert.equal(snapshot.pending.length,1);
  assert.equal(snapshot.approved.length,2);
  assert.equal(snapshot.possibleDuplicates.length,1);
  assert.deepEqual(snapshot.possibleDuplicates[0].componentIds,['c1','c2']);
  assert.equal(snapshot.sources[0].bound,true);
  assert.equal(snapshot.policy.autoMergeDuplicates,false);
  assert.equal(snapshot.policy.proximityDoesNotAuthorize,true);
});

test('V22 room and alias profile edits remain owner-scoped',async()=>{
  let captured;
  const pool={query:async(sql,args)=>{captured={sql,args};return{rows:[{component_id:'c1',owner_user_id:'u1',name:'Office Lamp',aliases:['desk light'],metadata:{room_id:'office'}}]};}};
  const service=new WisdoUniversalControlService({pool});
  const row=await service.updateComponentProfile({owner_user_id:'u1',device_id:'web:u1'},'c1',{name:'Office Lamp',room:'office',aliases:['desk light','Desk Light']});
  assert.equal(row.component_id,'c1');
  assert.match(captured.sql,/owner_user_id=\$5/);
  assert.equal(captured.args[4],'u1');
  assert.equal(JSON.parse(captured.args[1]).length,1);
});

test('V22 member portal exposes Trust Center without exposing a device bearer token',async()=>{
  const [server,client]=await Promise.all([
    readFile(new URL('../server/apiServer.js',import.meta.url),'utf8'),
    readFile(new URL('../public/js/smart-home-trust-center.js',import.meta.url),'utf8'),
  ]);
  assert.match(server,/\/member\/smart-home/);
  assert.match(server,/\/api\/member\/smart-home\/onboarding/);
  assert.match(server,/Discovery ≠ authorization/);
  assert.match(server,/Approve Selected/);
  assert.match(client,/X-Wisdo-Intent/);
  assert.match(client,/member-smart-home/);
  assert.doesNotMatch(server+client,/localStorage\.setItem\([^\n]*(?:device-token|WISDO_HOME_ASSISTANT_TOKEN)/i);
});

test('V22 adapter approval remains dependent on V21 home/source binding',async()=>{
  const calls=[];
  const pool={query:async(sql,args)=>{
    calls.push({sql,args});
    if(sql.includes('FROM wisdo_homes'))return{rows:[{home_id:'home-1'}]};
    if(sql.includes('AS source_bound'))return{rows:[{component_id:'c1',device_id:'edge-1',adapter_id:'home-assistant',source_instance_id:'ha-1',source_bound:false}]};
    return{rows:[]};
  }};
  const service=new WisdoUniversalControlService({pool});
  await assert.rejects(
    service.approveComponent({owner_user_id:'u1',device_id:'web:u1'},'c1',{homeId:'home-1'}),
    (error)=>error.code==='adapter_binding_required'
  );
  assert.ok(calls.some((call)=>call.sql.includes('wisdo_adapter_bindings')));
});
