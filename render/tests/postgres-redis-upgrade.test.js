import test from 'node:test';
import assert from 'node:assert/strict';
import { RedisCommandBridge } from '../services/redisCommandBridge.js';

class MemoryRedis {
  constructor(){ this.hashes=new Map(); this.streams=new Map(); this.zsets=new Map(); this.values=new Map(); this.messages=[]; }
  async connect(){}
  async ping(){return 'PONG';}
  async hSet(k,v){this.hashes.set(k,{...(this.hashes.get(k)||{}),...v});return 1;}
  async hGetAll(k){return {...(this.hashes.get(k)||{})};}
  async expire(){return 1;}
  async xAdd(k,id,fields){const a=this.streams.get(k)||[];a.push({id:id==='*'?`${Date.now()}-${a.length}`:id,message:{...fields}});this.streams.set(k,a);return a.at(-1).id;}
  async publish(k,v){this.messages.push({k,v});return 1;}
  async zAdd(k,rows){const m=this.zsets.get(k)||new Map();for(const r of rows)m.set(r.value,r.score);this.zsets.set(k,m);return rows.length;}
  async zRem(k,v){this.zsets.get(k)?.delete(v);return 1;}
  async zCard(k){return this.zsets.get(k)?.size||0;}
  async zRangeByScore(k,min,max){return [...(this.zsets.get(k)||new Map()).entries()].filter(([,score])=>score>=min&&score<=max).map(([id])=>id);}
  async set(k,v){this.values.set(k,v);return 'OK';}
  async del(k){this.values.delete(k);return 1;}
  async quit(){return 'OK';}
}

function bridgeWithMemory(options={}){
  const bridge=new RedisCommandBridge({url:'redis://test',visibilityTimeoutMs:5000,...options});
  bridge.client=new MemoryRedis(); bridge.connected=true;
  return bridge;
}

test('decorated MT4 command service publishes one authoritative account stream and acknowledges commands', async()=>{
  const bridge=bridgeWithMemory();
  const service={
    async queueCommandForAccount(userId,accountId,command,payload){return {id:'cmd-1',userId,accountId,command,payload};},
    async markCommandCompleted(userId,id,result,accountId){return {id,userId,accountId,result};},
  };
  bridge.decorate(service);
  const command=await service.queueCommandForAccount('u1','a1','COPY_CLOSE_TRADE',{sourceTicket:'55'});
  assert.equal((await bridge.health()).pendingCommands,1);
  assert.equal(command.bridgeDelivery.state,'published_redis_only');
  assert.equal(bridge.client.streams.size,1);
  assert.ok(bridge.client.streams.has('wisdo:stream:account:a1'));
  assert.equal([...bridge.client.streams.keys()].some((key)=>key.includes('stream:user')),false);
  await service.markCommandCompleted('u1','cmd-1',{success:true},'a1');
  assert.equal((await bridge.health()).pendingCommands,0);
  assert.equal(bridge.metrics.published,1);
  assert.equal(bridge.metrics.completed,1);
});

test('command IDs are idempotent and acknowledgements cannot cross account ownership', async()=>{
  const bridge=bridgeWithMemory();
  const first=await bridge.publish({id:'same-id',userId:'u1',accountId:'a1',command:'PAUSE_BOT'});
  const second=await bridge.publish({id:'same-id',userId:'u1',accountId:'a1',command:'PAUSE_BOT'});
  assert.equal(first.bridgeDelivery.accepted,true);
  assert.equal(second.bridgeDelivery.state,'idempotent_replay');
  assert.equal(bridge.client.streams.get('wisdo:stream:account:a1').length,1);
  assert.equal(await bridge.acknowledge('same-id','completed',{}, {userId:'u1',accountId:'a2'}),false);
  assert.equal(await bridge.acknowledge('same-id','completed',{}, {userId:'u1',accountId:'a1'}),true);
  assert.equal(bridge.metrics.rejectedAcks,1);
});

test('stale commands retry and eventually move to dead letter without duplicate user queues', async()=>{
  const bridge=bridgeWithMemory({maxDeliveryAttempts:1});
  await bridge.publish({id:'retry-id',userId:'u1',accountId:'a1',command:'SYNC_ACCOUNT',ttlSeconds:3600});
  bridge.client.zsets.get('wisdo:commands:pending').set('retry-id',Date.now()-10000);
  const first=await bridge.recoverStaleCommands();
  assert.equal(first.recovered,1);
  assert.equal(bridge.client.streams.get('wisdo:stream:account:a1').length,2);
  bridge.client.zsets.get('wisdo:commands:pending').set('retry-id',Date.now()-10000);
  const second=await bridge.recoverStaleCommands();
  assert.equal(second.deadLettered,1);
  assert.equal((await bridge.health()).pendingCommands,0);
  assert.equal((await bridge.client.hGetAll('wisdo:command:retry-id')).status,'dead_letter');
});
