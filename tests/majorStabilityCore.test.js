import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createCommandRegistry } from '../commands/index.js';
import { AccountSelectionService, classifyAccountHealth, classifyAccountType } from '../services/accountSelectionService.js';
import { createCommandEnvelope, transitionCommand } from '../services/commandEnvelopeService.js';
import { assertSafeCopierGraph, normalizeCopierLot, simulateCopierEvent } from '../services/copierSafetyService.js';
import { buildDeskPlan, GuildProvisioningQueue, reconcileDesk } from '../services/deskReconciliationService.js';
import { AffiliateLedger, cents, commissionCents } from '../services/moneyService.js';
import { PaymentWebhookLedger, paymentAvailability, verifyStripeSignature } from '../services/paymentWebhookService.js';
import { PaymentService } from '../services/paymentService.js';
import { BotStoreService } from '../services/botStoreService.js';
import { PresenceEngine } from '../services/presenceEngine.js';
import { SymbolResolver } from '../services/symbolResolver.js';
import { InteractionResponder } from '../utils/interactionResponder.js';
import { createHmac } from 'node:crypto';

const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');

function accountRepo(rows,activeId=''){
  return {getAccessibleMt4Accounts:async()=>rows.map((row)=>({...row,isPrimary:row.accountId===activeId})),setPrimaryMt4Account:async(user,id)=>rows.find((row)=>row.discordUserId===user&&row.accountId===id)||null};
}

test('account model classifies demo/live/unknown and health without guessing live',()=>{
  assert.equal(classifyAccountType({brokerServer:'Broker-Demo'}),'DEMO');
  assert.equal(classifyAccountType({accountType:'live'}),'LIVE');
  assert.equal(classifyAccountType({brokerServer:'Broker-1'}),'UNKNOWN');
  assert.equal(classifyAccountHealth({accountId:'a',lastHeartbeatAt:new Date().toISOString()}),'CONNECTED');
  assert.equal(classifyAccountHealth({accountId:'a'}),'UNLINKED');
  const now=Date.parse('2026-08-09T18:00:00Z');
  assert.equal(classifyAccountHealth({accountId:'a',status:'CONNECTED',lastHeartbeatAt:'2026-08-09T17:58:00Z'},now),'STALE');
  assert.equal(classifyAccountHealth({accountId:'a',status:'CONNECTED',lastHeartbeatAt:'2026-08-09T17:20:00Z'},now),'OFFLINE');
});

test('account resolver requires explicit saved active account and never selects row zero',async()=>{
  const rows=[{accountId:'a',discordUserId:'u',nickname:'Atlanta Live',accountType:'LIVE'},{accountId:'b',discordUserId:'u',nickname:'Gold Demo',accountType:'DEMO'}];
  const service=new AccountSelectionService({repository:accountRepo(rows)});
  await assert.rejects(service.resolve('u',''),(error)=>error.code==='active_account_required');
  assert.equal((await service.resolve('u','Account 2')).accountId,'b');
  assert.equal((await service.resolve('u','my Atlanta live account')).accountId,'a');
});

test('account resolver rejects ambiguous aliases and view-only shared control',async()=>{
  const service=new AccountSelectionService({repository:accountRepo([{accountId:'a',discordUserId:'x',ownerUserId:'x',nickname:'Gold',shared:true,sharePermission:'view_only'},{accountId:'b',discordUserId:'u',nickname:'Gold'}],'b')});
  await assert.rejects(service.resolve('u','Gold'),(error)=>error.code==='account_ambiguous');
  await assert.rejects(service.resolve('u','a',{permission:'control'}),(error)=>error.code==='account_forbidden');
});

test('canonical command envelopes are deterministic and enforce lifecycle transitions',()=>{
  const a=createCommandEnvelope({requestedByUserId:'u',accountId:'a',source:'discord',action:'PAUSE_ENTRIES',parameters:{x:1}});
  const b=createCommandEnvelope({requestedByUserId:'u',accountId:'a',source:'discord',action:'PAUSE_ENTRIES',parameters:{x:1}});
  assert.equal(a.idempotencyKey,b.idempotencyKey);
  const delivered=transitionCommand(a,'DELIVERED');
  const acknowledged=transitionCommand(delivered,'ACKNOWLEDGED');
  assert.equal(transitionCommand(acknowledged,'COMPLETED').status,'COMPLETED');
  assert.throws(()=>transitionCommand(a,'COMPLETED'),(error)=>error.code==='invalid_command_transition');
});

