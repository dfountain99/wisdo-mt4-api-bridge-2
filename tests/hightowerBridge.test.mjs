import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HT_COMMAND, hightowerMatches, validateHightowerScope } from '../services/hightowerRouting.js';
import { registerHightowerBridge } from '../server/hightowerBridge.js';
import { Mt4CommandService } from '../services/mt4CommandService.js';

const scope={executionTarget:'hightower',accountId:'a',symbol:'XAUUSD',magicNumber:26080204,receiverId:'receiver_000001'};
const bot={command:HT_COMMAND,accountId:'a',payload:{symbol:'XAUUSD',magicNumber:26080204,action:'PAUSE'}};
test('copier and bot lanes are disjoint; exact account/symbol/magic/receiver required',()=>{
 assert.equal(hightowerMatches(bot,{}),false);assert.equal(hightowerMatches({command:'COPY_OPEN_TRADE'},scope),false);
 assert.equal(hightowerMatches(bot,scope),true);
 for(const change of [{accountId:'b'},{symbol:'XAUUSDm'},{magicNumber:99}])assert.equal(hightowerMatches(bot,{...scope,...change}),false);
 assert.equal(hightowerMatches({...bot,payload:{...bot.payload,_receiverId:'other'}},scope),false);
});
test('scope validation rejects wildcard/negative/fractional/overflow targets',()=>{
 for(const magicNumber of [0,-1,1.1,2147483648,'26080204'])assert.throws(()=>validateHightowerScope({symbol:'XAUUSD',magicNumber}));
 for(const symbol of ['', '*', '../XAUUSD'])assert.throws(()=>validateHightowerScope({symbol,magicNumber:1}));
});
function fixture() {
 const routes=new Map(),records=[];
 const account={accountId:'a',accountNumber:'123',brokerServer:'Broker-Demo'};
 const commands={
  async claimHightower(ids,s){return {command:records.find(r=>hightowerMatches(r,s))||null};},
  async getCommandStatus(a,b){return records.find(r=>r.id===(b||a))||null;},
  async markCommandCompleteForAnyUser(ids,id,result){Object.assign(records.find(r=>r.id===id),{status:result.success?'completed':'failed',result});},
  async queueCommandForAccount(uid,accountId,command,payload){const row={id:'q1',userId:uid,accountId,command,payload,status:'pending'};records.push(row);return row;}
 };
 const deps={mt4SyncService:{async validateReporterAuth(h,{pairingCode}){assert.equal(pairingCode,'CODE');},async getOrRecoverPairingCode(){return {accountId:'a',discordUserId:'u'};},repository:{async getAccessibleMt4Accounts(uid){return uid==='u'?[account]:[];}}},mt4CommandService:commands,async getRequestAccess(req){return {identity:{loggedIn:req.user!=='anonymous',userId:req.user||'u'}};},async resolveDeliveryIds(){return ['u'];},scheduleHeartbeat(){}};
 registerHightowerBridge({post:(p,h)=>routes.set(p,h),get:(p,h)=>routes.set(p,h)},deps);
 const body={pairingCode:'CODE',accountNumber:'123',brokerServer:'Broker-Demo',symbol:'XAUUSD',magicNumber:26080204,receiverId:'receiver_000001'};
 async function call(path,extra={},user='u',params={}){let output,code=200;const res={status(n){code=n;return this;},json(j){output=j;},type(){return this;},send(s){output=s;}};await routes.get(path)({body:{...body,...extra},headers:{},user,params},res);return {code,output};}
 return {records,account,call};
}
test('pairing binds broker and account before poll; flat protocol handshake',async()=>{
 const f=fixture();assert.equal((await f.call('/mt4-bot-poll')).output.protocol,1);
 for(const wrong of [{accountNumber:'999'},{brokerServer:'Other'},{pairingCode:'WRONG'},{receiverId:'x'}])assert.equal((await f.call('/mt4-bot-poll',wrong)).code,400);
});
test('preview never queues; confirmation queues only supported owned scope',async()=>{
 const f=fixture();let r=await f.call('/api/wisdo/hightower/command',{accountId:'a',action:'PAUSE'});
 assert.equal(r.output.confirmationRequired,true);assert.equal(f.records.length,0);
 assert.equal((await f.call('/api/wisdo/hightower/command',{accountId:'b',action:'PAUSE',confirmed:true})).code,400);
 assert.equal((await f.call('/api/wisdo/hightower/command',{accountId:'a',action:'MARKET_ORDER',confirmed:true})).code,400);
 r=await f.call('/api/wisdo/hightower/command',{accountId:'a',action:'PAUSE',confirmed:true});assert.equal(r.output.executionConfirmed,false);assert.equal(f.records.length,1);
});
test('read-only shares and unsigned requests cannot control',async()=>{
 const f=fixture();f.account.shared=true;
 assert.equal((await f.call('/api/wisdo/hightower/command',{accountId:'a',action:'RESUME',confirmed:true})).code,400);
 assert.equal((await f.call('/api/wisdo/hightower/command',{accountId:'a',action:'RESUME',confirmed:true},'anonymous')).code,400);
});
test('receipts require matching receiver and explicit result; failed close stays failed',async()=>{
 const f=fixture();f.records.push({...bot,id:'q',userId:'u',status:'delivered',payload:{...bot.payload,_receiverId:scope.receiverId}});
 assert.equal((await f.call('/mt4-bot-complete',{commandId:'q',message:'x'})).code,400);
 assert.equal((await f.call('/mt4-bot-complete',{commandId:'q',success:true,message:'x',receiverId:'receiver_000002'})).code,400);
 let r=await f.call('/mt4-bot-complete',{commandId:'q',success:false,message:'Partial close',changed:1,requested:2});assert.equal(r.output.ok,true);assert.equal(f.records[0].status,'failed');
 r=await f.call('/mt4-bot-complete',{commandId:'q',success:true,message:'retry'});assert.equal(r.output.duplicate,true);assert.equal(f.records[0].status,'failed');
 assert.equal((await f.call('/api/wisdo/hightower/receipt/:id',{},'other',{id:'q'})).code,400);
});
test('real file-backed queue claims once and preserves copier commands',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wisdo-test-'));
 try{
 const service=new Mt4CommandService({dataDir:dir,persistence:{driver:'file'}});service.databaseStore=null;
 await service.queueCommandForAccount('u','a',HT_COMMAND,{...bot.payload,confirmation:'confirmed'});
 await service.queueCommandForAccount('u','a','COPY_OPEN_TRADE',{sourceTicket:10});
 assert.equal((await service.getPendingCommand('u',{accountId:'a'})).command,'COPY_OPEN_TRADE');
 const results=await Promise.all([service.claimHightower(['u'],scope),service.claimHightower(['u'],{...scope,receiverId:'receiver_000002'})]);
 assert.equal(results.filter(x=>x.command).length,1);
 const claimed=results.find(x=>x.command).command;assert.ok(claimed.payload._receiverId);
 assert.equal((await service.claimHightower(['wrong'],scope)).command,null);
 assert.equal((await service.getPendingCommandForAnyUser(['u'],{accountId:'a'})).command.command,'COPY_OPEN_TRADE');
 }finally{await rm(dir,{recursive:true,force:true});}
});
