import { createWorldCommandRuntime } from './command-runtime.js';
import { createWisdoTimeEngine } from './wisdo-time-engine.js';

const esc=(v='')=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const money=(v,c='USD')=>{try{return new Intl.NumberFormat(undefined,{style:'currency',currency:c,maximumFractionDigits:2}).format(finite(v));}catch{return `$${finite(v).toFixed(2)}`;}};
const ago=(value)=>{const t=Date.parse(value||'');if(!Number.isFinite(t))return '—';const s=Math.max(0,Math.floor((Date.now()-t)/1000));return s<60?`${s}s ago`:s<3600?`${Math.floor(s/60)}m ago`:`${Math.floor(s/3600)}h ago`;};

function ensureStyles(){
  const href='/app/world/command/wisdo-continuity-v17.css?v=20261003-v17';
  let link=document.querySelector('link[data-wisdo-continuity-v17]');
  if(!link){link=document.createElement('link');link.rel='stylesheet';link.dataset.wisdoContinuityV17='1';document.head.appendChild(link);}
  link.href=href;
}

function markup(){
  return `<section id="wisdoCommandOverlay" class="wisdo-command-overlay" hidden aria-label="WISDO Continuity Live Manager">
    <div class="c-shell">
      <header class="c-top">
        <div class="c-brand"><small>CONNECT · COPY · CONTROL</small><strong>WISDO <b>CONTINUITY</b></strong></div>
        <div class="c-scope">
          <div><span>ACCOUNT</span><b id="cAccount">—</b></div>
          <div><span>SYMBOL</span><b id="cSymbol">—</b></div>
          <div><span>CAMPAIGN</span><b id="cCampaign">—</b></div>
          <div><span>EA LINK</span><b id="cLink">—</b></div>
        </div>
        <button id="cMode" class="c-mode" type="button">DESK</button>
        <button id="cExit" class="c-exit" type="button">EXIT</button>
      </header>

      <section class="c-command">
        <div class="c-command-head">
          <div><span class="c-label">THOUGHT → CONTEXT → PLAN → EXECUTION → TRUTH</span><h1>What do you want WISDO to do?</h1><p>Speak naturally from a connected WISDO voice device or type it here. WISDO resolves the live object and compiles only verified capabilities.</p></div>
          <span id="cLinkPill" class="c-link">CHECKING LINK</span>
        </div>
        <form id="cForm" class="c-form">
          <input id="cInput" autocomplete="off" placeholder="Protect this more… If I get stopped, counter me… When I enter my room, wake my laptop…" aria-label="Tell WISDO what you want">
          <button class="c-send" type="submit">INTERPRET</button>
        </form>
        <div class="c-under"><span id="cStatus" class="c-status">Loading live context…</span><span id="cVoice" class="c-voice">VOICE · CHECKING DEVICE</span></div>
      </section>

      <section class="c-four">
        <article class="c-story now"><span class="c-label">NOW</span><h2>Live situation</h2><div id="cNow"></div></article>
        <article class="c-story intent"><span class="c-label">YOUR INTENT</span><h2>What WISDO understands</h2><div id="cIntent"><p>No active instruction yet.</p></div></article>
        <article class="c-story waiting"><span class="c-label">WISDO IS WAITING FOR</span><h2>Next verified hinge</h2><div id="cWaiting"><p>Nothing pending.</p></div></article>
        <article class="c-story verified"><span class="c-label">VERIFIED ACTIONS</span><h2>What actually happened</h2><div id="cVerified"><p>No verified receipts yet.</p></div></article>
      </section>

      <div class="c-layout">
        <main class="c-main">
          <section class="c-card">
            <div class="c-card-head"><div><span class="c-label">LIVE CAMPAIGN</span><h3>Broker truth</h3></div><small id="cCampaignTruth">—</small></div>
            <div class="c-metrics">
              <div class="c-metric"><span>FLOATING</span><b id="cFloating">—</b></div>
              <div class="c-metric"><span>POSITIONS</span><b id="cCount">0</b></div>
              <div class="c-metric"><span>STOP ATR</span><b id="cStop">—</b></div>
              <div class="c-metric"><span>TRAIL</span><b id="cTrail">—</b></div>
              <div class="c-metric"><span>ENTRY GATE</span><b id="cGate">—</b></div>
            </div>
            <div class="c-table-wrap" style="margin-top:10px"><table class="c-table"><thead><tr><th>TICKET</th><th>SIDE</th><th>ROLE</th><th>LOTS</th><th>ENTRY</th><th>NOW</th><th>SL</th><th>TP</th><th>P/L</th></tr></thead><tbody id="cPositions"><tr><td colspan="9">Waiting for Reporter.</td></tr></tbody></table></div>
          </section>

          <section class="c-card c-time-host" id="cTime"></section>
        </main>

        <aside class="c-side">
          <section class="c-card">
            <div class="c-card-head"><div><span class="c-label">CONTEXT</span><h3>Account & campaign</h3></div></div>
            <select id="cAccountSelect" class="c-select"></select>
            <div id="cCampaigns" class="c-campaigns"></div>
          </section>

          <section class="c-card">
            <div class="c-card-head"><div><span class="c-label">REFLEXES</span><h3>Reusable verified intentions</h3></div><small>REAL ACTIONS ONLY</small></div>
            <div id="cReflexes" class="c-reflexes"></div>
          </section>

          <section class="c-card">
            <div class="c-card-head"><div><span class="c-label">STANDING INTENTIONS</span><h3>Rules that keep watching</h3></div></div>
            <div id="cStanding" class="c-standing"><div class="c-standing-item"><span>None active.</span></div></div>
          </section>

          <section class="c-card">
            <div class="c-card-head"><div><span class="c-label">LIFE / DEVICE CONTEXT</span><h3>Presence & handoff</h3></div></div>
            <div id="cEnvironment" class="c-environment"></div>
          </section>
        </aside>
      </div>
    </div>

    <section id="cProposal" class="c-proposal" hidden>
      <span class="c-label">WISDO PLAN · NOTHING SENT YET</span>
      <h2 id="cProposalTitle">Review live intention</h2>
      <p id="cProposalMeaning">—</p>
      <p id="cProposalScope">—</p>
      <div class="c-proposal-actions">
        <button id="cHold" class="c-hold" type="button"><i></i><span>HOLD TO CONFIRM</span></button>
        <button id="cCancel" class="c-cancel" type="button">CANCEL</button>
      </div>
    </section>
  </section>`;
}

