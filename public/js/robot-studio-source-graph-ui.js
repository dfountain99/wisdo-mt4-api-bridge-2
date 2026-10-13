/* WISDO Source Canvas: runs locally, never executes uploaded MQL. */
import {decodeMqlFile,encodeMqlSource,MAX_SOURCE_BYTES} from './robot-studio-import-core.js';
import {sourceBlueprint,moveSourceNode,updateSourceInput,updateSourceCondition,
  attachSourceGate,removeSourceGate,reconnectSourceGate,compileSourceBlueprint,sourceEdges,sourceCaseSummary
} from './robot-studio-source-graph-core.js';

export function makeSourceCanvas({$,surface,nodes,edges,inspector,code,errorsBox,edgeList,tell,openDrawer,getZoom,download}){
  let session=null,bytes=null,encoding=null,selected='',compiled=null;
  const active=()=>!!session;
  const all=()=>session?[...session.nodes,...session.gates]:[];
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
  function refresh(){
    try{
      compiled=compileSourceBlueprint(session);
      code.value=compiled.source.slice(0,125000)+(compiled.source.length>125000?'\n// Preview truncated; export includes complete source.':'');
      $('fx-compile-state').textContent=session.platform+' SOURCE · '+compiled.changes.length+' mapped edit(s) · NOT COMPILED';
      $('fx-graph-stats').textContent=all().length+' shown · '+session.represented.functions+' functions';
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
      path.setAttribute('class','fx-connector '+(link.kind==='gate'?'fx-source-gate-wire':'fx-source-verified'));
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
      const choose=()=>{selected=n.id;draw();inspect();openDrawer('inspector');};
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
