/* WISDO Source Canvas: runs locally, never executes uploaded MQL. */
import {decodeMqlFile,encodeMqlSource,MAX_SOURCE_BYTES} from './robot-studio-import-core.js';
import {sourceBlueprint,moveSourceNode,updateSourceInput,updateSourceCondition,
  attachSourceGate,removeSourceGate,reconnectSourceGate,expandSourceModule,compileSourceBlueprint,sourceEdges,sourceCaseSummary,setSourceView,visibleSourceNodes,sourceCategorySummary
} from './robot-studio-source-graph-core.js';

export function makeSourceCanvas({$,surface,nodes,edges,inspector,code,errorsBox,edgeList,tell,openDrawer,getZoom,download,onSize,onFit,onResetSize}){
  let session=null,bytes=null,encoding=null,selected='',compiled=null;
  const active=()=>!!session;
  const all=()=>session?visibleSourceNodes(session):[];
  const find=id=>all().find(n=>n.id===id);
  const e=(tag,cls='',value)=>{
    const item=document.createElement(tag);item.className=cls;
    if(value!==undefined)item.textContent=String(value);
    return item;
  };
  const button=(label,fn)=>{const b=e('button','fx-source-action',label);b.type='button';b.addEventListener('click',fn);return b;};
  const input=(type,value)=>{const x=e('input');x.type=type;x.value=String(value);if(type==='number')x.step='any';return x;};
  const select=(values,value)=>{const x=e('select');for(const v of values){const o=e('option','',v);o.value=v;x.append(o);}x.value=String(value);return x;};
  function row(title,control,cb){const x=e('label','fx-field');x.append(e('span','',title),control);control.addEventListener('change',cb);return x;}
  function setView(mode,category=null){
    if(!session)return;
    setSourceView(session,mode,category);
    selected=visibleSourceNodes(session)[0]?.id||'';
    render();
    onFit?.();
    tell(mode==='all'?'All '+session.hospital.functions.length+' functions shown. Scroll to explore or collapse to eight engines.':
      mode==='collapsed'?'Collapsed to eight engines. Tap an engine to work inside its functions.':
      'Focused '+session.categories.find(c=>c.id===category)?.title+'. All its functions are visible.');
  }
  function setupNavigation(){
    const categories=sourceCategorySummary(session);
    const selectBox=$('fx-source-category');
    selectBox.replaceChildren();
    const none=e('option','', 'Choose engine…');none.value='';selectBox.append(none);
    for(const c of categories){
      const option=e('option','',c.title+' ('+c.functions+')');
      option.value=c.id;selectBox.append(option);
    }
    selectBox.value=session.view==='category'?session.activeCategory:'';
    $('fx-source-all').setAttribute('aria-pressed',String(session.view==='all'));
    $('fx-source-collapse').setAttribute('aria-pressed',String(session.view==='collapsed'));
    $('fx-source-file').textContent=session.filename+' · '+session.platform+' · '+
      session.hospital.functions.length+' total functions · '+all().length+' shown';
  }
  function refresh(){
    try{
      compiled=compileSourceBlueprint(session);
      code.value=compiled.source.slice(0,125000)+(compiled.source.length>125000?'\n// Preview truncated; export includes complete source.':'');
      $('fx-compile-state').textContent=session.platform+' SOURCE · '+compiled.changes.length+' mapped edit(s) · NOT COMPILED';
      $('fx-graph-stats').textContent=all().filter(n=>n.type==='function').length+'/'+session.hospital.functions.length+' functions · '+all().length+' cards';
      $('fx-download-mq4').disabled=false;$('fx-export-json').disabled=false;
      errorsBox.replaceChildren(e('p','fx-source-caution','Unverified execution logic stays read-only. Compiler and demo testing are still required.'));
    }catch(err){
      compiled=null;code.value='// Source edit rejected: '+err.message;
      $('fx-download-mq4').disabled=true;errorsBox.replaceChildren(e('div','fx-error',err.message));tell(err.message,true);
    }
  }
  function wires(){
    edges.replaceChildren();
    for(const link of sourceEdges(session)){
      const a=find(link.from),b=find(link.to);if(!a||!b)continue;
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      const x=a.x+200,y=a.y+68,p=b.x,q=b.y+63,m=Math.max(48,Math.abs(p-x)/2);
      path.setAttribute('d','M '+x+' '+y+' C '+(x+m)+' '+y+', '+(p-m)+' '+q+', '+p+' '+q);
      path.setAttribute('class','fx-connector '+(link.kind==='gate'?'fx-source-gate-wire':link.kind==='reference'?'fx-source-reference':'fx-source-verified'));
      path.setAttribute('fill','none');path.setAttribute('stroke-width','3');
      edges.append(path);
    }
  }
  function draw(){
    nodes.replaceChildren();
    for(const n of all()){
      const card=e('article','fx-node fx-source-node fx-source-'+n.type);
      card.dataset.id=n.id;card.style.left=n.x+'px';card.style.top=n.y+'px';
      card.setAttribute('aria-label','Inspect '+n.label);card.setAttribute('role','button');card.tabIndex=0;
      if(selected===n.id)card.classList.add('active');
      const head=e('div','fx-node-head');
      head.append(e('span','fx-node-glyph',n.type==='module'?'◈':n.type==='gate'?'⊕':'◇'),
        e('strong','',n.label.length>42?n.label.slice(0,39)+'…':n.label));
      card.append(head,e('div','fx-node-desc',n.detail),
        e('span','fx-source-badge',n.type==='gate'?'EDITABLE LINK':n.editable?'SOURCE-LINKED':'SOURCE X-RAY'));
      const choose=()=>{
        if(n.type==='module'&&session.view==='collapsed'){setView('category',n.category);return;}
        selected=n.id;draw();inspect();openDrawer('inspector');
      };
      card.addEventListener('click',choose);
      card.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();choose();}});
      head.addEventListener('pointerdown',ev=>{
        if(ev.button!==0)return;
        const ox=n.x,oy=n.y,x=ev.clientX,y=ev.clientY;
        let moved=false;head.setPointerCapture?.(ev.pointerId);
        const move=p=>{
          if(Math.abs(p.clientX-x)+Math.abs(p.clientY-y)>4)moved=true;
          if(!moved)return;
          moveSourceNode(session,n.id,ox+(p.clientX-x)/getZoom(),oy+(p.clientY-y)/getZoom());
          card.style.left=n.x+'px';card.style.top=n.y+'px';wires();
        };
        const done=()=>{
          head.removeEventListener('pointermove',move);head.removeEventListener('pointerup',done);
          head.removeEventListener('pointercancel',done);
          if(moved)tell('Rearranged source X-ray; execution logic unchanged.');
        };
        head.addEventListener('pointermove',move);head.addEventListener('pointerup',done);head.addEventListener('pointercancel',done);
      });
      nodes.append(card);
    }
    wires();
  }
  function editParameter(item,container){
    const value=Object.hasOwn(session.updates,item.id)?session.updates[item.id]:item.value;
    const kind=item.hospitalKind;
    const field=kind==='enum'?select(item.options,value):input(kind==='bool'?'checkbox':['integer','decimal'].includes(kind)?'number':'text',value);
    if(kind==='bool')field.checked=Boolean(value);
    if(kind==='readonly')field.disabled=true;
    container.append(row(item.name+' · '+item.type,field,()=>{
      try{
        const next=kind==='bool'?field.checked:['integer','decimal'].includes(kind)?Number(field.value):field.value;
        updateSourceInput(session,item.id,next);refresh();tell('Mapped '+item.name+' default updated in source.');
      }catch(err){tell(err.message,true);}
    }));
    if(item.isInternalDefault)container.append(e('p','fx-source-caution','Internal default: EA code may override this at runtime.'));
    if(item.usedBy?.length)container.append(e('p','help','Referenced in '+item.usedBy.slice(0,8).join(', ')));
  }
  function editCondition(cond,container){
    const state=session.updates[cond.id]||{operator:cond.operator,value:cond.value};
    const op=select(['<','>','<=','>=','==','!='],state.operator);
    const val=input('number',state.value);
    const change=()=>{
      try{updateSourceCondition(session,cond.id,op.value,val.value);draw();refresh();
        tell('Mapped IF condition updated at its original source location.');
      }catch(err){tell(err.message,true);}
    };
    container.append(row('IF '+cond.lhs+' · comparison',op,change),row('Numeric threshold',val,change));
    if(!session.analysis.links.some(l=>l.from===cond.id))return;
    container.append(e('h4','','Attach a new AND-condition block'));
    if(!session.numericInputs.length){container.append(e('p','help','No mapped numeric inputs available.'));return;}
    const names=session.numericInputs.slice(0,150).map(i=>i.name);
    const target=select(names,names[0]),operator=select(['<','>','<=','>=','==','!='],'<'),threshold=input('number',1);
    container.append(row('Numeric input already in EA',target,()=>{}),
      row('New operator',operator,()=>{}),row('New threshold',threshold,()=>{}));
    container.append(button('＋ Add code-linked gate',()=>{
      try{
        const gate=attachSourceGate(session,cond.id,{input:target.value,operator:operator.value,threshold:threshold.value});
        setSourceView(session,session.view,session.activeCategory);
        selected=gate.id;render();tell('AND gate attached to verified trade condition. Exported source updated.');
      }catch(err){tell(err.message,true);}
    }));
  }
  function editGate(g,container){
    const guards=session.analysis.links.map(l=>session.analysis.conditions.find(c=>c.id===l.from)).filter(Boolean);
    const options=session.numericInputs.map(i=>i.name);
    const lhs=select(options,g.input),operator=select(['<','>','<=','>=','==','!='],g.operator);
    const number=input('number',g.threshold),destination=select(guards.map(c=>c.id),g.source);
    for(const o of destination.options){
      const cond=guards.find(c=>c.id===o.value);if(cond)o.textContent='Line '+cond.line+' : '+cond.lhs+' '+cond.operator+' '+cond.valueOriginal;
    }
    const change=()=>{
      try{
        if(!options.includes(lhs.value)||number.value.trim()===''||!Number.isFinite(Number(number.value)))
          throw new Error('Select a mapped input and a valid number.');
        reconnectSourceGate(session,g.id,destination.value);
        g.input=lhs.value;g.operator=operator.value;g.threshold=Number(number.value);
        g.label='AND '+g.input+' '+g.operator+' '+g.threshold;
        compileSourceBlueprint(session);
        render();tell('Code-linked gate moved or edited. The exported source has changed.');
      }catch(err){tell(err.message,true);}
    };
    container.append(row('Mapped input',lhs,change),row('Operator',operator,change),
      row('Threshold',number,change),row('Connect to direct-trade IF',destination,change));
    container.append(button('Disconnect / remove added gate',()=>{
      removeSourceGate(session,g.id);
      setSourceView(session,session.view,session.activeCategory);
      selected='';render();
      tell('Added gate removed. Original source condition restored.');
    }));
  }
  function inspect(){
    inspector.replaceChildren();
    const node=find(selected);
    if(!node){inspector.append(e('p','help','Tap any reconstructed source node to inspect.'));return;}
    inspector.append(e('h3','',node.label),e('p','fx-source-caution',node.evidence));
    if(node.type==='gate'){editGate(node,inspector);return;}
    if(node.type==='condition'){
      const item=session.analysis.conditions.find(c=>c.id===node.source);
      if(item)editCondition(item,inspector);
      return;
    }
    if(node.type==='input'){
      const item=session.hospital.inputs.find(i=>i.id===node.source);
      if(item)editParameter(item,inspector);
      return;
    }
    if(node.type==='function'){
      const fn=session.hospital.functions.find(f=>f.id===node.source);
      if(!fn)return;
      inspector.append(e('p','help','References named functions: '+(fn.calls.join(', ')||'None identified')));
      inspector.append(e('p','help','Mentions mapped inputs: '+(fn.usesInputs?.slice(0,24).join(', ')||'None identified')));
      inspector.append(button('Inspect original function source',()=>{
        code.value=session.original.slice(fn.bodyStart,fn.bodyEnd).slice(0,50000);
        openDrawer('code');tell('Original function shown. Rewiring this opaque code is not verified.');
      }));
      return;
    }
    if(node.type==='module'){
      const group=session.hospital.groups.find(g=>g.id===node.source);
      if(!group)return;
      const major=session.categories.find(cat=>cat.id===node.category);
      const related=major?.buckets||[group.id];
      const allFunctions=related.flatMap(key=>session.hospital.groups.find(g=>g.id===key)?.functions||[]);
      const allInputs=related.flatMap(key=>session.hospital.groups.find(g=>g.id===key)?.inputs||[]);
      inspector.append(e('p','help',allFunctions.length+' actual functions · '+allInputs.length+' controls (classification by names).'));
      inspector.append(button('Open this engine on the blueprint',()=>{setView('category',node.category);openDrawer(null);}));
      inspector.append(button('◈ Expand functions on blueprint',()=>{
        try{
          const amount=expandSourceModule(session,node.category);
          render();onFit?.();tell('Showing ALL '+amount+' original function blocks for '+group.title+'. Dashed wires are lexical references, not verified trade execution.');
          openDrawer(null);
        }catch(err){tell(err.message,true);}
      }));
      const query=input('search','');query.placeholder='Search function or input names';
      inspector.append(query);
      const results=e('div','fx-source-settings');inspector.append(results);
      const update=()=>{
        const term=query.value.toLowerCase();results.replaceChildren();
        for(const item of allInputs.filter(i=>i.name.toLowerCase().includes(term)).slice(0,80))
          editParameter(item,results);
        results.append(e('h4','','Function source · read only'));
        for(const fn of allFunctions.filter(f=>f.name.toLowerCase().includes(term)).slice(0,25)){
          results.append(button(fn.name+' · line '+fn.line,()=>{
            code.value=session.original.slice(fn.bodyStart,fn.bodyEnd).slice(0,24000);
            openDrawer('code');tell('Original function displayed. Complex function rewrites are locked.');
          }));
        }
      };
      query.addEventListener('input',update);update();
    }else inspector.append(e('p','help','Original trade call preserved. Only verified numeric guards accept added gates.'));
  }
  function render(){
    if(!session)return;
    $('fx-source-session').hidden=false;
    setupNavigation();
    onSize?.(session.dimensions.width,session.dimensions.height);
    $('fx-download-mq4').textContent='Export edited '+session.platform+' source';
    draw();inspect();refresh();
    $('fx-global-settings').replaceChildren(e('p','fx-source-caution','Imported EA settings are edited from mapped blocks. The starter bot risk settings do NOT apply to this code.'));
    edgeList.replaceChildren(e('p','help',session.edges.length+' verified direct trade links · '+session.gates.length+' editable added gates.'));
  }
  async function load(file){
    if(!file||!/\.mq[45]$/i.test(file.name))throw new Error('Choose an editable .mq4/.mq5 file; .ex4/.ex5 cannot be reconstructed.');
    if(file.size>MAX_SOURCE_BYTES)throw new Error('Maximum import size is 4 MB.');
    const raw=new Uint8Array(await file.arrayBuffer()),decoded=decodeMqlFile(raw);
    const parsed=sourceBlueprint(decoded.text,file.name);
    session=parsed;bytes=raw;encoding={encoding:decoded.encoding,bom:decoded.bom};
    selected=visibleSourceNodes(parsed)[0]?.id||'';render();
    tell('Imported '+file.name+': ALL '+parsed.hospital.functions.length+' function blocks are visible. Collapse to eight engines at any time.');
    return sourceCaseSummary(parsed);
  }
  function addGate(){
    if(!session)return tell('Import MQ4/MQ5 source first.',true);
    const guard=session.analysis.conditions.find(c=>session.analysis.links.some(l=>l.from===c.id));
    const current=session.analysis.conditions.find(c=>'guard-'+c.id===selected);
    const target=current&&session.analysis.links.some(l=>l.from===current.id)?current:guard;
    if(!target||!session.numericInputs.length)return tell('No verified direct-trade IF with a mapped numeric input is available for this code. Custom function rewiring remains protected.',true);
    try{
      const gate=attachSourceGate(session,target.id,{
        input:session.numericInputs[0].name,operator:'<',threshold:1
      });
      if(session.view==='collapsed')setSourceView(session,'all');
      else setSourceView(session,session.view,session.activeCategory);
      selected=gate.id;render();openDrawer('inspector');
      tell('Added a real source-linked AND gate. Configure it in Inspector before exporting.');
    }catch(err){tell(err.message,true);}
  }
  function clear(){
    session=null;bytes=null;encoding=null;selected='';compiled=null;
    $('fx-source-session').hidden=true;$('fx-download-mq4').textContent='Export MT4 code (.mq4)';
    onResetSize?.();
  }
  function exportSource(){
    if(!session||!compiled)throw new Error('Import source first or fix invalid source edits.');
    const data=compiled.changes.length?encodeMqlSource(compiled.source,encoding):bytes;
    download(session.filename.replace(/[^A-Za-z0-9_. -]/g,'_').slice(0,120),data,'application/octet-stream');
  }
  function exportReport(){
    if(!session||!compiled)throw new Error('Import source first.');
    const report={...sourceCaseSummary(session),
      changes:compiled.changes.map(({kind,label})=>({kind,label})),compiled:false,backtested:false};
    download(session.filename+'.wisdo-report.json',new TextEncoder().encode(JSON.stringify(report,null,2)),'application/json');
  }
  $('fx-source-all').addEventListener('click',()=>setView('all'));
  $('fx-source-collapse').addEventListener('click',()=>setView('collapsed'));
  $('fx-source-category').addEventListener('change',event=>{
    const category=event.target.value;
    setView(category?'category':'collapsed',category||null);
  });
  $('fx-source-arrange').addEventListener('click',()=>{
    if(!session)return;
    session.positions?.delete(session.view==='category'?'category:'+session.activeCategory:session.view);
    setView(session.view,session.activeCategory);
    tell('Rearranged displayed blocks into source-category rows. EA logic and edits unchanged.');
  });
  return {active,load,render,clear,addGate,setView,exportSource,exportReport,get session(){return session;},get dimensions(){return session?.dimensions;}};
}
