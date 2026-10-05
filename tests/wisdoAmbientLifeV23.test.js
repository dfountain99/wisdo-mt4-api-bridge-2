import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { WisdoAmbientLifeService, DEFAULT_POLICIES } from '../services/wisdoAmbientLifeService.js';
import { WisdoUniversalControlService } from '../services/wisdoUniversalControlService.js';

function fakePool(){
  const events=[];
  return {
    events,
    async query(sql,args=[]){
      if(sql.includes('FROM wisdo_life_policies'))return{rows:[]};
      if(sql.includes('FROM wisdo_household_members'))return{rows:[]};
      if(sql.includes('INSERT INTO wisdo_mission_truth_events')){
        const row={event_id:args[0],run_id:args[1],owner_user_id:args[2],event_type:args[3],detail:JSON.parse(args[4]),created_at:new Date().toISOString()};
        events.push(row);return{rows:[row]};
      }
      if(sql.includes('INSERT INTO wisdo_mission_runs'))return{rows:[]};
      if(sql.includes('UPDATE wisdo_mission_runs'))return{rows:[]};
      if(sql.includes('INSERT INTO wisdo_life_context'))return{rows:[{current_mode:args[2]}]};
      if(sql.includes('INSERT INTO wisdo_local_routine_manifests'))return{rows:[{manifest_id:args[0],status:args[7],manifest_hash:args[5]}]};
      return{rows:[]};
    }
  };
}

test('V23 default laws block unattended trading and require security/trading confirmation',()=>{
  const ids=DEFAULT_POLICIES.map((p)=>p.id);
  assert.ok(ids.includes('presence_no_live_trading'));
  assert.ok(ids.includes('automation_no_unlock'));
  assert.ok(ids.includes('physical_security_confirmation'));
  assert.ok(ids.includes('trading_confirmation'));
  assert.ok(ids.includes('scene_confirmation'));
});

test('V23 mission simulation coordinates home, workstation and trading without bypassing gates',async()=>{
  const pool=fakePool();
  const universal={
    preview:async(_actor,input)=>({action:input.action,risk_level:input.action==='unlock'?5:1,requires_confirmation:input.action==='unlock',targets:[{component_id:'c1',component_type:'light',metadata:{wisdo_device_class:'LIGHT'}}]}),
  };
  const commandBus={
    resolveTarget:async()=>({id:'desktop-1',capabilities:{prepare_trading_workspace:true},deviceName:'Desk'}),
  };
  const tradingExecutionService={queue:async()=>({id:'trade-command-1'})};
  const service=new WisdoAmbientLifeService({pool,universalControlService:universal,commandBusService:commandBus,tradingExecutionService});
  service.listPolicies=async()=>({defaults:DEFAULT_POLICIES,custom:[]});
  service.memberRole=async()=>({role:'OWNER',permissions:{}});

  const mission={mission_id:'m1',name:'Start Trading Day',home_id:'home-1',allowed_sources:['manual','voice'],steps:[
    {type:'mode',mode:'trading'},
    {type:'home',action:'turn_on',target:{type:'light',alias:'office lights'}},
    {type:'workstation',intent:'prepare_trading_workspace',requiredCapability:'prepare_trading_workspace',target:{type:'desktop'}},
    {type:'trading',action:'pause_entries',accountId:'1001'},
  ]};
  const sim=await service.simulateMission({owner_user_id:'u1',device_id:'web:u1'},mission,{source:'manual'});
  assert.equal(sim.blocked,false);
  assert.equal(sim.requiresConfirmation,true);
  assert.equal(sim.steps[0].status,'ready');
  assert.equal(sim.steps[1].status,'ready');
  assert.equal(sim.steps[2].status,'ready');
  assert.equal(sim.steps[3].status,'confirmation_required');
  assert.equal(sim.steps[1].detail.preview.action,'turn_on');
});

test('V23 presence-triggered trading is denied before execution',async()=>{
  const pool=fakePool();
  const service=new WisdoAmbientLifeService({
    pool,
    universalControlService:{preview:async()=>({risk_level:1,targets:[]})},
    commandBusService:{resolveTarget:async()=>null},
    tradingExecutionService:{queue:async()=>({id:'should-not-run'})},
  });
  service.listPolicies=async()=>({defaults:DEFAULT_POLICIES,custom:[]});
  service.memberRole=async()=>({role:'OWNER',permissions:{}});
  const mission={mission_id:'m2',name:'Arrival',allowed_sources:['presence'],steps:[{type:'trading',action:'pause_entries',accountId:'1001'}]};
  const sim=await service.simulateMission({owner_user_id:'u1'},mission,{source:'presence'});
  assert.equal(sim.blocked,true);
  assert.match(sim.steps[0].reason,/Presence|unattended/i);
});

