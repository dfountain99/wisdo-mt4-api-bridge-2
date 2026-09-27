import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCampaignControl, campaignPacket } from '../services/campaignControlContract.js';
import { WorldCommandCenterService } from '../services/worldCommandCenterService.js';
import { parseCampaignIntent } from '../public/js/campaign-intent.js';
const telemetry = () => ({ version:1,symbol:'XAUUSDm',magic:99,campaignId:42,phase:1,direction:1,rail:100,enabled:true,ageSeconds:1,levels:[{id:12000,price:120}],positions:[{ticket:1,role:0},{ticket:2,role:2}],ackId:10,pendingId:0 });
function fixture({age=0,control=telemetry(),shared=false}={}) {
  const timestamp=new Date(Date.now()-age).toISOString();
  const account={accountId:'a',discordUserId:'u',ownerUserId:'u',shared,sharePermission:shared?'view_only':null,lastSyncAt:timestamp,latestSnapshot:{receivedAt:timestamp,snapshot:{campaignControl:control,terminalConnected:true,expertEnabled:true,openTrades:[]}}};
  const rows=[];
  const service=new WorldCommandCenterService({mt4SyncService:{repository:{async getAccessibleMt4Accounts(){return [account];}}},mt4CommandService:{async load(){return {commandQueue:rows};},async queueCommandForAccount(userId,accountId,command,payload){await new Promise(resolve=>setTimeout(resolve,5));const row={id:'q1',userId,accountId,command,payload,status:'pending'};rows.push(row);return row;}}});
  return {service,rows,account};
}
test('telemetry discards unsupported protocol and unbounded data',()=>{
  assert.equal(normalizeCampaignControl({...telemetry(),version:2}),null);
  assert.equal(normalizeCampaignControl({...telemetry(),symbol:'../unsafe'}),null);
  const c=normalizeCampaignControl({...telemetry(),levels:[{id:1,price:NaN},{id:2,price:-1},{id:3,price:100}]});
  assert.equal(c.levels.length,1);assert.equal(c.levels[0].kind,'confirmed-pivot');
});
test('campaign requires fresh EA AND Reporter, not just a persisted connected flag',async()=>{
  for(const options of [{age:31000},{control:{...telemetry(),ageSeconds:35}},{control:null},{shared:true}]){
    const {service}=fixture(options);const s=await service.state('u',{accountId:'a'});assert.equal(s.capabilities.PAUSE_FOR.available,false);
    await assert.rejects(service.propose('u',{action:'PAUSE_FOR',accountId:'a',eaCampaignId:42,durationSeconds:900}));
  }
});
test('unknown account cannot silently fall back to the primary',async()=>{
  const {service}=fixture();await assert.rejects(service.propose('u',{accountId:'other',action:'PAUSE_FOR',eaCampaignId:42,durationSeconds:900}));
});
test('scope, duration, busy mailbox, HOLD role and missing levels fail closed',()=>{
  const c={...telemetry(),live:true};const packet=(action,body={},control=c)=>campaignPacket(action,{eaCampaignId:42,...body},{campaignControl:control});
  for(const seconds of [0,-1,604801,1.5])assert.throws(()=>packet('PAUSE_FOR',{durationSeconds:seconds}));
  assert.throws(()=>packet('PAUSE_FOR',{durationSeconds:900,eaCampaignId:41}));
  assert.throws(()=>packet('PAUSE_FOR',{durationSeconds:900},{...c,pendingId:99}));
  assert.throws(()=>packet('MOVE_TARGET',{tickets:[1],levelId:12000}));
  assert.throws(()=>packet('MOVE_TARGET',{tickets:[2],levelId:999}));
  assert.throws(()=>packet('MOVE_TARGET',{tickets:[2],levelId:12000,levelPrice:119}));
  assert.throws(()=>packet('PROTECT_RAIL',{levelId:12000},{...c,rail:121}));
  assert.throws(()=>packet('ARM_SONIC',{durationSeconds:900,burstCount:11}));
  assert.equal(packet('ARM_SONIC',{durationSeconds:900,burstCount:10}).burstCount,10);
});
test('preview does not execute; commit revalidates level geometry and campaign identity',async()=>{
  const {service,rows,account}=fixture();const p=await service.propose('u',{action:'MOVE_TARGET',accountId:'a',eaCampaignId:42,tickets:[2],levelId:12000});
  assert.equal(rows.length,0);assert.equal(p.packet.symbol,'XAUUSDm');assert.equal(p.packet.magicNumber,99);
  account.latestSnapshot.snapshot.campaignControl.levels[0].price=121;
  await assert.rejects(service.execute('u',{proposalId:p.proposalId,confirmationToken:p.confirmationToken,heldForMs:2000}),/level changed/);
  assert.equal(rows.length,0);
});
test('parallel confirmations queue at most one command, and receipt does not claim execution',async()=>{
  const {service,rows}=fixture();const p=await service.propose('u',{action:'AFTER_WIN',accountId:'a',eaCampaignId:42,durationSeconds:900});
  const results=await Promise.allSettled([1,2].map(()=>service.execute('u',{proposalId:p.proposalId,confirmationToken:p.confirmationToken,heldForMs:2000})));
  assert.equal(rows.length,1);const receipt=results.find(x=>x.status==='fulfilled').value;
  assert.equal(receipt.deliveryOnly,true);assert.equal(receipt.status,'pending');assert.ok(Number.isSafeInteger(receipt.eaRequestId));
  assert.equal(rows[0].payload.operation,3);assert.equal(rows[0].payload.confirmation,'confirmed');
});
test('speech parsing is bounded and never interprets ambiguous text as execution',()=>{
  assert.deepEqual(parseCampaignIntent('Wisdo, pause new entries for 2 hours.'),{action:'PAUSE_FOR',durationSeconds:7200});
  assert.deepEqual(parseCampaignIntent('after each win pause 15 minutes'),{action:'AFTER_WIN',durationSeconds:900});
  assert.deepEqual(parseCampaignIntent('after every compound target pause until a new opposite candle closes'),{action:'AFTER_COMPOUND'});
  assert.equal(parseCampaignIntent('arm a ten burst sonic attack for the next valid entry').burstCount,10);
  assert.equal(parseCampaignIntent('after this campaign ends pause for 2 hours').action,'AFTER_CAMPAIGN');
  for(const text of ['do it','close everything I guess','enter now and ignore risk','pause 1 hour then buy 100 lots','extend that one'])assert.throws(()=>parseCampaignIntent(text));
});
