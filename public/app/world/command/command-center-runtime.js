import { createWorldCommandRuntime } from './command-runtime.js';
import { createWisdoTimeEngine } from './wisdo-time-engine.js';

const esc=(value='')=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const money=(value,currency='USD')=>{try{return new Intl.NumberFormat(undefined,{style:'currency',currency,maximumFractionDigits:2}).format(finite(value));}catch{return `$${finite(value).toFixed(2)}`;}};
const pct=(value)=>`${(finite(value)*100).toFixed(0)}%`;

export const INTENT_OS_CAPABILITIES=Object.freeze([
  'SET_STOP_ATR','SET_TRAIL_ATR','TRIM_CAMPAIGN','ADD_IF_VALID',
  'WIDEN_EXISTING_STOPS','CLEAR_RUNTIME_OVERRIDES','COUNTER_IF_VALID','ARM_TWO_MIN_SCALP',
  'SET_TRADING_SCHEDULE','CLEAR_TRADING_SCHEDULE',
]);

function ensureStyles(){
  const href='/app/world/command/wisdo-live-manager-v15.css?v=20261005-v20-scalp-hold';
  let link=document.querySelector('link[data-wisdo-live-manager-v15]');
  if(!link){link=document.createElement('link');link.rel='stylesheet';link.dataset.wisdoLiveManagerV15='1';document.head.appendChild(link);}
  link.href=href;
}

