import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sourceBlueprint,moveSourceNode,updateSourceInput,updateSourceCondition,
  attachSourceGate,removeSourceGate,expandSourceModule,compileSourceBlueprint,sourceEdges
} from '../public/js/robot-studio-source-graph-core.js';
const example=[
  '#property strict','input double AllowedSpread = 1.5;',
  'input int TradeThreshold = 2;',
  'void OnTick() {',
  '  if (TradeThreshold > 1) OrderSend(Symbol(), OP_BUY, 0.01, Ask, 2, 0, 0);',
  '}'
].join('\n')+'\n';
test('MQ4 source becomes real original input and verified trade-condition blocks',()=>{
  const a=sourceBlueprint(example,'custom.mq4');
  assert.equal(a.platform,'MT4');
  assert.equal(a.analysis.links.length,1);
  assert.ok(a.nodes.some(n=>n.type==='module'));
  assert.ok(a.nodes.some(n=>n.type==='condition'));
  assert.ok(a.nodes.some(n=>n.type==='action'&&n.label==='OrderSend'));
  assert.ok(sourceEdges(a).some(e=>e.kind==='verified'));
  assert.deepEqual(compileSourceBlueprint(a),{source:example,changes:[]});
});
test('editing original inputs and conditions changes exactly those source regions',()=>{
  const a=sourceBlueprint(example,'custom.mq4');
  const input=a.hospital.inputs.find(x=>x.name==='AllowedSpread');
  const guard=a.analysis.conditions[0];
  updateSourceInput(a,input.id,2.25);updateSourceCondition(a,guard.id,'>=',4);
  const result=compileSourceBlueprint(a);
  assert.equal(result.source,example.replace('AllowedSpread = 1.5;','AllowedSpread = 2.25;').replace('TradeThreshold > 1','TradeThreshold >= 4'));
  assert.equal(result.changes.length,3);
});
test('adding/removing a new AND-condition is round-trip source editing',()=>{
  const a=sourceBlueprint(example,'custom.mq4'),guard=a.analysis.conditions[0];
  const g=attachSourceGate(a,guard.id,{input:'AllowedSpread',operator:'<',threshold:2.5},'gate-1');
  assert.ok(sourceEdges(a).some(e=>e.kind==='gate'));
  assert.equal(compileSourceBlueprint(a).source,example.replace('if (TradeThreshold > 1)','if (TradeThreshold > 1 && (AllowedSpread < 2.5))'));
  g.threshold=3;
  assert.match(compileSourceBlueprint(a).source,/AllowedSpread < 3/);
  removeSourceGate(a,g.id);assert.equal(compileSourceBlueprint(a).source,example);
});
test('rejects fabricated arbitrary MQL rewiring and invalid source edits',()=>{
  const a=sourceBlueprint('#property strict\nvoid OnTick(){if(GetSignal()) OrderSend(Symbol(),OP_BUY,0.01,Ask,2,0,0);}\n','opaque.mq4');
  assert.equal(a.analysis.links.length,0);
  assert.throws(()=>attachSourceGate(a,'any',{input:'bad',operator:'<',threshold:2}),/verified direct-trade/);
  const b=sourceBlueprint(example,'safe.mq4'),id=b.analysis.conditions[0].id;
  assert.throws(()=>attachSourceGate(b,id,{input:'OrderSend',operator:'>',threshold:1}),/numeric global input/);
  assert.throws(()=>updateSourceCondition(b,id,'&&',1),/comparison operator/);
  assert.throws(()=>updateSourceInput(b,'unknown',1),/Unknown mapped input/);
});
test('MQ5 CTrade source uses the same source-backed canvas without pretending to generate MT4',()=>{
  const mq5=[
    '#include <Trade/Trade.mqh>',
    'CTrade trade;',
    'input int RiskThreshold = 2;',
    'void OnTick(){ if(RiskThreshold > 1) trade.Buy(0.01); }'
  ].join('\n')+'\n';
  const a=sourceBlueprint(mq5,'portfolio.mq5');
  assert.equal(a.platform,'MT5');
  assert.ok(a.nodes.some(n=>n.type==='action'&&n.label==='trade.Buy'));
  const field=a.hospital.inputs.find(n=>n.name==='RiskThreshold');
  updateSourceInput(a,field.id,4);
  assert.equal(compileSourceBlueprint(a).source,mq5.replace('RiskThreshold = 2','RiskThreshold = 4'));
});
test('expanding original functions creates reference-only inspectable canvas edges',()=>{
  const source=[
    '#property strict',
    'bool RiskSignal(){return true;}',
    'void RiskEngine(){if(RiskSignal()) Print("allowed");}',
    'void OnTick(){RiskEngine();}'
  ].join('\n')+'\n';
  const a=sourceBlueprint(source,'custom.mq4');
  const count=expandSourceModule(a,'risk');
  assert.equal(count,2);
  assert.ok(a.nodes.some(n=>n.type==='function'&&n.label==='RiskEngine'));
  assert.ok(a.nodes.some(n=>n.type==='function'&&n.label==='RiskSignal'));
  assert.ok(sourceEdges(a).some(edge=>edge.kind==='reference'&&edge.label.includes('NOT EXECUTION')));
  assert.equal(compileSourceBlueprint(a).source,source);
});
test('moving imported cards changes the layout, not robot code',()=>{
  const a=sourceBlueprint(example,'custom.mq4'),n=a.nodes[0];
  moveSourceNode(a,n.id,550,500);assert.equal(n.x,550);
  assert.equal(compileSourceBlueprint(a).source,example);
});

test('large original HIGHTOWER v6.21 keeps its advanced functions while editing source default',async()=>{
  const fs=await import('node:fs');
  const text=fs.readFileSync(new URL('../mql4/HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4',import.meta.url),'utf8');
  assert.ok(text.length>500000);
  const a=sourceBlueprint(text,'HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4');
  assert.ok(a.represented.functions>20);
  assert.ok(a.represented.inputs>40);
  assert.ok(a.nodes.some(n=>n.type==='module'));
  const sonic=a.hospital.inputs.find(i=>i.name==='DirectSonicNodesBetweenCores');
  assert.ok(sonic);
  updateSourceInput(a,sonic.id,12);
  assert.equal(compileSourceBlueprint(a).source,
    text.replace('DirectSonicNodesBetweenCores=24;','DirectSonicNodesBetweenCores=12;'));
});
test('top navigation handles native phone/laptop MQ4/MQ5 import and complete source export',async()=>{
  const fs=await import('node:fs');
  const html=fs.readFileSync(new URL('../public/app/robot-studio/index.html',import.meta.url),'utf8');
  const script=fs.readFileSync(new URL('../public/js/robot-studio-flow-ui.js',import.meta.url),'utf8');
  const imported=fs.readFileSync(new URL('../public/js/robot-studio-source-graph-ui.js',import.meta.url),'utf8');
  assert.match(html,/id="fx-import-source"/);
  assert.match(html,/id="fx-source-file-input" type="file" accept="\.mq4,\.mq5"/);
  assert.ok(html.indexOf('id="fx-import-source"')<html.indexOf('id="fx-flow-board"'));
  assert.match(html,/source-blueprint\.css/);
  assert.match(script,/sourceMode\.load\(file\)/);
  assert.match(script,/sourceMode\.exportSource\(\)/);
  assert.match(imported,/attachSourceGate\(/);
  assert.match(imported,/removeSourceGate\(/);
  assert.match(imported,/openDrawer\('inspector'\)/);
});
