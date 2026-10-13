import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  BLOCKS, FLOW_KEY, exampleFlow, freshNode, validateFlow,
  connectFlow, removeFlowNode,generateFlowMql4,exportFlowJson,deserializeFlow
} from '../public/js/robot-studio-flow-core.js';

test('source-generating graph has typed blocks and valid nontrivial true/false paths', () => {
  const g=exampleFlow();
  assert.deepEqual(validateFlow(g),[]);
  assert.equal(g.nodes.find(n=>n.id==='sell-signal').params.direction,'down');
  assert.ok(['tick','ema','rsi','session','spread','buy','sell','wait'].every(t=>BLOCKS[t]));
  assert.equal(g.edges.length,5);
  const c=generateFlowMql4(g);
  assert.match(c,/void OnTick\(\)/);
  assert.match(c,/if \(\(iMA\(/);
  assert.match(c,/SubmitTrade\(OP_BUY\);/);
  assert.match(c,/SubmitTrade\(OP_SELL\);/);
  assert.match(c,/\} else \{/);
  assert.match(c,/HasOwnOpenOrder\(\)/);
  assert.match(c,/MODE_STOPLEVEL/);
  assert.match(c,/AccountFreeMarginCheck/);
  assert.doesNotMatch(c,/WebRequest|DllImport|ShellExecute/);
  assert.equal((c.match(/void OnTick\(\)/g)||[]).length,1);
});

test('relinking a branch changes emitted trade execution flow', () => {
  const g=exampleFlow(), first=generateFlowMql4(g);
  // Swap buy / wait branches with connectFlow; each output remains unique and each node has one parent.
  const buy=g.edges.find(e=>e.to==='buy-action'), wait=g.edges.find(e=>e.to==='no-trade');
  buy.to='no-trade';wait.to='buy-action';
  assert.deepEqual(validateFlow(g),[]);
  const second=generateFlowMql4(g);
  assert.notEqual(first,second);
  assert.match(second, /if \(\(iMA\([^]*?\)\) \{\s*\} else \{/);
});

test('real connected RSI and session blocks generate their own MQL4 conditions', () => {
  let g=exampleFlow();
  g.nodes.push(freshNode('rsi','rsi-filter',570,290),freshNode('session','session-filter',550,500));
  g=connectFlow(g,'buy-signal','true','rsi-filter');
  g=connectFlow(g,'rsi-filter','true','buy-action');
  // After reconnecting, stale false branch is allowed to be a wait terminal.
  g=connectFlow(g,'rsi-filter','false','session-filter');
  g=connectFlow(g,'session-filter','true','no-trade');
  // session false is an intentionally empty branch
  // The sell-signal false edge to no-trade was displaced by session connection; attach fresh no-op.
  g.nodes.push(freshNode('wait','sell-no-action',880,670));
  g=connectFlow(g,'sell-signal','false','sell-no-action');
  assert.deepEqual(validateFlow(g),[]);
  const source=generateFlowMql4(g);
  assert.match(source,/iRSI\(Symbol\(\),0,14,PRICE_CLOSE,1\) < 30/);
  assert.match(source,/TimeHour\(TimeCurrent\(\)\) >= 8/);
  assert.ok(source.indexOf('iRSI(')>0);
});

test('rejects unreachable nodes, cycles, duplicate socket outputs and multiple parents',()=>{
  const g=exampleFlow();
  g.nodes.push(freshNode('spread','unconnected',20,20));
  assert.match(validateFlow(g).join(' '),/unconnected: connect exactly one incoming/);
  assert.throws(()=>generateFlowMql4(g),/unconnected/);
  assert.equal(g.nodes.length,7);
});

test('connectFlow forbids feedback cycles even on partially detached canvases',()=>{
  const g=exampleFlow();
  const existing=g.edges.find(e=>e.from==='buy-signal'&&e.port==='false');
  assert.equal(existing.to,'sell-signal');
  assert.throws(()=>connectFlow(g,'sell-signal','false','buy-signal'),/cycle/);
  assert.throws(()=>connectFlow(g,'buy-action','next','tick'),/valid output/);
  assert.throws(()=>removeFlowNode(g,'tick'),/cannot be removed/);
});

test('one incoming owner per node and no duplicate port sockets',()=>{
  const g=exampleFlow();
  g.edges.push({from:'tick',port:'next',to:'sell-signal'});
  assert.match(validateFlow(g).join(' '),/each output socket/);
  assert.match(validateFlow(g).join(' '),/connect exactly one incoming/);
});

test('graph builder refuses script injection, malformed numeric values and unsupported code nodes',()=>{
  const g=exampleFlow();
  g.nodes[1].params.fast='9; OrderSend(Symbol(),OP_BUY,5,Ask,0,0,0)';
  assert.match(validateFlow(g).join(' '),/EMA periods/);
  assert.throws(()=>generateFlowMql4(g));
  const h=exampleFlow();h.nodes[1].type='script';
  assert.match(validateFlow(h).join(' '),/unknown block type/);
  assert.throws(()=>deserializeFlow(JSON.stringify(h)));
});

test('graph round trip keeps connections, positions and settings, while validating before import',()=>{
  const g=exampleFlow();
  g.settings.name='WISDO HIGHTOWER Test';
  const json=exportFlowJson(g),back=deserializeFlow(json);
  assert.deepEqual(back,g);
  assert.equal(generateFlowMql4(back),generateFlowMql4(g));
  assert.equal(typeof FLOW_KEY,'string');
  assert.throws(()=>deserializeFlow('{invalid'),/Invalid flow project JSON/);
  assert.throws(()=>deserializeFlow('x'.repeat(140001)),/140 KB/);
});

test('page integrates fourth fxDreema-like workspace and preserves hospital/import tabs',()=>{
  const html=fs.readFileSync(new URL('../public/app/robot-studio/index.html',import.meta.url),'utf8');
  const workspace=fs.readFileSync(new URL('../public/js/robot-studio-workspace.js',import.meta.url),'utf8');
  const ui=fs.readFileSync(new URL('../public/js/robot-studio-flow-ui.js',import.meta.url),'utf8');
  for(const id of ['mode-flow-tab','flow-builder','fx-flow-board','fx-edges','fx-nodes','fx-palette',
    'fx-inspector','fx-global-settings','fx-edges-list','fx-download-mq4','fx-export-json','fx-import','fx-code','fx-status',
    'mode-hospital-tab','bot-hospital','mode-import-tab','import-rebuild']) assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(html,/flow-builder\.css/);
  assert.match(html,/robot-studio-flow-ui\.js/);
  assert.match(workspace,/#flow-builder/);
  assert.match(ui,/linkFrom\(/);
  assert.match(ui,/connectFlow\(/);
  assert.match(ui,/dataTransfer\.setData/);
});