function markup(){
  return `<section id="wisdoCommandOverlay" class="wisdo-command-overlay" hidden aria-label="WISDO Live Manager">
    <div class="lm-shell">
      <header class="lm-top">
        <div class="lm-brand"><span>CONNECT · COPY · CONTROL</span><strong>WISDO <b>LIVE MANAGER</b></strong></div>
        <div class="lm-scope">
          <div><span>ACCOUNT</span><strong id="lmScopeAccount">—</strong></div>
          <div><span>SYMBOL</span><strong id="lmScopeSymbol">—</strong></div>
          <div><span>CAMPAIGN</span><strong id="lmScopeCampaign">—</strong></div>
          <div><span>EA LINK</span><strong id="lmScopeLink">—</strong></div>
        </div>
        <button id="lmClose" class="lm-close" type="button">EXIT</button>
      </header>

      <div class="lm-grid">
        <main class="lm-main">
          <section class="lm-card lm-command-card">
            <div class="lm-command-title">
              <div><span class="lm-label">VOICE + TEXT → VERIFIED EA COMMANDS</span><h1>Tell WISDO what to do.</h1><p>No character. No game controls. This surface exists to manage the live campaign.</p></div>
              <span id="lmLinkPill" class="lm-link-pill bad">LINK CHECKING</span>
            </div>
            <form id="lmComposer" class="lm-composer">
              <input id="lmIntentInput" autocomplete="off" placeholder="Example: tighten the trailer a little" aria-label="WISDO trading command">
              <button class="lm-send" type="submit">SEND TO WISDO</button>
            </form>
            <div id="lmIntentState" class="lm-intent">Waiting for live account state.</div>
            <div class="lm-examples" aria-label="Command examples">
              <button class="lm-example" type="button" data-example="tighten the trailer a little">TIGHTEN TRAILER</button>
              <button class="lm-example" type="button" data-example="move stop losses to 1.6 ATR">STOP 1.6 ATR</button>
              <button class="lm-example" type="button" data-example="trim half of the campaign">TRIM HALF</button>
              <button class="lm-example" type="button" data-example="add another position now">ADD IF VALID</button>
              <button class="lm-example" type="button" data-example="intentionally widen my existing stop losses to 2 ATR">WIDEN STOPS</button>
              <button class="lm-example" type="button" data-example="return stops to normal EA management">RETURN TO EA</button>
            </div>
            <div class="lm-quick">
              <button class="lm-btn" type="button" data-live-action="PAUSE_BOT">PAUSE BOT<span>Stop trading activity</span></button>
              <button class="lm-btn good" type="button" data-live-action="RESUME_BOT">RESUME BOT<span>Return to EA logic</span></button>
              <button class="lm-btn" type="button" data-live-action="STOP_NEW_ENTRIES">STOP ENTRIES<span>Manage current trades only</span></button>
              <button class="lm-btn good" type="button" data-live-action="RESUME_NEW_ENTRIES">ALLOW ENTRIES<span>Reopen entry gate</span></button>
              <button class="lm-btn" type="button" data-manager-action="SET_TRAIL_ATR" data-delta="-0.25">TIGHTEN TRAIL<span>−0.25 ATR</span></button>
              <button class="lm-btn" type="button" data-manager-action="TRIM_CAMPAIGN" data-trim="50">TRIM 50%<span>Current campaign</span></button>
              <button class="lm-btn danger" type="button" data-live-action="CLOSE_CAMPAIGN">CLOSE CAMPAIGN<span>Hold confirmation</span></button>
              <button class="lm-btn danger" type="button" data-live-action="EMERGENCY_STOP">EMERGENCY STOP<span>Hold confirmation</span></button>
            </div>
          </section>

          <section class="lm-card">
            <div class="lm-card-head"><div><span class="lm-label">CAMPAIGN</span><h2>Live Progress</h2></div><small id="lmCampaignStatus">STANDBY</small></div>
            <div class="lm-metrics">
              <div class="lm-metric"><small>FLOATING P/L</small><strong id="lmFloating">—</strong></div>
              <div class="lm-metric"><small>POSITIONS</small><strong id="lmPositionsCount">0</strong></div>
              <div class="lm-metric"><small>CAMPAIGN BASE</small><strong id="lmCampaignBase">—</strong></div>
              <div class="lm-metric"><small>NEXT TARGET</small><strong id="lmTargetEquity">—</strong></div>
            </div>
            <div class="lm-progress"><i id="lmProgressBar"></i></div>
          </section>

          <section class="lm-card">
            <div class="lm-card-head"><div><span class="lm-label">RUNTIME CONTROL</span><h2>Protection & Market Sense</h2></div><small id="lmRuntimeScope">EA INPUTS</small></div>
            <div class="lm-risk-grid">
              <div class="lm-data"><small>STOP ATR</small><b id="lmStopAtr">—</b></div>
              <div class="lm-data"><small>TRAIL START</small><b id="lmTrailStart">—</b></div>
              <div class="lm-data"><small>TRAIL DISTANCE</small><b id="lmTrailDistance">—</b></div>
              <div class="lm-data"><small>TRAIL STEP</small><b id="lmTrailStep">—</b></div>
            </div>
            <div class="lm-sense-grid" style="margin-top:8px">
              <div class="lm-data"><small>DIRECTION</small><b id="lmDirection">—</b></div>
              <div class="lm-data"><small>SESSION</small><b id="lmSession">—</b></div>
              <div class="lm-data"><small>ENTRY GATE</small><b id="lmEntryGate">—</b></div>
              <div class="lm-data"><small>CONTINUE / REVERSE</small><b id="lmProbability">—</b></div>
            </div>
          </section>

          <section class="lm-card lm-time-host" id="lmTimeHost"></section>

          <section class="lm-card">
            <div class="lm-card-head"><div><span class="lm-label">BROKER TRUTH</span><h2>Open Positions</h2></div><small id="lmPositionSummary">NO OPEN POSITIONS</small></div>
            <div class="lm-table-wrap"><table class="lm-table"><thead><tr><th>TICKET</th><th>SIDE</th><th>LOTS</th><th>ENTRY</th><th>NOW</th><th>SL</th><th>TP</th><th>P/L</th></tr></thead><tbody id="lmPositionRows"><tr><td colspan="8">Waiting for Reporter.</td></tr></tbody></table></div>
          </section>
        </main>

        <aside class="lm-side">
          <section class="lm-card">
            <div class="lm-card-head"><div><span class="lm-label">BOUND ACCOUNT</span><h3>Account & Campaign</h3></div></div>
            <select id="lmAccountSelect" class="lm-account-select" aria-label="Trading account"></select>
            <div id="lmCampaigns" class="lm-campaigns"></div>
          </section>

          <section class="lm-voice-note">
            <strong>ONE INTENT OS · VOICE + WEB + REPORTER</strong>
            <p>Speak from your enrolled WISDO voice device or type naturally here. Both surfaces use the same server-side intent compiler, standing-behavior fabric, command bus and HIGHTOWER truth loop.</p>
          </section>

          <section class="lm-card">
            <div class="lm-card-head"><div><span class="lm-label">STANDING INTENTIONS</span><h3>What WISDO Is Carrying For You</h3></div><small id="lmIntentionsStatus">SYNCING</small></div>
            <div id="lmIntentions" class="lm-intentions"><div class="lm-intention empty">No standing intentions loaded.</div></div>
          </section>

          <section class="lm-card">
            <div class="lm-card-head"><div><span class="lm-label">EA TRUTH LOOP</span><h3>Last Verified Receipt</h3></div></div>
            <div id="lmReceipt" class="lm-receipt">No command sent.</div>
          </section>

          <section class="lm-card">
            <div class="lm-card-head"><div><span class="lm-label">CONNECTION</span><h3>Execution Health</h3></div></div>
            <div class="lm-sense-grid">
              <div class="lm-data"><small>REPORTER</small><b id="lmReporter">—</b></div>
              <div class="lm-data"><small>TERMINAL</small><b id="lmTerminal">—</b></div>
              <div class="lm-data"><small>AUTOTRADING</small><b id="lmExpert">—</b></div>
              <div class="lm-data"><small>BOT</small><b id="lmBot">—</b></div>
            </div>
          </section>
        </aside>
      </div>
    </div>

    <section id="lmProposal" class="lm-proposal" hidden>
      <span>CONFIRM LIVE COMMAND</span>
      <h2 id="lmProposalTitle">—</h2>
      <p id="lmProposalScope">—</p>
      <p id="lmProposalEffect">Server and EA state will be revalidated before execution.</p>
      <div class="lm-proposal-actions">
        <button id="lmHold" class="lm-hold" type="button"><i></i><span>HOLD TO CONFIRM</span></button>
        <button id="lmCancel" class="lm-close" type="button">CANCEL</button>
      </div>
    </section>
  </section>`;
}

