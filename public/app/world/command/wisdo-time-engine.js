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
  return 'DIRECT CONTROL';
}

function resumeRule(goal){
  const id=Number(goal||0);
  if(id===2||id===4)return 'OPPOSITE CANDLE';
  if(id===1||id===3||id===6||id===7||id===9||id===12)return 'TIMER / EA RULE';
  return 'NOT CONFIGURED';
}

function windowPieces(startHour,endHour){
  const start=clamp(Number(startHour)||0,0,23),end=clamp(Number(endHour)||0,0,23);
  if(start===end)return [{start:0,end:24}];
  if(start<end)return [{start,end}];
  return [{start,end:24},{start:0,end}];
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
const WEEK_DAYS=Object.freeze([{day:1,label:'MON'},{day:2,label:'TUE'},{day:3,label:'WED'},{day:4,label:'THU'},{day:5,label:'FRI'},{day:6,label:'SAT'},{day:0,label:'SUN'}]);
const FULL_DAY_MASK=0xFFFFFF;
function maskFromRange(start,end,enabled=true){
  if(!enabled)return 0;
  const a=clamp(Math.trunc(Number(start)||0),0,23),b=clamp(Math.trunc(Number(end)||24),1,24);
  if(b<=a)return 0;
  let mask=0;for(let h=a;h<b;h++)mask|=(1<<h);return mask>>>0;
}
function maskPieces(mask){
  const pieces=[];let start=null;
  for(let h=0;h<=24;h++){
    const active=h<24&&((Number(mask)>>>h)&1)===1;
    if(active&&start==null)start=h;
    if(!active&&start!=null){pieces.push({start,end:h});start=null;}
  }
  return pieces;
}
function rangeFromMask(mask){
  const pieces=maskPieces(mask);if(!pieces.length)return {enabled:false,start:7,end:21};
  return {enabled:true,start:pieces[0].start,end:pieces[pieces.length-1].end,split:pieces.length>1};
}
function legacyMask(session){
  if(!session?.reported)return maskFromRange(7,21,true);
  if(session.windowMode===0)return FULL_DAY_MASK;
  let mask=0;for(const w of (session.windows||[]))for(const p of windowPieces(w.startHour,w.endHour))for(let h=p.start;h<p.end;h++)mask|=(1<<h);
  return mask>>>0;
}
function hourLabel(hour){return String(clamp(Number(hour)||0,0,24)).padStart(2,'0')+':00';}

function markup(){
  return `<div class="wisdo-v10-time-engine wisdo-v12-time-engine" data-temporal-mode="standby">
    <div class="wisdo-v10-time-head"><span>WISDO TIME / SESSION CONTROL</span><b id="wcV10TimeStatus">STANDBY</b></div>
    <div class="wisdo-v12-time-layout">
      <button type="button" class="wisdo-v10-time-core wisdo-v14-scalp-core" id="wcV14ScalpCore" aria-label="Hold for two seconds to arm the two-minute scalp game plan">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="track" cx="60" cy="60" r="50"></circle>
          <circle class="progress" id="wcV10TimeProgress" cx="60" cy="60" r="50"></circle>
          <circle class="hold-progress" id="wcV14HoldProgress" cx="60" cy="60" r="55"></circle>
        </svg>
        <div><strong id="wcV10TimeMain">02:00</strong><span id="wcV10TimeCaption">HOLD 2.0s TO ARM</span><small id="wcV10TimeElapsed">ELAPSED —</small><em id="wcV14ScalpHint">2-MINUTE GAME PLAN</em></div>
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
          <div id="wcV12SessionBands"></div>
          <i id="wcV12NowMarker"></i>
        </div>
        <div class="wisdo-v12-day-legend"><span class="active">ACTIVE HOURS · BOT ALLOWS NEW ENTRIES</span><span class="blocked">BLOCKED HOURS · MANAGE ONLY</span></div>
        <div class="wisdo-v14-time-actions">
          <button type="button" id="wcV14EditWeek">EDIT TRADING WEEK</button>
          <button type="button" id="wcV14ClearWeek">USE EA WINDOWS</button>
        </div>
      </div>
    </div>
    <div class="wisdo-v14-week-editor" id="wcV14WeekEditor" hidden>
      <div class="wisdo-v14-week-head"><div><span>WEEK SCHEDULE · BROKER TIME</span><strong>SLIDE EACH DAY'S ACTIVE WINDOW</strong></div><small>Green = entries allowed. Red = manage only.</small></div>
      <div class="wisdo-v14-week-rows">
        <div class="wisdo-v14-week-row" data-day="1"><label><input type="checkbox" checked> MON</label><div class="wisdo-v14-range"><input class="start" type="range" min="0" max="23" step="1" value="7"><input class="end" type="range" min="1" max="24" step="1" value="21"></div><output>07:00–21:00</output><div class="wisdo-v14-mini-track"></div></div>
        <div class="wisdo-v14-week-row" data-day="2"><label><input type="checkbox" checked> TUE</label><div class="wisdo-v14-range"><input class="start" type="range" min="0" max="23" step="1" value="7"><input class="end" type="range" min="1" max="24" step="1" value="21"></div><output>07:00–21:00</output><div class="wisdo-v14-mini-track"></div></div>
        <div class="wisdo-v14-week-row" data-day="3"><label><input type="checkbox" checked> WED</label><div class="wisdo-v14-range"><input class="start" type="range" min="0" max="23" step="1" value="7"><input class="end" type="range" min="1" max="24" step="1" value="21"></div><output>07:00–21:00</output><div class="wisdo-v14-mini-track"></div></div>
        <div class="wisdo-v14-week-row" data-day="4"><label><input type="checkbox" checked> THU</label><div class="wisdo-v14-range"><input class="start" type="range" min="0" max="23" step="1" value="7"><input class="end" type="range" min="1" max="24" step="1" value="21"></div><output>07:00–21:00</output><div class="wisdo-v14-mini-track"></div></div>
        <div class="wisdo-v14-week-row" data-day="5"><label><input type="checkbox" checked> FRI</label><div class="wisdo-v14-range"><input class="start" type="range" min="0" max="23" step="1" value="7"><input class="end" type="range" min="1" max="24" step="1" value="21"></div><output>07:00–21:00</output><div class="wisdo-v14-mini-track"></div></div>
        <div class="wisdo-v14-week-row" data-day="6"><label><input type="checkbox"> SAT</label><div class="wisdo-v14-range"><input class="start" type="range" min="0" max="23" step="1" value="7"><input class="end" type="range" min="1" max="24" step="1" value="21"></div><output>BLOCKED</output><div class="wisdo-v14-mini-track"></div></div>
        <div class="wisdo-v14-week-row" data-day="0"><label><input type="checkbox"> SUN</label><div class="wisdo-v14-range"><input class="start" type="range" min="0" max="23" step="1" value="7"><input class="end" type="range" min="1" max="24" step="1" value="21"></div><output>BLOCKED</output><div class="wisdo-v14-mini-track"></div></div>
      </div>
      <div class="wisdo-v14-week-footer"><span id="wcV14WeekStatus">UNSAVED</span><button type="button" id="wcV14CopyWeekdays">COPY MON → WEEKDAYS</button><button type="button" id="wcV14SaveWeek">SAVE + HOLD TO CONFIRM</button></div>
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

export function createWisdoTimeEngine(container,{resetWindowSeconds=120,scalpHoldMs=2000,onScalpArm=null,onScalpCancel=null,onScheduleSave=null,onScheduleClear=null,onVisualState=null}={}){
  if(!container)return {setState(){},render(){},destroy(){}};
  container.classList.add('wisdo-v10-time-host','wisdo-v12-time-host');
  container.innerHTML=markup();
  const q=(id)=>container.querySelector(id);
  const root=container.querySelector('.wisdo-v10-time-engine');
  const circumference=2*Math.PI*50;
  const progress=q('#wcV10TimeProgress');
  progress.style.strokeDasharray=String(circumference);

  let state=null,campaign=null,stateReceivedAt=Date.now(),timer=0;

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
    return {control,session,live,paused,remaining,elapsed,age,progress:live&&paused&&rawRemaining>0?livePauseProgress:resetProgress};
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
      const pieces=session.windowMode===0?[{start:0,end:24}]:windows.flatMap((w)=>windowPieces(w.startHour,w.endHour));
      activeHost.innerHTML=pieces.map((p)=>`<span class="wisdo-v12-active-window" style="left:${(p.start/24)*100}%;width:${((p.end-p.start)/24)*100}%"></span>`).join('');
      bands.innerHTML=sessionRanges(Number(session.id)).map((p)=>`<span class="wisdo-v12-session-band" style="left:${(p.start/24)*100}%;width:${((p.end-p.start)/24)*100}%"></span>`).join('');
      const minute=brokerMinute(session,d.age);
      if(minute!=null)q('#wcV12NowMarker').style.left=`${(minute/1440)*100}%`;
      q('#wcV12NowMarker').hidden=false;
    }else{
      q('#wcV12NowMarker').hidden=true;
    }
  }

  function render(){
    const d=derived(),now=new Date(),session=d.session,sessionReported=Boolean(d.live&&session?.reported);
    q('#wcV10LocalClock').textContent=fmtClock(now,false);
    q('#wcV10UtcClock').textContent=fmtClock(now,true);
    q('#wcV10TimeElapsed').textContent=d.elapsed==null?'ELAPSED —':`ELAPSED ${fmtDuration(d.elapsed)}`;
    q('#wcV12Protocol').textContent=goalLabel(d.control?.goal,d.paused);

    if(d.live&&d.paused&&d.remaining>0){
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
      q('#wcV12WindowMode').textContent=session.windowMode===0?'ALL MARKET HOURS':session.windowMode===1?'LONDON + NEW YORK':session.scheduleEnforced?'CUSTOM EA WINDOWS':'EA WINDOW';
      q('#wcV10Schedule').textContent=session.windowMode===0?'ALL HOURS':session.windowMode===1?'07:00–21:00 BROKER':'CUSTOM WINDOWS';
      q('#wcV10Enforcement').textContent=session.scheduleEnforced?(session.windowAllowed?'WINDOW OPEN':'WINDOW BLOCKED'):'ALL HOURS';
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
    }

    renderWindows(d);
    const pct=clamp(d.progress,0,1);
    progress.style.strokeDashoffset=String(circumference*(1-pct));
    q('#wcV10RailMarker').style.left=`${(pct*100).toFixed(2)}%`;
    onVisualState?.({progress:pct,live:d.live,paused:d.paused,remaining:d.remaining,elapsed:d.elapsed,session:d.session,mode:root.dataset.temporalMode});
  }

  function setState(next={},activeCampaign=null){
    state=next||{};
    campaign=activeCampaign||state?.campaigns?.[0]||null;
    stateReceivedAt=Date.now();
    render();
  }

  timer=setInterval(render,1000);
  render();
  return {setState,render,destroy(){clearInterval(timer);container.classList.remove('wisdo-v10-time-host','wisdo-v12-time-host');}};
}
