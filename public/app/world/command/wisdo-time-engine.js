const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const pad=(n)=>String(Math.max(0,Math.floor(n))).padStart(2,'0');

function fmtDuration(seconds){
  const s=Math.max(0,Number(seconds)||0);
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=Math.floor(s%60);
  return h>0?`${pad(h)}:${pad(m)}:${pad(sec)}`:`${pad(m)}:${pad(sec)}`;
}

function fmtClock(date,utc=false){
  try{
    return new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:utc?'UTC':undefined}).format(date);
  }catch{return '--:--:--';}
}

function markup(){
  return `<div class="wisdo-v10-time-engine" data-temporal-mode="standby">
    <div class="wisdo-v10-time-head"><span>ADVANCED WISDO TIME</span><b id="wcV10TimeStatus">STANDBY</b></div>
    <div class="wisdo-v10-time-core">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle class="track" cx="60" cy="60" r="50"></circle>
        <circle class="progress" id="wcV10TimeProgress" cx="60" cy="60" r="50"></circle>
      </svg>
      <div><strong id="wcV10TimeMain">00:00</strong><span id="wcV10TimeCaption">RESET REFERENCE</span><small id="wcV10TimeElapsed">ELAPSED —</small></div>
    </div>
    <div class="wisdo-v10-time-meta">
      <div><span>SESSION SYNC</span><b id="wcV10SessionSync">LOCAL / UTC</b></div>
      <div><span>RESUME RULE</span><b id="wcV10ResumeRule">NOT CONFIGURED</b></div>
      <div><span>PAUSE WINDOW</span><b id="wcV10PauseWindow">02:00 RESET · REFERENCE</b></div>
      <div><span>NEXT TRIGGER</span><b id="wcV10NextTrigger">STANDBY</b></div>
      <div><span>SCHEDULE</span><b id="wcV10Schedule">NOT CONFIGURED</b></div>
      <div><span>ENFORCEMENT</span><b id="wcV10Enforcement">STANDBY</b></div>
    </div>
    <div class="wisdo-v10-clock-pair"><span>LOCAL <b id="wcV10LocalClock">--:--:--</b></span><span>UTC <b id="wcV10UtcClock">--:--:--</b></span></div>
    <div class="wisdo-v10-time-rail" aria-label="Two minute temporal rail">
      <div class="wisdo-v10-time-rail-line"><i id="wcV10RailMarker"></i></div>
      <div class="wisdo-v10-time-labels"><span>00:00</span><span>00:30</span><span>01:00</span><span>01:30</span><span>02:00</span></div>
    </div>
  </div>`;
}

export function createWisdoTimeEngine(container,{resetWindowSeconds=120}={}){
  if(!container) return {setState(){},destroy(){}};
  container.classList.add('wisdo-v10-time-host');
  container.innerHTML=markup();
  const q=(id)=>container.querySelector(id);
  const root=container.querySelector('.wisdo-v10-time-engine');
  const circumference=2*Math.PI*50;
  const progress=q('#wcV10TimeProgress');
  progress.style.strokeDasharray=String(circumference);

  let state=null;
  let campaign=null;
  let stateReceivedAt=Date.now();
  let timer=0;

  function derived(){
    const control=state?.campaignControl||null;
    const now=Date.now();
    const live=Boolean(control?.live);
    const paused=Boolean(control?.paused);
    const age=Math.max(0,(now-stateReceivedAt)/1000);
    const rawRemaining=Number(control?.remainingSeconds||0);
    const remaining=live&&rawRemaining>0?Math.max(0,rawRemaining-age):0;
    const created=Date.parse(campaign?.createdAt||'');
    const elapsed=Number.isFinite(created)?Math.max(0,(now-created)/1000):null;
    const resetProgress=elapsed==null?0:(elapsed%resetWindowSeconds)/resetWindowSeconds;
    const livePauseProgress=rawRemaining>0?clamp(remaining/Math.max(1,rawRemaining),0,1):0;
    return {control,live,paused,remaining,elapsed,progress:live&&paused&&rawRemaining>0?livePauseProgress:resetProgress};
  }

  function render(){
    const d=derived();
    const now=new Date();
    q('#wcV10LocalClock').textContent=fmtClock(now,false);
    q('#wcV10UtcClock').textContent=fmtClock(now,true);
    q('#wcV10SessionSync').textContent='LOCAL / UTC';
    q('#wcV10TimeElapsed').textContent=d.elapsed==null?'ELAPSED —':`ELAPSED ${fmtDuration(d.elapsed)}`;

    if(d.live&&d.paused&&d.remaining>0){
      root.dataset.temporalMode='live';
      q('#wcV10TimeStatus').textContent='LIVE';
      q('#wcV10TimeMain').textContent=fmtDuration(d.remaining);
      q('#wcV10TimeCaption').textContent='LIVE PAUSE COUNTDOWN';
      q('#wcV10PauseWindow').textContent=fmtDuration(d.remaining);
      q('#wcV10NextTrigger').textContent='TIMER / EA EVENT';
      q('#wcV10Enforcement').textContent='LIVE';
    }else if(d.live){
      root.dataset.temporalMode='smart';
      q('#wcV10TimeStatus').textContent='SMART ACTIVE';
      q('#wcV10TimeMain').textContent=d.elapsed==null?'00:00':fmtDuration(d.elapsed);
      q('#wcV10TimeCaption').textContent='CAMPAIGN ELAPSED';
      q('#wcV10PauseWindow').textContent='02:00 RESET · REFERENCE';
      q('#wcV10NextTrigger').textContent='EA / CAMPAIGN EVENT';
      q('#wcV10Enforcement').textContent='LIVE';
    }else{
      root.dataset.temporalMode='standby';
      q('#wcV10TimeStatus').textContent='STANDBY';
      q('#wcV10TimeMain').textContent=d.elapsed==null?'02:00':fmtDuration(d.elapsed);
      q('#wcV10TimeCaption').textContent=d.elapsed==null?'RESET REFERENCE':'CAMPAIGN ELAPSED';
      q('#wcV10PauseWindow').textContent='02:00 RESET · REFERENCE';
      q('#wcV10NextTrigger').textContent='STANDBY';
      q('#wcV10Enforcement').textContent='STANDBY';
    }

    q('#wcV10ResumeRule').textContent=d.control?.paused?'NOT CONFIGURED':'NOT CONFIGURED';
    q('#wcV10Schedule').textContent='NOT CONFIGURED';
    const pct=clamp(d.progress,0,1);
    progress.style.strokeDashoffset=String(circumference*(1-pct));
    q('#wcV10RailMarker').style.left=`${(pct*100).toFixed(2)}%`;
  }

  function setState(next={},activeCampaign=null){
    state=next||{};
    campaign=activeCampaign||state?.campaigns?.[0]||null;
    stateReceivedAt=Date.now();
    render();
  }

  timer=setInterval(render,1000);
  render();
  return {setState,render,destroy(){clearInterval(timer);container.classList.remove('wisdo-v10-time-host');}};
}
