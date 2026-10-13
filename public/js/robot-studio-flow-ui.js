/* WISDO Flow Builder — browser-only graph UI, no live order bridge. */
import {
  FLOW_KEY,BLOCKS,exampleFlow,freshNode,connectFlow,removeFlowNode,
  validateFlow,generateFlowMql4,deserializeFlow,exportFlowJson,MAX_FLOW_NODES
} from './robot-studio-flow-core.js';
import {makeSourceCanvas} from './robot-studio-source-graph-ui.js';

const $ = id=>document.getElementById(id);
const BOARD_WIDTH=1120, BOARD_HEIGHT=850, NODE_WIDTH=200;
let graph=exampleFlow(), selected='buy-signal',pending=null,counter=0;
const svgNS='http://www.w3.org/2000/svg';
const surface=$('fx-flow-board');
const flowShell=$('flow-builder');
const zoomSpace=$('fx-zoom-spacer');
let zoom=1;
let activeDrawer=null;
let lastDrawerTrigger=null;
const status=$('fx-status');
const code=$('fx-code');
const scroll=$('fx-board-scroll');
const nodesArea=$('fx-nodes');
const edgesSvg=$('fx-edges');
const errorsBox=$('fx-errors');
const edgeList=$('fx-edges-list');
const options=[
  ['Trigger',['tick']],
  ['Conditions',['ema','rsi']],
  ['Filters',['session','spread']],
  ['Actions',['buy','sell','wait']]
];
const safeName=(s)=>String(s||'WISDO_FLOW').replace(/[^A-Za-z0-9_.-]/g,'_').slice(0,85);

// The canvas fills the viewport. Additional tools never consume permanent canvas width.
function openDrawer(name, trigger=null){
  const names=new Set(['blocks','inspector','risk','code','projects','studios']);
  if(name!==null&&!names.has(name))return;
  activeDrawer=name;
  if(name!==null&&trigger)lastDrawerTrigger=trigger;
  if(name===null)delete flowShell.dataset.fxDrawer;
  else flowShell.dataset.fxDrawer=name;
  for(const panel of flowShell.querySelectorAll('[data-fx-panel]')){
    const isOpen=panel.dataset.fxPanel===name;
    panel.inert=!isOpen;
    panel.setAttribute('aria-hidden',String(!isOpen));
    if(isOpen&&trigger)panel.querySelector('[data-fx-close]')?.focus({preventScroll:true});
  }
  for(const btn of flowShell.querySelectorAll('[data-fx-open]')){
    btn.setAttribute('aria-expanded',String(btn.dataset.fxOpen===name));
  }
  if(name===null&&lastDrawerTrigger){
    lastDrawerTrigger.focus?.({preventScroll:true});
    lastDrawerTrigger=null;
  }
}
function toggleDrawer(name,trigger=null){
  openDrawer(activeDrawer===name?null:name,trigger);
}
function setZoom(raw){
  if(!Number.isFinite(raw))return;
  zoom=Math.min(1.5,Math.max(.25,Math.round(raw*100)/100));
  surface.style.transform='scale('+zoom+')';
  zoomSpace.style.width=Math.ceil(BOARD_WIDTH*zoom)+'px';
  zoomSpace.style.height=Math.ceil(BOARD_HEIGHT*zoom)+'px';
  $('fx-zoom-label').textContent=Math.round(zoom*100)+'%';
  $('fx-zoom-out').disabled=zoom<=.25;
  $('fx-zoom-in').disabled=zoom>=1.5;
}
function fitZoom(){
  const usableW=Math.max(180,scroll.clientWidth-36),usableH=Math.max(220,scroll.clientHeight-32);
  setZoom(Math.min(usableW/BOARD_WIDTH,usableH/BOARD_HEIGHT,1.5));
  scroll.scrollTop=0;scroll.scrollLeft=0;
  tell('Blueprint fitted to the available screen. Zoom in for full-size editing.');
}

