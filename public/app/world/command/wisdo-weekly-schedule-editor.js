// Browser-side broker-clock weekly hours editor. Saving requires authenticated
// World Command Center proposal + hold confirmation; local draft is NOT live.
const DAYS=['SUN','MON','TUE','WED','THU','FRI','SAT'];
export function hourActive(mask,hour){return (Number(mask)&(1<<hour))!==0;}
export function createWisdoWeeklyScheduleEditor(host,{onApply}={}){
 if(!host)return {setState(){},destroy(){}};
 let masks=Array(7).fill(0),key='',drag=null,armed=false,lastApplied='',dirty=false;
 host.innerHTML='<div class="wsw-head"><div><span class="lm-label">WISDO CHRONOS</span><h2>Color-coordinate trading hours</h2></div><span class="wsw-badge" id="wswBadge">DRAFT ONLY</span></div><p class="wsw-caption">Drag across hours to paint allowed entries. Red=blocked, green=allowed. The broker server clock is authoritative; open trades stay protected outside entry hours. This editor requires the updated EA/Reporter receiver.</p><div class="wsw-grid-wrap"><div class="wsw-grid" id="wswGrid" aria-label="Weekly broker-time allowed entry hours"></div></div><div class="wsw-legend"><span><b style="background:#25d3a7"></b>ALLOWED</span><span><b style="background:#43212b"></b>BLOCKED</span><span><b style="background:#698bff"></b>ASIA</span><span><b style="background:#eaba63"></b>LONDON</span><span><b style="background:#ae78ff"></b>NEW YORK</span></div><div class="wsw-actions"><button type="button" id="wswClear">Clear all</button><button type="button" id="wswFull">All market hours</button><button type="button" id="wswApply" class="primary" disabled>Review &amp; apply to EA</button></div><p class="wsw-status" id="wswStatus">Select a paired EA to create a schedule.</p>';
 const grid=host.querySelector('#wswGrid'),badge=host.querySelector('#wswBadge'),message=host.querySelector('#wswStatus'),apply=host.querySelector('#wswApply');
 function paint(){grid.innerHTML='<span></span>'+Array.from({length:24},(_,h)=>'<span>'+String(h).padStart(2,'0')+'</span>').join('')+DAYS.map((day,d)=>'<span class="wsw-day">'+day+'</span>'+Array.from({length:24},(_,h)=>'<button type="button" class="wsw-hour'+(hourActive(masks[d],h)?' selected':'')+'" data-day="'+d+'" data-hour="'+h+'" data-session="'+(h<7?'asia':h<15?'london':'newyork')+'" aria-pressed="'+hourActive(masks[d],h)+'" aria-label="'+day+' '+h+':00 broker time"></button>').join('')).join('');}
 function persist(){dirty=true;if(key){try{localStorage.setItem(key,JSON.stringify(masks))}catch{}}badge.textContent='UNSAVED BROKER SCHEDULE';message.textContent='Edited draft. Schedule is not active until the EA confirms it.';paint();}
 function setCell(d,h,enable){if(d<0||d>6||h<0||h>23)return;const next=enable?(masks[d]|(1<<h)):(masks[d]&~(1<<h));if(next!==masks[d]){masks[d]=next;persist();}}
 grid.addEventListener('pointerdown',e=>{const t=e.target.closest('[data-day][data-hour]');if(!t)return;drag={paint:!hourActive(masks[Number(t.dataset.day)],Number(t.dataset.hour))};setCell(Number(t.dataset.day),Number(t.dataset.hour),drag.paint);try{grid.setPointerCapture(e.pointerId)}catch{};e.preventDefault();});
 grid.addEventListener('pointermove',e=>{if(!drag)return;const t=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('[data-day][data-hour]');if(t&&grid.contains(t))setCell(Number(t.dataset.day),Number(t.dataset.hour),drag.paint);});
 grid.addEventListener('pointerup',()=>drag=null);grid.addEventListener('pointercancel',()=>drag=null);
 grid.addEventListener('click',e=>{if(e.detail!==0)return;const t=e.target.closest('[data-day][data-hour]');if(t)setCell(Number(t.dataset.day),Number(t.dataset.hour),!hourActive(masks[Number(t.dataset.day)],Number(t.dataset.hour)));});
 host.querySelector('#wswClear').onclick=()=>{masks=Array(7).fill(0);persist()};
 host.querySelector('#wswFull').onclick=()=>{masks=Array(7).fill(0xFFFFFF);persist()};
 apply.addEventListener('click',()=>{if(!armed)return;message.textContent='Previewing account-bound schedule. Hold to confirm in WISDO.';const slotMasks=[...masks];onApply?.(slotMasks);});
 paint();
 return {setState(state,campaign,cap){
   const account=state?.account?.accountId||'',symbol=campaign?.symbol||state?.campaignControl?.symbol||'',magic=campaign?.magicNumber??state?.campaignControl?.magic??0;
   const next=account&&symbol&&magic?'wisdo.weekly.v1:'+account+':'+symbol+':'+magic:'';
   if(next!==key){key=next;dirty=false;lastApplied='';try{masks=JSON.parse(localStorage.getItem(key)||'null')||Array(7).fill(0)}catch{masks=Array(7).fill(0)};paint();}
   armed=Boolean(cap?.available);
   apply.disabled=!armed;
   apply.title=armed?'Hold-confirm to send broker-clock schedule':cap?.reason||'EA weekly schedule receiver unavailable';
   const c=state?.campaignControl;
   const exactReceiver=Boolean(account&&symbol&&Number(magic)>0&&c?.live&&String(c.symbol)===String(symbol)&&Number(c.magic)===Number(magic));
   if(exactReceiver&&c?.scheduleActive&&c?.scheduleVersion===1){
     const reported=Array.isArray(c.scheduleDays)?c.scheduleDays:[];
     const valid=reported.length===7&&reported.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=0xFFFFFF);
     if(valid){
       const identity=[account,symbol,magic,...reported].join('|');
       if(dirty && reported.every((mask,index)=>Number(mask)===Number(masks[index])))dirty=false;
       if(!dirty&&lastApplied!==identity){masks=reported.slice();paint();}
       lastApplied=identity;
       badge.textContent=dirty?'UNSAVED BROKER SCHEDULE':'EA SCHEDULE REPORTED';
       const gate=c.session?.entryAllowed;
       message.textContent=dirty?'Local draft differs from EA; review and apply to enforce changes.':'EA weekly gate: '+(c.scheduleAllowed?'allowed.':'blocked.')+' Overall new entries: '+(gate===true?'allowed by current gates.':gate===false?'blocked by current gates.':'not reported.');
     }else{lastApplied='';badge.textContent='UNVERIFIED';message.textContent='Receiver did not report a complete valid schedule.';}
   }else{
     lastApplied='';
     badge.textContent=armed&&exactReceiver?'READY TO APPLY':'DRAFT ONLY';
     message.textContent=armed&&exactReceiver?'Schedule receiver online. Drag allowed hours, then review and hold confirmation.':cap?.reason||'Exact live EA receiver not verified; schedule enforcement is unconfirmed.';
   }
 },destroy(){}};
}
