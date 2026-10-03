import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { WisdoBehaviorCompilerService } from '../services/wisdoBehaviorCompilerService.js';
import { WisdoIntentService } from '../services/wisdoIntentService.js';
import { campaignPacket } from '../services/campaignControlContract.js';
import { stopLossHitEvent } from '../services/wisdoPlanMonitorService.js';

const compiler=new WisdoBehaviorCompilerService();

test('V17 compiles stop-out counter language into a standing HIGHTOWER intention',()=>{
  const text='If my trade hits stop, immediately counter trade and set that as the main campaign and trigger from there';
  const intent=new WisdoIntentService().deterministic(text,{activeAccountId:'acct-1',symbol:'XAUUSD',magic_number:880099});
  assert.equal(intent.type,'BEHAVIOR');
  const behavior=compiler.compile(text,{account_id:'acct-1',symbol:'XAUUSD',magic_number:880099});
  assert.equal(behavior.validation.valid,true);
  assert.deepEqual(behavior.trigger,{type:'event',event:'stop_loss_hit'});
  assert.equal(behavior.actions.some((action)=>action.type==='counter_if_valid'),true);
  assert.equal(behavior.scope.account_ref,'acct-1');
  assert.equal(behavior.scope.symbol,'XAUUSD');
  assert.equal(behavior.scope.magic_number,880099);
  assert.equal(behavior.verification.receipt,'mt4_reporter');
});

test('V17 counter command is derived from the verified closed trade, never from a guessed side',()=>{
  const behavior=compiler.compile('If my trade hits stop, counter trade',{account_id:'acct-1',symbol:'XAUUSD',magic_number:880099});
  const action=behavior.actions.find((item)=>item.type==='counter_if_valid');
  const buyStopped=compiler.commandFor(action,{event:{type:'stop_loss_hit',closedTrade:{ticket:101,type:'BUY',stopLoss:2320,closePrice:2319.9}}});
  assert.equal(buyStopped.commandName,'WISDO_CAMPAIGN');
  assert.equal(buyStopped.parameters.action,'COUNTER_IF_VALID');
  assert.equal(buyStopped.parameters.counterDirection,-1);
  assert.equal(buyStopped.parameters.referencePrice,2320);
  const sellStopped=compiler.commandFor(action,{event:{type:'stop_loss_hit',closedTrade:{ticket:102,type:'SELL',stopLoss:2350,closePrice:2350.1}}});
  assert.equal(sellStopped.parameters.counterDirection,1);
});

test('V17 Reporter stop detector requires prior ownership plus broker SL/close evidence',()=>{
  const snapshot={closedTradesToday:[
    {ticket:101,symbol:'XAUUSD',magicNumber:880099,type:'BUY',stopLoss:2320,closePrice:2319.9},
    {ticket:102,symbol:'XAUUSD',magicNumber:880099,type:'BUY',stopLoss:2310,closePrice:2340},
  ]};
  const event=stopLossHitEvent(snapshot,{symbol:'XAUUSD',magic_number:880099},['101']);
  assert.equal(event.type,'stop_loss_hit');
  assert.equal(event.closedTrade.ticket,101);
  assert.equal(event.counterDirection,-1);
  assert.equal(stopLossHitEvent(snapshot,{symbol:'XAUUSD',magic_number:880099},['102']),null);
  assert.equal(stopLossHitEvent(snapshot,{symbol:'EURUSD',magic_number:880099},['101']),null);
});

test('V17 campaign operation 21 can only arm a flat verified counter campaign',()=>{
  const state={campaignControl:{
    live:true,version:1,symbol:'XAUUSD',magic:880099,campaignId:77,phase:0,direction:0,rail:0,pendingId:0,ackId:0,
    positions:[],levels:[],runtime:{overrideMask:0,scope:0,stopAtr:1.5,trailStartAtr:1,trailDistanceAtr:.75,trailStepAtr:.15},
  }};
  const packet=campaignPacket('COUNTER_IF_VALID',{eaCampaignId:77,counterDirection:-1,referencePrice:2320},state);
  assert.equal(packet.operation,21);
  assert.equal(packet.counterDirection,-1);
  assert.equal(packet.referencePrice,2320);
  assert.throws(()=>campaignPacket('COUNTER_IF_VALID',{eaCampaignId:77,counterDirection:0,referencePrice:2320},state),/Counter direction/);
  assert.throws(()=>campaignPacket('COUNTER_IF_VALID',{eaCampaignId:77,counterDirection:-1,referencePrice:0},state),/reference price/);
  const active={campaignControl:{...state.campaignControl,phase:1,positions:[{ticket:101,role:0}]}};
  assert.throws(()=>campaignPacket('COUNTER_IF_VALID',{eaCampaignId:77,counterDirection:-1,referencePrice:2320},active),/flat|prior campaign/i);
});

