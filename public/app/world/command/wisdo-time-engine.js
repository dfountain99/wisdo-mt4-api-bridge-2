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

function fmtDayMinute(value,{allow24=false}={}){
  let minute=Math.round(Number(value)||0);
  if(allow24&&minute===1440)return '24:00';
  minute=((minute%1440)+1440)%1440;
  return `${pad(Math.floor(minute/60))}:${pad(minute%60)}`;
}

function protocolMinute(value){
  const minute=Math.round(Number(value)||0);
  return minute>=1440?0:clamp(minute,0,1439);
}

function goalLabel(goal,paused=false){
  const id=Number(goal||0);
  if(id===1)return paused?'PAUSE TIMER':'PAUSE RULE';
  if(id===2)return 'AFTER COMPOUND → OPPOSITE CANDLE';
  if(id===3)return 'AFTER WIN → TIMED PAUSE';
  if(id===4)return 'WAITING FOR OPPOSITE CANDLE';
  if(id===6)return 'TIMED CAMPAIGN END';
  if(id===7||id===9)return 'POST-CAMPAIGN PAUSE';
  if(id===12)return 'SONIC WINDOW';
  if(id===8)return 'SONIC WINDOW COMPLETE';
  if(id===23)return '2-MIN SCALP WATCHDOG';
  if(id===24)return 'SCALP RESET → OPPOSITE CANDLE';
  return 'DIRECT CONTROL';
}

function resumeRule(goal){
  const id=Number(goal||0);
  if(id===2||id===4||id===24)return 'OPPOSITE CANDLE';
  if(id===23)return 'NEW ENTRY RESETS 02:00';
  if(id===1||id===3||id===6||id===7||id===9||id===12)return 'TIMER / EA RULE';
  return 'NOT CONFIGURED';
}

function windowPieces(startHour,endHour){
  const start=clamp(Number(startHour)||0,0,23),end=clamp(Number(endHour)||0,0,23);
  if(start===end)return [{start:0,end:24}];
  if(start<end)return [{start,end}];
  return [{start,end:24},{start:0,end}];
}

function minutePieces(startMinute,endMinute){
  const start=clamp(Number(startMinute)||0,0,1440),end=clamp(Number(endMinute)||0,0,1440);
  const s=start===1440?0:start,e=end===1440?1440:end;
  if(s===(e===1440?0:e))return [{start:0,end:1440}];
  if(s<e)return [{start:s,end:e}];
  return [{start:s,end:1440},{start:0,end:e}];
}

function brokerMinute(session,ageSeconds){
  if(!session?.reported)return null;
  const minute=(Number(session.brokerHour||0)*60)+Number(session.brokerMinute||0)+(ageSeconds/60);
  return ((minute%1440)+1440)%1440;
}

function sessionRanges(id){
  if(id===0)return [{start:23,end:24},{start:0,end:7}];
  if(id===1)return [{start:7,end:12}];
  if(id===2)return [{start:16,end:21}];
  if(id===3)return [{start:12,end:16}];
  if(id===4)return [{start:21,end:23}];
  return [];
}

