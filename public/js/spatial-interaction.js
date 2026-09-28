// WISDO Spatial Interaction V2 — gesture interpretation + analytical simulation.
// It never calls execution APIs directly. Action gestures only request the existing preview path.
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const fmt=v=>Number.isFinite(v)?Number(v).toFixed(2):'—';
const roleName=r=>['HOLD','COLLECTOR','RUNNER'][r]||'TRADE';
const pnlText=t=>(num(t.floatingMoney)>=0?'+':'')+num(t.floatingMoney).toFixed(2);

export function createSpatialInteraction({host,getState,getPositions,getSelected,setSelected,preview,message,listen}){
  let exploded=null, whatIf=false, simDelta=0, down=null, longTimer=null;
  const q=s=>host.querySelector(s), state=()=>getState?.(), positions=()=>getPositions?.()||[];
  const explain=t=>{
    const c=state()?.campaignControl,pnl=num(t?.floatingMoney),entry=num(t?.entryPrice),now=num(t?.currentPrice),tp=num(t?.takeProfit);
    const side=c?.direction===-1?'sell':c?.direction===1?'buy':'campaign';
    return '#'+t.ticket+' is a '+roleName(t.role).toLowerCase()+' in the '+side+' basket. It entered at '+fmt(entry)+', reports '+fmt(now)+' now, '+(pnl>=0?'adds':'subtracts')+' '+Math.abs(pnl).toFixed(2)+' from floating P/L'+(tp?', and its current target is '+fmt(tp):'')+'. This explanation does not change the trade.';
  };
  const renderInspector=()=>{
    const panel=q('[data-spatial-inspector]'); if(!panel)return;
    const t=positions().find(x=>String(x.ticket)===String(exploded));
    if(!t){panel.hidden=true;return;} panel.hidden=false;
    const c=state()?.campaignControl,now=num(t.currentPrice),entry=num(t.entryPrice),tp=num(t.takeProfit),rail=num(c?.rail);
    const riskDistance=rail&&now?Math.abs(now-rail):0,rewardDistance=tp&&now?Math.abs(tp-now):0,simulated=now+simDelta;
    panel.innerHTML='<div class="wco-inspector-head"><div><span class="eyebrow">Exploded trade core</span><h3>#'+t.ticket+' · '+roleName(t.role)+'</h3></div><button class="btn ghost" data-collapse-core>Collapse</button></div>'+
      '<div class="wco-core-orbit"><div class="wco-core-center">'+pnlText(t)+'</div><span>ENTRY '+fmt(entry)+'</span><span>NOW '+fmt(now)+'</span><span>TARGET '+fmt(tp)+'</span><span>RAIL '+fmt(rail)+'</span></div>'+
      '<div class="wco-contribution"><b>Contribution line</b><i style="--contrib:'+Math.max(4,Math.min(100,Math.abs(num(t.floatingMoney))*2))+'%"></i><span>'+pnlText(t)+'</span></div>'+
      '<div class="wco-risk-shadow"><b>Risk Shadow</b><span>Rail distance '+fmt(riskDistance)+'</span><span>Reward distance '+fmt(rewardDistance)+'</span><span>R:R proxy '+(riskDistance?(rewardDistance/riskDistance).toFixed(2):'—')+'</span></div>'+
      '<label class="wco-whatif"><input type="checkbox" data-whatif '+(whatIf?'checked':'')+'> What-If mode <small>simulation only</small></label>'+
      '<label class="wco-sim" '+(whatIf?'':'hidden')+'>Simulate price displacement <input data-sim type="range" min="-20" max="20" step=".1" value="'+simDelta+'"><output>'+fmt(simulated)+'</output></label>'+
      '<p class="wco-why">'+explain(t)+'</p><small>Hold the trade core to listen. Drag toward WISDO for WHY. Swipe up previews Runner. Twist/arc left previews protection; arc right previews Profit Vault. No gesture executes by itself.</small>';
    q('[data-collapse-core]').onclick=()=>{exploded=null;renderInspector();};
    q('[data-whatif]').onchange=e=>{whatIf=e.target.checked;simDelta=0;renderInspector();};
    q('[data-sim]')?.addEventListener('input',e=>{simDelta=num(e.target.value);renderInspector();});
  };
  const classify=g=>{
    const pts=g.path,a=pts[0],z=pts[pts.length-1],dx=z.x-a.x,dy=z.y-a.y,distance=Math.hypot(dx,dy);
    if(distance<12)return 'tap';
    const orb=q('.wco-orb')?.getBoundingClientRect(),svg=q('svg')?.getBoundingClientRect();
    if(orb&&svg){const ox=(orb.left+orb.width/2-svg.left)*800/svg.width,oy=(orb.top+orb.height/2-svg.top)*390/svg.height;if(Math.hypot(z.x-ox,z.y-oy)<115)return 'why';}
    if(dy<-55&&Math.abs(dy)>Math.abs(dx)*1.1)return 'runner';
    if(Math.abs(dx)>80&&Math.abs(dx)>Math.abs(dy)*1.4)return 'isolate';
    if(pts.length>5){let turn=0;for(let i=2;i<pts.length;i++){const p0=pts[i-2],p1=pts[i-1],p2=pts[i];turn+=(p1.x-p0.x)*(p2.y-p1.y)-(p1.y-p0.y)*(p2.x-p1.x);}if(Math.abs(turn)>180)return turn<0?'protect':'harvest';}
    return 'select';
  };
  const finish=g=>{
    clearTimeout(longTimer);down=null;const t=positions().find(x=>String(x.ticket)===String(g.ticket));if(!t)return false;const kind=classify(g);
    if(kind==='tap'){exploded=String(t.ticket);setSelected(new Set([String(t.ticket)]));renderInspector();message('Trade #'+t.ticket+' expanded. Analytical controls only until you preview an action.');return true;}
    if(kind==='why'){exploded=String(t.ticket);renderInspector();message(explain(t));return true;}
    if(kind==='runner'){setSelected(new Set([String(t.ticket)]));preview({action:'ASSIGN_RUNNER'});return true;}
    if(kind==='protect'){setSelected(new Set([String(t.ticket)]));preview({action:'TRAIL_STRUCTURE'});return true;}
    if(kind==='harvest'){setSelected(new Set([String(t.ticket)]));preview({action:'TRAIL_PROFIT'});return true;}
    if(kind==='isolate'){setSelected(new Set([String(t.ticket)]));exploded=String(t.ticket);renderInspector();message('Trade #'+t.ticket+' isolated for analysis. Nothing sent.');return true;}
    return false;
  };
  return {
    begin(ticket,p){down={ticket:String(ticket),path:[p],started:performance.now()};clearTimeout(longTimer);longTimer=setTimeout(()=>{if(!down)return;listen?.();message('Listening while trade #'+ticket+' stays selected. Speech will still open a preview before any command can execute.');},650);},
    move(p){if(down){down.path.push(p);if(Math.hypot(p.x-down.path[0].x,p.y-down.path[0].y)>16)clearTimeout(longTimer);}},
    end(){if(!down)return false;return finish(down);},
    render(){renderInspector();},
    cleanup(){clearTimeout(longTimer);}
  };
}
