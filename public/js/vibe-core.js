// WISDO VIBE Core — browser-native spatial control surface.
// UI state only. Executable actions must flow through the Command Center preview/confirm path.
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const money=v=>(n(v)>=0?'+':'')+n(v).toFixed(2);
export function createVibeCore({host,getPositions,getSelected,setSelected,preview,message}){
  let face='TARGET', open=false;
  const q=s=>host.querySelector(s);
  const positions=()=>getPositions?.()||[];
  const selected=()=>getSelected?.()||new Set();
  const faces=['TARGET','TIME','INTENT','ENTRY','WHY','RISK'];
  function render(){
    const panel=q('[data-vibe-core]'); if(!panel)return;
    const picks=positions().filter(p=>selected().has(String(p.ticket)));
    panel.hidden=!picks.length;
    if(!picks.length)return;
    const pnl=picks.reduce((a,p)=>a+n(p.floatingMoney),0);
    panel.innerHTML='<div class="vibe-head"><div><span class="eyebrow">WISDO VIBE</span><h3>'+picks.length+' GOLD '+(picks.length===1?'CORE':'CORES')+'</h3><small>'+money(pnl)+' floating contribution</small></div><button class="btn ghost" data-vibe-close>×</button></div>'+
      '<div class="vibe-stage"><div class="vibe-cube" data-cube tabindex="0" aria-label="VIBE Core. Swipe or use face buttons."><div class="vibe-face main">'+face+'</div><div class="vibe-face side">RISK</div><div class="vibe-face top">TIME</div><div class="vibe-stack">'+picks.slice(0,5).map((p,i)=>'<i style="--i:'+i+'"></i>').join('')+'</div></div></div>'+
      '<div class="vibe-faces">'+faces.map(f=>'<button type="button" data-face="'+f+'" class="'+(f===face?'active':'')+'">'+f+'</button>').join('')+'</div>'+
      '<div class="vibe-readout">'+readout(face,picks)+'</div>'+
      '<div class="vibe-actions">'+actions(face).map(a=>'<button type="button" class="btn '+(a.primary?'primary':'')+'" data-vibe-action="'+a.action+'">'+a.label+'</button>').join('')+'</div>'+
      '<small class="vibe-safe">Transparent = inspect/simulate · Amber = preview · Gold = deployed after the existing confirmation + EA acknowledgement path.</small>';
    q('[data-vibe-close]').onclick=()=>{setSelected(new Set());panel.hidden=true;};
    panel.querySelectorAll('[data-face]').forEach(b=>b.onclick=()=>{face=b.dataset.face;render();});
    panel.querySelectorAll('[data-vibe-action]').forEach(b=>b.onclick=()=>preview({action:b.dataset.vibeAction}));
    let start=null;
    q('[data-cube]').onpointerdown=e=>{start={x:e.clientX,y:e.clientY};q('[data-cube]').setPointerCapture(e.pointerId);};
    q('[data-cube]').onpointerup=e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;const i=faces.indexOf(face);if(Math.abs(dx)>35)face=faces[(i+(dx>0?1:-1)+faces.length)%faces.length];else if(dy<-35)face='INTENT';else if(dy>35)face='RISK';else{open=!open;message(open?'VIBE Core expanded. Rotate faces to inspect or preview an intent.':'VIBE Core focused.');}render();};
  }
  function readout(f,p){
    if(f==='TARGET')return '<b>Outcome face</b><span>Shape targets and campaign outcome for the selected gold.</span>';
    if(f==='TIME')return '<b>Time face</b><span>Timed collection and pause rules stay preview-first.</span>';
    if(f==='INTENT')return '<b>Intent face</b><span>Convert the selected gold into Runner or Collector roles.</span>';
    if(f==='ENTRY')return '<b>Entry face</b><span>'+p.map(x=>'#'+x.ticket+' · '+(n(x.lots)||n(x.volume)||'—')+' lots').join('<br>')+'</span>';
    if(f==='WHY')return '<b>WHY face</b><span>'+p.map(x=>'#'+x.ticket+' contributes '+money(x.floatingMoney)).join('<br>')+'</span>';
    return '<b>Risk face</b><span>Inspect protection before changing it. Protection gestures never execute directly.</span>';
  }
  function actions(f){
    if(f==='TARGET')return [{label:'Move target',action:'MOVE_TARGET',primary:true},{label:'Profit Vault',action:'TRAIL_PROFIT'}];
    if(f==='TIME')return [{label:'Timed pause',action:'PAUSE_FOR',primary:true},{label:'After win',action:'AFTER_WIN'}];
    if(f==='INTENT')return [{label:'Runner',action:'ASSIGN_RUNNER',primary:true},{label:'Collector',action:'ASSIGN_COLLECTOR'}];
    if(f==='RISK')return [{label:'Structure Keeper',action:'TRAIL_STRUCTURE',primary:true},{label:'Protect rail',action:'PROTECT_RAIL'}];
    return [];
  }
  return {render};
}
