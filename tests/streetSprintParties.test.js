import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {StreetSprintPartyService} from '../services/streetSprintPartyService.js';
import {registerStreetSprintPartyRoutes} from '../server/streetSprintPartyRoutes.js';

function memoryPool(){
  const parties=new Map(),members=new Map(),queries=[];
  const query=async(sql,args=[])=>{
    queries.push(sql);
    if(sql.includes('CREATE TABLE'))return {rows:[]};
    if(sql.startsWith('BEGIN')||sql.startsWith('COMMIT')||sql.startsWith('ROLLBACK'))return {rows:[]};
    if(sql.startsWith('SELECT pg_advisory_xact_lock'))return {rows:[]};
    if(sql.startsWith('SELECT id FROM wisdo_race_parties WHERE owner_id'))return {rows:[...parties.values()].filter(p=>p.owner_id===args[0]&&p.status==='waiting').map(p=>({id:p.id}))};
    if(sql.startsWith('INSERT INTO wisdo_race_parties')){parties.set(args[0],{id:args[0],owner_id:args[1],duration_minutes:args[2],status:'waiting',expires_at:new Date(Date.now()+1800000)});return {rows:[]};}
    if(sql.startsWith('SELECT * FROM wisdo_race_parties'))return {rows:parties.has(args[0])?[parties.get(args[0])]:[]};
    if(sql.startsWith('INSERT INTO wisdo_race_party_members')){const key=`${args[0]}:${args[1]}`;if(!members.has(key))members.set(key,{party_id:args[0],user_id:args[1],status:sql.includes("'invited'")?'invited':'joined'});return {rows:[]};}
    if(sql.startsWith('SELECT user_id,status FROM wisdo_race_party_members'))return {rows:[...members.values()].filter(row=>row.party_id===args[0])};
    if(sql.startsWith('SELECT p.id FROM wisdo_race_parties'))return {rows:[...parties.values()].filter(p=>p.status==='waiting'&&members.has(`${p.id}:${args[0]}`)).map(p=>({id:p.id}))};
    if(sql.startsWith('UPDATE wisdo_race_party_members')){members.get(`${args[0]}:${args[1]}`).status=sql.includes("status='joined'")?'joined':args[2];return {rows:[]};}
    if(sql.startsWith('DELETE FROM wisdo_race_party_members')){members.delete(`${args[0]}:${args[1]}`);return {rows:[]};}
    if(sql.startsWith('UPDATE wisdo_race_parties')){parties.get(args[0]).status='closed';return {rows:[]};}
    throw new Error(`Unexpected query ${sql}`);
  };
  return {query,connect:async()=>({query,release(){}}),queries,parties,members};
}

test('invites require the owner; invited people must accept before ready and no fifth player enters',async()=>{
  const pool=memoryPool(),service=new StreetSprintPartyService({pool});
  const party=await service.create('host',5);
  assert.equal(party.members[0].status,'joined');
  await assert.rejects(service.create('host',15),{code:'party_already_open'});
  await assert.rejects(service.invite(party.id,'stranger','hijack'),{code:'party_not_found'});
  await service.invite(party.id,'host','a');
  await assert.rejects(service.ready(party.id,'a',true),{code:'invite_not_accepted'});
  await service.join(party.id,'a');
  assert.equal((await service.ready(party.id,'a',true)).members.find(m=>m.user_id==='a').status,'ready');
  await service.invite(party.id,'host','b');await service.invite(party.id,'host','c');
  await assert.rejects(service.invite(party.id,'host','d'),{code:'party_full'});
  await assert.rejects(service.get(party.id,'uninvited'),{code:'party_not_found'});
  assert.equal((await service.list('a')).length,1);
  await service.leave(party.id,'host');
  assert.equal((await service.list('a')).length,0);
  assert.equal(pool.queries.some(q=>q.includes('wisdo_culture_coin_ledger')),false);
});

test('route rejects unauthenticated calls and never accepts a client race result for rewards',async()=>{
  const previousEnv=process.env.NODE_ENV;process.env.NODE_ENV='test';
  const app=express(),pool=memoryPool();app.use(express.json());registerStreetSprintPartyRoutes(app,{pool});
  const server=app.listen(0);
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    const unauth=await fetch(`${base}/api/world/race-parties`);
    assert.equal(unauth.status,401);
    const headers={'content-type':'application/json','x-wisdo-test-user':'host'};
    const created=await fetch(`${base}/api/world/race-parties`,{method:'POST',headers,body:JSON.stringify({durationMinutes:15})});
    assert.equal(created.status,201);
    const {party}=await created.json();
    const denied=await fetch(`${base}/api/world/race-parties/${party.id}`,{headers:{'x-wisdo-test-user':'other'}});
    assert.equal(denied.status,404);
    const forged=await fetch(`${base}/api/world/race-parties/${party.id}/results`,{method:'POST',headers,body:JSON.stringify({banked:999999,placement:1,reward:999999})});
    assert.equal(forged.status,409);
    assert.equal((await forged.json()).code,'race_result_unverified');
    const start=await fetch(`${base}/api/world/race-parties/${party.id}/start`,{method:'POST',headers,body:'{}'});
    assert.equal(start.status,503);
    assert.equal((await start.json()).code,'race_match_host_unavailable');
    assert.equal(pool.queries.some(q=>q.includes('wisdo_culture_coin_ledger')),false);
  }finally{server.close();if(previousEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previousEnv;}
});
