import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  sourceBlueprint,setSourceView,visibleSourceNodes,sourceCategorySummary,
  moveSourceNode,updateSourceInput,compileSourceBlueprint,sourceEdges
} from '../public/js/robot-studio-source-graph-core.js';

const hightower=fs.readFileSync(new URL('../mql4/HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4',import.meta.url),'utf8');
const make=()=>sourceBlueprint(hightower,'HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4');

test('all imported HIGHTOWER functions are shown by default, not capped at nine or 38 cards',()=>{
  const graph=make();
  const functions=visibleSourceNodes(graph).filter(n=>n.type==='function');
  assert.ok(graph.hospital.functions.length>20);
  assert.equal(graph.view,'all');
  assert.equal(functions.length,graph.hospital.functions.length);
  assert.equal(new Set(functions.map(f=>f.source)).size,graph.hospital.functions.length);
  assert.ok(graph.dimensions.height>850,'large complete map must grow vertically');
  assert.ok(graph.dimensions.width>=1120,'map must fit several readable node columns');
  assert.equal(compileSourceBlueprint(graph).source,hightower);
});

test('a generated 333-function MQL robot displays all 333 nodes and collapses without loss',()=>{
  const code='#property strict\n'+Array.from({length:333},(_,i)=>{
    const suffix=String(i).padStart(3,'0');
    return 'void CustomUnit'+suffix+'(){ }\n';
  }).join('')+'void OnTick(){CustomUnit000();}\n';
  const graph=sourceBlueprint(code,'custom_333.mq4');
  assert.equal(graph.hospital.functions.length,334);
  assert.equal(visibleSourceNodes(graph).filter(n=>n.type==='function').length,334);
  assert.ok(graph.dimensions.height>7000);
  setSourceView(graph,'collapsed');
  assert.equal(visibleSourceNodes(graph).length,8);
  const other=sourceCategorySummary(graph).find(c=>c.id==='bridge');
  assert.ok(other.functions>=333,'all custom functions must remain in the eighth umbrella');
  setSourceView(graph,'category','bridge');
  assert.ok(visibleSourceNodes(graph).filter(n=>n.type==='function').length>=333);
  assert.equal(compileSourceBlueprint(graph).source,code);
});
test('collapse always yields precisely eight engines without dropping unmatched custom functions',()=>{
  const graph=make(),summary=sourceCategorySummary(graph);
  assert.equal(summary.length,8);
  assert.equal(summary.reduce((n,c)=>n+c.functions,0),graph.hospital.functions.length);
  const collapsed=setSourceView(graph,'collapsed');
  assert.equal(collapsed.shown,8);
  assert.equal(visibleSourceNodes(graph).filter(n=>n.type==='module').length,8);
  assert.equal(visibleSourceNodes(graph).filter(n=>n.type==='function').length,0);
  assert.equal(compileSourceBlueprint(graph).source,hightower);
});

test('each engine opens ALL its functions, and navigation recovers every imported function',()=>{
  const graph=make(),combined=new Set();
  setSourceView(graph,'collapsed');
  for(const category of sourceCategorySummary(graph)){
    const focus=setSourceView(graph,'category',category.id);
    const nodes=visibleSourceNodes(graph).filter(n=>n.type==='function');
    assert.equal(nodes.length,category.functions,category.id+' function coverage');
    assert.ok(focus.height>=850);
    for(const n of nodes)combined.add(n.source);
  }
  assert.equal(combined.size,graph.hospital.functions.length);
  assert.deepEqual(sourceCategorySummary(graph).map(x=>x.id),
    ['structure','sonic','campaign','risk','protection','collection','session','bridge']);
  assert.throws(()=>setSourceView(graph,'category','fake-category'),/Unknown category/);
  setSourceView(graph,'all');
  assert.equal(visibleSourceNodes(graph).filter(n=>n.type==='function').length,graph.hospital.functions.length);
});

test('visual repositioning is scoped by view and original source never changes',()=>{
  const graph=make();
  const one=visibleSourceNodes(graph).find(n=>n.type==='function');
  const originalX=one.x,originalY=one.y;
  const changed=moveSourceNode(graph,one.id,690,880);
  assert.equal(changed.x,690);
  assert.equal(changed.y,880);
  setSourceView(graph,'collapsed');
  setSourceView(graph,'all');
  const same=visibleSourceNodes(graph).find(n=>n.id===one.id);
  assert.equal(same.x,690);
  assert.equal(same.y,880);
  assert.notDeepEqual({x:690,y:880},{x:originalX,y:originalY});
  assert.equal(compileSourceBlueprint(graph).source,hightower);
});

test('editing a HIGHTOWER parameter survives collapse and category focus unchanged',()=>{
  const graph=make();
  const sonic=graph.hospital.inputs.find(i=>i.name==='DirectSonicNodesBetweenCores');
  assert.ok(sonic);
  updateSourceInput(graph,sonic.id,12);
  setSourceView(graph,'collapsed');
  setSourceView(graph,'category','sonic');
  setSourceView(graph,'all');
  assert.equal(compileSourceBlueprint(graph).source,
    hightower.replace('DirectSonicNodesBetweenCores=24;','DirectSonicNodesBetweenCores=12;'));
});

test('reference-only wires appear only for a visible category, never fabricated between all 333 functions',()=>{
  const graph=sourceBlueprint([
    '#property strict',
    'bool RiskCheck(){return true;}',
    'void RiskEngine(){if(RiskCheck()) Print("ok");}',
    'void OnTick(){RiskEngine();}'
  ].join('\n')+'\n','risk.mq4');
  assert.equal(visibleSourceNodes(graph).filter(n=>n.type==='function').length,3);
  assert.equal(sourceEdges(graph).filter(e=>e.kind==='reference').length,0);
  setSourceView(graph,'category','risk');
  assert.ok(sourceEdges(graph).some(e=>e.kind==='reference'&&e.label.includes('NOT EXECUTION')));
  setSourceView(graph,'collapsed');
  assert.equal(sourceEdges(graph).filter(e=>e.kind==='reference').length,0);
});

test('full screen blueprint exposes all functions, eight engines, focused editing and dynamic sizing controls',()=>{
  const html=fs.readFileSync(new URL('../public/app/robot-studio/index.html',import.meta.url),'utf8');
  const ui=fs.readFileSync(new URL('../public/js/robot-studio-source-graph-ui.js',import.meta.url),'utf8');
  const flow=fs.readFileSync(new URL('../public/js/robot-studio-flow-ui.js',import.meta.url),'utf8');
  for(const id of ['fx-source-all','fx-source-collapse','fx-source-category','fx-source-arrange'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(html,/Collapse to 8 engines/);
  assert.match(ui,/sourceCategorySummary\(session\)/);
  assert.match(ui,/setSourceView\(session,mode,category\)/);
  assert.match(ui,/onSize\?\.\(session\.dimensions\.width,session\.dimensions\.height\)/);
  assert.match(flow,/sourceMode\.active\(\)&&BOARD_HEIGHT>1550/);
  assert.match(flow,/edgesSvg\.setAttribute\('viewBox'/);
});
