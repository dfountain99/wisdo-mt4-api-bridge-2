const esc=(v='')=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

function shell(){
  return `<div id="wcV11EvolutionTop" class="wisdo-v11-evolution-top"></div>
  <aside id="wcV11TruthDock" class="wisdo-v11-truth-dock" aria-label="WISDO live truth">
    <header>
      <div><span>LIVE TRUTH DOCK</span><strong id="wcV11DockTitle">ACCOUNT LINK</strong></div>
      <button id="wcV11DockClose" type="button" aria-label="Close live truth dock">×</button>
    </header>
    <section class="wisdo-v11-link-card">
      <label>ACCOUNT<select id="wcV11AccountSelect"></select></label>
      <div class="wisdo-v11-link-grid">
        <span>Reporter<b id="wcV11Reporter">—</b></span>
        <span>Terminal<b id="wcV11Terminal">—</b></span>
        <span>AutoTrading<b id="wcV11Expert">—</b></span>
        <span>EA<b id="wcV11Bot">—</b></span>
      </div>
      <div id="wcV11LinkReason" class="wisdo-v11-link-reason">Waiting for account state.</div>
    </section>
    <div id="wcV11DockBody" class="wisdo-v11-dock-body"></div>
  </aside>`;
}

export function createTruthDock({overlay,onAccountChange=null}={}){
  const stage=overlay?.querySelector('.wisdo-command-stage');
  if(!stage) return {setState(){},setReceipt(){},open(){},close(){},destroy(){}};
  if(!stage.querySelector('#wcV11TruthDock')) stage.insertAdjacentHTML('beforeend',shell());
  const dock=stage.querySelector('#wcV11TruthDock');
  const body=dock.querySelector('#wcV11DockBody');
  const evolutionHost=stage.querySelector('#wcV11EvolutionTop');
  const oldSelect=stage.querySelector('#wcAccountSelect');
  const select=dock.querySelector('#wcV11AccountSelect');

  const move=(node,className='')=>{
    if(!node)return;
    if(className)node.classList.add(className);
    body.appendChild(node);
  };
  move(stage.querySelector('#wcV7Progress'),'wisdo-v11-dock-section');
  move(stage.querySelector('#wcV7Sense'),'wisdo-v11-dock-section');
  move(stage.querySelector('#wcV7Protocol'),'wisdo-v11-dock-section');
  move(stage.querySelector('.wisdo-v8-victories'),'wisdo-v11-dock-section');
  const receipt=stage.querySelector('#wcReceipt');
  if(receipt){
    const receiptSection=document.createElement('section');
    receiptSection.className='wisdo-v11-command-receipt';
    receiptSection.innerHTML='<h3>LAST COMMAND</h3>';
    receiptSection.appendChild(receipt);
    body.appendChild(receiptSection);
  }
  const evolution=stage.querySelector('.wisdo-v8-evolution');
  const rank=stage.querySelector('.wisdo-v8-rank-head');
  if(rank)evolutionHost.appendChild(rank);
  if(evolution)evolutionHost.appendChild(evolution);

  oldSelect?.closest('.wisdo-command-card')?.classList.add('wisdo-v11-legacy-account-card');
  if(oldSelect)oldSelect.hidden=true;

  select?.addEventListener('change',()=>onAccountChange?.(select.value));

  dock.querySelector('#wcV11DockClose')?.addEventListener('click',()=>overlay.classList.remove('truth-dock-open'));

  function setState(state={},campaign=null){
    const account=state.account||null;
    const accounts=state.accounts||[];
    const current=account?.accountId||'';
    select.innerHTML=accounts.map((a)=>{
      const value=a.legacyAccountId||a.accountId;
      const selected=String(a.accountId)===String(current)||String(a.legacyAccountId||'')===String(current);
      return `<option value="${esc(value)}" ${selected?'selected':''}>${esc(a.nickname||a.accountId)}${a.mt4Login?' · '+esc(a.mt4Login):''}${a.isPrimary?' · PRIMARY':''}</option>`;
    }).join('');
    if(!select.value&&current)select.value=current;
    const health=state.executionHealth||{};
    const control=state.campaignControl||null;
    dock.querySelector('#wcV11DockTitle').textContent=account ? (account.accountNumberMasked||account.nickname||'ACCOUNT LINK') : 'NO ACCOUNT SELECTED';
    dock.querySelector('#wcV11Reporter').textContent=health.reporter||'DISCONNECTED';
    dock.querySelector('#wcV11Terminal').textContent=health.terminalConnected===true?'CONNECTED':health.terminalConnected===false?'OFFLINE':'UNKNOWN';
    dock.querySelector('#wcV11Expert').textContent=health.expertEnabled===true?'ON':health.expertEnabled===false?'OFF':'UNKNOWN';
    dock.querySelector('#wcV11Bot').textContent=state.bot?.name||'NOT REPORTED';
    const reason=dock.querySelector('#wcV11LinkReason');
    if(!account) reason.textContent=accounts.length?'Select one authorized account to bind CORE.':'No authorized MT4 account is available to CORE.';
    else if(!health.commandLinkReady) reason.textContent=`Command link is not ready · Reporter ${health.reporter||'DISCONNECTED'}${health.terminalConnected===false?' · terminal offline':''}.`;
    else if(!control?.live) reason.textContent=campaign?'Reporter link is ready; campaign EA telemetry is missing or stale for direct campaign controls.':'Reporter link is ready; waiting for a live campaign / campaign-control telemetry.';
    else reason.textContent='Reporter + terminal + campaign control are verified for this account.';
    dock.classList.toggle('link-ready',Boolean(health.commandLinkReady));
    dock.classList.toggle('campaign-live',Boolean(control?.live));
  }

  function setReceipt(receipt){
    dock.dataset.receipt=String(receipt?.status||'idle').toLowerCase();
  }

  return {
    setState,setReceipt,
    open(){overlay.classList.add('truth-dock-open');},
    close(){overlay.classList.remove('truth-dock-open');},
    destroy(){dock.remove();evolutionHost.remove();}
  };
}