function markup(){
  return `<div class="wisdo-v10-time-engine wisdo-v12-time-engine" data-temporal-mode="standby">
    <div class="wisdo-v10-time-head"><span>WISDO TIME / SESSION CONTROL</span><b id="wcV10TimeStatus">STANDBY</b></div>
    <div class="wisdo-v12-time-layout">
      <button type="button" class="wisdo-v10-time-core" id="wcV10ScalpArm" aria-label="Hold for two seconds to arm the two-minute scalp game plan" data-arm-state="idle">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="track" cx="60" cy="60" r="50"></circle>
          <circle class="progress" id="wcV10TimeProgress" cx="60" cy="60" r="50"></circle>
          <circle class="arm-progress" id="wcV10ArmProgress" cx="60" cy="60" r="54"></circle>
        </svg>
        <div><strong id="wcV10TimeMain">02:00</strong><span id="wcV10TimeCaption">RESET REFERENCE</span><small id="wcV10TimeElapsed">ELAPSED —</small></div>
        <em id="wcV10ArmHint">HOLD 2.0s · ARM SCALP</em>
      </button>
      <div class="wisdo-v12-session-core">
        <div class="wisdo-v12-session-cards">
          <section><span>CURRENT SESSION</span><strong id="wcV12SessionName">EA SESSION NOT REPORTED</strong><small id="wcV12SessionQuality">CHRONOS TELEMETRY REQUIRED</small></section>
          <section><span>ENTRY GATE</span><strong id="wcV12EntryGate">UNKNOWN</strong><small id="wcV12WindowMode">SCHEDULE NOT REPORTED</small></section>
          <section><span>NEXT TRIGGER</span><strong id="wcV10NextTrigger">STANDBY</strong><small id="wcV10ResumeRule">NOT CONFIGURED</small></section>
        </div>
        <div class="wisdo-v12-day-labels"><span>00</span><span>03</span><span>06</span><span>09</span><span>12</span><span>15</span><span>18</span><span>21</span><span>24</span></div>
        <div class="wisdo-v12-day-track" id="wcV12DayTrack">
          <div class="wisdo-v12-blocked-base"></div>
          <div id="wcV12ActiveWindows"></div>
          <div id="wcV12SchedulePreview"></div>
          <div id="wcV12SessionBands"></div>
          <i id="wcV12NowMarker"></i>
        </div>
        <div class="wisdo-v12-day-legend"><span class="active">ACTIVE HOURS · BOT ALLOWS NEW ENTRIES</span><span class="blocked">BLOCKED HOURS · MANAGE ONLY</span></div>
        <section class="wisdo-v12-schedule-editor" id="wcV12ScheduleEditor" aria-label="Trading schedule controls">
          <div class="wisdo-v12-schedule-head"><div><span>BOT TRADING SCHEDULE</span><strong>Broker-clock active windows</strong></div><b id="wcV12ScheduleSource">EA INPUTS</b></div>
          <div class="wisdo-v12-schedule-presets" role="group" aria-label="Schedule mode">
            <button type="button" data-schedule-mode="0">ALL HOURS</button>
            <button type="button" data-schedule-mode="1">LONDON → NY</button>
            <button type="button" data-schedule-mode="2">CUSTOM</button>
          </div>
          <div class="wisdo-v12-window-editor" id="wcV12CustomSchedule">
            <article>
              <header><span>WINDOW 1</span><b id="wcV12W1Label">07:00 → 12:00</b></header>
              <label><span>START</span><input id="wcV12W1Start" type="range" min="0" max="1440" step="15" value="420"></label>
              <label><span>END</span><input id="wcV12W1End" type="range" min="0" max="1440" step="15" value="720"></label>
            </article>
            <article>
              <header><label class="wisdo-v12-window-toggle"><input id="wcV12W2Enabled" type="checkbox" checked><span>WINDOW 2</span></label><b id="wcV12W2Label">13:00 → 16:00</b></header>
              <label><span>START</span><input id="wcV12W2Start" type="range" min="0" max="1440" step="15" value="780"></label>
              <label><span>END</span><input id="wcV12W2End" type="range" min="0" max="1440" step="15" value="960"></label>
            </article>
          </div>
          <div class="wisdo-v12-schedule-actions">
            <button type="button" id="wcV12ApplySchedule" class="primary" data-hold-state="idle">HOLD 2.0s · APPLY SCHEDULE</button>
            <button type="button" id="wcV12RestoreSchedule" data-hold-state="idle">HOLD 2.0s · USE EA DEFAULT</button>
          </div>
          <small id="wcV12ScheduleHint">Move the sliders to preview active/blocked hours. Nothing changes in MT4 until the hold completes.</small>
        </section>
      </div>
    </div>
    <div class="wisdo-v10-time-meta">
      <div><span>SESSION SYNC</span><b id="wcV10SessionSync">LOCAL / UTC</b></div>
      <div><span>BROKER TIME</span><b id="wcV12BrokerClock">NOT REPORTED</b></div>
      <div><span>PAUSE WINDOW</span><b id="wcV10PauseWindow">02:00 RESET · REFERENCE</b></div>
      <div><span>SCHEDULE</span><b id="wcV10Schedule">NOT CONFIGURED</b></div>
      <div><span>ENFORCEMENT</span><b id="wcV10Enforcement">STANDBY</b></div>
      <div><span>PROTOCOL</span><b id="wcV12Protocol">DIRECT CONTROL</b></div>
    </div>
    <div class="wisdo-v10-clock-pair"><span>LOCAL <b id="wcV10LocalClock">--:--:--</b></span><span>UTC <b id="wcV10UtcClock">--:--:--</b></span></div>
    <div class="wisdo-v10-time-rail" aria-label="Two minute reset reference">
      <div class="wisdo-v10-time-rail-line"><i id="wcV10RailMarker"></i></div>
      <div class="wisdo-v10-time-labels"><span>00:00</span><span>00:30</span><span>01:00</span><span>01:30</span><span>02:00</span></div>
    </div>
  </div>`;
}

