import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldCommandCenterService } from '../services/worldCommandCenterService.js';
import { normalizeCampaignControl } from '../services/campaignControlContract.js';
import { resolveLanePauseTarget } from '../services/wisdoLanePause.js';
import { AccountSelectionService } from '../services/accountSelectionService.js';

const control={version:1,enabled:true,symbol:'XAUUSD',magic:123,ageSeconds:1,scheduleVersion:2,scheduleClockMode:3,lanePauseVersion:1,lanePaused:false,sessionId:2,windowMode:2,window1Start:3,window1End:10,window2Start:12,window2End:16,entryAllowed:false,windowAllowed:false,scheduleEnforced:true,scheduleActive:true,scheduleAllowed:false,scheduleDays:[0,62456,62456,62456,62456,62456,0]};
test('second snapshot normalization preserves the actual schedule and entry gate',()=>{
  const normalized=normalizeCampaignControl(control),again=normalizeCampaignControl(normalized);
  assert.deepEqual(again.session,normalized.session);
  assert.equal(again.session.entryAllowed,false);
  assert.equal(again.scheduleClockMode,3);
  assert.deepEqual(again.scheduleDays,control.scheduleDays);
  assert.equal(again.lanePauseVersion,1);
  assert.deepEqual(normalizeCampaignControl({...control,scheduleDays:[0,0,0,-1,0,0,0]}).scheduleDays,[]);
});
test('confirmed Eastern schedule queues exact lane with clock mode 3, rejects v1 and changed receiver',async()=>{
  let current={...control,live:true};const queued=[];
  const service=new WorldCommandCenterService({mt4SyncService:{repository:{}},mt4CommandService:{queueCommandForAccount:async(...args)=>{queued.push(args);return {id:'queued',command:args[2],accountId:args[1],payload:args[3]};}}});
  service.campaignState={snapshot:async()=>({account:{accountId:'a',ownerUserId:'u'},executionHealth:{commandLinkReady:true},campaigns:[],campaignControl:current})};
  const input={action:'SET_EA_SCHEDULE',accountId:'a',scheduleClock:'EASTERN',slotMasks:control.scheduleDays};
  current={...current,scheduleVersion:1};await assert.rejects(()=>service.propose('u',input),{statusCode:409});
  current={...current,scheduleVersion:2};
  const p=await service.propose('u',input);
  assert.equal(p.schedule.clock,'EASTERN');assert.deepEqual(p.schedule.masks,control.scheduleDays);
  const confirmation={proposalId:p.proposalId,confirmationToken:p.confirmationToken,heldForMs:p.holdRequiredMs};
  current={...current,magic:456};await assert.rejects(()=>service.execute('u',confirmation),{statusCode:409});assert.equal(queued.length,0);
  current={...current,magic:123};const receipt=await service.execute('u',confirmation);
  assert.equal(queued.length,1);assert.deepEqual(queued[0].slice(0,3),['u','a','CEM_SET_GLOBALS']);
  assert.equal(queued[0][3].globals[0].value,2);assert.equal(queued[0][3].globals.at(-1).value,3);
  assert.equal(receipt.deliveryOnly,true);
});
test('lane pause resolves only the watched fresh symbol and magic',()=>{
  const now=Date.now();const a={latestSnapshot:{receivedAt:new Date(now-1000).toISOString(),snapshot:{expertEnabled:true,terminalConnected:true,campaignControl:control,bots:[{laneId:'gold',symbol:'XAUUSD',magicNumber:123},{laneId:'other',symbol:'EURUSD',magicNumber:123}]}}};
  assert.deepEqual(resolveLanePauseTarget(a,'gold',now),{scope:'LANE',symbol:'XAUUSD',magicNumber:123,laneId:'XAUUSD:123'});
  assert.equal(resolveLanePauseTarget(a,'XAUUSD:123',now).scope,'LANE');
  assert.throws(()=>resolveLanePauseTarget(a,'other',now),/not verified/);
  assert.throws(()=>resolveLanePauseTarget(a,'XAUUSD:123',now+31000),/fresh compatible/);
});
test('implicit active shared account does not bypass trading permission',async()=>{
  const service=new AccountSelectionService({repository:{getAccessibleMt4Accounts:async()=>[{accountId:'shared',ownerUserId:'someone-else',shared:true,sharePermission:'view_only',isPrimary:true}]}});
  await assert.rejects(()=>service.resolve('viewer','',{permission:'control'}),{code:'account_forbidden'});
});