test('symbol resolver verifies follower inventory and never blindly strips suffixes',()=>{
  const resolver=new SymbolResolver();
  assert.equal(resolver.resolve('XAUUSD',['EURUSD','XAUUSDm']).resolvedSymbol,'XAUUSDM');
  assert.equal(resolver.resolve('XAUUSD',['XAUUSDm','XAUUSD.a']).reason,'symbol_ambiguous');
  assert.equal(resolver.resolve('XAUUSD',['EURUSD'],{'XAUUSD':'XAUUSD.a'}).reason,'mapped_symbol_unavailable');
});

test('copier graph rejects self, duplicate, and circular routes',()=>{
  assert.throws(()=>assertSafeCopierGraph([],{masterAccountId:'a',followerAccountId:'a'}),(e)=>e.code==='copier_self_route');
  assert.throws(()=>assertSafeCopierGraph([{masterAccountId:'a',followerAccountId:'b'}],{masterAccountId:'a',followerAccountId:'b'}),(e)=>e.code==='copier_duplicate_route');
  assert.throws(()=>assertSafeCopierGraph([{masterAccountId:'a',followerAccountId:'b'},{masterAccountId:'b',followerAccountId:'c'}],{masterAccountId:'c',followerAccountId:'a'}),(e)=>e.code==='copier_cycle');
});

test('copier lot normalization and simulator target the explicit follower account',()=>{
  assert.deepEqual(normalizeCopierLot({mode:'multiplier',sourceLot:0.13,multiplier:2,minLot:0.01,maxLot:0.2,lotStep:0.01}).lot,0.2);
  const result=simulateCopierEvent({event:{sourceEventId:'evt-1',symbol:'XAUUSD',lots:0.2},route:{masterAccountId:'master',followerAccountId:'follower',lotPolicy:{mode:'fixed',fixedLot:0.03}},followerSnapshot:{symbols:['XAUUSDm'],openTradeCount:0}});
  assert.equal(result.accepted,true);assert.equal(result.command.accountId,'follower');assert.equal(result.command.symbol,'XAUUSDM');
});

test('desk reconciliation is idempotent and per-guild queue serializes work',async()=>{
  const plan=buildDeskPlan({guildId:'g',ownerUserId:'u',channels:[{name:'trading'}],roles:[{name:'Trader'}]});
  const first=reconcileDesk(plan,{});assert.equal(first.operations.length,3);
  const second=reconcileDesk(plan,{category:{name:'WISDO Desks'},channels:[{name:'trading',type:'text',permissions:{}}],roles:[{name:'Trader',permissions:[]}]});assert.equal(second.operations.length,0);
  const queue=new GuildProvisioningQueue(),order=[];await Promise.all([queue.run('g',async()=>{order.push(1);await new Promise((r)=>setTimeout(r,5));order.push(2);}),queue.run('g',async()=>order.push(3))]);assert.deepEqual(order,[1,2,3]);
});

test('presence greeting handles first, daily, away, dismissal, and refresh cooldown',()=>{
  const engine=new PresenceEngine({cooldownMs:1000,awayMs:2000,timeZone:'UTC'}),now=new Date('2026-08-09T10:00:00Z');
  const first=engine.evaluate({}, {}, now);assert.equal(first.type,'FIRST_LOGIN');
  assert.equal(engine.evaluate(first.patch,{},new Date(now.getTime()+100)).reason,'cooldown');
  const nextDay=engine.evaluate({...first.patch,lastGreetingAt:'2026-08-08T10:00:00Z'}, {},new Date('2026-08-10T10:00:00Z'));assert.equal(nextDay.type,'DAILY_GREETING');
  assert.equal(engine.evaluate({firstSeenAt:now.toISOString(),lastSeenAt:now.toISOString(),lastDailyGreetingDate:'08/09/2026',dismissedNotices:['danger:1']},{type:'DANGER',eventId:'danger:1'},new Date(now.getTime()+5000)).reason,'dismissed');
});

test('money and affiliate ledger use integer cents and idempotency',()=>{
  assert.equal(cents(1200),1200);assert.throws(()=>cents(12.34));assert.equal(commissionCents(10001,1250),1250);
  const ledger=new AffiliateLedger();const one=ledger.record({idempotencyKey:'sale-1',affiliateId:'a',amountCents:1250,status:'AVAILABLE'});assert.equal(ledger.record({idempotencyKey:'sale-1',affiliateId:'a',amountCents:9999}),one);assert.equal(ledger.balance('a'),1250);
});

test('payment webhook verification and ledger reject fake success paths',()=>{
  const secret='whsec_test',body='{"id":"evt_1"}',timestamp=1700000000,signature=createHmac('sha256',secret).update(`${timestamp}.${body}`).digest('hex');
  assert.equal(verifyStripeSignature(body,`t=${timestamp},v1=${signature}`,secret,300,timestamp*1000),true);
  assert.equal(paymentAvailability({}).available,false);
  const ledger=new PaymentWebhookLedger();assert.equal(ledger.apply({id:'evt_1',type:'checkout.session.completed'},()=>({activated:true})).duplicate,false);assert.equal(ledger.apply({id:'evt_1'},()=>({})).duplicate,true);
});

