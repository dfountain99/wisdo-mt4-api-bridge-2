import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { WisdoFourPillarOperations, freshness, cleanMetrics, safeEventDetails }
  from '../services/wisdoFourPillarOperations.js';

const actor = { owner_user_id:'owner-one', device_id:'edge-one',
  device_type:'desktop-agent', capabilities:{os_telemetry:true,camera_events:true,ops_operator:true} };
function service(query,commandBusService={issueSystemCommand:async()=>({command_id:'cmd-one'})}) {
  return new WisdoFourPillarOperations({pool:{query},commandBusService});
}

test('freshness states are measured, and empty/missing data is not called online',()=>{
  assert.equal(freshness(null).state,'unavailable');
  assert.equal(freshness(new Date(Date.now()-300000).toISOString()).state,'stale');
  assert.equal(freshness(new Date().toISOString()).state,'online');
});
test('agent telemetry rejects impossible percentages and does not fabricate absent metrics',()=>{
  assert.deepEqual(cleanMetrics({cpuPercent:50}),{cpuPercent:50});
  assert.throws(()=>cleanMetrics({memoryPercent:105}),/outside allowed/);
  assert.throws(()=>cleanMetrics({reporterConnected:'true'}),/boolean/);
  assert.deepEqual(safeEventDetails({zone:'garage',personName:'private',imageUrl:'https://invalid'}),{zone:'garage'});
});
test('heartbeat saves authenticated owner and source device, never a caller-selected owner',async()=>{
  const queries=[];
  const ops=service(async(sql,params)=>{
    queries.push({sql,params});
    return {rows:[{owner_user_id:'owner-one',node_id:'worker1',device_id:'edge-one',metrics:{cpuPercent:55}}]};
  });
  const value=await ops.heartbeat(actor,{nodeId:'worker1',name:'My worker',role:'vps',
    metrics:{cpuPercent:55}});
  assert.equal(value.executionVerified,false);
  assert.equal(queries[0].params[0],'owner-one');
  assert.equal(queries[0].params[2],'edge-one');
  assert.match(queries[0].sql,/wisdo_os_nodes\.device_id=EXCLUDED\.device_id/);
  await assert.rejects(()=>ops.heartbeat({...actor,capabilities:{}},{nodeId:'worker2',role:'vps'}),error=>error.statusCode===403);
});
test('Sentinel refuses unapproved cameras without inserting an event',async()=>{
  let writes=0;
  const ops=service(async(sql)=>{
    if(sql.includes('SELECT component_id FROM wisdo_components'))return{rows:[]};
    writes++;return{rows:[]};
  });
  await assert.rejects(()=>ops.recordSentinelEvent(actor,{
    componentId:'camera-one',sourceEventId:'event-101',eventType:'person',occurredAt:new Date().toISOString()
  }),error=>error.code==='camera_not_approved');
  assert.equal(writes,0);
});
test('Sentinel stores immutable verified-source events once, and never auto-arms or fires a siren',async()=>{
  const statements=[];
  const ops=service(async(sql,params)=>{
    statements.push({sql,params});
    if(sql.includes('SELECT component_id FROM wisdo_components'))return{rows:[{component_id:'cam-1'}]};
    if(sql.includes('INSERT INTO wisdo_sentinel_events'))return{rows:[{
      source_event_id:'evt-1',event_type:'tamper',severity:'critical',details:{zone:'driveway'}
    }]};
    throw Error('Unexpected SQL');
  });
  const result=await ops.recordSentinelEvent(actor,{componentId:'cam-1',sourceEventId:'evt-1',
    eventType:'tamper',occurredAt:new Date().toISOString(),details:{zone:'driveway'}});
  assert.equal(result.recorded,true);
  assert.equal(result.responseAction,'none');
  const row=statements.find(s=>s.sql.includes('INSERT INTO'));
  assert.equal(row.params[0],'owner-one');
  assert.equal(row.params[3],'edge-one');
  assert.equal(row.params[6],'critical');
  assert.match(row.sql,/ON CONFLICT.*DO NOTHING/);
  await assert.rejects(()=>ops.recordSentinelEvent(actor,{componentId:'cam-1',sourceEventId:'evt-2',
    eventType:'person',occurredAt:'2000-01-01T00:00:00Z'}),/occurredAt/);
});
test('duplicate Sentinel events return stored record without claiming a fresh detection',async()=>{
  const ops=service(async(sql)=>{
    if(sql.includes('SELECT component_id FROM wisdo_components'))return{rows:[{component_id:'cam-1'}]};
    if(sql.includes('INSERT INTO wisdo_sentinel_events'))return{rows:[]};
    if(sql.includes('FROM wisdo_sentinel_events'))return{rows:[{source_event_id:'evt-1'}]};
    throw Error('Unexpected SQL');
  });
  const result=await ops.recordSentinelEvent(actor,{componentId:'cam-1',sourceEventId:'evt-1',
    eventType:'motion',occurredAt:new Date().toISOString()});
  assert.equal(result.duplicate,true);
  assert.equal(result.recorded,false);
});
test('trading overview is user-scoped and never reports accepted commands as executions',async()=>{
  const calls=[];
  const ops=service(async(sql,params)=>{
    calls.push({sql,params});
    if(sql.includes('FROM wisdo_mt4_accounts'))return{rows:[{
      account_id:'acc-1',account_number:'123',broker_server:'demo',status:'connected',
      last_sync_at:new Date().toISOString(),snapshot_present:true
    }]};
    if(sql.includes('FROM wisdo_mt4_commands'))return{rows:[{account_id:'acc-1',status:'pending',count:1}]};
    throw Error('Unexpected SQL');
  });
  const data=await ops.tradingAccounts('owner-one');
  assert.equal(data.accounts[0].reporterFreshness,'online');
  assert.equal(data.accounts[0].brokerOrderReceiptVerified,false);
  assert.equal(data.commandCounts7d[0].status,'pending');
  assert.equal(data.executionTruth,'command_receipts_only_not_http_acceptance');
  assert.ok(calls.every(({params})=>params[0]==='owner-one'));
});
test('supervised recovery is capability-bound, exact-target and receipt-pending',async()=>{
  const statements=[];
  const ops=service(async(sql,params)=>{
    statements.push({sql,params});
    if(sql.includes('SELECT device_id,capabilities FROM wisdo_devices'))
      return{rows:[{device_id:'desktop-1',capabilities:{restart_wisdo_worker:true}}]};
    if(sql.includes('INSERT INTO wisdo_os_recoveries'))return{rows:[{
      recovery_id:'12345678-1234-1234-1234-123456789012',target_device_id:'desktop-1',
      action:'restart_wisdo_worker',status:'pending'
    }]};
    if(sql.includes('SELECT target_device_id,status,expires_at FROM wisdo_os_recoveries'))return{rows:[{
      target_device_id:'desktop-1',status:'pending',expires_at:new Date(Date.now()+90000).toISOString()
    }]};
    if(sql.includes('UPDATE wisdo_os_recoveries')&&sql.includes("status='approved'"))
      return{rows:[{target_device_id:'desktop-1'}]};
    if(sql.includes('UPDATE wisdo_os_recoveries'))return{rows:[]};
    throw Error('Unexpected SQL '+sql);
  });
  const request=await ops.requestRecovery(actor,{targetDeviceId:'desktop-1'});
  assert.equal(request.confirmationRequired,'RESTART WORKER desktop-1');
  await assert.rejects(()=>ops.approveRecovery(actor,request.recovery_id,'RESTART ALL'),error=>error.code==='confirmation_mismatch');
  assert.equal(statements.filter(s=>s.sql.includes("status='approved'")).length,0);
  const completed=await ops.approveRecovery(actor,request.recovery_id,request.confirmationRequired);
  assert.equal(completed.status,'queued');
  assert.equal(completed.executionConfirmed,false);
  assert.equal(completed.commandId,'cmd-one');
  assert.match(statements.at(-1).sql,/queued_command_id/);
});
test('kernel, migration and client are connected to real services, no mock success endpoint',async()=>{
  const [kernel,migrate,routes,html]=await Promise.all([
    readFile(new URL('../server/kernelRouteRegistry.js',import.meta.url),'utf8'),
    readFile(new URL('../scripts/migratePostgres.js',import.meta.url),'utf8'),
    readFile(new URL('../server/fourPillarRoutes.js',import.meta.url),'utf8'),
    readFile(new URL('../public/app/os/index.html',import.meta.url),'utf8')
  ]);
  assert.match(kernel,/registerFourPillarRoutes\(app/);
  assert.match(migrate,/2026-11-13-four-pillar-operations\.sql/);
  assert.match(routes,/authenticateDevice/);
  assert.match(routes,/getSessionUser/);
  assert.match(routes,/\/api\/member\/os\/v1\/overview/);
  assert.match(html,/\/api\/member\/os\/v1\/overview/);
  assert.doesNotMatch(html,/mockData|fakeResults|sampleAccount|simulatedSuccess/);
});