test('V17 MQL arms HIGHTOWER reversal proof instead of forcing an opposite order',async()=>{
  const [receiver,bridge,reporter,ea]=await Promise.all([
    fs.readFile(new URL('../mql4/include/WISDO_H620Receiver.mqh',import.meta.url),'utf8'),
    fs.readFile(new URL('../mql4/include/WISDO_ReporterCampaign.mqh',import.meta.url),'utf8'),
    fs.readFile(new URL('../mql4/CultureCoin_MT4_Reporter.mq4',import.meta.url),'utf8'),
    fs.readFile(new URL('../mql4/HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4',import.meta.url),'utf8'),
  ]);
  assert.match(bridge,/op>21/);
  assert.match(bridge,/counterDirection/);
  assert.match(bridge,/referencePrice/);
  assert.match(receiver,/WcoArmCounterIfValid/);
  assert.match(receiver,/h620Flip=dir/);
  assert.match(receiver,/h620Phase=3/);
  assert.match(receiver,/H620TryFlip still requires opposite closed-bar/);
  const start=receiver.indexOf('bool WcoArmCounterIfValid');
  const end=receiver.indexOf('bool WcoApplyTrailAtr',start);
  assert.ok(start>=0&&end>start);
  assert.doesNotMatch(receiver.slice(start,end),/OrderSend\s*\(/);
  assert.match(ea,/void H620TryFlip\(\)/);
  assert.match(ea,/HT6EinsteinOpenStructureHold\(dir\)/);
  assert.match(reporter,/REPORTER_VERSION = "1\.63"/);
  assert.match(reporter,/\"stopLoss\"/);
  assert.match(reporter,/counter-campaign intention is armed/);
});

test('V17 Live Manager sends full language to shared Intent OS and exposes standing truth',async()=>{
  const [runtime,routes,conversation,provider]=await Promise.all([
    fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../server/worldCommandRoutes.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../services/wisdoConversationService.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../services/wisdoProviderService.js',import.meta.url),'utf8'),
  ]);
  assert.match(runtime,/\/api\/world\/intent/);
  assert.match(runtime,/\/api\/world\/intentions/);
  assert.match(runtime,/STANDING INTENTIONS/);
  assert.match(runtime,/INTENT_OS_CAPABILITIES/);
  assert.doesNotMatch(runtime,/function parseManager/);
  assert.match(routes,/conversationService\.answer/);
  assert.match(routes,/wisdo_behavior_runtime_state/);
  assert.match(conversation,/lastIntent/);
  assert.match(conversation,/magic_number/);
  assert.match(provider,/GENERAL_CONDITIONAL_BEHAVIOR/);
  assert.match(provider,/context\.lastIntent/);
  assert.match(provider,/WISDO_CAMPAIGN/);
});

test('V17 ambient room arrival is real capability-gated device execution',async()=>{
  const [bus,routes,desktop,desktopEnroll,edge,edgeEnroll,control,controlRoutes]=await Promise.all([
    fs.readFile(new URL('../services/wisdoCommandBusService.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../server/commandBusRoutes.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../desktop-agent/agent.py',import.meta.url),'utf8'),
    fs.readFile(new URL('../desktop-agent/enroll.py',import.meta.url),'utf8'),
    fs.readFile(new URL('../pi-edge/wisdo_edge.py',import.meta.url),'utf8'),
    fs.readFile(new URL('../pi-edge/enroll.py',import.meta.url),'utf8'),
    fs.readFile(new URL('../services/wisdoUniversalControlService.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../server/universalControlRoutes.js',import.meta.url),'utf8'),
  ]);
  assert.match(bus,/issueSystemCommand/);
  assert.match(bus,/ambient_capability_missing/);
  assert.match(routes,/\/api\/device\/v1\/presence\/arrive/);
  assert.match(routes,/wake_trading_workstation/);
  assert.match(routes,/prepare_trading_workspace/);
  assert.match(desktop,/def prepare_trading_workspace/);
  assert.match(desktop,/webbrowser\.open/);
  assert.doesNotMatch(desktop,/command-inbox\.jsonl/);
  assert.match(desktopEnroll,/prepare_trading_workspace.*bool/);
  assert.match(edge,/def wake_trading_workstation/);
  assert.match(edge,/sock\.sendto\(packet/);
  assert.match(edge,/def poll_presence/);
  assert.match(edgeEnroll,/presence.*bool\(presence_command\)/);
  assert.match(control,/leaseExecutions/);
  assert.match(control,/completeExecution/);
  assert.match(controlRoutes,/executions\/lease/);
  assert.match(controlRoutes,/executions\/:executionId\/complete/);
});

test('V17 deployment enables live voice authority but keeps explicit safety implementation',async()=>{
  const [render,safety,workspace,worker]=await Promise.all([
    fs.readFile(new URL('../render.yaml',import.meta.url),'utf8'),
    fs.readFile(new URL('../services/wisdoSafetyService.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/js/workspace.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/service-worker.js',import.meta.url),'utf8'),
  ]);
  assert.match(render,/WISDO_VOICE_EXECUTION_MODE\s*\n\s*value: LIVE_AUTHORIZED/);
  assert.match(safety,/requiresStrongConfirmation/);
  assert.match(safety,/WIDEN_EXISTING_STOPS/);
  assert.match(workspace,/v=20261002-v17-intent-os/);
  assert.match(worker,/wisdo-static-v17\.0\.0-intent-os/);
});