function appendLaunchButton(){
  const nav=document.querySelector('.top-actions');if(!nav||document.getElementById('wisdoCommandLaunch'))return;
  const button=document.createElement('button');button.id='wisdoCommandLaunch';button.className='chip wisdo-command-launch';button.textContent='Live Manager';nav.prepend(button);
}

export function startCampaignCommandCenter({initialAccountId=''}={}){
  ensureStyles();document.getElementById('wisdoCommandOverlay')?.remove();document.body.insertAdjacentHTML('beforeend',markup());appendLaunchButton();
  const overlay=document.getElementById('wisdoCommandOverlay'),q=(s)=>overlay.querySelector(s);
  let world=null,continuity=null,selectedCampaignId=null,opened=false,refreshingContinuity=false,continuityTimer=0;
  let activeProposal=null,holdStart=0,holdTimer=0;
  const announced=new Set();
  const timeEngine=createWisdoTimeEngine(q('#cTime'),{resetWindowSeconds:120});

  const runtime=createWorldCommandRuntime({
    initialAccountId:initialAccountId||sessionStorage.getItem('wisdo.selectedAccountId')||'',
    onState:(state,meta)=>{world=state;selectedCampaignId=meta?.selectedCampaignId||state?.selectedCampaignId||state?.campaigns?.[0]?.campaignId||null;renderWorld();if(opened)refreshContinuity().catch(()=>{});},
    onStatus:({state,error})=>{if(state==='degraded'&&error)setStatus(`Live state unavailable · ${error.message}`,'bad');},
    onReceipt:(receipt)=>{announceReceipt(receipt);renderReceiptUpdate(receipt);setTimeout(()=>refreshContinuity().catch(()=>{}),250);},
  });

  function setStatus(text,tone=''){const el=q('#cStatus');el.textContent=text;el.className=`c-status ${tone}`.trim();}
  const activeCampaign=()=>world?.campaigns?.find((row)=>String(row.campaignId)===String(selectedCampaignId))||world?.campaigns?.[0]||null;
  const currency=()=>world?.financial?.currency||'USD';

  function meaningText(value){
    if(!value)return 'No active instruction yet.';
    if(typeof value==='string')return value;
    if(value.label)return value.label;
    if(value.action)return value.action.replaceAll('_',' ');
    if(value.name)return value.name;
    return 'WISDO has a structured live plan.';
  }

  function renderWorld(){
    if(!world)return;const campaign=activeCampaign(),control=world.campaignControl||{},health=world.executionHealth||{},account=world.account;
    q('#cAccount').textContent=account?.accountNumberMasked||account?.nickname||'SELECT ACCOUNT';
    q('#cSymbol').textContent=campaign?.symbol||control.symbol||'—';
    q('#cCampaign').textContent=campaign?.strategyName||campaign?.campaignId|| (control.live?`EA ${Math.trunc(finite(control.campaignId))}`:'—');
    q('#cLink').textContent=health.commandLinkReady?'EA VERIFIED':'NOT READY';
    q('#cLinkPill').textContent=health.commandLinkReady?'EA LINK VERIFIED':'EA LINK NOT READY';q('#cLinkPill').className=`c-link ${health.commandLinkReady?'live':''}`;
    q('#cFloating').textContent=money(campaign?.floatingMoney??world.financial?.floatingPL??0,currency());q('#cFloating').className=finite(campaign?.floatingMoney??world.financial?.floatingPL)>=0?'c-good':'c-bad';
    q('#cCount').textContent=String(campaign?.positionCount||0);
    q('#cStop').textContent=control.runtime?.stopAtr?`${Number(control.runtime.stopAtr).toFixed(2)} ATR`:'—';
    q('#cTrail').textContent=control.runtime?.trailDistanceAtr?`${Number(control.runtime.trailDistanceAtr).toFixed(2)} ATR`:'—';
    q('#cGate').textContent=control.session?.reported?(control.session.entryAllowed?'OPEN':'BLOCKED'):'UNKNOWN';
    q('#cGate').className=control.session?.entryAllowed?'c-good':control.session?.reported?'c-warn':'';
    q('#cCampaignTruth').textContent=control.live?`${control.direction===1?'BUY':control.direction===-1?'SELL':'FLAT'} · REPORTER + EA LIVE`:'CAMPAIGN TELEMETRY NOT LIVE';

    const accounts=world.accounts||[];q('#cAccountSelect').innerHTML=accounts.map((row)=>`<option value="${esc(row.accountId)}" ${String(row.accountId)===String(account?.accountId)?'selected':''}>${esc(row.nickname||row.accountId)}${row.mt4Login?` · MT4 ${esc(row.mt4Login)}`:''}</option>`).join('');
    q('#cCampaigns').innerHTML=(world.campaigns||[]).length?(world.campaigns||[]).map((row)=>`<button type="button" class="c-campaign ${String(row.campaignId)===String(campaign?.campaignId)?'active':''}" data-campaign="${esc(row.campaignId)}">${esc(row.symbol)} · ${esc(row.direction)} · ${row.positionCount||0}</button>`).join(''):'<small>No active campaigns.</small>';

    const selectedTicket=String(continuity?.continuity?.focus?.ticket||'');
    q('#cPositions').innerHTML=(campaign?.positions||[]).length?campaign.positions.map((p)=>{
      const pl=finite(p.floatingMoney);const role=control.positions?.find((x)=>String(x.ticket)===String(p.ticket))?.role;
      const roleName=role===0?'HOLD':role===1?'COLLECTOR':role===2?'RUNNER':p.classification||'—';
      return `<tr data-ticket="${esc(p.ticket)}" class="${selectedTicket===String(p.ticket)?'selected':''}"><td>${esc(p.ticket)}</td><td>${esc(p.direction)}</td><td>${esc(roleName)}</td><td>${finite(p.lots).toFixed(2)}</td><td>${p.entryPrice??'—'}</td><td>${p.currentPrice??'—'}</td><td>${p.stopLoss??'—'}</td><td>${p.takeProfit??'—'}</td><td class="${pl>=0?'profit':'loss'}">${money(pl,currency())}</td></tr>`;
    }).join(''):'<tr><td colspan="9">No open positions in this campaign.</td></tr>';
    timeEngine.setState(world,campaign);
  }

  function renderContinuity(){
    if(!continuity)return;const nowState=continuity.now||{},counter=continuity.standing?.counterOnStop;
    q('#cMode').textContent=nowState.operatingMode||'DESK';q('#cMode').className=`c-mode ${nowState.operatingMode==='AWAY'?'away':''}`;

    const nowBits=[];
    if(nowState.campaign)nowBits.push(`<div class="big ${finite(nowState.campaign.floatingMoney)>=0?'c-good':'c-bad'}">${money(nowState.campaign.floatingMoney,currency())}</div><p>${esc(nowState.campaign.symbol)} · ${esc(nowState.campaign.direction)} · ${nowState.campaign.positionCount||0} position${nowState.campaign.positionCount===1?'':'s'}</p>`);
    else nowBits.push('<p>No active campaign.</p>');
    nowBits.push(`<small>${nowState.executionHealth?.commandLinkReady?'Reporter and EA command link verified':'Execution link not ready'}</small>`);
    q('#cNow').innerHTML=nowBits.join('');

    const intent=continuity.intent;q('#cIntent').innerHTML=intent?`<p><b>${esc(intent.text||'Current intention')}</b></p><p>${esc(meaningText(intent.meaning))}</p><small>${esc(intent.kind||'intent')} · ${ago(intent.updatedAt)}</small>`:'<p>No active instruction yet.</p>';

    const waiting=continuity.waiting;q('#cWaiting').innerHTML=waiting?`<p class="c-warn"><b>${esc(waiting.label)}</b></p><small>${esc(waiting.source||'continuity')}</small>`:'<p class="c-good">No unresolved execution or standing trigger right now.</p>';

    const verified=continuity.verified||[];q('#cVerified').innerHTML=verified.length?`<ul>${verified.slice(0,5).map((r)=>`<li><b class="${String(r.status).toLowerCase()==='completed'?'c-good':'c-bad'}">${esc(String(r.status||'').toUpperCase())}</b> · ${esc(r.command||'COMMAND')}<br><small>${esc(r.result?.message||r.error||'Verified receipt')} · ${ago(r.completedAt||r.failedAt||r.requestedAt)}</small></li>`).join('')}</ul>`:'<p>No verified receipts yet.</p>';

    const standing=[];
    if(counter?.armed||counter?.pending)standing.push(`<div class="c-standing-item"><b>COUNTER ON STOP · ${counter.pending?'WAITING FOR REVERSAL':'ARMED'}</b><span>Source campaign ${esc(counter.sourceCampaignId||'—')} · HIGHTOWER confirmation ${counter.confirmationBars||1} bar(s)</span></div>`);
    for(const b of continuity.standing?.behaviors||[])if(['active','paused','shadow'].includes(b.status))standing.push(`<div class="c-standing-item"><b>${esc(b.name)} · ${esc(String(b.status).toUpperCase())}</b><span>${esc(b.definition?.trigger?.type||b.purpose||'standing behavior')}</span></div>`);
    for(const scene of continuity.standing?.presenceScenes||[])standing.push(`<div class="c-standing-item"><b>PRESENCE · ${esc(scene.content)}</b><span>Real component scene · ${ago(scene.updated_at)}</span></div>`);
    q('#cStanding').innerHTML=standing.length?standing.join(''):'<div class="c-standing-item"><span>No standing instructions.</span></div>';

    const reflexes=[...(continuity.continuity?.builtInReflexes||[]),...(continuity.continuity?.customReflexes||[]).map((r)=>({key:r.memory_id,name:r.content}))];
    q('#cReflexes').innerHTML=reflexes.map((r)=>`<button class="c-reflex" type="button" data-reflex="${esc(r.key)}" title="${esc(r.description||'Verified saved reflex')}">${esc(r.name)}</button>`).join('')||'<small>No executable reflexes.</small>';

    const env=[],room=nowState.room,device=continuity.continuity?.primaryDevice,components=continuity.continuity?.onlineComponents||[];
    env.push(`<div class="c-env"><span>ROOM</span><b>${room?esc(room.room_id):'NO LIVE ROOM SENSOR'}</b></div>`);
    env.push(`<div class="c-env"><span>PRIMARY DEVICE</span><b>${device?esc(device.device_name||device.device_id):'NO LIVE HANDOFF'}</b></div>`);
    env.push(`<div class="c-env"><span>ONLINE COMPONENTS</span><b>${components.length}</b></div>`);
    env.push(`<div class="c-env"><span>VOICE</span><b>${voiceDeviceLive()?'LIVE DEVICE':'NO RECENT VOICE HEARTBEAT'}</b></div>`);
    q('#cEnvironment').innerHTML=env.join('');
    q('#cVoice').textContent=voiceDeviceLive()?'VOICE · CONNECTED DEVICE · SAME VERIFIED INTENT PATH':'VOICE · NO RECENT ENROLLED DEVICE HEARTBEAT';
    renderWorld();
  }

  function voiceDeviceLive(){
    const devices=continuity?.continuity?.devices||[];return devices.some((d)=>d.last_heartbeat_at&&Date.now()-Date.parse(d.last_heartbeat_at)<120000&&!d.muted);
  }

  async function refreshContinuity(){
    if(refreshingContinuity)return continuity;refreshingContinuity=true;
    try{continuity=await runtime.continuityState();renderContinuity();return continuity;}
    catch(error){setStatus(`Continuity unavailable · ${error.message}`,'bad');return continuity;}
    finally{refreshingContinuity=false;}
  }

  function scheduleContinuity(){clearTimeout(continuityTimer);if(!opened)return;continuityTimer=setTimeout(async()=>{await refreshContinuity();scheduleContinuity();},3200);}

  function renderReceiptUpdate(receipt){
    const status=String(receipt?.status||'').toLowerCase();
    if(status==='completed')setStatus(receipt.result?.message||'EA verified command execution.','good');
    else if(status==='failed')setStatus(receipt.error||'EA reported command failure.','bad');
    else setStatus('Command queued. Waiting for Reporter/HIGHTOWER acknowledgement.','warn');
  }

  function announceReceipt(receipt){
    const status=String(receipt?.status||'').toLowerCase();if(!['completed','failed'].includes(status)||!receipt?.commandId||announced.has(receipt.commandId))return;
    announced.add(receipt.commandId);const detail=String(receipt?.result?.message||receipt?.error||receipt?.command||'Trading command');
    try{if('speechSynthesis'in window&&localStorage.getItem('wisdo.commandVoiceAlerts')!=='off'){const u=new SpeechSynthesisUtterance(status==='completed'?`WISDO. Command verified. ${detail}`:`WISDO. Command failed. ${detail}`);u.rate=.92;window.speechSynthesis.speak(u);}}catch{}
    try{if('Notification'in window&&Notification.permission==='granted'&&navigator.serviceWorker?.ready)navigator.serviceWorker.ready.then((r)=>r.showNotification(status==='completed'?'WISDO · VERIFIED':'WISDO · FAILED',{body:detail.slice(0,220),tag:`wisdo-${receipt.commandId}`})).catch(()=>{});}catch{}
  }

  function cancelProposal(){activeProposal=null;holdStart=0;clearInterval(holdTimer);holdTimer=0;q('#cProposal').hidden=true;q('#cHold i').style.width='0%';q('#cHold span').textContent='HOLD TO CONFIRM';}

  async function acceptWorldProposal(proposal,meaning=null){
    if(Number(proposal.holdRequiredMs||0)<=0){
      const receipt=await runtime.execute(proposal,0);renderReceiptUpdate(receipt);await refreshContinuity();return;
    }
    activeProposal={kind:'world',proposal,meaning};showProposal();
  }
  async function acceptContinuityProposal(proposal,meaning=null){activeProposal={kind:'continuity',proposal,meaning};showProposal();}
  function showProposal(){
    const p=activeProposal?.proposal;if(!p)return;
    q('#cProposalTitle').textContent=p.label||p.payload?.name||p.type?.replaceAll('_',' ')||'Confirm WISDO plan';
    q('#cProposalMeaning').textContent=typeof activeProposal.meaning==='string'?activeProposal.meaning:meaningText(activeProposal.meaning||p.payload);
    q('#cProposalScope').textContent=`${p.scope||p.type||'CONTINUITY'} · hold ${(Number(p.holdRequiredMs||0)/1000).toFixed(1)}s · WISDO will revalidate before execution`;
    q('#cProposal').hidden=false;
  }

  async function handleResult(result){
    if(result.kind==='world_proposal'){setStatus('Intent resolved to a verified trading plan. Review before execution.','warn');await acceptWorldProposal(result.proposal,result.meaning);return;}
    if(result.kind==='continuity_proposal'){setStatus('Standing/device intention compiled. Review before activation.','warn');await acceptContinuityProposal(result.proposal,result.meaning);return;}
    if(result.kind==='completed'){setStatus(result.message||'Continuity state updated.','good');await refreshContinuity();return;}
    if(result.kind==='clarification'){setStatus(result.message||'One live detail is ambiguous. Nothing was sent.','warn');await refreshContinuity();return;}
    if(result.kind==='unavailable'){setStatus(result.message||'That outcome has no verified executor. Nothing was sent.','bad');await refreshContinuity();return;}
    setStatus(result.message||'No executable change was made.','warn');await refreshContinuity();
  }

  q('#cForm').addEventListener('submit',async(event)=>{
    event.preventDefault();try{if('Notification'in window&&Notification.permission==='default')Notification.requestPermission().catch(()=>{});}catch{}
    const input=q('#cInput'),text=String(input.value||'').trim();if(!text)return;input.value='';
    setStatus('WISDO is resolving your words against the live account, focused object, standing rules, and verified capabilities…','warn');
    try{await handleResult(await runtime.interpretContinuity(text,{campaignId:selectedCampaignId,ticket:continuity?.continuity?.focus?.ticket||''}));}
    catch(error){setStatus(`Nothing sent · ${error.message}`,'bad');}
  });

  q('#cAccountSelect').addEventListener('change',async(event)=>{
    const id=String(event.target.value||'');sessionStorage.setItem('wisdo.selectedAccountId',id);selectedCampaignId=null;
    try{await runtime.selectAccount(id);await runtime.focusContinuity({accountId:id});await refreshContinuity();}catch(error){setStatus(error.message,'bad');}
  });
  q('#cCampaigns').addEventListener('click',async(event)=>{
    const button=event.target.closest('[data-campaign]');if(!button)return;
    selectedCampaignId=runtime.selectCampaign(button.dataset.campaign);
    try{continuity=await runtime.focusContinuity({accountId:runtime.accountId,campaignId:selectedCampaignId});renderContinuity();setStatus('Campaign is now the conversational subject.','good');}catch(error){setStatus(error.message,'bad');}
  });
  q('#cPositions').addEventListener('click',async(event)=>{
    const row=event.target.closest('[data-ticket]');if(!row)return;
    try{continuity=await runtime.focusContinuity({accountId:runtime.accountId,campaignId:selectedCampaignId,ticket:row.dataset.ticket});renderContinuity();setStatus(`Ticket ${row.dataset.ticket} is now “this trade.”`,'good');}catch(error){setStatus(error.message,'bad');}
  });
  q('#cReflexes').addEventListener('click',async(event)=>{
    const button=event.target.closest('[data-reflex]');if(!button)return;
    try{const result=await runtime.runContinuityReflex(button.dataset.reflex,{campaignId:selectedCampaignId,ticket:continuity?.continuity?.focus?.ticket||''});await handleResult(result);}catch(error){setStatus(`Reflex blocked · ${error.message}`,'bad');}
  });
  q('#cMode').addEventListener('click',async()=>{
    const current=continuity?.now?.operatingMode||'DESK',next=current==='DESK'?'AWAY':'DESK';
    try{continuity=await runtime.setContinuityMode(next);renderContinuity();setStatus(`${next} mode active. Continuity state persists across connected interfaces.`,'good');}catch(error){setStatus(error.message,'bad');}
  });

  q('#cHold').addEventListener('pointerdown',(event)=>{
    if(!activeProposal)return;event.preventDefault();q('#cHold').setPointerCapture?.(event.pointerId);holdStart=performance.now();clearInterval(holdTimer);
    const required=Math.max(1,Number(activeProposal.proposal.holdRequiredMs||1));holdTimer=setInterval(()=>{q('#cHold i').style.width=`${Math.min(100,(performance.now()-holdStart)/required*100)}%`;},30);
  });
  const finishHold=async()=>{
    if(!activeProposal||!holdStart)return;const elapsed=performance.now()-holdStart,required=Number(activeProposal.proposal.holdRequiredMs||0);holdStart=0;clearInterval(holdTimer);holdTimer=0;
    if(elapsed<required){q('#cHold i').style.width='0%';return;}
    const active=activeProposal;q('#cHold span').textContent='REVALIDATING…';
    try{
      if(active.kind==='world'){const receipt=await runtime.execute(active.proposal,Math.round(elapsed));renderReceiptUpdate(receipt);}
      else {const result=await runtime.executeContinuity(active.proposal,Math.round(elapsed));setStatus(result.message||'Continuity plan activated.','good');}
      cancelProposal();await refreshContinuity();
    }catch(error){cancelProposal();setStatus(`Execution blocked · ${error.message}`,'bad');}
  };
  q('#cHold').addEventListener('pointerup',finishHold);q('#cHold').addEventListener('pointercancel',()=>{holdStart=0;clearInterval(holdTimer);q('#cHold i').style.width='0%';});q('#cCancel').addEventListener('click',()=>{cancelProposal();setStatus('Plan cancelled. Nothing was sent.','warn');});

  function open(){opened=true;overlay.hidden=false;document.documentElement.classList.add('wisdo-continuity-active');runtime.start().then(()=>refreshContinuity()).catch((error)=>setStatus(error.message,'bad'));scheduleContinuity();}
  function close(){opened=false;overlay.hidden=true;clearTimeout(continuityTimer);cancelProposal();document.documentElement.classList.remove('wisdo-continuity-active');}
  const keyHandler=(event)=>{if(opened&&event.key==='Escape'){event.preventDefault();activeProposal?cancelProposal():close();}};
  window.addEventListener('keydown',keyHandler,true);document.getElementById('wisdoCommandLaunch')?.addEventListener('click',open);q('#cExit').addEventListener('click',close);
  const workspaceHandler=(event)=>{const id=String(event.detail?.selectedAccountId||'');if(id&&id!==runtime.accountId)runtime.selectAccount(id).then(()=>runtime.focusContinuity({accountId:id})).then(()=>refreshContinuity()).catch(()=>{});};
  window.addEventListener('wisdo:account-selected',workspaceHandler);

  return {open,close,stop(){opened=false;runtime.stop();timeEngine.destroy();clearTimeout(continuityTimer);clearInterval(holdTimer);window.removeEventListener('keydown',keyHandler,true);window.removeEventListener('wisdo:account-selected',workspaceHandler);document.documentElement.classList.remove('wisdo-continuity-active');overlay.remove();}};
}