function tell(message,err=false){status.textContent=message;status.classList.toggle('error',err);}
function emitFile(name,data,type='text/plain;charset=utf-8'){
  const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1200);
}
function nodeById(id){return graph.nodes.find(n=>n.id===id);}
function makeElement(tag,className,text){
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(text!==undefined)el.textContent=text;
  return el;
}
const sourceMode=makeSourceCanvas({$,surface,nodes:nodesArea,edges:edgesSvg,inspector:$('fx-inspector'),
  code,errorsBox,edgeList,tell,openDrawer,getZoom:()=>zoom,download:emitFile});
function portLabel(p){return p==='next'?'NEXT':p==='true'?'TRUE':'FALSE';}
function snap(n){return Math.max(0,Math.min(8000,Math.round(n/10)*10));}
function coordinate(event){
  const rect=surface.getBoundingClientRect();
  return {x:Math.min(BOARD_WIDTH-220,Math.max(10,snap((event.clientX-rect.left)/zoom))),
          y:Math.min(BOARD_HEIGHT-155,Math.max(10,snap((event.clientY-rect.top)/zoom)))};
}
function palette(){
  const root=$('fx-palette');root.replaceChildren();
  for(const [category,types] of options){
    root.append(makeElement('div','fx-palette-label',category));
    for(const type of types){
      const btn=makeElement('button','fx-palette-block');
      btn.type='button';btn.draggable=true;
      btn.dataset.type=type;
      btn.append(makeElement('span','fx-block-icon',BLOCKS[type].icon),
                 makeElement('span','',BLOCKS[type].title));
      btn.title=BLOCKS[type].description;
      btn.addEventListener('click',()=>addBlock(type));
      btn.addEventListener('dragstart',e=>{
        e.dataTransfer.setData('text/plain','wisdo:block:'+type);
        e.dataTransfer.effectAllowed='copy';
      });
      root.append(btn);
    }
  }
}
function addBlock(type,pos){
  if(sourceMode.active())return tell('Imported EA blocks are source-linked. Open a verified IF block to attach a new AND gate, or choose an imported gate from the block library.',true);
  if(graph.nodes.length>=MAX_FLOW_NODES)return tell('Maximum '+MAX_FLOW_NODES+' blocks reached.',true);
  if(type==='tick')return tell('One OnTick event already exists. Connect its output to new blocks.',true);
  counter++;
  const id=type+'-'+Date.now().toString(36)+'-'+counter.toString(36);
  graph.nodes.push(freshNode(type,id,pos?.x??(480+(counter%4)*80),pos?.y??(120+(counter%5)*120)));
  selected=id;
  render();
  tell('Added '+BLOCKS[type].title+'. Connect an existing output to its INPUT before exporting.');
}
function selectedNode(){return nodeById(selected);}
function linkFrom(id,port){
  if(pending?.from===id&&pending.port===port){pending=null;render();return;}
  pending={from:id,port};
  render();
  tell('Linking '+nodeById(id)?.type+' / '+port.toUpperCase()+'. Tap another block’s INPUT socket or drag the port there.');
}
function linkTo(id,source=pending){
  if(!source)return tell('Select an output socket first.',true);
  try{
    graph=connectFlow(graph,source.from,source.port,id);
    pending=null;selected=id;render();
    tell('Connected '+source.from+' / '+source.port+' → '+id+'. Generated source updated.');
  }catch(e){tell(e.message,true);}
}
function svgDraw(){
  edgesSvg.replaceChildren();
  for(const [index,e] of graph.edges.entries()){
    const a=nodeById(e.from),b=nodeById(e.to);
    if(!a||!b)continue;
    const sx=a.x+NODE_WIDTH,sy=a.y+(e.port==='false'?119:e.port==='true'?82:82);
    const tx=b.x,ty=b.y+63;
    const bend=Math.max(55,Math.abs(tx-sx)*0.55);
    const path=document.createElementNS(svgNS,'path');
    path.setAttribute('d','M '+sx+' '+sy+' C '+(sx+bend)+' '+sy+', '+(tx-bend)+' '+ty+', '+tx+' '+ty);
    path.setAttribute('class','fx-connector '+(e.port==='false'?'fx-connector-false':e.port==='true'?'fx-connector-true':''));
    path.setAttribute('fill','none');
    path.setAttribute('stroke-width','2.8');
    path.setAttribute('aria-label',e.from+' '+e.port+' to '+e.to);
    const title=document.createElementNS(svgNS,'title');
    title.textContent=e.from+' '+portLabel(e.port)+' → '+e.to;
    path.append(title);edgesSvg.append(path);
  }
}
function drawNode(node){
  const meta=BLOCKS[node.type];
  const el=makeElement('article','fx-node fx-node-'+node.type);
  el.style.left=node.x+'px';el.style.top=node.y+'px';
  el.dataset.id=node.id;el.setAttribute('aria-label',meta.title+' node');
  if(selected===node.id)el.classList.add('active');
  if(node.type!=='tick'){
    const input=makeElement('button','fx-port fx-port-in','●');
    input.type='button';input.title='INPUT: connect an output here';input.setAttribute('aria-label','Connect to '+meta.title+' input');
    input.addEventListener('click',e=>{e.stopPropagation();linkTo(node.id);});
    input.addEventListener('dragover',e=>{e.preventDefault();});
    input.addEventListener('drop',e=>{
      e.preventDefault();e.stopPropagation();
      const raw=e.dataTransfer.getData('text/plain'), parts=raw.split(':');
      if(parts.length===4&&parts[0]==='wisdo'&&parts[1]==='port')linkTo(node.id,{from:parts[2],port:parts[3]});
    });
    el.append(input);
  }
  const header=makeElement('div','fx-node-head');
  header.append(makeElement('span','fx-node-glyph',meta.icon),makeElement('strong','',meta.title));
  header.title='Drag header to move; click block to inspect';
  header.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    const sx=event.clientX,sy=event.clientY,ox=node.x,oy=node.y;
    let changed=false;
    header.setPointerCapture?.(event.pointerId);
    function moving(e){
      if(Math.abs(e.clientX-sx)+Math.abs(e.clientY-sy)>4)changed=true;
      if(!changed)return;
      node.x=Math.min(BOARD_WIDTH-220,Math.max(8,snap(ox+(e.clientX-sx)/zoom)));
      node.y=Math.min(BOARD_HEIGHT-160,Math.max(8,snap(oy+(e.clientY-sy)/zoom)));
      el.style.left=node.x+'px';el.style.top=node.y+'px';svgDraw();
    }
    function finished(){
      header.removeEventListener('pointermove',moving);
      header.removeEventListener('pointerup',finished);
      header.removeEventListener('pointercancel',finished);
      if(changed){selected=node.id;renderInspector();tell('Moved '+meta.title+'. Connections and generated logic are unchanged.');}
    }
    header.addEventListener('pointermove',moving);
    header.addEventListener('pointerup',finished);
    header.addEventListener('pointercancel',finished);
  });
  el.append(header);
  const desc=node.type==='ema'?(node.params.direction==='up'?'Cross up':'Cross down')+' · '+node.params.fast+' / '+node.params.slow:
    node.type==='rsi'?'RSI('+node.params.period+') '+(node.params.mode==='below'?'< ':'> ')+node.params.threshold:
    node.type==='session'?'Hours '+node.params.start+'–'+node.params.end:
    node.type==='spread'?'Max '+node.params.max+' pips':meta.description;
  el.append(makeElement('div','fx-node-desc',desc));
  for(const port of meta.ports){
    const portBtn=makeElement('button','fx-port fx-port-out fx-port-'+port,'●');
    portBtn.type='button';portBtn.draggable=true;
    portBtn.dataset.port=port;portBtn.title=portLabel(port)+' OUTPUT';
    portBtn.setAttribute('aria-label',meta.title+' '+port+' output: tap to connect');
    if(pending?.from===node.id&&pending.port===port)portBtn.classList.add('pending');
    portBtn.addEventListener('click',e=>{e.stopPropagation();linkFrom(node.id,port);});
    portBtn.addEventListener('dragstart',e=>{
      e.stopPropagation();e.dataTransfer.setData('text/plain','wisdo:port:'+node.id+':'+port);
      e.dataTransfer.effectAllowed='link';
    });
    el.append(portBtn);
    el.append(makeElement('span','fx-port-label fx-label-'+port,portLabel(port)));
  }
  el.addEventListener('click',()=>{selected=node.id;renderInspector();renderNodes();openDrawer('inspector');});
  return el;
}
function renderNodes(){
  nodesArea.replaceChildren();
  for(const node of graph.nodes)nodesArea.append(drawNode(node));
  svgDraw();
}
function removeEdge(idx){
  graph.edges.splice(idx,1);render();tell('Connection removed. Reconnect the branch to create valid MQ4 output.');
}
function lineRow(edge,index){
  const row=makeElement('div','fx-edge-row');
  row.append(makeElement('span','',edge.from+' ['+portLabel(edge.port)+'] → '+edge.to));
  const rm=makeElement('button','','×');rm.title='Delete connection';
  rm.setAttribute('aria-label','Remove '+edge.from+' to '+edge.to+' connection');
  rm.addEventListener('click',()=>removeEdge(index));row.append(rm);
  return row;
}
function controls(){
  const root=$('fx-global-settings');root.replaceChildren();
  const specs=[
    ['name','Robot name','text',null,null],
    ['magic','Magic number','number',100000,1999999999],
    ['moneyMode','Sizing','select',['risk','fixed']],
    ['riskPercent','Risk % / trade','number',0.1,5],
    ['fixedLots','Fixed lots','number',0.01,5],
    ['stopPips','Stop (pips)','number',1,1000],
    ['takePips','Target (pips)','number',1,2000],
    ['maxSpreadPips','Max global spread (pips)','number',0.1,100],
    ['slippagePoints','Slippage (points)','number',0,200]
  ];
  for(const [key,label,type,min,max] of specs){
    const holder=makeElement('label','fx-field');
    holder.append(makeElement('span','',label));
    let input;
    if(type==='select'){
      input=document.createElement('select');
      for(const value of min){const option=document.createElement('option');option.value=value;option.textContent=value==='risk'?'% of equity':'Fixed lots';input.append(option);}
    }else{
      input=document.createElement('input');input.type=type;
      if(min!==null){input.min=String(min);input.max=String(max);input.step=key==='riskPercent'||key==='fixedLots'||key==='maxSpreadPips'?'0.01':'1';}
      if(key==='name')input.maxLength=48;
    }
    input.value=String(graph.settings[key]);
    input.addEventListener('change',()=>{
      graph.settings[key]=type==='number'?Number(input.value):input.value;
      evaluate();
    });
    holder.append(input);root.append(holder);
  }
}
function renderInspector(){
  const root=$('fx-inspector');root.replaceChildren();
  const node=selectedNode();
  if(!node){root.textContent='Select a block to edit its behavior.';return;}
  const meta=BLOCKS[node.type];
  root.append(makeElement('h3','',meta.title),makeElement('p','help',meta.description));
  const params={
    ema:[['direction','Crossover direction','select',['up','down']],['fast','Fast EMA','number',2,100],['slow','Slow EMA','number',3,300]],
    rsi:[['mode','RSI comparison','select',['below','above']],['period','RSI period','number',2,100],['threshold','Threshold','number',1,99]],
    session:[['start','Start server hour','number',0,23],['end','End server hour','number',0,23]],
    spread:[['max','Maximum spread (pips)','number',0.1,100]]
  };
  for(const [key,label,kind,min,max] of params[node.type]||[]){
    const holder=makeElement('label','fx-field');holder.append(makeElement('span','',label));
    let inp;
    if(kind==='select'){
      inp=document.createElement('select');
      for(const val of min){const opt=document.createElement('option');opt.value=val;opt.textContent=val;inp.append(opt);}
    } else{
      inp=document.createElement('input');inp.type='number';inp.min=String(min);inp.max=String(max);
      inp.step=key==='max'||key==='threshold'?'0.1':'1';
    }
    inp.value=String(node.params[key]);
    inp.addEventListener('change',()=>{
      node.params[key]=kind==='number'?Number(inp.value):inp.value;
      renderNodes();evaluate();
    });holder.append(inp);root.append(holder);
  }
  root.append(makeElement('h4','fx-inspector-title','OUTPUT CONNECTIONS'));
  for(const port of meta.ports){
    const destination=graph.edges.find(e=>e.from===node.id&&e.port===port)?.to||'Not connected';
    const row=makeElement('div','fx-inspector-edge');
    row.append(makeElement('span','',portLabel(port)+' → '+destination));
    row.append(makeElement('button','','Connect'));
    row.lastChild.addEventListener('click',()=>linkFrom(node.id,port));
    root.append(row);
  }
  if(node.type!=='tick'){
    const del=makeElement('button','fx-delete-node','Remove this block');
    del.addEventListener('click',()=>{
      graph=removeFlowNode(graph,node.id);selected='tick';pending=null;render();
      tell('Removed block. The remaining branch must be reconnected before export.');
    });root.append(del);
  }
  root.append(makeElement('p','help','Connections are compiled into real MQL4 control flow. Unconnected or cyclic graphs cannot be exported.'));
}
function evaluate(){
  const issues=validateFlow(graph);
  errorsBox.replaceChildren();
  for(const msg of issues.slice(0,12))errorsBox.append(makeElement('div','fx-error',msg));
  if(issues.length>12)errorsBox.append(makeElement('div','fx-error','… '+(issues.length-12)+' additional validation issues.'));
  $('fx-download-mq4').disabled=!!issues.length;
  $('fx-export-json').disabled=!!issues.length;
  if(issues.length){
    code.value='// Connect every block, correct parameters and remove cycles.\n// '+issues.join('\n// ');
    $('fx-compile-state').textContent=issues.length+' validation issue(s)';
    $('fx-compile-state').className='fx-state bad';
  }else{
    try{
      code.value=generateFlowMql4(graph);
      $('fx-compile-state').textContent='Graph valid · MetaEditor NOT run';
      $('fx-compile-state').className='fx-state good';
    }catch(error){code.value='// '+error.message;$('fx-download-mq4').disabled=true;$('fx-compile-state').textContent='Code generation blocked';}
  }
  $('fx-graph-stats').textContent=graph.nodes.length+' nodes · '+graph.edges.length+' links';
}
function render(){
  if(sourceMode.active()){sourceMode.render();return;}
  renderNodes();renderInspector();controls();edgeList.replaceChildren();
  for(const [i,e] of graph.edges.entries())edgeList.append(lineRow(e,i));
  evaluate();
}
function safeStorage(fn){
  try{fn();}catch(e){tell('Browser storage unavailable: '+e.message,true);}
}
function loadProject(payload){
  const validated=deserializeFlow(payload);
  sourceMode.clear();
  graph=validated;selected=graph.nodes[0]?.id||'';pending=null;render();tell('Validated visual strategy project loaded.');
}
$('fx-new').addEventListener('click',()=>{
  if(sourceMode.active()&&!confirm('Leave the imported robot? Download the edited source first if you want to keep changes.'))return;
  sourceMode.clear();graph=exampleFlow();selected='buy-signal';pending=null;render();tell('Started a new sample flow. All trades remain source-only.');});
