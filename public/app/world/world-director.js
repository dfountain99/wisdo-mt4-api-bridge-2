const esc = (value='') => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

export function startWorldDirector(){
  let stopped=false; let activeDestination=null; let activeSignal=null;
  const stage=document.getElementById('worldStage');
  const status=document.createElement('div');
  status.className='wisdo-director-status';
  status.hidden=true;
  status.style.cssText='position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top) + 82px);z-index:5300;padding:8px 14px;border:1px solid rgba(111,229,255,.26);border-radius:999px;background:rgba(4,10,16,.78);backdrop-filter:blur(8px);color:#dff8ff;font:700 10px/1 system-ui;letter-spacing:.09em;pointer-events:none';
  stage?.appendChild(status);
  function show(text,ms=2200){ if(stopped||!status)return;status.textContent=text;status.hidden=false;clearTimeout(show.timer);show.timer=setTimeout(()=>{status.hidden=true;},ms); }
  function entered(event){activeDestination=event.detail?.id||null;show(`${String(event.detail?.name||activeDestination||'WISDO').toUpperCase()} · INTERIOR ACTIVE`);}
  function exited(){activeDestination=null;show('RETURNED TO WORLD');}
  function signal(event){const d=event.detail||{};activeSignal={id:d.eventId||d.id||null,symbol:d.symbol||d.event?.symbol||'MARKET',direction:d.direction||d.event?.direction||''};show(`WISDO SIGNAL · ${activeSignal.symbol} ${activeSignal.direction}`.trim(),3200);}
  function connection(){show(navigator.onLine?'WORLD LINK RESTORED':'WORLD LINK LOST · LIVE DATA MAY BE STALE',3500);}
  window.addEventListener('wisdo:world-destination-entered',entered);window.addEventListener('wisdo:world-destination-exited',exited);window.addEventListener('wisdo:bot.signal.created',signal);window.addEventListener('online',connection);window.addEventListener('offline',connection);
  globalThis.WisdoWorldDirector=Object.freeze({get state(){return Object.freeze({activeDestination,activeSignal,online:navigator.onLine});},announce:show});
  return Object.freeze({stop(){stopped=true;window.removeEventListener('wisdo:world-destination-entered',entered);window.removeEventListener('wisdo:world-destination-exited',exited);window.removeEventListener('wisdo:bot.signal.created',signal);window.removeEventListener('online',connection);window.removeEventListener('offline',connection);status.remove();delete globalThis.WisdoWorldDirector;}});
}