test('V23 guest role cannot reach trading or physical security',async()=>{
  const pool=fakePool();
  const service=new WisdoAmbientLifeService({
    pool,
    universalControlService:{preview:async()=>({risk_level:5,targets:[{component_type:'lock',metadata:{wisdo_device_class:'LOCK'}}]})},
    commandBusService:{resolveTarget:async()=>null},
    tradingExecutionService:{queue:async()=>({id:'x'})},
  });
  service.listPolicies=async()=>({defaults:DEFAULT_POLICIES,custom:[]});
  service.memberRole=async()=>({role:'GUEST',permissions:{}});
  const mission={mission_id:'m3',name:'Guest Attempt',allowed_sources:['manual'],steps:[
    {type:'home',action:'unlock',target:{type:'lock',alias:'front door'}},
    {type:'trading',action:'pause_entries',accountId:'1001'},
  ]};
  const sim=await service.simulateMission({owner_user_id:'u1'},mission,{source:'manual'});
  assert.equal(sim.blocked,true);
  assert.match(sim.steps[0].reason,/GUEST/);
  assert.match(sim.steps[1].reason,/GUEST/);
});

test('V23 execute mission stops at awaiting confirmation and records truth without queueing',async()=>{
  const pool=fakePool();
  let homeExecutions=0;
  const service=new WisdoAmbientLifeService({
    pool,
    universalControlService:{preview:async()=>({risk_level:4,targets:[{component_type:'cover',metadata:{wisdo_device_class:'GARAGE'}}]}),execute:async()=>{homeExecutions+=1;return[];}},
    commandBusService:{resolveTarget:async()=>null},
    tradingExecutionService:null,
  });
  service.mission=async()=>({mission_id:'m4',name:'Garage',allowed_sources:['manual'],steps:[{type:'home',action:'open',target:{type:'cover',alias:'garage'}}]});
  service.listPolicies=async()=>({defaults:DEFAULT_POLICIES,custom:[]});
  service.memberRole=async()=>({role:'OWNER',permissions:{}});
  const result=await service.executeMission({owner_user_id:'u1',device_id:'web:u1'},'m4',{source:'manual'});
  assert.equal(result.status,'awaiting_confirmation');
  assert.equal(homeExecutions,0);
  assert.ok(pool.events.some((e)=>e.event_type==='run.awaiting_confirmation'));
});

test('V23 home resolution supports explicit home scoping',async()=>{
  let captured;
  const pool={query:async(sql,args)=>{captured={sql,args};return{rows:[]};}};
  const service=new WisdoUniversalControlService({pool});
  await service.resolveComponents({owner_user_id:'u1'},{type:'light',alias:'office',homeId:'home-2'});
  assert.match(captured.sql,/home_id=\$7/);
  assert.equal(captured.args[6],'home-2');
});

test('V23 local manifest compiler refuses trading and high-risk missions',async()=>{
  const pool=fakePool();
  const service=new WisdoAmbientLifeService({
    pool,
    universalControlService:{preview:async()=>({risk_level:1,targets:[]})},
    commandBusService:{resolveTarget:async()=>null},
    tradingExecutionService:{queue:async()=>({id:'x'})},
  });
  service.mission=async()=>({mission_id:'m5',name:'Trading Local',home_id:'home-1',allowed_sources:['manual'],steps:[{type:'trading',action:'pause_entries',accountId:'1001'}]});
  service.listPolicies=async()=>({defaults:DEFAULT_POLICIES,custom:[]});
  service.memberRole=async()=>({role:'OWNER',permissions:{}});
  const compiled=await service.compileLocalManifest({owner_user_id:'u1'},'m5');
  assert.equal(compiled.eligible,false);
  assert.equal(compiled.record.status,'not_deployable');
});

test('V23 is registered in the master kernel and member portal',async()=>{
  const [kernel,server,client,migration]=await Promise.all([
    readFile(new URL('../server/kernelRouteRegistry.js',import.meta.url),'utf8'),
    readFile(new URL('../server/apiServer.js',import.meta.url),'utf8'),
    readFile(new URL('../public/js/ambient-life-os.js',import.meta.url),'utf8'),
    readFile(new URL('../migrations/2026-10-05-wisdo-ambient-life-os-v23.sql',import.meta.url),'utf8'),
  ]);
  assert.match(kernel,/registerAmbientLifeRoutes/);
  assert.match(kernel,/offline_edge_runner: false/);
  assert.match(server,/\/member\/life-os/);
  assert.match(server,/Simulation first/);
  assert.match(client,/Compile Local-Safe Manifest/);
  assert.match(migration,/wisdo_mission_truth_events/);
  assert.match(migration,/wisdo_household_members/);
});
