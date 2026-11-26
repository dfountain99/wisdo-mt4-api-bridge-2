// Versioned CHRONOS editor. Drafts remain local until an authenticated hold-confirmed
// proposal is applied and matching, fresh EA telemetry proves the selected clock and masks.
const DAYS=['SUN','MON','TUE','WED','THU','FRI','SAT'];
const validMasks=raw=>Array.isArray(raw)&&raw.length===7&&raw.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=0xFFFFFF);
export function hourActive(mask,hour){return (Number(mask)&(1<<hour))!==0;}
export function createWisdoWeeklyScheduleEditor(host,{onApply}={}){
 if(!host)return {setState(){},destroy(){}};
 let masks=Array(7).fill(0),lane='',key='',clock='BROKER_CLOCK',drag=null,armed=false,dirty=false,current=null;
 host.innerHTML='<div class="wsw-head"><div><span class="lm-label">WISDO CHRONOS</span><h2>Weekly entry hours</h2></div><span class="wsw-badge" id="wswBadge">DRAFT ONLY</span></div><label>Schedule clock <select id="wswClock"><option value="BROKER_CLOCK">Broker server time</option><option value="EASTERN">Eastern time (automatic DST)</option></select></label><p class="wsw-caption">Paint allowed entry hours. Red=blocked, green=allowed. The EA enforces the selected clock locally. Other entry and risk gates remain in effect; open positions remain managed.</p><div class="wsw-grid-wrap"><div class="wsw-grid" id="wswGrid" aria-label="Weekly allowed entry hours"></div></div><div class="wsw-legend"><span><b style="background:#25d3a7"></b>ALLOWED</span><span><b style="background:#43212b"></b>BLOCKED</span></div><div class="wsw-actions"><button type="button" id="wswPreset">Workday 03–10 / 12–16 ET</button><button type="button" id="wswClear">Clear all</button><button type="button" id="wswFull">Allow all hours</button><button type="button" id="wswApply" class="primary" disabled>Review &amp; apply to EA</button></div><p class="wsw-status" id="wswStatus">Select a paired EA to create a schedule.</p>';
 const grid=host.querySelector('#wswGrid'),badge=host.querySelector('#wswBadge'),message=host.querySelector('#wswStatus'),apply=host.querySelector('#wswApply'),selector=host.querySelector('#wswClock'),preset=host.querySelector('#wswPreset');
 const clockName=()=>clock==='EASTERN'?'Eastern time':'broker time';
 function paint(){grid.innerHTML='<span></span>'+Array.from({length:24},(_,h)=>'<span>'+String(h).padStart(2,'0')+'</span>').join('')+DAYS.map((day,d)=>'<span class="wsw-day">'+day+'</span>'+Array.from({length:24},(_,h)=>'<button type="button" class="wsw-hour'+(hourActive(masks[d],h)?' selected':'')+'" data-day="'+d+'" data-hour="'+h+'" aria-pressed="'+hourActive(masks[d],h)+'" aria-label="'+day+' '+h+':00 '+clockName()+'"></button>').join('')).join('');}
 function store(){if(key){try{localStorage.setItem(key,JSON.stringify({masks,dirty}))}catch{}}}
 function load(){
   key=lane?'wisdo.weekly.v2:'+lane+':'+clock:'';
   masks=Array(7).fill(0);dirty=false;
   if(key){try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(validMasks(saved?.masks)){masks=saved.masks;dirty=saved.dirty===true;}}catch{}}
   paint();
 }
 function persist(){dirty=true;store();badge.textContent='UNSAVED '+clockName().toUpperCase();message.textContent='Edited draft. Nothing has been applied to the EA.';paint();}
 function setCell(d,h,enable){if(d<0||d>6||h<0||h>23)return;const next=enable?(masks[d]|(1<<h)):(masks[d]&~(1<<h));if(next!==masks[d]){masks[d]=next;persist();}}
 grid.addEventListener('pointerdown',e=>{const t=e.target.closest('[data-day][data-hour]');if(!t)return;drag={paint:!hourActive(masks[Number(t.dataset.day)],Number(t.dataset.hour))};setCell(Number(t.dataset.day),Number(t.dataset.hour),drag.paint);try{grid.setPointerCapture(e.pointerId)}catch{};e.preventDefault();});
 grid.addEventListener('pointermove',e=>{if(!drag)return;const t=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('[data-day][data-hour]');if(t&&grid.contains(t))setCell(Number(t.dataset.day),Number(t.dataset.hour),drag.paint);});
 grid.addEventListener('pointerup',()=>drag=null);grid.addEventListener('pointercancel',()=>drag=null);
 grid.addEventListener('click',e=>{if(e.detail!==0)return;const t=e.target.closest('[data-day][data-hour]');if(t)setCell(Number(t.dataset.day),Number(t.dataset.hour),!hourActive(masks[Number(t.dataset.day)],Number(t.dataset.hour)));});
 function refresh(){
   const c=current?.c,exact=current?.exact,eastern=Boolean(exact&&c?.scheduleVersion===2&&[0,1,2,3].includes(c.scheduleClockMode));
   selector.options[1].disabled=!eastern;
   preset.disabled=!eastern;
   selector.value=clock;
   armed=Boolean(exact&&current?.cap?.available&&[1,2].includes(c?.scheduleVersion)&&(clock==='BROKER_CLOCK'||eastern));
   apply.disabled=!armed;
   apply.title=armed?'Hold-confirm to apply '+clockName():current?.cap?.reason||'Compatible live receiver unavailable';
   const activeClock=c?.scheduleClockMode===3?'EASTERN':(c?.scheduleClockMode===1||c?.scheduleVersion===1?'BROKER_CLOCK':null);
   if(exact&&c?.scheduleActive&&activeClock===clock){
     if(!validMasks(c.scheduleDays)){badge.textContent='UNVERIFIED';message.textContent='Receiver reported an incomplete or invalid week.';return;}
     const same=c.scheduleDays.every((mask,i)=>mask===masks[i]);
     if(dirty&&same){dirty=false;store();}
     if(!dirty&&!same){masks=c.scheduleDays.slice();store();paint();}
     badge.textContent=dirty?'UNSAVED '+clockName().toUpperCase():'EA SCHEDULE REPORTED';
     const gate=c.session?.entryAllowed;
     message.textContent=dirty?'Draft differs from the active EA schedule. Review and apply to change it.':'EA weekly gate ('+clockName()+'): '+(c.scheduleAllowed?'allowed.':'blocked.')+' Overall entry gate: '+(gate===true?'allowed.':gate===false?'blocked.':'not reported.');
     return;
   }
   badge.textContent=dirty?'UNSAVED '+clockName().toUpperCase():armed?'READY TO APPLY':'DRAFT ONLY';
   message.textContent=exact&&c?.scheduleClockMode===2?'EA is blocked during an incomplete schedule update. Reapply a complete week when connected.':armed?(c?.scheduleActive&&activeClock?'The EA currently uses '+(activeClock==='EASTERN'?'Eastern time':'broker time')+'. Applying replaces that weekly schedule.':'Receiver ready. Review and apply a complete week.'):(current?.cap?.reason||'Exact live EA receiver not verified; schedule enforcement is unconfirmed.');
 }
 selector.addEventListener('change',()=>{clock=selector.value;load();refresh();});
 preset.addEventListener('click',()=>{if(preset.disabled)return;if(clock!=='EASTERN'){clock='EASTERN';load();}const workday=((1<<10)-1)^((1<<3)-1)|((1<<16)-1)^((1<<12)-1);masks=[0,workday,workday,workday,workday,workday,0];persist();refresh();});
 host.querySelector('#wswClear').onclick=()=>{masks=Array(7).fill(0);persist()};
 host.querySelector('#wswFull').onclick=()=>{masks=Array(7).fill(0xFFFFFF);persist()};
 apply.addEventListener('click',()=>{if(!armed)return;message.textContent='Previewing '+clockName()+' schedule. Hold to confirm in WISDO.';onApply?.([...masks],clock);});
 paint();
 return {setState(state,campaign,cap){
   const account=state?.account?.accountId||'',symbol=campaign?.symbol||state?.campaignControl?.symbol||'',magic=campaign?.magicNumber??state?.campaignControl?.magic??0,c=state?.campaignControl;
   const exact=Boolean(account&&symbol&&Number(magic)>0&&c?.live&&String(c.symbol)===String(symbol)&&Number(c.magic)===Number(magic));
   current={c,exact,cap};
   const next=account&&symbol&&magic?account+':'+symbol+':'+magic:'';
   if(next!==lane){lane=next;clock=exact&&c?.scheduleVersion===2&&[0,1,2,3].includes(c.scheduleClockMode)&&c.scheduleClockMode!==1?'EASTERN':'BROKER_CLOCK';load();}
   refresh();
 },destroy(){}};
}
