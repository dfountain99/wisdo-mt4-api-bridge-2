import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { WisdoFourPillarOperations } from '../services/wisdoFourPillarOperations.js';

test('VPS command requires live owner-scoped Windows agent and yields only queued truth',async()=>{
  const queries=[];const issued=[];
  const pool={query:async(sql,values)=>{
    queries.push({sql,values});
    if(sql.includes('JOIN wisdo_os_nodes'))return{rows:[{
      device_id:'owned-vps',capabilities:{windows:true,prepare_trading_workspace:true},
      last_seen_at:new Date().toISOString(),
    }]};
    throw Error('Unexpected query');
  }};
  const service=new WisdoFourPillarOperations({pool,commandBusService:{issueSystemCommand:async(owner,request)=>{
    issued.push({owner,request});return{command_id:'test-command-uuid'};
  }}});
  const result=await service.prepareVps('owner-1','owned-vps');
  assert.equal(result.status,'queued');
  assert.equal(result.executionConfirmed,false);
  assert.equal(queries[0].values[0],'owner-1');
  assert.equal(queries[0].values[1],'owned-vps');
  assert.match(queries[0].sql,/device_type='desktop-agent'/);
  assert.match(queries[0].sql,/node_role='vps'/);
  assert.equal(issued[0].owner,'owner-1');
  assert.equal(issued[0].request.intent,'prepare_trading_workspace');
  assert.equal(issued[0].request.target.id,'owned-vps');
  assert.equal(issued[0].request.requiredCapability,'prepare_trading_workspace');
});

test('VPS launch blocks unavailable or unconfigured remote nodes',async()=>{
  let invoked=false;
  const service=new WisdoFourPillarOperations({
    pool:{query:async()=>({rows:[]})},
    commandBusService:{issueSystemCommand:async()=>{invoked=true;}}
  });
  await assert.rejects(()=>service.prepareVps('owner-1','not-my-vps'),error=>error.code==='vps_not_available');
  assert.equal(invoked,false);
});

test('VPS command receipts are owner-scoped and never inferred from submission',async()=>{
  const pool={query:async(sql,values)=>{
    assert.match(sql,/owner_user_id=\$2/);
    assert.equal(values[1],'owner-1');
    return{rows:[{command_id:values[0],status:'failed',result_message:'Terminal configuration missing'}]};
  }};
  const service=new WisdoFourPillarOperations({pool,commandBusService:{}});
  const r=await service.commandStatus('owner-1','12345678-1234-1234-1234-123456789012');
  assert.equal(r.executionConfirmed,false);
  assert.equal(r.status,'failed');
});

test('authenticated member actions enforce same origin, exact confirmation and observed receipt',async()=>{
  const [routes,ui]=await Promise.all([
    readFile(new URL('../server/fourPillarRoutes.js',import.meta.url),'utf8'),
    readFile(new URL('../public/app/os/index.html',import.meta.url),'utf8'),
  ]);
  assert.match(routes,/memberAction/);
  assert.match(routes,/sec-fetch-site/);
  assert.match(routes,/x-wisdo-intent/);
  assert.match(routes,/PREPARE VPS/);
  assert.match(routes,/operations\.commandStatus/);
  assert.match(ui,/prepareVps/);
  assert.match(ui,/\/api\/member\/os\/v1\/commands\//);
  assert.match(ui,/Awaiting VPS receipt/);
});

test('Windows service restarts are restricted to allowlisted WISDO services',async()=>{
  const [agent,enroll]=await Promise.all([
    readFile(new URL('../desktop-agent/agent.py',import.meta.url),'utf8'),
    readFile(new URL('../desktop-agent/enroll.py',import.meta.url),'utf8'),
  ]);
  assert.match(agent,/WISDO_ALLOW_WORKER_RESTART/);
  assert.match(agent,/WISDO_WORKER_SERVICE_NAME/);
  assert.match(agent,/re\.fullmatch\(r'WISDO/);
  assert.match(agent,/sc\.exe','stop'/);
  assert.match(agent,/sc\.exe','start'/);
  assert.match(agent,/report_os_heartbeat\(\)/);
  assert.match(enroll,/os_telemetry/);
  assert.match(enroll,/restart_wisdo_worker/);
});

test('Sentinel bridge uses an explicit HA sensor-to-camera mapping and real last_changed timestamps',async()=>{
  const [edge,home,enroll]=await Promise.all([
    readFile(new URL('../pi-edge/wisdo_edge.py',import.meta.url),'utf8'),
    readFile(new URL('../pi-edge/home_assistant_bridge.py',import.meta.url),'utf8'),
    readFile(new URL('../pi-edge/enroll.py',import.meta.url),'utf8'),
  ]);
  assert.match(home,/WISDO_SENTINEL_ENTITY_MAP/);
  assert.match(home,/binary_sensor\./);
  assert.match(home,/camera\./);
  assert.match(home,/sensor\.get\('last_changed'\)/);
  assert.match(home,/api\/os\/v1\/sentinel\/events/);
  assert.match(home,/self\.sentinel_seen\.add/);
  assert.match(edge,/api\/os\/v1\/nodes\/heartbeat/);
  assert.match(enroll,/camera_events/);
});

test('AETHER PRISM VPS control links to authenticated working operations UI',async()=>{
  const [world,css]=await Promise.all([
    readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8'),
    readFile(new URL('../public/app/world/command/aether-prism-v1.css',import.meta.url),'utf8')
  ]);
  assert.match(world,/href="\/app\/os"/);
  assert.match(css,/\.ap-modes a/);
});
