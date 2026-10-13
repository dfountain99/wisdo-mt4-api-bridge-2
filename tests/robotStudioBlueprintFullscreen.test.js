import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=(name)=>fs.readFileSync(new URL(name,import.meta.url),'utf8');
const html=read('../public/app/robot-studio/index.html');
const css=read('../public/app/robot-studio/blueprint-focus.css');
const flow=read('../public/js/robot-studio-flow-ui.js');
const workspace=read('../public/js/robot-studio-workspace.js');

test('robot logic blueprint is a single full-viewport primary workspace',()=>{
  assert.match(html,/id="flow-builder"[^>]*role="tabpanel"/);
  assert.match(html,/class="fx-blueprint-main"/);
  assert.match(html,/id="fx-board-scroll"/);
  assert.match(html,/id="fx-zoom-spacer"/);
  assert.match(html,/id="fx-flow-board"/);
  assert.match(html,/id="fx-edges"/);
  assert.match(html,/id="fx-nodes"/);
  assert.match(html,/blueprint-focus\.css/);
  assert.match(css,/body\.studio-blueprint-mode\s*\{\s*overflow:hidden/);
  assert.match(css,/body\.studio-blueprint-mode #flow-builder\s*\{[^}]*position:fixed;inset:0/);
  assert.match(css,/#flow-builder #fx-board-scroll\s*\{[^}]*flex:1 1 auto/);
  assert.match(css,/#flow-builder \[data-fx-panel\]\s*\{[^}]*position:fixed/);
  assert.doesNotMatch(html,/class="fx-layout"/);
});

test('every secondary control has a drawer and original working widget',()=>{
  const names=['blocks','inspector','risk','code','projects','studios'];
  for(const name of names){
    assert.match(html,new RegExp('data-fx-open="'+name+'"'));
    assert.match(html,new RegExp('data-fx-panel="'+name+'"'));
    assert.match(css,new RegExp('data-fx-drawer="'+name+'"'));
  }
  for(const id of [
    'fx-palette-panel','fx-palette','fx-inspector','fx-global-settings',
    'fx-edges-list','fx-code','fx-compile-state','fx-errors',
    'fx-project-file','fx-import','fx-new','fx-save','fx-clear-pending',
    'fx-download-mq4','fx-export-json','fx-copy','fx-status','fx-graph-stats',
    'fx-drawer-backdrop','fx-zoom-in','fx-zoom-out','fx-zoom-fit','fx-zoom-label'
  ])assert.ok(html.includes('id="'+id+'"'),id+' not found');
  assert.match(html,/data-fx-studio="hospital"/);
  assert.match(html,/data-fx-studio="import"/);
  assert.match(html,/data-fx-studio="builder"/);
  assert.match(flow,/openDrawer\('inspector'\)/);
  assert.match(flow,/navigator\.clipboard\.writeText/);
  assert.match(flow,/generateFlowMql4\(graph\)/);
});

test('zoom controls modify rendered blueprint and scaled drag coordinates',()=>{
  assert.match(flow,/surface\.style\.transform='scale\('/);
  assert.match(flow,/zoomSpace\.style\.width/);
  assert.match(flow,/zoomSpace\.style\.height/);
  assert.match(flow,/event\.clientX-rect\.left\)\/zoom/);
  assert.match(flow,/\(e\.clientX-sx\)\/zoom/);
  assert.match(flow,/scroll\.clientWidth/);
  assert.match(flow,/scroll\.clientHeight/);
  assert.match(flow,/activeDrawer!==null/);
  assert.match(flow,/panel\.inert=!isOpen/);
  assert.match(flow,/event\.key==='Escape'/);
});

test('workspace focus toggles only for Flow mode and other Studio tabs still work',()=>{
  const makeElement=(view)=>{
    const listeners=new Map();
    return {
      dataset:{studioView:view},listeners,tabIndex:-1,attributes:{},
      setAttribute(key,value){this.attributes[key]=value;},
      addEventListener(key,callback){listeners.set(key,callback);},
      focus(){}
    };
  };
  const tabs=['flow','builder','import','hospital'].map(makeElement);
  const panels={
    'builder-view':{hidden:true},'import-rebuild':{hidden:true},
    'bot-hospital':{hidden:true},'flow-builder':{hidden:true}
  };
  const state=new Set();
  const body={classList:{toggle(key,on){if(on)state.add(key);else state.delete(key);}}};
  const count={textContent:'—',setAttribute(){}};
  const eventMap=new Map();
  const context={
    document:{
      body,
      getElementById(id){return panels[id]??({
        'mode-switch':{scrollIntoView(){}},
        'studio-module-count':count,
        'flow-graph':{querySelectorAll:()=>[]},
        'start-new':{addEventListener(){}}
      })[id]??null;},
      querySelectorAll(q){return q==='[data-studio-view]'?tabs:[];}
    },
    location:{hash:''},
    history:{pushState(_data,_unused,hash){context.location.hash=hash;}},
    addEventListener(name,callback){eventMap.set(name,callback);},
    MutationObserver:class{observe(){}}
  };
  vm.runInNewContext(workspace,context);
  assert.equal(panels['flow-builder'].hidden,false);
  assert.equal(state.has('studio-blueprint-mode'),true);
  tabs.find(x=>x.dataset.studioView==='hospital').listeners.get('click')();
  assert.equal(panels['flow-builder'].hidden,true);
  assert.equal(panels['bot-hospital'].hidden,false);
  assert.equal(state.has('studio-blueprint-mode'),false);
  tabs[0].listeners.get('click')();
  assert.equal(panels['flow-builder'].hidden,false);
  assert.equal(state.has('studio-blueprint-mode'),true);
});

test('the flow compiler is unchanged by full-screen layout',async()=>{
  const { exampleFlow,validateFlow,generateFlowMql4 }=await import('../public/js/robot-studio-flow-core.js');
  const graph=exampleFlow();
  assert.deepEqual(validateFlow(graph),[]);
  const source=generateFlowMql4(graph);
  assert.match(source,/void OnTick\(\)/);
  assert.match(source,/SubmitTrade\(OP_BUY\)/);
  assert.match(source,/SubmitTrade\(OP_SELL\)/);
});
