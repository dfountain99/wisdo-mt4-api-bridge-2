// WISDO weekly schedule: paint a broker-time 7x48 half-hour matrix.
// Colors show local draft; only post-Reporter EA telemetry confirms activation.
export function createWisdoWeeklyScheduler(host,{onApply=()=>{}}={}){
  if(!host)return {setState(){},destroy(){}};
  const DAYS=['MON','TUE','WED','THU','FRI','SAT','SUN'];
  host.innerHTML='<div class="ws-head"><div><small class="lm-label">ADVANCED WISDO TIME</small><h2>Drag to schedule bot hours</h2></div><b id="wsGate">NOT CONNECTED</b></div>'+
    '<p class="ws-legend"><span class="yes">● GREEN · NEW ENTRIES ALLOWED</span><span class="no">● RED · MANAGE EXISTING TRADES ONLY</span></p>'+
    '<p>Paint the grid in broker terminal time (Monday–Sunday, 30-minute blocks). Drag across cells to open or block hours. Existing trades remain managed outside green hours.</p>'+
    '<div class="ws-scroll"><div id="wsGrid" class="ws-grid" aria-label="Weekly broker trading schedule"></div></div>'+
    '<div class="ws-actions"><button type="button" data-ws-preset="london">LONDON</button><button type="button" data-ws-preset="newyork">NEW YORK</button><button type="button" data-ws-preset="all">ALL HOURS</button><button type="button" data-ws-preset="none">BLOCK ALL</button><button type="button" id="wsSave" class="primary">REVIEW & APPLY TO EA</button><button type="button" id="wsDisable">REMOVE WEEKLY OVERRIDE</button></div>'+
    '<div class="ws-status" id="wsStatus" role="status">Waiting for a compatible HIGHTOWER campaign receiver.</div>';
  const grid=host.querySelector('#wsGrid'),status=host.querySelector('#wsStatus'),save=host.querySelector('#wsSave'),disable=host.querySelector('#wsDisable');
  let draft=Array(7).fill(0),identity='',dirty=false,dragging=false,paintValue=false,mode=0,version=0,capability=null,lastApply=null;
  const block=document.createElement('span');block.className='ws-label';block.textContent='BROKER';grid.appendChild(block);
  for(let slot=0;slot<48;slot++){const node=document.createElement('span');node.className='ws-hour';node.textContent=slot%4===0?String(slot/2).padStart(2,'0'):'';grid.appendChild(node);}
  for(let day=0;day<7;day++){const label=document.createElement('span');label.className='ws-label';label.textContent=DAYS[day];grid.appendChild(label);
    for(let slot=0;slot<48;slot++){const cell=document.createElement('button');cell.type='button';cell.className='ws-cell';cell.dataset.day=String(day);cell.dataset.slot=String(slot);cell.title=DAYS[day]+' '+String(Math.floor(slot/2)).padStart(2,'0')+':'+(slot%2?'30':'00')+' broker';cell.setAttribute('aria-label',cell.title);grid.appendChild(cell);}}
  function isOn(day,slot){return Math.floor(draft[day]/2**slot)%2===1;}
  function draw(){grid.querySelectorAll('.ws-cell').forEach(cell=>{const d=Number(cell.dataset.day),s=Number(cell.dataset.slot),on=isOn(d,s);cell.dataset.on=String(on);cell.setAttribute('aria-pressed',String(on));});}
  function paint(cell){if(!cell||!cell.classList?.contains('ws-cell'))return;const d=Number(cell.dataset.day),s=Number(cell.dataset.slot),old=isOn(d,s);
    if(old===paintValue)return;draft[d]+=(paintValue?1:-1)*2**s;dirty=true;draw();status.textContent='Unsaved changes · no MT4 schedule has been sent.';}
  grid.addEventListener('pointerdown',e=>{const cell=e.target.closest('.ws-cell');if(!cell)return;e.preventDefault();dragging=true;paintValue=!isOn(Number(cell.dataset.day),Number(cell.dataset.slot));paint(cell);grid.setPointerCapture?.(e.pointerId);});
  grid.addEventListener('pointermove',e=>{if(!dragging)return;const cell=document.elementFromPoint(e.clientX,e.clientY)?.closest('.ws-cell');if(cell&&grid.contains(cell))paint(cell);});
  grid.addEventListener('pointerup',()=>{dragging=false;});grid.addEventListener('pointercancel',()=>{dragging=false;});
  grid.addEventListener('click',e=>{const cell=e.target.closest('.ws-cell');if(!cell)return;if(e.detail===0){paintValue=!isOn(Number(cell.dataset.day),Number(cell.dataset.slot));paint(cell);}});
  host.querySelectorAll('[data-ws-preset]').forEach(button=>button.addEventListener('click',()=>{const value=button.dataset.wsPreset;draft=Array(7).fill(0);
    if(value!=='none')for(let d=0;d<5;d++)for(let s=0;s<48;s++){const h=s/2;if(value==='all'||value==='london'&&h>=7&&h<16||value==='newyork'&&h>=13&&h<21)draft[d]+=2**s;}
    if(value==='all')draft=Array(7).fill(2**48-1);
    dirty=true;draw();status.textContent='Preset ready · review hours, then apply to EA.';}));
  save.addEventListener('click',async()=>{if(!capability?.available){status.textContent=capability?.reason||'Schedule receiver unavailable.';return;}try{status.textContent='Reviewing schedule for confirmed account, symbol and MagicNumber…';await onApply(draft.slice(),true);lastApply={masks:draft.slice(),mode:1};status.textContent='Review command created. Complete the live command confirmation to send the schedule.';}catch(e){status.textContent='BLOCKED · '+e.message;}});
  disable.addEventListener('click',async()=>{if(!capability?.available){status.textContent=capability?.reason||'Schedule receiver unavailable.';return;}try{await onApply(draft.slice(),false);lastApply={masks:draft.slice(),mode:0};status.textContent='Removal proposed. Confirm to restore the EA own trading-window rules.';}catch(e){status.textContent='BLOCKED · '+e.message;}});
  function setState(state,campaign){const c=state?.campaignControl,account=state?.account,key=[account?.accountId||'',c?.symbol||'',c?.magic||''].join('|'),remote=c?.schedule;
    capability=state?.capabilities?.SET_WEEKLY_SCHEDULE||null;version=remote?.version||0;mode=remote?.mode||0;
    if(identity!==key){identity=key;dirty=false;lastApply=null;draft=Array.isArray(remote?.masks)&&remote.masks.length===7?remote.masks.slice():Array(7).fill(0);draw();}
    if(version===1&&!dirty&&Array.isArray(remote?.masks)){draft=remote.masks.slice();draw();}
    if(lastApply&&version===1&&mode===lastApply.mode&&lastApply.masks.every((n,i)=>Number(remote?.masks?.[i])===n)){dirty=false;lastApply=null;status.textContent='EA TELEMETRY VERIFIED · WEEKLY SCHEDULE '+(mode===1?'ACTIVE':'DISABLED');}
    host.querySelector('#wsGate').textContent=!c?.live?'EA OFFLINE':!capability?.available?'RECEIVER UPGRADE REQUIRED':mode===1?'EA ACTIVE · WEEKLY GATE':mode===2?'EA APPLYING · BLOCKED':'EA READY · ALL LEGACY HOURS';
    save.disabled=disable.disabled=!capability?.available;
    if(!capability?.available)status.textContent=capability?.reason||'Compatible EA not connected.';
    else if(!dirty&&!lastApply)status.textContent=mode===1?'Broker confirmed the active weekly schedule.':'EA ready. Paint allowed hours, then review and confirm.';
  }
  draw();return {setState,destroy(){dragging=false;}};
}