function appendLaunchButton(){
  const nav=document.querySelector('.top-actions');
  if(!nav||document.getElementById('wisdoCommandLaunch'))return;
  const button=document.createElement('button');
  button.id='wisdoCommandLaunch';
  button.className='chip wisdo-command-launch';
  button.textContent='Live Manager';
  nav.prepend(button);
}

export function startCampaignCommandCenter({initialAccountId=''}={}){
  ensureStyles();
  document.getElementById('wisdoCommandOverlay')?.remove();
  document.body.insertAdjacentHTML('beforeend',markup());
  appendLaunchButton();

  const overlay=document.getElementById('wisdoCommandOverlay');
  const q=(id)=>overlay.querySelector(id);
  let commandState=null;
  let selectedCampaignId=null;
  let latestReceipt=null;
  let proposal=null;
  let holdStart=0;
  let holdTimer=0;
  let opened=false;
  let intentSessionId=sessionStorage.getItem('wisdo.intentSessionId')||'';
  let intentionsRefreshAt=0;
  const announced=new Set();

  const activeCampaign=()=>commandState?.campaigns?.find((row)=>String(row.campaignId)===String(selectedCampaignId))||commandState?.campaigns?.[0]||null;
  const selectedAccount=()=>commandState?.account||null;
  const capability=(action)=>commandState?.capabilities?.[action]||null;

  const setIntent=(text,tone='')=>{
    const el=q('#lmIntentState');
    if(!el)return;
    el.textContent=text;
    el.className=`lm-intent ${tone}`.trim();
  };

  function announceReceipt(receipt){
    const status=String(receipt?.status||'').toLowerCase();
    if(!['completed','failed'].includes(status)||!receipt?.commandId||announced.has(receipt.commandId))return;
    announced.add(receipt.commandId);
    const detail=String(receipt?.result?.message||receipt?.error||receipt?.command||'Trading command').trim();
    try{
      if('speechSynthesis'in window&&localStorage.getItem('wisdo.commandVoiceAlerts')!=='off'){
        const utterance=new SpeechSynthesisUtterance(status==='completed'?`WISDO. Command executed. ${detail}`:`WISDO. Command failed. ${detail}`);
        utterance.rate=.92;utterance.pitch=.92;window.speechSynthesis.speak(utterance);
      }
    }catch{}
    try{
      if('Notification'in window&&Notification.permission==='granted'&&navigator.serviceWorker?.ready){
        navigator.serviceWorker.ready.then((registration)=>registration.showNotification(status==='completed'?'WISDO · COMMAND EXECUTED':'WISDO · COMMAND FAILED',{body:detail.slice(0,220),tag:`wisdo-command-${receipt.commandId}`,renotify:true,data:{commandId:receipt.commandId,status}})).catch(()=>{});
      }
    }catch{}
  }

  function renderReceipt(){
    const el=q('#lmReceipt');
    if(!el)return;
    const r=latestReceipt;
    if(!r){el.className='lm-receipt';el.textContent='No command sent.';return;}
    const status=String(r.status||'pending').toLowerCase();
    el.className=`lm-receipt ${status==='completed'?'ok':status==='failed'?'fail':'pending'}`;
    el.innerHTML=`<strong>${esc(status.toUpperCase())}</strong><br>${esc(r.command||'COMMAND')}<br><span>${esc(r.result?.message||r.error||'Waiting for HIGHTOWER acknowledgement.')}</span>${r.commandId?`<br><small>ID ${esc(r.commandId)}</small>`:''}`;
  }

  function renderState(){
    if(!commandState)return;
    const account=selectedAccount();
    const campaign=activeCampaign();
    const control=commandState.campaignControl||null;
    const health=commandState.executionHealth||{};
    const currency=commandState.financial?.currency||'USD';

    q('#lmScopeAccount').textContent=account?.accountNumberMasked||account?.nickname||'SELECT ACCOUNT';
    q('#lmScopeSymbol').textContent=campaign?.symbol||control?.symbol||'—';
    q('#lmScopeCampaign').textContent=campaign?.strategyName||campaign?.campaignId|| (control?.live?`EA ${Math.trunc(finite(control.campaignId))}`:'—');
    q('#lmScopeLink').textContent=health.commandLinkReady?'EA VERIFIED':'NOT READY';
    q('#lmLinkPill').textContent=health.commandLinkReady?'EA VERIFIED':'LINK NOT READY';
    q('#lmLinkPill').className=`lm-link-pill ${health.commandLinkReady?'live':'bad'}`;
    setIntent(health.commandLinkReady?'Voice and text command paths are ready. HIGHTOWER acknowledgement required for success.':'Reporter/terminal command link is not ready. Nothing will be sent until the link is verified.',health.commandLinkReady?'live':'error');

    const accounts=commandState.accounts||[];
    q('#lmAccountSelect').innerHTML=accounts.map((row)=>`<option value="${esc(row.accountId)}" ${String(row.accountId)===String(account?.accountId)?'selected':''}>${esc(row.nickname||row.accountId)}${row.mt4Login?` · MT4 ${esc(row.mt4Login)}`:''}</option>`).join('');
    const campaigns=commandState.campaigns||[];
    q('#lmCampaigns').innerHTML=campaigns.length?campaigns.map((row)=>`<button type="button" class="lm-campaign ${String(row.campaignId)===String(campaign?.campaignId)?'active':''}" data-campaign-id="${esc(row.campaignId)}">${esc(row.symbol)} · ${esc(row.direction)} · ${row.positionCount||0}</button>`).join(''):'<small>No active campaigns.</small>';

    const progress=control?.progress||{};
    const base=finite(progress.campaignBase);
    const realized=finite(progress.realized);
    const floating=finite(progress.floating,campaign?.floatingMoney||0);
    const target=finite(progress.targetEquity);
    const progressRatio=target>base?Math.max(0,Math.min(1,(base+realized+floating-base)/(target-base))):0;
    q('#lmFloating').textContent=money(campaign?.floatingMoney??commandState.financial?.floatingPL??floating,currency);
    q('#lmFloating').className=finite(campaign?.floatingMoney??floating)>=0?'lm-profit':'lm-loss';
    q('#lmPositionsCount').textContent=String(campaign?.positionCount||0);
    q('#lmCampaignBase').textContent=base>0?money(base,currency):'—';
    q('#lmTargetEquity').textContent=target>0?money(target,currency):'—';
    q('#lmProgressBar').style.width=`${(progressRatio*100).toFixed(1)}%`;
    q('#lmCampaignStatus').textContent=control?.live?(control.paused?'EA LIVE · PAUSED':'EA LIVE'):'CAMPAIGN TELEMETRY STANDBY';

    const runtime=control?.runtime||{};
    q('#lmStopAtr').textContent=Number.isFinite(Number(runtime.stopAtr))?`${Number(runtime.stopAtr).toFixed(2)} ATR`:'—';
    q('#lmTrailStart').textContent=Number.isFinite(Number(runtime.trailStartAtr))?`${Number(runtime.trailStartAtr).toFixed(2)} ATR`:'—';
    q('#lmTrailDistance').textContent=Number.isFinite(Number(runtime.trailDistanceAtr))?`${Number(runtime.trailDistanceAtr).toFixed(2)} ATR`:'—';
    q('#lmTrailStep').textContent=Number.isFinite(Number(runtime.trailStepAtr))?`${Number(runtime.trailStepAtr).toFixed(2)} ATR`:'—';
    q('#lmRuntimeScope').textContent=runtime.overrideMask? (runtime.scope===2?'LIVE OVERRIDE · PERSISTENT':'LIVE OVERRIDE · CAMPAIGN'):'VISIBLE EA INPUTS';
    q('#lmDirection').textContent=control?.direction===1?'BUY':control?.direction===-1?'SELL':campaign?.direction||'—';
    q('#lmSession').textContent=control?.session?.reported?control.session.name:'NOT REPORTED';
    q('#lmEntryGate').textContent=control?.session?.reported?(control.session.entryAllowed?'OPEN':'BLOCKED'):'UNKNOWN';
    q('#lmProbability').textContent=control?.marketSense?`${pct(control.marketSense.continuationProbability)} / ${pct(control.marketSense.reversalProbability)}`:'—';

    q('#lmReporter').textContent=health.reporter||'DISCONNECTED';
    q('#lmTerminal').textContent=health.terminalConnected===true?'CONNECTED':health.terminalConnected===false?'OFFLINE':'UNKNOWN';
    q('#lmExpert').textContent=health.expertEnabled===true?'ON':health.expertEnabled===false?'OFF':'UNKNOWN';
    q('#lmBot').textContent=commandState.bot?.name? `${commandState.bot.name}${commandState.bot.version?` · v${commandState.bot.version}`:''}`:'NOT REPORTED';

    const positions=campaign?.positions||[];
    q('#lmPositionSummary').textContent=positions.length?`${positions.length} OPEN · ${finite(campaign.totalLots).toFixed(2)} LOTS`:'NO OPEN POSITIONS';
    q('#lmPositionRows').innerHTML=positions.length?positions.map((p)=>{
      const pl=finite(p.floatingMoney);
      return `<tr><td>${esc(p.ticket||'—')}</td><td>${esc(p.direction||'—')}</td><td>${finite(p.lots).toFixed(2)}</td><td>${p.entryPrice??'—'}</td><td>${p.currentPrice??'—'}</td><td>${p.stopLoss??'—'}</td><td>${p.takeProfit??'—'}</td><td class="${pl>=0?'lm-profit':'lm-loss'}">${money(pl,currency)}</td></tr>`;
    }).join(''):'<tr><td colspan="8">No open positions in this campaign.</td></tr>';

    overlay.querySelectorAll('[data-live-action]').forEach((button)=>{
      const cap=capability(button.dataset.liveAction);
      button.disabled=cap?cap.available===false:!health.commandLinkReady;
      button.title=cap?.reason||'';
    });
    overlay.querySelectorAll('[data-manager-action]').forEach((button)=>{
      const cap=capability(button.dataset.managerAction);
      button.disabled=cap?cap.available===false:!control?.live;
      button.title=cap?.reason||'';
    });

    timeEngine.setState(commandState,campaign);
  }

  const runtime=createWorldCommandRuntime({
    initialAccountId:initialAccountId||sessionStorage.getItem('wisdo.selectedAccountId')||'',
    onState:(state,meta)=>{commandState=state;selectedCampaignId=meta?.selectedCampaignId||state?.selectedCampaignId||state?.campaigns?.[0]?.campaignId||null;renderState();refreshIntentions();},
    onStatus:({state,error})=>{if(state==='degraded'&&error)setIntent(`Live state unavailable · ${error.message}`,'error');},
    onReceipt:(receipt)=>{latestReceipt=receipt;renderReceipt();announceReceipt(receipt);},
  });

  async function handleScalpHold({phase,prepared,heldForMs=0,windowSeconds=120}={}){
    if(phase==='start'){
      setIntent(`Keep holding. WISDO is revalidating the live campaign before arming the ${windowSeconds}-second scalp watchdog…`,'warn');
      return runtime.propose('ARM_TWO_MIN_SCALP',{campaignId:selectedCampaignId,durationSeconds:120});
    }
    if(phase==='cancel'){
      setIntent('Scalp arm cancelled. Nothing was sent to HIGHTOWER.','');
      return null;
    }
    if(phase==='complete'){
      if(!prepared?.proposalId)throw new Error('Scalp proposal was not prepared.');
      latestReceipt=await runtime.execute(prepared,heldForMs);
      renderReceipt();
      setIntent('Two-minute scalp game plan sent. HIGHTOWER will reset the 02:00 clock on every confirmed entry, then collect and wait for an opposite candle if the clock expires.','live');
      return latestReceipt;
    }
    return null;
  }

  async function handleScheduleHold({phase,action='set',schedule=null,prepared,heldForMs=0}={}){
    const command=action==='clear'?'CLEAR_TRADING_SCHEDULE':'SET_TRADING_SCHEDULE';
    if(phase==='start'){
      const description=action==='clear'?'restore the EA schedule inputs':'apply the selected broker-time trading windows';
      setIntent(`Keep holding. WISDO is revalidating the live account before it can ${description}…`,'warn');
      return runtime.propose(command,{campaignId:selectedCampaignId,...(schedule||{})});
    }
    if(phase==='cancel'){
      setIntent('Schedule change cancelled. Nothing was sent to HIGHTOWER.','');
      return null;
    }
    if(phase==='complete'){
      if(!prepared?.proposalId)throw new Error('Schedule proposal was not prepared.');
      latestReceipt=await runtime.execute(prepared,heldForMs);
      renderReceipt();
      setIntent(action==='clear'
        ? 'EA trading-window inputs restore sent. Existing positions remain managed while the schedule changes only gate new entries.'
        : 'Trading schedule sent. HIGHTOWER will enforce these broker-time active windows for new entries while continuing to manage open positions outside the window.','live');
      return latestReceipt;
    }
    return null;
  }

  const timeEngine=createWisdoTimeEngine(q('#lmTimeHost'),{
    resetWindowSeconds:120,
    scalpHoldMs:2000,
    scheduleHoldMs:2000,
    onScalpHold:handleScalpHold,
    onScheduleHold:handleScheduleHold,
  });

  function cancelProposal(){
    proposal=null;holdStart=0;clearInterval(holdTimer);holdTimer=0;
    q('#lmProposal').hidden=true;
    const bar=q('#lmHold i');if(bar)bar.style.width='0%';
    const label=q('#lmHold span');if(label)label.textContent='HOLD TO CONFIRM';
  }

  async function arm(action,options={}){
    try{
      setIntent(`Revalidating ${action.replaceAll('_',' ')} against the live account…`,'warn');
      const next=await runtime.propose(action,{campaignId:selectedCampaignId,...options});
      if(Number(next.holdRequiredMs||0)<=0){
        latestReceipt=await runtime.execute(next,0);renderReceipt();
        setIntent('Command delivered. Waiting for HIGHTOWER verified acknowledgement.','live');
        return latestReceipt;
      }
      proposal=next;
      q('#lmProposalTitle').textContent=next.label||action.replaceAll('_',' ');
      q('#lmProposalScope').textContent=`${next.scope||'ACCOUNT'} · ${next.affectedCount??0} affected · hold ${(Number(next.holdRequiredMs)/1000).toFixed(1)}s`;
      q('#lmProposalEffect').textContent=action==='WIDEN_EXISTING_STOPS'
        ? `Intentional stop widening can increase maximum loss on open positions. Requested stop: ${Number(options.stopAtr).toFixed(2)} ATR.`
        : 'Nothing has been sent yet. Release early to cancel.';
      q('#lmProposal').hidden=false;
      setIntent('Command understood. Review the live proposal and hold to confirm.','warn');
      return next;
    }catch(error){
      latestReceipt={status:'failed',command:action,error:error.message};renderReceipt();
      setIntent(`Blocked · ${error.message}`,'error');
      return null;
    }
  }

  async function intentRequest(textValue){
    const response=await fetch('/api/world/intent',{
      method:'POST',
      credentials:'same-origin',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text:textValue,sessionId:intentSessionId||null,accountId:runtime.accountId||selectedAccount()?.accountId||null,symbol:activeCampaign()?.symbol||commandState?.campaignControl?.symbol||null,campaignId:commandState?.campaignControl?.campaignId||activeCampaign()?.campaignId||null,magicNumber:commandState?.campaignControl?.magic||activeCampaign()?.magicNumber||null}),
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||payload.message||`Intent OS request failed: ${response.status}`);
    if(payload.sessionId){intentSessionId=payload.sessionId;sessionStorage.setItem('wisdo.intentSessionId',intentSessionId);}
    return payload;
  }

  function triggerLabel(trigger={}){
    if(trigger.type==='event'&&trigger.event==='stop_loss_hit')return 'WAITING · STOP LOSS HIT';
    if(trigger.type==='event'&&trigger.event==='campaign_closed')return 'WAITING · CAMPAIGN CLOSE';
    if(trigger.type==='event'&&trigger.event==='new_entry')return 'WAITING · NEW ENTRY';
    if(trigger.type==='metric')return `WAITING · ${String(trigger.metric||'METRIC').replaceAll('_',' ').toUpperCase()} ${trigger.operator||''} ${trigger.value??''}`;
    if(trigger.type==='interval')return `EVERY ${trigger.interval_seconds||0}s`;
    if(trigger.type==='resettable_inactivity_timer')return `RESETTABLE TIMER · ${trigger.timeout_seconds||0}s`;
    return String(trigger.type||'MANUAL').replaceAll('_',' ').toUpperCase();
  }

  function renderIntentions(intentions=[]){
    const host=q('#lmIntentions'),status=q('#lmIntentionsStatus');if(!host||!status)return;
    const visible=(intentions||[]).filter((row)=>!['cancelled'].includes(String(row.status||'').toLowerCase()));
    status.textContent=visible.length?`${visible.length} TRACKED`:'NONE';
    host.innerHTML=visible.length?visible.slice(0,12).map((row)=>{
      const runtimeState=row.lastRuntime||{};
      const actions=(row.actions||[]).map((a)=>String(a.type||'').replaceAll('_',' ')).filter(Boolean).join(' → ');
      const state=String(runtimeState.state||row.status||'armed').toUpperCase();
      const detail=runtimeState.last_triggered_at?`LAST TRIGGER ${new Date(runtimeState.last_triggered_at).toLocaleString()}`:triggerLabel(row.trigger||{});
      return `<article class="lm-intention" data-state="${esc(state.toLowerCase())}"><div><strong>${esc(row.purpose||row.name||'Standing intention')}</strong><small>${esc(actions||'Observe')}</small></div><span>${esc(state)}</span><em>${esc(detail)}</em></article>`;
    }).join(''):'<div class="lm-intention empty">No standing intentions. Tell WISDO an “if / when / after” instruction and it can compile one.</div>';
  }

  async function refreshIntentions(force=false){
    if(!force&&Date.now()<intentionsRefreshAt)return;
    intentionsRefreshAt=Date.now()+4000;
    try{
      const response=await fetch('/api/world/intentions',{credentials:'same-origin',cache:'no-store'});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||'Intentions unavailable');
      renderIntentions(payload.intentions||[]);
    }catch(error){
      const status=q('#lmIntentionsStatus');if(status)status.textContent='UNAVAILABLE';
      const host=q('#lmIntentions');if(host)host.innerHTML=`<div class="lm-intention empty">${esc(error.message)}</div>`;
    }
  }

  async function handleIntentResult(result){
    if(result.state==='awaiting_confirmation'){
      proposal={intentOs:true,holdRequiredMs:1800,result};
      q('#lmProposalTitle').textContent=result.behaviorId?'ACTIVATE STANDING INTENTION':'CONFIRM WISDO INTENT';
      q('#lmProposalScope').textContent=result.text||'Review the exact WISDO interpretation before execution.';
      q('#lmProposalEffect').textContent=result.behaviorId?'This standing instruction remains armed after confirmation and wakes on verified Reporter events.':'Hold to send the explicit confirmation back through the same WISDO conversation session.';
      q('#lmProposal').hidden=false;
      setIntent(result.text||'WISDO is waiting for confirmation.','warn');
      return;
    }
    if(result.commandId){
      setIntent(result.text||'Command queued. Waiting for verified Reporter/HIGHTOWER truth.','live');
      runtime.watchReceipt(result.commandId).catch(()=>undefined);
    }else setIntent(result.text||'WISDO understood the intention.',result.ok===false?'error':'live');
    await refreshIntentions(true);
  }

  async function submitText(raw){
    try{
      setIntent('WISDO is resolving your meaning against the live account and current conversation…','warn');
      const result=await intentRequest(raw);
      await handleIntentResult(result);
    }catch(error){
      setIntent(`Intent blocked · ${error.message}`,'error');
    }
  }

  q('#lmComposer').addEventListener('submit',async(event)=>{
    event.preventDefault();
    try{if('Notification'in window&&Notification.permission==='default')Notification.requestPermission().catch(()=>{});}catch{}
    const input=q('#lmIntentInput');const raw=String(input.value||'').trim();if(!raw)return;input.value='';await submitText(raw);
  });

  overlay.querySelectorAll('[data-example]').forEach((button)=>button.addEventListener('click',()=>{q('#lmIntentInput').value=button.dataset.example||'';q('#lmIntentInput').focus();}));
  overlay.querySelectorAll('[data-live-action]').forEach((button)=>button.addEventListener('click',()=>arm(button.dataset.liveAction,{})));
  overlay.querySelectorAll('[data-manager-action]').forEach((button)=>button.addEventListener('click',()=>{
    const action=button.dataset.managerAction;
    const options={};
    if(button.dataset.delta)options.trailDeltaAtr=Number(button.dataset.delta);
    if(button.dataset.trim)options.trimPercent=Number(button.dataset.trim);
    arm(action,options);
  }));

  q('#lmAccountSelect').addEventListener('change',async(event)=>{
    const accountId=String(event.target.value||'');
    sessionStorage.setItem('wisdo.selectedAccountId',accountId);
    selectedCampaignId=null;
    await runtime.selectAccount(accountId).catch((error)=>setIntent(`Account bind failed · ${error.message}`,'error'));
  });
  q('#lmCampaigns').addEventListener('click',(event)=>{
    const button=event.target.closest('[data-campaign-id]');if(!button)return;
    selectedCampaignId=runtime.selectCampaign(button.dataset.campaignId);renderState();
  });

  q('#lmHold').addEventListener('pointerdown',(event)=>{
    if(!proposal)return;
    event.preventDefault();q('#lmHold').setPointerCapture?.(event.pointerId);holdStart=performance.now();clearInterval(holdTimer);
    holdTimer=setInterval(()=>{const elapsed=performance.now()-holdStart;const required=Math.max(1,Number(proposal?.holdRequiredMs||1));q('#lmHold i').style.width=`${Math.min(100,(elapsed/required)*100)}%`;},30);
  });
  const finishHold=async()=>{
    if(!proposal||!holdStart)return;
    const elapsed=performance.now()-holdStart;clearInterval(holdTimer);holdTimer=0;holdStart=0;
    if(elapsed<Number(proposal.holdRequiredMs||0)){q('#lmHold i').style.width='0%';return;}
    const active=proposal;q('#lmHold span').textContent='SENDING…';
    try{
      if(active.intentOs){
        const result=await intentRequest('Confirm Coach, execute');
        cancelProposal();
        await handleIntentResult(result);
      }else{
        latestReceipt=await runtime.execute(active,Math.round(elapsed));renderReceipt();setIntent('Command delivered. Waiting for HIGHTOWER verified acknowledgement.','live');cancelProposal();
      }
    }
    catch(error){latestReceipt={status:'failed',command:active.action||'WISDO_INTENT',error:error.message};renderReceipt();setIntent(`Execution failed · ${error.message}`,'error');cancelProposal();}
  };
  q('#lmHold').addEventListener('pointerup',finishHold);
  q('#lmHold').addEventListener('pointercancel',()=>{holdStart=0;clearInterval(holdTimer);q('#lmHold i').style.width='0%';});
  q('#lmCancel').addEventListener('click',cancelProposal);

  function open(){
    opened=true;overlay.hidden=false;document.documentElement.classList.add('wisdo-live-manager-active');
    runtime.start().catch((error)=>setIntent(`Live Manager unavailable · ${error.message}`,'error'));
    refreshIntentions(true);
  }
  function close(){
    opened=false;overlay.hidden=true;document.documentElement.classList.remove('wisdo-live-manager-active');cancelProposal();
  }
  const keyHandler=(event)=>{if(opened&&event.key==='Escape'){event.preventDefault();proposal?cancelProposal():close();}};
  window.addEventListener('keydown',keyHandler,true);
  document.getElementById('wisdoCommandLaunch')?.addEventListener('click',open);
  q('#lmClose').addEventListener('click',close);

  const workspaceHandler=(event)=>{
    const accountId=String(event.detail?.selectedAccountId||'');if(!accountId||accountId===runtime.accountId)return;
    sessionStorage.setItem('wisdo.selectedAccountId',accountId);runtime.selectAccount(accountId).catch(()=>{});
  };
  window.addEventListener('wisdo:account-selected',workspaceHandler);

  return {open,close,stop(){runtime.stop();timeEngine.destroy();clearInterval(holdTimer);window.removeEventListener('keydown',keyHandler,true);window.removeEventListener('wisdo:account-selected',workspaceHandler);document.documentElement.classList.remove('wisdo-live-manager-active');overlay.remove();}};
}