test('Square webhook processing is durably claimed, idempotent, and retryable after failure',async()=>{
  const events=new Map();
  const repository={
    async beginPaymentEvent(provider,id,type){const prior=events.get(id);if(prior?.status==='APPLIED'||prior?.status==='PROCESSING')return{accepted:false};events.set(id,{provider,type,status:'PROCESSING'});return{accepted:true};},
    async completePaymentEvent(provider,id){events.get(id).status='APPLIED';},
    async failPaymentEvent(provider,id,error){events.set(id,{provider,status:'FAILED',error:error.message});},
  };
  const service=new PaymentService({store:{},api:{}},repository);
  service.hasWebhookConfig=()=>true;service.square.verifyWebhook=()=>true;
  let handled=0;service.handleCompletedPayment=async()=>{handled+=1;};
  const body=JSON.stringify({event_id:'square-event-1',type:'payment.updated',data:{object:{payment:{status:'COMPLETED'}}}});
  assert.equal((await service.handleWebhook(body,'valid')).duplicate,false);
  assert.equal((await service.handleWebhook(body,'valid')).duplicate,true);
  assert.equal(handled,1);assert.equal(events.get('square-event-1').status,'APPLIED');

  let failOnce=true;service.handleCompletedPayment=async()=>{if(failOnce){failOnce=false;throw new Error('transient');}handled+=1;};
  const retryBody=JSON.stringify({event_id:'square-event-2',type:'payment.updated',data:{object:{payment:{status:'COMPLETED'}}}});
  await assert.rejects(service.handleWebhook(retryBody,'valid'),/transient/);
  assert.equal(events.get('square-event-2').status,'FAILED');
  assert.equal((await service.handleWebhook(retryBody,'valid')).duplicate,false);
  assert.equal(events.get('square-event-2').status,'APPLIED');
});

test('interaction responder acknowledges once and records latency',async()=>{
  const calls=[];let now=1000;const interaction={id:'i',commandName:'x',user:{id:'u'},guildId:'g',deferred:false,replied:false,async deferReply(){calls.push('defer');this.deferred=true;},async editReply(){calls.push('edit');},async followUp(){calls.push('follow');}};
  const responder=new InteractionResponder(interaction,{clock:()=>now});await responder.defer();now=1100;await responder.reply('done');now=1200;const row=responder.finish();assert.deepEqual(calls,['defer','edit']);assert.equal(row.ackMs,0);assert.equal(row.completionMs,200);
});

test('Discord runtime and registration use one valid 100-command source of truth',()=>{
  const registry=createCommandRegistry({});assert.equal(registry.audit.commandCount,100);assert.equal(new Set(registry.audit.names).size,100);assert.match(read('../scripts/registerCommands.js'),/createCommandRegistry/);assert.match(read('../index.js'),/createCommandRegistry/);
});

test('production identity cannot fall back to query parameters or website-buyer',()=>{
  const server=read('../server/apiServer.js');const identity=server.slice(server.indexOf('function getIdentity'),server.indexOf('function currentUserId'));
  assert.doesNotMatch(identity,/req\.query|req\.body|website-buyer/);assert.match(server,/authentication_required/);
});

test('major stability migration contains stable accounts, command lifecycle, copier idempotency, and integer money',()=>{
  const sql=read('../migrations/2026-08-09-major-stability-ecosystem.sql');
  for(const token of ['stable_account_id UUID','wisdo_user_trading_preferences','canonical_status','wisdo_discord_interactions','wisdo_copier_routes','UNIQUE(route_id,source_event_id,event_type)','wisdo_bot_lanes','amount_cents BIGINT','wisdo_operational_metrics'])assert.match(sql,new RegExp(token.replace(/[()]/g,'\\$&')));
});

test('MT4 authoritative snapshot persistence precedes post-ack signal processing',()=>{
  const source=read('../services/mt4SyncService.js');
  const receive=source.slice(source.indexOf('async receiveSnapshot'),source.indexOf('\n  async ',source.indexOf('async receiveSnapshot')+10));
  assert.doesNotMatch(receive,/await this\.processTradeSignals/);
  assert.ok(receive.indexOf('persistMt4Snapshot')<receive.indexOf('enqueueTradeSignalWork'));
});