$('fx-save').addEventListener('click',()=>{
  if(sourceMode.active())return tell('Imported source is not saved in browser storage. Download the edited MQ4/MQ5 from Code / Export to keep your work.');
  safeStorage(()=>{localStorage.setItem(FLOW_KEY,exportFlowJson(graph));tell('Validated graph saved on this device.');});});
$('fx-export-json').addEventListener('click',()=>{
  if(sourceMode.active()){try{sourceMode.exportReport();tell('Downloaded source-mapping report (does not contain your full original EA).');}catch(e){tell(e.message,true);}return;}
  try{emitFile(safeName(graph.settings.name)+'.wisdo-flow.json',exportFlowJson(graph),'application/json');tell('Exported editable graph project.');}
  catch(e){tell(e.message,true);}
});
$('fx-download-mq4').addEventListener('click',()=>{
  if(sourceMode.active()){try{sourceMode.exportSource();tell('Edited '+sourceMode.session.platform+' source downloaded. Compile in MetaEditor and test on demo.');}catch(e){tell(e.message,true);}return;}
  try{emitFile(safeName(graph.settings.name)+'.mq4',generateFlowMql4(graph));tell('MQ4 downloaded. You must compile in MetaEditor and backtest on a demo account.');}
  catch(e){tell(e.message,true);}
});
$('fx-import').addEventListener('click',()=>$('fx-project-file').click());
$('fx-project-file').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';
  if(!file)return;
  if(file.size>140000)return tell('Project exceeds 140 KB.',true);
  try{loadProject(await file.text());}catch(err){tell('Import rejected: '+err.message,true);}
});
$('fx-copy').addEventListener('click',async()=>{
  if(sourceMode.active())return tell('Imported source preview may be truncated. Use Export Edited Source for the complete code.');
  try{await navigator.clipboard.writeText(code.value);tell('Generated code copied.');}
  catch{tell('Clipboard permission unavailable; select the code preview to copy manually.',true);}
});
// The old mobile palette toggle remains available to preserve keyboard and project controls.
$('fx-palette-toggle').addEventListener('click',()=>toggleDrawer('blocks'));
for(const btn of flowShell.querySelectorAll('[data-fx-open]')){
  btn.addEventListener('click',()=>toggleDrawer(btn.dataset.fxOpen,btn));
}
for(const btn of flowShell.querySelectorAll('[data-fx-close]')){
  btn.addEventListener('click',()=>openDrawer(null));
}
$('fx-drawer-backdrop').addEventListener('click',()=>openDrawer(null));
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&activeDrawer!==null&&flowShell.hidden===false){
    event.preventDefault();openDrawer(null);
  }
});
for(const btn of flowShell.querySelectorAll('[data-fx-studio]')){
  btn.addEventListener('click',()=>{
    const target=document.querySelector('[data-studio-view="'+btn.dataset.fxStudio+'"]');
    if(target){openDrawer(null);target.click();}
  });
}
$('fx-zoom-in').addEventListener('click',()=>setZoom(zoom+.15));
$('fx-zoom-out').addEventListener('click',()=>setZoom(zoom-.15));
$('fx-zoom-fit').addEventListener('click',fitZoom);
setZoom(1);
$('fx-import-source').addEventListener('click',()=>$('fx-source-file-input').click());
$('fx-source-file-input').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';
  if(!file)return;
  tell('Reading and reconstructing '+file.name+' into the main blueprint…');
  try{
    await sourceMode.load(file);
    palette();
    const pal=$('fx-palette');
    const action=makeElement('button','fx-palette-block');
    action.type='button';action.textContent='⊕ Add source-linked AND gate';
    action.addEventListener('click',()=>sourceMode.addGate());
    pal.prepend(action);
    fitZoom();
  }catch(err){tell('Import blocked: '+err.message,true);}
});
$('fx-source-new').addEventListener('click',()=>$('fx-new').click());
surface.addEventListener('dragover',e=>{
  if(e.dataTransfer.types.includes('text/plain'))e.preventDefault();
});
surface.addEventListener('drop',e=>{
  const raw=e.dataTransfer.getData('text/plain');
  if(!raw.startsWith('wisdo:block:'))return;
  e.preventDefault();
  const type=raw.slice('wisdo:block:'.length);
  if(!BLOCKS[type])return;
  addBlock(type,coordinate(e));
});
$('fx-clear-pending').addEventListener('click',()=>{pending=null;render();tell('Connection selection cleared.');});
palette();
safeStorage(()=>{
  const saved=localStorage.getItem(FLOW_KEY);
  if(saved){
    try{graph=deserializeFlow(saved);selected=graph.nodes[0].id;}
    catch{localStorage.removeItem(FLOW_KEY);}
  }
});
render();
