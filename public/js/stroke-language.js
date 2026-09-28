// WISDO Stroke Language V1
// Normalizes desktop letters and multi-touch gestures into the existing preview pipeline.
// It never executes a command; execution remains propose -> preview -> hold confirm -> EA acknowledgement.
const ACTION_KEYS={R:'ASSIGN_RUNNER',C:'ASSIGN_COLLECTOR'};
const label=a=>({ASSIGN_RUNNER:'RUNNER',ASSIGN_COLLECTOR:'COLLECTOR',TRAIL_STRUCTURE:'PROTECT · STRUCTURE',PROTECT_RAIL:'PROTECT · RAIL'}[a]||a);

export function createStrokeLanguage({host,getPositions,getSelected,setSelected,preview,clearPreview,message}){
  let buffer='',timer=null;
  const eligible=()=>getPositions?.().filter(t=>t.role!==0)||[];
  const ensureScope=()=>{
    let s=new Set(getSelected?.()||[]);
    if(!s.size&&eligible().length===1){s=new Set([String(eligible()[0].ticket)]);setSelected?.(s);}
    return s;
  };
  const announce=(text)=>{message?.('WISDO Ink · '+text);};
  const reset=()=>{buffer='';clearTimeout(timer);};
  const compile=()=>{
    const cmd=buffer; reset();
    if(!cmd)return;
    if(cmd==='Y'){announce('WHY · Select or touch a trade to inspect its live reasoning.');return;}
    if(cmd==='W'){announce('WHAT-IF armed for the next gesture. Simulation only; nothing is sent.');return;}
    if(cmd==='X'){clearPreview?.();announce('Proposed command cleared. Live EA rules were not changed.');return;}
    if(cmd==='B'){setSelected?.(new Set(eligible().map(t=>String(t.ticket))));announce('BASKET · '+eligible().length+' controllable trades selected.');return;}
    if(cmd==='P'||cmd==='PS'){
      if(cmd==='PS'&&!ensureScope().size){announce('PROTECT · STRUCTURE needs a selected trade or basket.');return;}
      preview?.({action:cmd==='PS'?'TRAIL_STRUCTURE':'PROTECT_RAIL'});return;
    }
    if(ACTION_KEYS[cmd]){
      if(!ensureScope().size){announce(label(ACTION_KEYS[cmd])+' needs a selected trade or basket.');return;}
      preview?.({action:ACTION_KEYS[cmd]});return;
    }
    const timed=cmd.match(/^T(\d{1,3})$/);
    if(timed){const minutes=Math.max(1,Math.min(999,Number(timed[1])));preview?.({action:'PAUSE_FOR',durationSeconds:minutes*60});return;}
    announce('“'+cmd+'” is not armed yet. Nothing was sent.');
  };
  const keydown=e=>{
    if(!host.contains(document.activeElement))return;
    const tag=document.activeElement?.tagName;
    if(['INPUT','TEXTAREA','SELECT'].includes(tag)||document.activeElement?.isContentEditable)return;
    if(e.key==='Escape'){e.preventDefault();reset();clearPreview?.();announce('command construction cancelled.');return;}
    if(e.key==='Enter'&&buffer){e.preventDefault();compile();return;}
    const k=e.key.toUpperCase();
    if(!/^[A-Z0-9]$/.test(k))return;
    if(!'PRCTGSBWXY0123456789'.includes(k))return;
    e.preventDefault();buffer=(buffer+k).slice(0,12);announce(buffer+' · Enter to preview');clearTimeout(timer);timer=setTimeout(compile,900);
  };
  host.tabIndex=host.tabIndex>=0?host.tabIndex:0;
  host.addEventListener('keydown',keydown);

  const twoFingerSlide=({dx,dy,distanceChange=0})=>{
    if(Math.abs(distanceChange)>55){announce(distanceChange<0?'PINCH · basket compression reserved; no command sent.':'SPREAD · basket expansion reserved; no command sent.');return true;}
    if(Math.hypot(dx,dy)<38){announce('2-FINGER TAP · WHAT-IF context. Simulation only.');return true;}
    if(Math.abs(dy)>Math.abs(dx)){
      if(dy<0){announce('2-FINGER ↑ · WHAT-IF objective stretch. No MT4 change.');return true;}
      const s=ensureScope(); if(s.size)preview?.({action:'TRAIL_STRUCTURE'}); else preview?.({action:'PROTECT_RAIL'});return true;
    }
    if(dx>0){const s=ensureScope();if(s.size)preview?.({action:'ASSIGN_COLLECTOR'});else announce('2-FINGER → needs a trade selection.');return true;}
    clearPreview?.();announce('2-FINGER ← · proposed change rewound. Live rules unchanged.');return true;
  };
  const threeFinger=({dy=0,dx=0})=>{
    setSelected?.(new Set(eligible().map(t=>String(t.ticket))));
    if(Math.hypot(dx,dy)<32){announce('3-FINGER TAP · CAMPAIGN scope · '+eligible().length+' trades selected.');return true;}
    if(Math.abs(dy)>Math.abs(dx)&&dy<0){announce('3-FINGER ↑ · campaign extension is in preview language only; no command sent.');return true;}
    if(Math.abs(dy)>Math.abs(dx)&&dy>0){preview?.({action:'PROTECT_RAIL'});return true;}
    if(dx>0&&eligible().length)preview?.({action:'ASSIGN_COLLECTOR'});
    else {clearPreview?.();announce('3-FINGER ← · campaign proposal cleared.');}
    return true;
  };
  return {twoFingerSlide,threeFinger,cleanup(){clearTimeout(timer);host.removeEventListener('keydown',keydown);}};
}