export function createWisdoTimeEngine(container,{resetWindowSeconds=120,scalpHoldMs=2000,scheduleHoldMs=2000,onScalpHold=null,onScheduleHold=null,onVisualState=null}={}){
  if(!container)return {setState(){},render(){},destroy(){}};
  container.classList.add('wisdo-v10-time-host','wisdo-v12-time-host');
  container.innerHTML=markup();
  const q=(id)=>container.querySelector(id);
  const root=container.querySelector('.wisdo-v10-time-engine');
  const circumference=2*Math.PI*50;
  const progress=q('#wcV10TimeProgress');
  const armProgress=q('#wcV10ArmProgress');
  const armButton=q('#wcV10ScalpArm');
  const holdRequiredMs=Math.max(1800,Number(scalpHoldMs)||2000);
  const scheduleHoldRequiredMs=Math.max(1800,Number(scheduleHoldMs)||2000);
  progress.style.strokeDasharray=String(circumference);
  armProgress.style.strokeDasharray=String(2*Math.PI*54);
  armProgress.style.strokeDashoffset=String(2*Math.PI*54);

  let state=null,campaign=null,stateReceivedAt=Date.now(),timer=0;
  let armStartedAt=0,armTimer=0,armPointer=null,armBusy=false,armPreparation=null,armCooldownUntil=0;
  let scheduleDraft={mode:0,windowCount:1,w1Start:0,w1End:0,w2Start:0,w2End:0};
  let scheduleDirty=false,scheduleBusy=false,scheduleHoldStartedAt=0,scheduleHoldTimer=0,scheduleHoldPointer=null,schedulePreparation=null,scheduleHoldAction='set',scheduleCooldownUntil=0;

  function derived(){
    const control=state?.campaignControl||null;
    const now=Date.now(),age=Math.max(0,(now-stateReceivedAt)/1000);
    const live=Boolean(control?.live),paused=Boolean(control?.paused);
    const rawRemaining=Number(control?.remainingSeconds||0);
    const remaining=live&&rawRemaining>0?Math.max(0,rawRemaining-age):0;
    const created=Date.parse(campaign?.createdAt||'');
    const elapsed=Number.isFinite(created)?Math.max(0,(now-created)/1000):null;
    const resetProgress=elapsed==null?0:(elapsed%resetWindowSeconds)/resetWindowSeconds;
    const livePauseProgress=rawRemaining>0?clamp(remaining/Math.max(1,rawRemaining),0,1):0;
    const session=control?.session||null;
    const goal=Number(control?.goal||0),phase=Number(control?.phase||0);
    const scalpActive=live&&goal===23&&phase===1;
    const scalpReset=live&&goal===24;
    const scalpProgress=scalpReset?1:scalpActive&&rawRemaining>0?clamp(1-(remaining/resetWindowSeconds),0,1):0;
    const visualProgress=(scalpActive||scalpReset)?scalpProgress:(live&&paused&&rawRemaining>0?livePauseProgress:resetProgress);
    return {control,session,live,paused,remaining,elapsed,age,goal,phase,scalpActive,scalpReset,progress:visualProgress};
  }

  function renderWindows(d){
    const activeHost=q('#wcV12ActiveWindows'),bands=q('#wcV12SessionBands'),track=q('#wcV12DayTrack');
    if(!activeHost||!bands||!track)return;
    activeHost.innerHTML=''; bands.innerHTML='';
    const session=d.session;
    const reported=Boolean(d.live&&session?.reported);
    track.dataset.telemetry=reported?'reported':'missing';
    if(reported){
      const windows=Array.isArray(session.windows)?session.windows:[];
      const pieces=session.windowMode===0?[{start:0,end:1440}]:windows.flatMap((w)=>minutePieces(Number.isFinite(w.startMinute)?w.startMinute:(w.startHour*60),Number.isFinite(w.endMinute)?w.endMinute:(w.endHour*60)));
      activeHost.innerHTML=pieces.map((p)=>`<span class="wisdo-v12-active-window" style="left:${(p.start/1440)*100}%;width:${((p.end-p.start)/1440)*100}%"></span>`).join('');
      bands.innerHTML=sessionRanges(Number(session.id)).map((p)=>`<span class="wisdo-v12-session-band" style="left:${(p.start/24)*100}%;width:${((p.end-p.start)/24)*100}%"></span>`).join('');
      const minute=brokerMinute(session,d.age);
      if(minute!=null)q('#wcV12NowMarker').style.left=`${(minute/1440)*100}%`;
      q('#wcV12NowMarker').hidden=false;
    }else{
      q('#wcV12NowMarker').hidden=true;
    }
    renderSchedulePreview();
  }

  function render(){
    const d=derived(),now=new Date(),session=d.session,sessionReported=Boolean(d.live&&session?.reported);
    q('#wcV10LocalClock').textContent=fmtClock(now,false);
    q('#wcV10UtcClock').textContent=fmtClock(now,true);
    q('#wcV10TimeElapsed').textContent=d.elapsed==null?'ELAPSED —':`ELAPSED ${fmtDuration(d.elapsed)}`;
    q('#wcV12Protocol').textContent=goalLabel(d.control?.goal,d.paused);

    if(d.scalpReset){
      root.dataset.temporalMode='scalp-wait';
      q('#wcV10TimeStatus').textContent='SCALP RESET';
      q('#wcV10TimeMain').textContent='00:00';
      q('#wcV10TimeCaption').textContent='WAIT OPPOSITE CANDLE';
      q('#wcV10PauseWindow').textContent='ENTRIES BLOCKED · COLLECTING';
    }else if(d.scalpActive){
      root.dataset.temporalMode='scalp';
      q('#wcV10TimeStatus').textContent='SCALP ACTIVE';
      q('#wcV10TimeMain').textContent=fmtDuration(d.remaining);
      q('#wcV10TimeCaption').textContent='NO-ENTRY COUNTDOWN';
      q('#wcV10PauseWindow').textContent=`${fmtDuration(d.remaining)} · RESET ON ENTRY`;
    }else if(d.live&&d.goal===23){
      root.dataset.temporalMode='scalp-ready';
      q('#wcV10TimeStatus').textContent='SCALP ARMED';
      q('#wcV10TimeMain').textContent='02:00';
      q('#wcV10TimeCaption').textContent='WAIT NEXT VALID ENTRY';
      q('#wcV10PauseWindow').textContent='02:00 STARTS ON ENTRY';
    }else if(d.live&&d.paused&&d.remaining>0){
      root.dataset.temporalMode='live';
      q('#wcV10TimeStatus').textContent='LIVE PAUSE';
      q('#wcV10TimeMain').textContent=fmtDuration(d.remaining);
      q('#wcV10TimeCaption').textContent='EA COUNTDOWN';
      q('#wcV10PauseWindow').textContent=fmtDuration(d.remaining);
    }else if(d.live){
      root.dataset.temporalMode='smart';
      q('#wcV10TimeStatus').textContent='EA LIVE';
      q('#wcV10TimeMain').textContent=d.elapsed==null?'02:00':fmtDuration(d.elapsed);
      q('#wcV10TimeCaption').textContent=d.elapsed==null?'RESET REFERENCE':'CAMPAIGN ELAPSED';
      q('#wcV10PauseWindow').textContent=d.remaining>0?fmtDuration(d.remaining):'02:00 RESET · REFERENCE';
    }else{
      root.dataset.temporalMode='standby';
      q('#wcV10TimeStatus').textContent='STANDBY';
      q('#wcV10TimeMain').textContent=d.elapsed==null?'02:00':fmtDuration(d.elapsed);
      q('#wcV10TimeCaption').textContent=d.elapsed==null?'RESET REFERENCE':'CAMPAIGN ELAPSED';
      q('#wcV10PauseWindow').textContent='02:00 RESET · REFERENCE';
    }

    q('#wcV10NextTrigger').textContent=d.live?goalLabel(d.control?.goal,d.paused):'STANDBY';
    q('#wcV10ResumeRule').textContent=d.live?resumeRule(d.control?.goal):'NOT CONFIGURED';

    if(sessionReported){
      const broker=brokerMinute(session,d.age);
      const brokerHour=Math.floor((broker||0)/60),brokerMin=Math.floor((broker||0)%60);
      q('#wcV10SessionSync').textContent='EA / BROKER CLOCK';
      q('#wcV12BrokerClock').textContent=`${pad(brokerHour)}:${pad(brokerMin)}`;
      q('#wcV12SessionName').textContent=session.name||'OTHER';
      q('#wcV12SessionQuality').textContent=`CHRONOS QUALITY ${Number(session.quality||0).toFixed(2)}`;
      q('#wcV12EntryGate').textContent=session.entryAllowed?'TRADING ACTIVE':'NEW ENTRIES BLOCKED';
      q('#wcV12EntryGate').className=session.entryAllowed?'allow':'block';
      q('#wcV12WindowMode').textContent=session.windowMode===0?'ALL MARKET HOURS':session.windowMode===1?'LONDON + NEW YORK':session.scheduleOverride?'CUSTOM WISDO WINDOWS':'CUSTOM EA WINDOWS';
      const scheduleText=session.windowMode===0?'ALL HOURS':session.windowMode===1?'07:00–21:00 BROKER':(session.windows||[]).map(w=>`${fmtDayMinute(w.startMinute??w.startHour*60)}–${fmtDayMinute(w.endMinute??w.endHour*60)}`).join(' + ');
      q('#wcV10Schedule').textContent=scheduleText||'CUSTOM WINDOWS';
      q('#wcV10Enforcement').textContent=session.scheduleEnforced?(session.windowAllowed?'WINDOW OPEN':'WINDOW BLOCKED'):'ALL HOURS';
      q('#wcV12ScheduleSource').textContent=session.scheduleOverride?'WISDO OVERRIDE':'EA INPUTS';
    }else{
      q('#wcV10SessionSync').textContent=d.live?'EA SESSION NOT REPORTED':'LOCAL / UTC';
      q('#wcV12BrokerClock').textContent='NOT REPORTED';
      q('#wcV12SessionName').textContent='EA SESSION NOT REPORTED';
      q('#wcV12SessionQuality').textContent='UPDATE HIGHTOWER + REPORTER FOR CHRONOS';
      q('#wcV12EntryGate').textContent='UNKNOWN';
      q('#wcV12EntryGate').className='';
      q('#wcV12WindowMode').textContent='SCHEDULE NOT REPORTED';
      q('#wcV10Schedule').textContent='NOT CONFIGURED';
      q('#wcV10Enforcement').textContent=d.live?'SESSION TELEMETRY MISSING':'STANDBY';
      q('#wcV12ScheduleSource').textContent='NO TELEMETRY';
    }

    renderWindows(d);
    const pct=clamp(d.progress,0,1);
    progress.style.strokeDashoffset=String(circumference*(1-pct));
    q('#wcV10RailMarker').style.left=`${(pct*100).toFixed(2)}%`;
    updateArmUi(d);updateScheduleHoldUi(d);
    onVisualState?.({progress:pct,live:d.live,paused:d.paused,remaining:d.remaining,elapsed:d.elapsed,session:d.session,scalpActive:d.scalpActive,scalpReset:d.scalpReset,mode:root.dataset.temporalMode});
  }

  function scheduleFromSession(session){
    if(!session?.reported)return null;
    const windows=Array.isArray(session.windows)?session.windows:[];
    const w1=windows[0]||{},w2=windows[1]||{};
    return {
      mode:Number(session.windowMode||0),
      windowCount:Number(session.windowMode)===2?Math.max(1,Math.min(2,Number(session.windowCount||windows.length||1))):1,
      w1Start:Number.isFinite(w1.startMinute)?w1.startMinute:Number(w1.startHour||0)*60,
      w1End:Number.isFinite(w1.endMinute)?w1.endMinute:Number(w1.endHour||0)*60,
      w2Start:Number.isFinite(w2.startMinute)?w2.startMinute:Number(w2.startHour||0)*60,
      w2End:Number.isFinite(w2.endMinute)?w2.endMinute:Number(w2.endHour||0)*60,
    };
  }

  function syncScheduleControls(){
    q('#wcV12W1Start').value=String(scheduleDraft.w1Start);
    q('#wcV12W1End').value=String(scheduleDraft.w1End===0&&scheduleDraft.mode===2?1440:scheduleDraft.w1End);
    q('#wcV12W2Start').value=String(scheduleDraft.w2Start);
    q('#wcV12W2End').value=String(scheduleDraft.w2End===0&&scheduleDraft.mode===2?1440:scheduleDraft.w2End);
    q('#wcV12W2Enabled').checked=scheduleDraft.windowCount>1;
    q('#wcV12CustomSchedule').hidden=scheduleDraft.mode!==2;
    container.querySelectorAll('[data-schedule-mode]').forEach((button)=>button.dataset.active=Number(button.dataset.scheduleMode)===scheduleDraft.mode?'true':'false');
    updateScheduleLabels();
  }

  function updateScheduleLabels(){
    q('#wcV12W1Label').textContent=`${fmtDayMinute(q('#wcV12W1Start').value,{allow24:true})} → ${fmtDayMinute(q('#wcV12W1End').value,{allow24:true})}`;
    q('#wcV12W2Label').textContent=`${fmtDayMinute(q('#wcV12W2Start').value,{allow24:true})} → ${fmtDayMinute(q('#wcV12W2End').value,{allow24:true})}`;
    const enabled=q('#wcV12W2Enabled').checked;
    q('#wcV12W2Start').disabled=!enabled;q('#wcV12W2End').disabled=!enabled;
  }

  function readScheduleDraft(){
    scheduleDraft={
      mode:Number(scheduleDraft.mode||0),
      windowCount:q('#wcV12W2Enabled').checked?2:1,
      w1Start:protocolMinute(q('#wcV12W1Start').value),
      w1End:protocolMinute(q('#wcV12W1End').value),
      w2Start:protocolMinute(q('#wcV12W2Start').value),
      w2End:protocolMinute(q('#wcV12W2End').value),
    };
    return scheduleDraft;
  }

  function schedulePayload(){
    const draft=readScheduleDraft();
    if(draft.mode===2){
      if(draft.w1Start===draft.w1End)throw new Error('Window 1 needs different start and end times.');
      if(draft.windowCount===2&&draft.w2Start===draft.w2End)throw new Error('Window 2 needs different start and end times.');
    }
    return {
      scheduleMode:draft.mode,
      scheduleWindowCount:draft.mode===2?draft.windowCount:1,
      window1StartMinute:draft.mode===1?420:draft.mode===0?0:draft.w1Start,
      window1EndMinute:draft.mode===1?1260:draft.mode===0?0:draft.w1End,
      window2StartMinute:draft.mode===2&&draft.windowCount===2?draft.w2Start:0,
      window2EndMinute:draft.mode===2&&draft.windowCount===2?draft.w2End:0,
    };
  }

  function renderSchedulePreview(){
    const host=q('#wcV12SchedulePreview');if(!host)return;
    if(!scheduleDirty){host.innerHTML='';host.hidden=true;return;}
    host.hidden=false;
    let pieces=[];
    if(scheduleDraft.mode===0)pieces=[{start:0,end:1440}];
    else if(scheduleDraft.mode===1)pieces=minutePieces(420,1260);
    else {
      pieces=minutePieces(scheduleDraft.w1Start,scheduleDraft.w1End);
      if(scheduleDraft.windowCount>1)pieces.push(...minutePieces(scheduleDraft.w2Start,scheduleDraft.w2End));
    }
    host.innerHTML=pieces.map((p)=>`<span class="wisdo-v12-schedule-preview-window" style="left:${(p.start/1440)*100}%;width:${((p.end-p.start)/1440)*100}%"></span>`).join('');
  }

  function markScheduleDirty(){
    readScheduleDraft();scheduleDirty=true;updateScheduleLabels();renderSchedulePreview();updateScheduleHoldUi();
    q('#wcV12ScheduleHint').textContent='PREVIEW ONLY · hold APPLY to send this broker-time schedule to HIGHTOWER.';
  }

  function canSchedule(d=derived()){
    const pending=Number(d.control?.pendingId||0),ack=Number(d.control?.ackId||0);
    return Boolean(Date.now()>=scheduleCooldownUntil&&d.live&&(!pending||pending===ack)&&typeof onScheduleHold==='function');
  }

  function updateScheduleHoldUi(d=derived()){
    const apply=q('#wcV12ApplySchedule'),restore=q('#wcV12RestoreSchedule');
    if(!apply||scheduleBusy||scheduleHoldStartedAt)return;
    const available=canSchedule(d);
    apply.disabled=!available;restore.disabled=!available;
    apply.dataset.holdState=available?'idle':'unavailable';restore.dataset.holdState=available?'idle':'unavailable';
    apply.textContent=available?`HOLD ${(scheduleHoldRequiredMs/1000).toFixed(1)}s · APPLY SCHEDULE`:'SCHEDULE CONTROL UNAVAILABLE';
    restore.textContent=available?`HOLD ${(scheduleHoldRequiredMs/1000).toFixed(1)}s · USE EA DEFAULT`:'EA DEFAULT UNAVAILABLE';
  }

  function resetScheduleHoldVisual(){
    clearInterval(scheduleHoldTimer);scheduleHoldTimer=0;scheduleHoldStartedAt=0;scheduleHoldPointer=null;schedulePreparation=null;
    const button=scheduleHoldAction==='clear'?q('#wcV12RestoreSchedule'):q('#wcV12ApplySchedule');
    if(button)button.style.setProperty('--hold-progress','0%');
  }

  function cancelScheduleHold(reason='released'){
    if(!scheduleHoldStartedAt)return;
    const action=scheduleHoldAction;resetScheduleHoldVisual();
    Promise.resolve(onScheduleHold?.({phase:'cancel',action,reason,holdRequiredMs:scheduleHoldRequiredMs})).catch(()=>undefined);
    q('#wcV12ScheduleHint').textContent='Schedule hold cancelled. Nothing was sent to HIGHTOWER.';
    updateScheduleHoldUi();
  }

  async function completeScheduleHold(){
    if(!scheduleHoldStartedAt||scheduleBusy)return;
    const heldForMs=Math.max(0,performance.now()-scheduleHoldStartedAt);
    if(heldForMs<scheduleHoldRequiredMs){cancelScheduleHold('released_early');return;}
    const action=scheduleHoldAction,prepared=schedulePreparation;
    clearInterval(scheduleHoldTimer);scheduleHoldTimer=0;scheduleHoldStartedAt=0;scheduleHoldPointer=null;scheduleBusy=true;
    const button=action==='clear'?q('#wcV12RestoreSchedule'):q('#wcV12ApplySchedule');
    button.dataset.holdState='sending';button.textContent=action==='clear'?'RESTORING EA SCHEDULE…':'APPLYING SCHEDULE…';
    try{
      const resolved=await prepared;
      await onScheduleHold?.({phase:'complete',action,schedule:action==='set'?schedulePayload():null,prepared:resolved,heldForMs:Math.round(heldForMs),holdRequiredMs:scheduleHoldRequiredMs});
      scheduleCooldownUntil=Date.now()+12000;scheduleDirty=false;
      q('#wcV12ScheduleHint').textContent=action==='clear'?'EA schedule restore sent. Waiting for Reporter confirmation.':'Schedule sent. Waiting for Reporter confirmation.';
    }catch(error){
      button.dataset.holdState='blocked';
      q('#wcV12ScheduleHint').textContent=`BLOCKED · ${String(error?.message||'schedule command failed').slice(0,110)}`;
    }finally{
      schedulePreparation=null;scheduleBusy=false;
      setTimeout(()=>updateScheduleHoldUi(),700);
    }
  }

  function beginScheduleHold(action,pointerId=null){
    const d=derived();if(scheduleBusy||scheduleHoldStartedAt||!canSchedule(d))return;
    let payload=null;
    if(action==='set'){
      try{payload=schedulePayload();}catch(error){q('#wcV12ScheduleHint').textContent=error.message;return;}
    }
    scheduleHoldAction=action;scheduleHoldPointer=pointerId;scheduleHoldStartedAt=performance.now();
    const button=action==='clear'?q('#wcV12RestoreSchedule'):q('#wcV12ApplySchedule');
    button.dataset.holdState='holding';
    schedulePreparation=Promise.resolve().then(()=>onScheduleHold({phase:'start',action,schedule:payload,holdRequiredMs:scheduleHoldRequiredMs}));
    schedulePreparation.catch(()=>undefined);
    scheduleHoldTimer=setInterval(()=>{
      if(!scheduleHoldStartedAt)return;
      const ratio=clamp((performance.now()-scheduleHoldStartedAt)/scheduleHoldRequiredMs,0,1);
      button.style.setProperty('--hold-progress',`${(ratio*100).toFixed(1)}%`);
      button.textContent=ratio>=1?'ACTIVATING…':`KEEP HOLDING · ${Math.max(0,(scheduleHoldRequiredMs-(performance.now()-scheduleHoldStartedAt))/1000).toFixed(1)}s`;
      if(ratio>=1)void completeScheduleHold();
    },30);
  }

  function bindScheduleHold(button,action){
    button.oncontextmenu=(event)=>event.preventDefault();
    button.onpointerdown=(event)=>{if(!canSchedule())return;event.preventDefault();button.setPointerCapture?.(event.pointerId);beginScheduleHold(action,event.pointerId);};
    button.onpointerup=(event)=>{if(scheduleHoldPointer!==null&&event.pointerId!==scheduleHoldPointer)return;if(scheduleHoldStartedAt){const elapsed=performance.now()-scheduleHoldStartedAt;elapsed>=scheduleHoldRequiredMs?void completeScheduleHold():cancelScheduleHold('released_early');}};
    button.onpointercancel=()=>cancelScheduleHold('pointer_cancelled');
    button.onkeydown=(event)=>{if(![' ','Enter'].includes(event.key)||event.repeat)return;event.preventDefault();beginScheduleHold(action,null);};
    button.onkeyup=(event)=>{if(![' ','Enter'].includes(event.key)||!scheduleHoldStartedAt)return;event.preventDefault();const elapsed=performance.now()-scheduleHoldStartedAt;elapsed>=scheduleHoldRequiredMs?void completeScheduleHold():cancelScheduleHold('released_early');};
    button.onblur=()=>{if(scheduleHoldStartedAt)cancelScheduleHold('focus_lost');};
  }

  container.querySelectorAll('[data-schedule-mode]').forEach((button)=>button.addEventListener('click',()=>{
    scheduleDraft.mode=Number(button.dataset.scheduleMode);scheduleDirty=true;syncScheduleControls();renderSchedulePreview();updateScheduleHoldUi();
    q('#wcV12ScheduleHint').textContent='PREVIEW ONLY · hold APPLY to send this broker-time schedule to HIGHTOWER.';
  }));
  for(const id of ['#wcV12W1Start','#wcV12W1End','#wcV12W2Start','#wcV12W2End'])q(id).addEventListener('input',markScheduleDirty);
  q('#wcV12W2Enabled').addEventListener('change',markScheduleDirty);
  bindScheduleHold(q('#wcV12ApplySchedule'),'set');bindScheduleHold(q('#wcV12RestoreSchedule'),'clear');

  function canArmScalp(d=derived()){
    const pending=Number(d.control?.pendingId||0),ack=Number(d.control?.ackId||0);
    return Boolean(Date.now()>=armCooldownUntil&&d.live&&d.phase===1&&d.goal!==23&&d.goal!==24&&(!pending||pending===ack)&&typeof onScalpHold==='function');
  }

  function updateArmUi(d=derived()){
    if(!armButton||armStartedAt||armBusy)return;
    const hint=q('#wcV10ArmHint');
    if(d.goal===23&&d.phase===1){armButton.dataset.armState='active';hint.textContent='2-MIN SCALP ACTIVE · ENTRY RESETS 02:00';armButton.setAttribute('aria-disabled','true');}
    else if(d.goal===24){armButton.dataset.armState='waiting';hint.textContent='WAITING FOR OPPOSITE CANDLE';armButton.setAttribute('aria-disabled','true');}
    else if(d.goal===23){armButton.dataset.armState='ready';hint.textContent='SCALP ARMED · WAIT NEXT VALID ENTRY';armButton.setAttribute('aria-disabled','true');}
    else if(Date.now()<armCooldownUntil){armButton.dataset.armState='sending';hint.textContent='COMMAND SENT · WAITING FOR EA';armButton.setAttribute('aria-disabled','true');}
    else if(canArmScalp(d)){armButton.dataset.armState='idle';hint.textContent=`HOLD ${(holdRequiredMs/1000).toFixed(1)}s · ARM 2-MIN SCALP`;armButton.setAttribute('aria-disabled','false');}
    else{armButton.dataset.armState='unavailable';hint.textContent='LIVE CAMPAIGN REQUIRED TO ARM';armButton.setAttribute('aria-disabled','true');}
  }

  function resetArmVisual(){
    clearInterval(armTimer);armTimer=0;armStartedAt=0;armPointer=null;
    armProgress.style.strokeDashoffset=String(2*Math.PI*54);
  }

  function cancelArm(reason='released'){
    if(!armStartedAt)return;
    resetArmVisual();
    armPreparation?.catch(()=>undefined);
    Promise.resolve(onScalpHold?.({phase:'cancel',reason,windowSeconds:resetWindowSeconds,holdRequiredMs})).catch(()=>undefined);
    armPreparation=null;
    render();
  }

  async function completeArm(){
    if(!armStartedAt||armBusy)return;
    const heldForMs=Math.max(0,performance.now()-armStartedAt);
    if(heldForMs<holdRequiredMs){cancelArm('released_early');return;}
    clearInterval(armTimer);armTimer=0;armStartedAt=0;armPointer=null;armBusy=true;
    armButton.dataset.armState='sending';q('#wcV10ArmHint').textContent='ARMING SCALP WATCHDOG…';
    armProgress.style.strokeDashoffset='0';
    try{
      const prepared=await armPreparation;
      await onScalpHold?.({phase:'complete',prepared,heldForMs:Math.round(heldForMs),windowSeconds:resetWindowSeconds,holdRequiredMs});
      armCooldownUntil=Date.now()+15000;
      q('#wcV10ArmHint').textContent='COMMAND SENT · WAITING FOR EA';
    }catch(error){
      armButton.dataset.armState='blocked';
      q('#wcV10ArmHint').textContent=`BLOCKED · ${String(error?.message||'COMMAND FAILED').slice(0,90).toUpperCase()}`;
    }finally{
      armPreparation=null;armBusy=false;
      setTimeout(()=>render(),700);
    }
  }

  function beginArm(pointerId=null){
    const d=derived();
    if(armBusy||armStartedAt||!canArmScalp(d))return;
    armPointer=pointerId;armStartedAt=performance.now();
    armButton.dataset.armState='holding';q('#wcV10ArmHint').textContent='KEEP HOLDING · ARMING 2-MIN SCALP';
    armPreparation=Promise.resolve().then(()=>onScalpHold({phase:'start',windowSeconds:resetWindowSeconds,holdRequiredMs}));
    armPreparation.catch(()=>undefined);
    const armCirc=2*Math.PI*54;
    armTimer=setInterval(()=>{
      if(!armStartedAt)return;
      const ratio=clamp((performance.now()-armStartedAt)/holdRequiredMs,0,1);
      armProgress.style.strokeDashoffset=String(armCirc*(1-ratio));
      q('#wcV10ArmHint').textContent=ratio>=1?'ACTIVATING…':`HOLD ${Math.max(0,(holdRequiredMs-(performance.now()-armStartedAt))/1000).toFixed(1)}s`;
      if(ratio>=1)void completeArm();
    },30);
  }

  armButton.oncontextmenu=(event)=>event.preventDefault();
  armButton.onpointerdown=(event)=>{if(!canArmScalp())return;event.preventDefault();armButton.setPointerCapture?.(event.pointerId);beginArm(event.pointerId);};
  armButton.onpointerup=(event)=>{if(armPointer!==null&&event.pointerId!==armPointer)return;if(armStartedAt){const elapsed=performance.now()-armStartedAt;elapsed>=holdRequiredMs?void completeArm():cancelArm('released_early');}};
  armButton.onpointercancel=()=>cancelArm('pointer_cancelled');
  armButton.onkeydown=(event)=>{if(![' ','Enter'].includes(event.key)||event.repeat)return;event.preventDefault();beginArm(null);};
  armButton.onkeyup=(event)=>{if(![' ','Enter'].includes(event.key)||!armStartedAt)return;event.preventDefault();const elapsed=performance.now()-armStartedAt;elapsed>=holdRequiredMs?void completeArm():cancelArm('released_early');};
  armButton.onblur=()=>{if(armStartedAt)cancelArm('focus_lost');};

  function setState(next={},activeCampaign=null){
    state=next||{};
    campaign=activeCampaign||state?.campaigns?.[0]||null;
    if([23,24].includes(Number(state?.campaignControl?.goal||0)))armCooldownUntil=0;
    const liveSchedule=scheduleFromSession(state?.campaignControl?.session);
    if(liveSchedule&&!scheduleDirty&&!scheduleBusy){
      scheduleDraft={...liveSchedule};
      syncScheduleControls();
      if(Date.now()>=scheduleCooldownUntil)q('#wcV12ScheduleHint').textContent=state?.campaignControl?.session?.scheduleOverride?'WISDO schedule is live in HIGHTOWER.':'Using the visible EA schedule inputs.';
    }
    stateReceivedAt=Date.now();
    render();
  }

  timer=setInterval(render,1000);
  render();
  return {setState,render,destroy(){clearInterval(timer);clearInterval(armTimer);clearInterval(scheduleHoldTimer);container.classList.remove('wisdo-v10-time-host','wisdo-v12-time-host');}};
}
