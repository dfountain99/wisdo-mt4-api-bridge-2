import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {defaults,validateSettings,evaluatePresence,PresenceStudioService} from '../services/presenceStudioService.js';
import {registerPresenceStudioRoutes} from '../server/presenceStudioRoutes.js';

const now=Date.parse('2026-10-07T01:00:00Z'),iso=offset=>new Date(now+offset).toISOString();
const config={...defaults,arrivalEnabled:true,phoneSource:'phone',doorSource:'door',occupancySource:'desk'};
const sources=()=>[
  {source_id:'phone',kind:'phone',state:'home',state_since:iso(-30000),last_seen_at:iso(-10000)},
  {source_id:'door',kind:'door',state:'open',state_since:iso(-20000),last_seen_at:iso(-10000)},
  {source_id:'desk',kind:'occupancy',state:'vacant',state_since:iso(-70000),last_seen_at:iso(-10000)},
];
test('arrival requires the selected phone and door; other household signals cannot substitute',()=>{
  const rows=sources();rows[1].source_id='other-door';
  assert.equal(evaluatePresence(config,rows,{},now).notices.filter(n=>n.type==='arrival').length,0);
  assert.equal(evaluatePresence(config,sources(),{},now).notices.filter(n=>n.type==='arrival').length,1);
});
test('phone-only greetings are an explicit configuration and do not require a panel',()=>{
  assert.equal(evaluatePresence({...config,requireDoor:false},sources().slice(0,1),{},now).notices[0].type,'arrival');
  assert.equal(evaluatePresence({...config,arrivalEnabled:false},sources(),{},now).notices.some(n=>n.type==='arrival'),false);
});
test('sensor outage is unknown, never inferred vacancy',()=>{
  const rows=sources();rows[2].last_seen_at=iso(-100000);
  const result=evaluatePresence(config,rows,{},now);assert.equal(result.deskState,'unknown');assert.equal(result.notices.some(n=>n.type==='away'),false);
});
test('vacancy delay and revocation are enforced',()=>{
  const rows=sources();rows[2].state_since=iso(-30000);assert.equal(evaluatePresence(config,rows,{},now).notices.some(n=>n.type==='away'),false);
  rows[0].revoked=true;assert.equal(evaluatePresence(config,rows,{},now).notices.length,0);
});
test('repeated PostgreSQL Date objects do not replay arrival or away notices',()=>{
  const rows=sources();let first=evaluatePresence(config,rows,{},now);assert.equal(first.notices.length,2);
  const dateRows=rows.map(r=>({...r,state_since:new Date(r.state_since),last_seen_at:new Date(r.last_seen_at)}));
  const second=evaluatePresence(config,dateRows,JSON.parse(JSON.stringify(first)),now+1000);assert.equal(second.notices.length,2);
});
test('invalid delays, excessive greetings and trading activation are rejected',()=>{
  for(const patch of [{awaySeconds:0},{awaySeconds:Infinity},{awayAction:'enable_trading'},{greeting:'x'.repeat(181)},{arrivalEnabled:'true'}])assert.throws(()=>validateSettings({...defaults,...patch}));
  assert.equal(validateSettings({...defaults,owner_user_id:'someone-else'}).owner_user_id,undefined);
});
test('settings cannot bind another owner’s source or write after denial',async()=>{
  const calls=[];const service=new PresenceStudioService({query:async(sql,args)=>{calls.push({sql,args});return {rows:[]};}});
  await assert.rejects(service.save('owner',{...defaults,phoneSource:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}),{statusCode:403});
  assert.equal(calls.some(c=>c.sql.startsWith('UPDATE')),false);assert.equal(calls[1].args[1],'owner');
});
test('source ingestion rejects invalid credentials, state, stale events and out-of-order replay',async()=>{
  const token='a'.repeat(64),id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const row={source_id:id,owner_user_id:'owner',kind:'phone',token_hash:createHash('sha256').update(token).digest('hex'),last_seen_at:new Date(),last_event_id:'seen'};
  let writes=0,releases=0;
  const client={release:()=>releases++,query:async(sql)=>{
    if(sql.startsWith('UPDATE'))writes++;
    if(sql.includes('SELECT * FROM wisdo_presence_sources'))return {rows:[row]};
    if(sql.includes('SELECT settings,runtime'))return {rows:[{settings:{},runtime:{}}]};
    return {rows:[]};
  }};
  const service=new PresenceStudioService({connect:async()=>client});
  const event={state:'home',eventId:'seen',observedAt:new Date().toISOString()};
  await assert.rejects(service.ingest(id,'b'.repeat(64),event),{statusCode:401});
  await assert.rejects(service.ingest(id,token,{...event,state:'occupied'}),{statusCode:400});
  await assert.rejects(service.ingest(id,token,{...event,observedAt:'2020-01-01'}),{statusCode:400});
  assert.equal((await service.ingest(id,token,event)).duplicate,true);assert.equal(writes,0);assert.equal(releases,4);
});
test('web settings reject unauthenticated and cross-site writes before touching storage',async()=>{
  const routes=new Map();const app=Object.fromEntries(['get','post','put','delete'].map(m=>[m,(path,...handlers)=>routes.set(m+path,handlers)]));
  registerPresenceStudioRoutes(app,{pool:{},getCurrentUser:req=>req.user});
  const chain=routes.get('put/api/presence-studio');
  let status;const res={status:n=>(status=n,res),json:()=>{},set:()=>{}};
  chain[0]({headers:{}},res,()=>assert.fail('unauthenticated request passed'));assert.equal(status,401);
  const req={user:{id:'owner'},headers:{'x-wisdo-intent':'presence-studio','sec-fetch-site':'cross-site'}};
  chain[0](req,res,()=>{});chain[1](req,res,()=>assert.fail('cross-site request passed'));assert.equal(status,403);
});
