// WISDO V13 Power Dock — visual catalog and server-verified command dispatch.
// An open ticket unlocks visibility; support requires a verified EA receiver.
// Never mark a power active until the backend reports a corresponding state.
export const EA_POWERS = ["Sonic Burst","Sniper Entry","Shadow Entry","Echo Trade","Reversal Hunter","Momentum Accelerator","Trade Magnet","Smart Grid Builder","Guardian Shield","Profit Fortress","Basket Fusion","Runner Evolution","ATR Shape Shifter","Trade Resurrection","Reverse Shield","Position Gravity","Compound Reactor","Double-Up Campaign","Micro Collector","Victory Lock","Loss Recovery Architect","Equity Pulse","Target Ladder","Campaign Splitter","Time Warp","Candle Reset","Two-Minute Hunter","News Storm Shield","Liquidity Radar","Market DNA","Session Commander","Spread Sentinel","Guardian Override","Voice-to-Trade","Gesture Fusion","Risk Shadow Simulator","Strategy Mutation Lab","Guardian Memory","Emergency Extraction","Universal EA Power Dock","Burst → Ladder → Burst","Burst → Collect → Reload","Burst → Protect → Burst","Ladder → Burst → Reverse","Burst → Wait → Double Confirm","Staircase Accelerator","Reverse Staircase","Alternating Sonic","Price-and-Time Ladder","Candle-Step Ladder","Adaptive ATR Ladder","Liquidity-Gated Burst","Profit-Funded Burst","Drawdown Brake","Exposure Balancer","Basket Break-Even Gate","Multi-Timeframe Sequencer","Campaign Relay","Reversal Recovery Sequence","Behavior Fusion"].map((name,index)=>({
  id:index+1, name,
  // Only commands currently recognized by WorldCommandCenterService can be proposed.
  action:({
    1:'ARM_SONIC'
  })[index+1] || null
}));
export function mountEaPowerDock(host,{onCommand}={}){
  if(!host)throw new TypeError('Power Dock host required');
  let hasPosition=false, isLive=false, busy=false, lastReceipt='';
  const style=document.createElement('style');
  style.textContent=`.ea-dock{margin:18px 0;border:1px solid #795d2a;border-radius:18px;padding:16px;background:#0b1420;color:#f1ddb0}.ea-dock-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:8px;max-height:340px;overflow:auto}.ea-power{padding:12px;text-align:left;border-radius:12px;background:#111f2b;color:#8294a1;border:1px solid #304351;cursor:not-allowed;min-height:57px}.ea-power.gold{background:linear-gradient(135deg,#44300a,#231e14);color:#f9d777;border-color:#d7a846;box-shadow:0 0 14px #edb94736;cursor:pointer}.ea-power:disabled{opacity:.62;cursor:not-allowed}.ea-power small{display:block;color:#b9a37a}.ea-power.selected{outline:2px solid #f3d68e}.ea-dock-status{margin:8px 0;color:#d8b96a;font-size:13px}`;
  host.appendChild(style);
  const wrap=document.createElement('section');
  wrap.className='ea-dock';wrap.innerHTML='<h3>⚡ WISDO EA Power Dock · 60 Powers</h3><p class="ea-dock-status" role="status">Waiting for an open position.</p><div class="ea-dock-grid"></div>';
  host.appendChild(wrap);
  const grid=wrap.querySelector('.ea-dock-grid');
  for(const p of EA_POWERS){
    const btn=document.createElement('button');btn.type='button';btn.className='ea-power';btn.dataset.powerId=String(p.id);
    btn.innerHTML='<strong></strong><small></small>';btn.querySelector('strong').textContent=p.id+'. '+p.name;
    grid.appendChild(btn);
    btn.addEventListener('click',async()=>{
      if(busy||!hasPosition||!isLive)return;
      if(!p.action){status(p.name+' needs an EA/manager capability adapter; no order was sent.');return;}
      busy=true;btn.classList.add('selected');status('Preparing '+p.name+' with server validation…');
      try{await onCommand?.(p.action,p);status(p.name+' submitted for server preview. Confirm through the existing command safety flow; not yet executed.');}
      catch(e){status(p.name+' unavailable: '+(e?.message||'Server rejected request'));}
      finally{busy=false;btn.classList.remove('selected');}
    });
  }
  function status(message){lastReceipt=message;wrap.querySelector('.ea-dock-status').textContent=message;}
  function update({positions=[],live=false,capabilities={}}={}){
    hasPosition=positions.length>0;isLive=Boolean(live);
    for(const p of EA_POWERS){
      const b=grid.querySelector('[data-power-id="'+p.id+'"]');
      const supported=Boolean(p.action && capabilities?.[p.action]?.available);
      b.classList.toggle('gold',hasPosition && isLive && supported);
      b.disabled=!hasPosition||!isLive||!supported;
      b.querySelector('small').textContent=!hasPosition?'AWAITING TRADE':!isLive?'RECEIVER OFFLINE':supported?'PREVIEW AVAILABLE':p.action?'EA COMMAND BLOCKED':'ADAPTER REQUIRED';
      b.title=p.action?'Uses existing proposal and confirmation':'Not wired to MT4: unavailable until adapter installed';
    }
    if(!hasPosition)status('Waiting for an open position. Nothing will execute.');
    else if(!isLive)status('Trade detected. Gold powers shown, but EA receiver is not ready.');
    else if(!lastReceipt)status('Trade detected. Gold illuminates only verified EA controls; unsupported powers remain locked.');
  }
  update();
  return {update,destroy(){wrap.remove();style.remove();}};
}