test('account health uses heartbeat age instead of trusting a stale CONNECTED flag',()=>{
  const now=Date.parse('2026-08-09T18:00:00Z');
  assert.equal(classifyAccountHealth({accountId:'acct',status:'CONNECTED',lastHeartbeatAt:'2026-08-09T17:58:00Z'},now),'STALE');
  assert.equal(classifyAccountHealth({accountId:'acct',status:'CONNECTED',lastHeartbeatAt:'2026-08-09T17:00:00Z'},now),'OFFLINE');
});

test('member payout UI and API use integer cents and do not advertise fake fallback checkout',()=>{
  const server=read('../server/apiServer.js');
  assert.match(server,/amountCents=Math\.round\(Number\(data\.amount\|\|0\)\*100\)/);
  assert.match(server,/insufficient_available_commission/);
  assert.doesNotMatch(server,/Manual fallback/);
  assert.match(server,/Checkout disabled if unconfigured/);
});

test('review and copy-hub APIs persist state instead of returning hard-coded success',()=>{
  const server=read('../server/apiServer.js');
  assert.match(server,/state\.reviewsById\[review\.reviewId\] = review/);
  assert.doesNotMatch(server,/app\.get\('\/api\/reviews', \(req, res\) => res\.json\(\{ ok: true, reviews: \[\] \}\)\)/);
  assert.match(server,/updateMt4AccountSettings\?\.\(account\.discordUserId/);
  assert.match(server,/telegram_review_webhook_unconfigured/);
});

test('admin system health performs role authorization, not login-only authorization',()=>{
  const server=read('../server/apiServer.js');
  const start=server.indexOf("app.get('/admin/system-health'");
  const end=server.indexOf("app.get('/health/mt4'",start);
  const route=server.slice(start,end);
  assert.match(route,/getRequestAccess/);
  assert.match(route,/canAccessAdmin/);
  assert.match(route,/status\(403\)/);
});


test('paid bot delivery rejects amount mismatches before granting licenses',async()=>{
  const service=new BotStoreService({
    config:{},
    repository:{
      async getQuote(){return{quoteId:'quote-1',discordUserId:'u',botIds:['bot-1'],botNames:['Bot 1'],finalPriceUsd:100};},
      async findOrderByCheckoutSessionId(){return null;},
    },
    operatorDeskService:{},botCatalogService:{},botPricingService:{},paymentService:null,client:{guilds:{cache:new Map(),fetch:async()=>null}},
  });
  await assert.rejects(
    service.handleCompletedCheckoutSession({id:'pay-1',amount_total:9999,payment_status:'paid',metadata:{quoteId:'quote-1'}}),
    (error)=>error.code==='payment_amount_mismatch',
  );
});

test('finance checkout fails closed for unfinished recurring billing and commissions require paid state',()=>{
  const server=read('../server/apiServer.js');
  assert.match(server,/recurring_vps_checkout_not_enabled/);
  assert.match(server,/recurring_bot_checkout_not_enabled/);
  assert.match(server,/Access and commission remain locked until the signed webhook confirms payment/);
  assert.match(server,/paymentStatus = 'paid'/);
  const commissionStart=server.indexOf('async function createCommissionFromOrder');
  const commissionEnd=server.indexOf('\nfunction referralStatsForUser',commissionStart);
  const commission=server.slice(commissionStart,commissionEnd);
  assert.match(commission,/\['paid', 'completed', 'succeeded'\]/);
  assert.match(commission,/commissionAmountCents/);
  assert.match(commission,/convertedOrderId/);
});

test('effective login surface preserves OAuth errors and Discord callback persists the member identity',()=>{
  const major=read('../server/majorUpgradeRoutes.js');
  const server=read('../server/apiServer.js');
  assert.match(major,/req\.query\.message\|\|req\.query\.error/);
  assert.match(server,/scope: 'identify email'/);
  assert.match(server,/authStateStore\.usersById\[sessionUser\.id\] = sessionUser/);
  assert.match(server,/authStateStore\.profiles\[sessionUser\.id\]/);
  assert.match(server,/login_return_to/);
});


test('production startup requires a dedicated strong session secret and stable account UUIDs are non-null',()=>{
  const config=read('../config.js');
  const security=read('../server/security.js');
  const sql=read('../migrations/2026-08-09-major-stability-ecosystem.sql');
  assert.match(config,/NODE_ENV === 'production'.*SESSION_SECRET/s);
  assert.match(config,/SESSION_SECRET \|\| ''\)\.length < 32/);
  assert.match(security,/sessionSecretConfigured = String\(process\.env\.SESSION_SECRET \|\| ''\)\.length >= 32/);
  assert.match(sql,/UPDATE wisdo_mt4_accounts SET stable_account_id=gen_random_uuid\(\) WHERE stable_account_id IS NULL/);
  assert.match(sql,/ALTER COLUMN stable_account_id SET NOT NULL/);
});
