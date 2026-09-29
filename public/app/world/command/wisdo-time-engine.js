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

function minuteOf(value='00:00'){
  const [h,m]=String(value).split(':').map(Number);
  return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:0;
}

function esc(v=''){
  return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function markup(){
  return `<div class="wisdo-v10-time-engine" data-temporal-mode="standby" data-session-mode="disabled">
    <div class="wisdo-v10-time-head">
      <span>ADVANCED WISDO TIME</span>
      <div><b id="wcV10SessionBadge">NO SESSION</b><b id="wcV10TimeStatus">STANDBY</b></div>
    </div>
    <div class="wisdo-v10-time-core">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle class="track" cx="60" cy="60" r="50"></circle>
        <circle class="progress" id="wcV10TimeProgress" cx="60" cy="60" r="50"></circle>
      </svg>
      <div><strong id="wcV10TimeMain">00:00</strong><span id="wcV10TimeCaption">RESET REFERENCE</span><small id="wcV10TimeElapsed">ELAPSED —</small></div>
    </div>
    <div class="wisdo-v111-session-summary">
      <div><span>ACTIVE HOURS</span><b id="wcV111ActiveHours">NOT CONFIGURED</b></div>
      <div><span>BLOCKED HOURS</span><b id="wcV111BlockedHours">NOT CONFIGURED</b></div>
      <div><span>BOT ENFORCEMENT</span><b id="wcV111Enforcement">STANDBY</b></div>
    </div>
    <div class="wisdo-v111-session-rail" aria-label="24 hour WISDO trading session">
      <div class="wisdo-v111-session-track" id="wcV111SessionTrack"><i id="wcV111SessionNow"></i></div>
      <div class="wisdo-v111-session-labels"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
    </div>
    <div class="wisdo-v10-time-meta">
      <div><span>SESSION SYNC</span><b id="wcV10SessionSync">LOCAL / UTC</b></div>
      <div><span>RESUME RULE</span><b id="wcV10ResumeRule">SESSION BOUNDARY</b></div>
      <div><span>PAUSE WINDOW</span><b id="wcV10PauseWindow">02:00 RESET · REFERENCE</b></div>
      <div><span>NEXT TRIGGER</span><b id="wcV10NextTrigger">STANDBY</b></div>
      <div><span>SCHEDULE</span><b id="wcV10Schedule">NOT CONFIGURED</b></div>
      <div><span>ENFORCEMENT</span><b id="wcV10Enforcement">STANDBY</b></div>
    </div>
    <div class="wisdo-v10-clock-pair"><span>LOCAL <b id="wcV10LocalClock">--:--:--</b></span><span>UTC <b id="wcV10UtcClock">--:--:--</b></span></div>
    <div class="wisdo-v10-time-rail" aria-label="Two minute campaign reference rail">
      <div class="wisdo-v10-time-rail-line"><i id="wcV10RailMarker"></i></div>
      <div class="wisdo-v10-time-labels"><span>00:00</span><span>00:30</span><span>01:00</span><span>01:30</span><span>02:00</span></div>
    </div>
    <button id="wcV111Configure" class="wisdo-v111-time-configure" type="button">SESSION HOURS</button>
    <section id="wcV111Editor" class="wisdo-v111-session-editor" hidden>
      <div class="wisdo-v111-editor-head"><span>SERVER SESSION CONTROL</span><button id="wcV111EditorClose" type="button">×</button></div>
      <label>TIMEZONE<input id="wcV111Timezone" type="text" autocomplete="off"></label>
      <label>DAYS<select id="wcV111Days"><option value="weekdays">MON–FRI</option><option value="all">ALL DAYS</option></select></label>
      <div id="wcV111Windows" class="wisdo-v111-window-list"></div>
      <div class="wisdo-v111-editor-actions">
        <button id="wcV111AddWindow" type="button">+ WINDOW</button>
        <button id="wcV111Preview" type="button">PREVIEW HOURS</button>
        <button id="wcV111Disable" type="button">DISABLE</button>
      </div>
      <div id="wcV111ScheduleNotice" class="wisdo-v111-schedule-notice">Schedule changes do not touch MT4 until previewed and armed.</div>
      <div id="wcV111ArmWrap" class="wisdo-v111-arm-wrap" hidden>
        <strong id="wcV111ProposalText">READY TO ARM</strong>
        <button id="wcV111HoldArm" type="button"><i></i><span>HOLD TO ARM SERVER HOURS</span></button>
      </div>
    </section>
  </div>`;
}

export function createWisdoTimeEngine(container,{
  resetWindowSeconds=120,
  onVisualState=null,
  onPreviewSchedule=null,
  onArmSchedule=null,
  onDisableSchedule=null,
}={}){
  if(!container) return {setState(){},render(){},destroy(){}};
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
  let editorDirty=false;
  let proposal=null;
  let holdStart=0;
  let holdTimer=0;
  let arming=false;

  function scheduleState(){
    return state?.sessionSchedule||null;
  }

  function derived(){
    const control=state?.campaignControl||null;
    const session=scheduleState();
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
    const sessionRemaining=session?.secondsToBoundary!=null?Math.max(0,Number(session.secondsToBoundary)-age):null;
    return {control,session,live,paused,remaining,elapsed,sessionRemaining,progress:live&&paused&&rawRemaining>0?livePauseProgress:resetProgress};
  }

  function formatWindows(windows=[]){
    if(!windows.length)return 'NOT CONFIGURED';
    return windows.map((row)=>`${row.start}–${row.end}`).join(' · ');
  }

  function renderSessionRail(session){
    const track=q('#wcV111SessionTrack');
    if(!track)return;
    track.querySelectorAll('.wisdo-v111-active-window').forEach((node)=>node.remove());
    for(const row of session?.windows||[]){
      const start=minuteOf(row.start),end=minuteOf(row.end);
      const add=(from,to)=>{
        const span=document.createElement('span');
        span.className='wisdo-v111-active-window';
        span.style.left=`${(from/1440)*100}%`;
        span.style.width=`${((to-from)/1440)*100}%`;
        span.title=`${row.label||'ACTIVE'} · ${row.start}–${row.end}`;
        track.appendChild(span);
      };
      if(start<end)add(start,end); else {add(start,1440);add(0,end);}
    }
    const minute=Number(session?.localMinuteOfDay);
    q('#wcV111SessionNow').style.left=Number.isFinite(minute)?`${clamp(minute/1440,0,1)*100}%`:'0%';
  }

  function render(){
    const d=derived();
    const now=new Date();
    const session=d.session;
    q('#wcV10LocalClock').textContent=fmtClock(now,false);
    q('#wcV10UtcClock').textContent=fmtClock(now,true);
    q('#wcV10SessionSync').textContent=session?.timezone?`${session.timezone} / UTC`:'LOCAL / UTC';
    q('#wcV10TimeElapsed').textContent=d.elapsed==null?'ELAPSED —':`ELAPSED ${fmtDuration(d.elapsed)}`;
    renderSessionRail(session);

    const sessionEnabled=Boolean(session?.enabled&&session?.configured);
    const sessionMode=sessionEnabled?String(session.mode||'BLOCKED').toUpperCase():'DISABLED';
    root.dataset.sessionMode=sessionMode.toLowerCase();
    q('#wcV10SessionBadge').textContent=sessionEnabled?(sessionMode==='ACTIVE'?'ACTIVE HOURS':'BLOCKED HOURS'):'NO SESSION';
    q('#wcV111ActiveHours').textContent=formatWindows(session?.windows||[]);
    q('#wcV111BlockedHours').textContent=sessionEnabled?'ALL HOURS OUTSIDE ACTIVE WINDOWS':'NOT CONFIGURED';
    q('#wcV111Enforcement').textContent=session?.enforcementStatus||'STANDBY';

    if(sessionEnabled&&d.sessionRemaining!=null){
      root.dataset.temporalMode=sessionMode==='ACTIVE'?'session-active':'session-blocked';
      q('#wcV10TimeStatus').textContent=sessionMode==='ACTIVE'?'ACTIVE':'BLOCKED';
      q('#wcV10TimeMain').textContent=fmtDuration(d.sessionRemaining);
      q('#wcV10TimeCaption').textContent=sessionMode==='ACTIVE'?'ACTIVE HOURS LEFT':'BLOCKED HOURS LEFT';
      q('#wcV10NextTrigger').textContent=sessionMode==='ACTIVE'?'BLOCK NEW ENTRIES':'ALLOW NEW ENTRIES';
      q('#wcV10Schedule').textContent=formatWindows(session.windows);
      q('#wcV10Enforcement').textContent=session.enforcementStatus||'STANDBY';
      q('#wcV10ResumeRule').textContent='SESSION BOUNDARY';
      q('#wcV10PauseWindow').textContent=d.live&&d.paused&&d.remaining>0?fmtDuration(d.remaining):'EA MANAGED';
    }else if(d.live&&d.paused&&d.remaining>0){
      root.dataset.temporalMode='live';
      q('#wcV10TimeStatus').textContent='LIVE';
      q('#wcV10TimeMain').textContent=fmtDuration(d.remaining);
      q('#wcV10TimeCaption').textContent='LIVE PAUSE COUNTDOWN';
      q('#wcV10PauseWindow').textContent=fmtDuration(d.remaining);
      q('#wcV10NextTrigger').textContent='TIMER / EA EVENT';
      q('#wcV10Enforcement').textContent='LIVE';
      q('#wcV10Schedule').textContent='NOT CONFIGURED';
    }else if(d.live){
      root.dataset.temporalMode='smart';
      q('#wcV10TimeStatus').textContent='SMART ACTIVE';
      q('#wcV10TimeMain').textContent=d.elapsed==null?'00:00':fmtDuration(d.elapsed);
      q('#wcV10TimeCaption').textContent='CAMPAIGN ELAPSED';
      q('#wcV10PauseWindow').textContent='02:00 RESET · REFERENCE';
      q('#wcV10NextTrigger').textContent='EA / CAMPAIGN EVENT';
      q('#wcV10Enforcement').textContent='LIVE';
      q('#wcV10Schedule').textContent='NOT CONFIGURED';
    }else{
      root.dataset.temporalMode='standby';
      q('#wcV10TimeStatus').textContent='STANDBY';
      q('#wcV10TimeMain').textContent=d.elapsed==null?'02:00':fmtDuration(d.elapsed);
      q('#wcV10TimeCaption').textContent=d.elapsed==null?'RESET REFERENCE':'CAMPAIGN ELAPSED';
      q('#wcV10PauseWindow').textContent='02:00 RESET · REFERENCE';
      q('#wcV10NextTrigger').textContent='STANDBY';
      q('#wcV10Enforcement').textContent='STANDBY';
      q('#wcV10Schedule').textContent='NOT CONFIGURED';
    }

    const pct=sessionEnabled&&Number.isFinite(Number(session?.localMinuteOfDay))
      ? clamp(Number(session.localMinuteOfDay)/1440,0,1)
      : clamp(d.progress,0,1);
    progress.style.strokeDashoffset=String(circumference*(1-pct));
    q('#wcV10RailMarker').style.left=`${(clamp(d.progress,0,1)*100).toFixed(2)}%`;
    onVisualState?.({
      progress:pct,
      live:d.live,
      paused:d.paused,
      remaining:d.remaining,
      elapsed:d.elapsed,
      sessionMode,
      sessionRemaining:d.sessionRemaining,
      mode:root.dataset.temporalMode,
    });
  }

  function addWindowRow(row={}){
    const host=q('#wcV111Windows');
    if(host.children.length>=4)return;
    const node=document.createElement('div');
    node.className='wisdo-v111-window-row';
    node.innerHTML=`<input type="time" data-start value="${esc(row.start||'')}"><span>→</span><input type="time" data-end value="${esc(row.end||'')}"><button type="button" data-remove>×</button>`;
    node.querySelector('[data-remove]').addEventListener('click',()=>{node.remove();editorDirty=true;});
    node.querySelectorAll('input').forEach((input)=>input.addEventListener('input',()=>{editorDirty=true;proposal=null;q('#wcV111ArmWrap').hidden=true;}));
    host.appendChild(node);
  }

  function populateEditor(){
    if(editorDirty)return;
    const session=scheduleState();
    q('#wcV111Timezone').value=session?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
    const rows=session?.windows||[];
    const allDays=rows.length&&rows.every((row)=>(row.days||[]).length===7);
    q('#wcV111Days').value=allDays?'all':'weekdays';
    q('#wcV111Windows').innerHTML='';
    if(rows.length)rows.slice(0,4).forEach(addWindowRow); else addWindowRow({});
  }

  function scheduleFromEditor(){
    const days=q('#wcV111Days').value==='all'?[0,1,2,3,4,5,6]:[1,2,3,4,5];
    const windows=[...q('#wcV111Windows').children].map((row,index)=>({
      id:`window-${index+1}`,
      start:row.querySelector('[data-start]')?.value||'',
      end:row.querySelector('[data-end]')?.value||'',
      days,
      label:`ACTIVE WINDOW ${index+1}`,
    })).filter((row)=>row.start&&row.end&&row.start!==row.end);
    return {enabled:true,timezone:q('#wcV111Timezone').value||'UTC',windows,blockOutsideWindows:true};
  }

  function setNotice(text,tone=''){
    const node=q('#wcV111ScheduleNotice');
    node.textContent=text;
    node.dataset.tone=tone;
  }

  q('#wcV111Configure').addEventListener('click',()=>{
    populateEditor();
    q('#wcV111Editor').hidden=false;
  });
  q('#wcV111EditorClose').addEventListener('click',()=>{q('#wcV111Editor').hidden=true;});
  q('#wcV111AddWindow').addEventListener('click',()=>{addWindowRow({});editorDirty=true;});
  q('#wcV111Timezone').addEventListener('input',()=>{editorDirty=true;proposal=null;q('#wcV111ArmWrap').hidden=true;});
  q('#wcV111Days').addEventListener('change',()=>{editorDirty=true;proposal=null;q('#wcV111ArmWrap').hidden=true;});

  q('#wcV111Preview').addEventListener('click',async()=>{
    const schedule=scheduleFromEditor();
    if(!schedule.windows.length){setNotice('Add at least one complete start/end window.','error');return;}
    if(!onPreviewSchedule){setNotice('Schedule service is unavailable. Nothing sent.','error');return;}
    setNotice('Building server schedule preview…','working');
    try{
      proposal=await onPreviewSchedule(schedule);
      q('#wcV111ProposalText').textContent=`${schedule.windows.length} ACTIVE WINDOW${schedule.windows.length===1?'':'S'} · ${schedule.timezone}`;
      q('#wcV111ArmWrap').hidden=false;
      setNotice('Preview ready. Hold to arm recurring server enforcement.','ready');
    }catch(error){
      proposal=null;q('#wcV111ArmWrap').hidden=true;setNotice(error?.message||'Schedule preview failed. Nothing sent.','error');
    }
  });

  function clearHold(){
    clearInterval(holdTimer);holdTimer=0;holdStart=0;
    q('#wcV111HoldArm').style.setProperty('--hold-progress','0%');
  }

  async function completeHold(){
    if(arming||!proposal||!onArmSchedule)return;
    arming=true;
    const elapsed=Math.max(Number(proposal.holdRequiredMs||1200),performance.now()-holdStart);
    clearHold();
    setNotice('Arming server schedule…','working');
    try{
      await onArmSchedule(proposal,elapsed);
      editorDirty=false;proposal=null;q('#wcV111ArmWrap').hidden=true;
      setNotice('WISDO Time armed. Server will enforce active and blocked hours.','ready');
    }catch(error){setNotice(error?.message||'Schedule arm failed. Nothing changed.','error');}
    finally{arming=false;}
  }

  q('#wcV111HoldArm').addEventListener('pointerdown',(event)=>{
    if(!proposal||arming)return;
    event.preventDefault();q('#wcV111HoldArm').setPointerCapture?.(event.pointerId);
    holdStart=performance.now();
    const required=Number(proposal.holdRequiredMs||1200);
    holdTimer=setInterval(()=>{
      const elapsed=performance.now()-holdStart;
      q('#wcV111HoldArm').style.setProperty('--hold-progress',`${clamp(elapsed/required,0,1)*100}%`);
      if(elapsed>=required)completeHold();
    },40);
  });
  ['pointerup','pointercancel','pointerleave'].forEach((name)=>q('#wcV111HoldArm').addEventListener(name,()=>{if(holdStart&&!arming)clearHold();}));

  q('#wcV111Disable').addEventListener('click',async()=>{
    if(!onDisableSchedule){setNotice('Schedule service is unavailable.','error');return;}
    try{
      setNotice('Disabling server session enforcement…','working');
      await onDisableSchedule();
      editorDirty=false;proposal=null;q('#wcV111ArmWrap').hidden=true;
      setNotice('Session schedule disabled. Existing bot state was not automatically changed.','ready');
    }catch(error){setNotice(error?.message||'Could not disable the schedule.','error');}
  });

  function setState(next={},activeCampaign=null){
    state=next||{};
    campaign=activeCampaign||state?.campaigns?.[0]||null;
    stateReceivedAt=Date.now();
    populateEditor();
    render();
  }

  timer=setInterval(render,1000);
  populateEditor();
  render();
  return {setState,render,destroy(){clearInterval(timer);clearHold();container.classList.remove('wisdo-v10-time-host');}};
}
