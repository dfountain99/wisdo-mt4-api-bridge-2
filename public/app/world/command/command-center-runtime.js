import { THREE_MODULE_URL } from '../world-config.js';
import { createCampaignCoreRenderer } from './campaign-core-renderer.js';
import { createWorldCommandRuntime } from './command-runtime.js';

const money = (value, currency = 'USD') => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0)); }
  catch { return `$${Number(value || 0).toFixed(2)}`; }
};
const esc = (value = '') => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

function ensureStyles() {
  if (document.querySelector('link[data-wisdo-command-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = '/app/world/command/command-center.css'; link.dataset.wisdoCommandCss = '1';
  document.head.appendChild(link);
}

function commandMarkup() {
  return `<section id="wisdoCommandOverlay" class="wisdo-command-overlay" hidden aria-label="WISDO Campaign Command Center">
    <header class="wisdo-command-top">
      <div class="wisdo-command-brand"><span>WISDO WORLD</span><strong>CAMPAIGN COMMAND CENTER</strong></div>
      <div class="wisdo-command-scope"><div><span>ACCOUNT</span><strong id="wcScopeAccount">—</strong></div><div><span>SYMBOL</span><strong id="wcScopeSymbol">—</strong></div><div><span>CAMPAIGN</span><strong id="wcScopeCampaign">—</strong></div><div><span>LINK</span><strong id="wcScopeLink">—</strong></div></div>
      <button id="wcClose" class="wisdo-command-close">EXIT COMMAND</button>
    </header>
    <main class="wisdo-command-stage">
      <canvas id="wcCanvas" class="wisdo-command-canvas"></canvas>
      <div class="wisdo-command-chart-note">LIVE CAMPAIGN DIGITAL TWIN · DRAG TO ORBIT · SCROLL TO ZOOM</div>
      <div class="wisdo-command-crosshair"></div>
      <aside class="wisdo-command-side left">
        <section class="wisdo-command-card"><h3>ACCOUNT VAULT</h3><select id="wcAccountSelect"></select><h3 style="margin-top:12px">CAMPAIGNS</h3><div id="wcCampaignList" class="wisdo-command-list"></div></section>
        <section class="wisdo-command-card gold"><h3>LIVE POSITION NODES</h3><div id="wcPositionList" class="wisdo-command-list"></div></section>
      </aside>
      <aside class="wisdo-command-side right">
        <section class="wisdo-command-card"><h3>CAMPAIGN STATE</h3><div id="wcCampaignState"></div></section>
        <section class="wisdo-command-card"><h3>COMMAND RECEIPT</h3><div id="wcReceipt" class="wisdo-command-receipt">No command sent.</div></section>
      </aside>
      <section id="wcProposal" class="wisdo-command-proposal" hidden>
        <span>COMMAND PROPOSAL · NOTHING SENT YET</span><h2 id="wcProposalTitle">—</h2><p id="wcProposalScope">—</p><p id="wcProposalEffect">—</p><p class="wisdo-command-warning">Server will revalidate current live state before queueing the Reporter command.</p>
        <button id="wcHold" class="wisdo-command-hold"><i></i><span>HOLD TO CONFIRM</span></button>
        <button id="wcCancelProposal" class="wisdo-command-close" style="width:100%;margin-top:7px">CANCEL</button>
      </section>
    </main>
    <footer class="wisdo-command-deck"><div class="wisdo-command-groups">
      <div><h3>BOT / ENTRY CONTROL</h3><div id="wcGroupManagement" class="wisdo-command-group"></div></div>
      <div><h3>CAMPAIGN / EXIT CONTROL</h3><div id="wcGroupExit" class="wisdo-command-group"></div></div>
      <div><h3>PROTECTION / EMERGENCY</h3><div id="wcGroupProtection" class="wisdo-command-group"></div></div>
    </div></footer>
  </section>`;
}

function appendLaunchButton() {
  const nav = document.querySelector('.top-actions');
  if (!nav || document.getElementById('wisdoCommandLaunch')) return;
  const button = document.createElement('button');
  button.id = 'wisdoCommandLaunch'; button.className = 'chip wisdo-command-launch'; button.textContent = 'Command';
  nav.prepend(button);
}

function buildRoom(THREE, scene) {
  const black = new THREE.MeshStandardMaterial({ color: 0x05080c, roughness: .3, metalness: .75 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0d2634, roughness: .08, metalness: .2, transparent: true, opacity: .4, transmission: .18, clearcoat: .75 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a65d, emissive: 0x4b3208, emissiveIntensity: .9, roughness: .26, metalness: .78 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0x72e8ff, emissive: 0x075d7a, emissiveIntensity: 1.5, roughness: .18, metalness: .25 });
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 10.4, .5, 64), new THREE.MeshStandardMaterial({ color: 0x0b1117, roughness: .34, metalness: .36 })); floor.position.y = -.25; floor.receiveShadow = true; scene.add(floor);
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.1, .36, 64), black); platform.position.y = .03; platform.castShadow = true; scene.add(platform);
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(7.3, .06, 8, 100), gold); ringA.rotation.x = Math.PI / 2; ringA.position.y = .03; scene.add(ringA);
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(8.4, .035, 8, 100), cyan); ringB.rotation.x = Math.PI / 2; ringB.position.y = .05; scene.add(ringB);
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4.2 + (i % 3) * .7, .25), i % 4 === 0 ? glass : black);
    panel.position.set(Math.cos(angle) * 11.5, 2.1 + (i % 3) * .35, Math.sin(angle) * 11.5);
    panel.rotation.y = -angle + Math.PI / 2;
    scene.add(panel);
    if (i % 2 === 0) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(.07, panel.geometry.parameters.height * .72, .28), i % 4 === 0 ? gold : cyan);
      strip.position.copy(panel.position); strip.position.y += .1; strip.rotation.y = panel.rotation.y; scene.add(strip);
    }
  }
  return { black, glass, gold, cyan };
}

function controlButton(key, cap, tone = '') {
  const reason = cap?.available ? `${cap.scope || ''} · LEVEL ${cap.safetyLevel || ''}` : cap?.connected === false ? 'NOT CONNECTED' : (cap?.reason || 'UNAVAILABLE');
  return `<button class="wisdo-command-btn ${tone} ${cap?.connected === false ? 'wisdo-command-not-connected' : ''}" data-command="${esc(key)}" ${cap?.available ? '' : 'disabled'}>${esc(cap?.label || key.replaceAll('_',' '))}<em>${esc(reason)}</em></button>`;
}

export function startCampaignCommandCenter() {
  ensureStyles();
  if (!document.getElementById('wisdoCommandOverlay')) document.body.insertAdjacentHTML('beforeend', commandMarkup());
  appendLaunchButton();
  const overlay = document.getElementById('wisdoCommandOverlay');
  const canvas = document.getElementById('wcCanvas');
  const runtime = createWorldCommandRuntime({
    onState: (state, meta) => { commandState = state; selectedCampaignId = meta?.selectedCampaignId || state.selectedCampaignId || selectedCampaignId; renderState(); core?.setState(state, { campaignId: selectedCampaignId }); },
    onStatus: ({ state }) => { const el = document.getElementById('wcScopeLink'); if (el) el.textContent = state === 'live' ? 'READY' : 'DEGRADED'; },
    onReceipt: (receipt) => { latestReceipt = receipt; renderReceipt(); core?.showReceipt(receipt); if (['completed','failed','expired','cancelled'].includes(String(receipt?.status||'').toLowerCase())) runtime.refresh().catch(()=>{}); },
  });

  let commandState = null, selectedCampaignId = null, latestReceipt = null, proposal = null;
  let THREE = null, renderer = null, scene = null, camera = null, core = null, raf = 0, last = performance.now(), yaw = 0, pitch = .18, distance = 9.5, dragging = false, lastPointer = null, opened = false;

  function campaign() { return commandState?.campaigns?.find((row) => row.campaignId === selectedCampaignId) || commandState?.campaigns?.[0] || null; }

  function renderReceipt() {
    const el = document.getElementById('wcReceipt'); if (!el) return;
    const r = latestReceipt;
    if (!r) { el.textContent = 'No command sent.'; return; }
    const cls = r.status === 'completed' ? 'wisdo-command-ok' : r.status === 'failed' ? 'wisdo-command-error' : '';
    el.innerHTML = `<div class="${cls}"><strong>${esc(String(r.status || 'pending').toUpperCase())}</strong></div><div>${esc(r.command || '')}</div><div>ID ${esc(r.commandId || '')}</div><div>REQUEST ${esc(r.requestedAt || '')}</div>${r.result?.message ? `<div>${esc(r.result.message)}</div>` : ''}${r.error ? `<div class="wisdo-command-error">${esc(r.error)}</div>` : ''}`;
  }

  function renderState() {
    if (!commandState) return;
    const acct = commandState.account;
    const c = campaign();
    document.getElementById('wcScopeAccount').textContent = acct?.accountNumberMasked || acct?.nickname || '—';
    document.getElementById('wcScopeSymbol').textContent = c?.symbol || '—';
    document.getElementById('wcScopeCampaign').textContent = c?.strategyName || c?.campaignId?.slice(0,22) || '—';
    document.getElementById('wcScopeLink').textContent = commandState.executionHealth?.commandLinkReady ? 'READY' : 'DISABLED';

    const accountSelect = document.getElementById('wcAccountSelect');
    accountSelect.innerHTML = (commandState.accounts || []).map((a) => `<option value="${esc(a.accountId)}" ${a.accountId === acct?.accountId ? 'selected':''}>${esc(a.nickname || a.accountId)}${a.shared ? ' · SHARED' : ''}</option>`).join('');
    const campaignList = document.getElementById('wcCampaignList');
    campaignList.innerHTML = (commandState.campaigns || []).map((row) => `<button data-campaign="${esc(row.campaignId)}" class="${row.campaignId===selectedCampaignId?'active':''}">${esc(row.symbol)} ${esc(row.direction)} · ${esc(row.strategyName || 'CAMPAIGN')} · ${row.positionCount}</button>`).join('') || '<small>No active campaigns.</small>';
    campaignList.querySelectorAll('[data-campaign]').forEach((btn)=>btn.addEventListener('click',()=>{ selectedCampaignId=btn.dataset.campaign; runtime.selectCampaign(selectedCampaignId); core?.selectCampaign(selectedCampaignId); renderState(); }));

    const pos = document.getElementById('wcPositionList');
    pos.innerHTML = (c?.positions || []).map((p) => `<div class="wisdo-command-position"><div><strong>${esc(p.classification || 'POSITION')} ${esc(String(p.ticket||''))}</strong><br><small>${esc(p.direction)} · ENTRY ${p.entryPrice} · ${money(p.floatingMoney, commandState.financial?.currency)}</small></div><button data-close-position="${esc(String(p.ticket||''))}">CLOSE</button></div>`).join('') || '<small>No open positions in selected campaign.</small>';
    pos.querySelectorAll('[data-close-position]').forEach((btn)=>btn.addEventListener('click',()=>arm('CLOSE_POSITION',{positionId:btn.dataset.closePosition})));

    const cs = document.getElementById('wcCampaignState');
    cs.innerHTML = c ? `<div class="wisdo-command-receipt"><div>${esc(c.symbol)} ${esc(c.direction)}</div><div>${esc(c.strategyName || 'CAMPAIGN')}</div><div>CURRENT ${c.currentPrice ?? '—'}</div><div>AVG ${c.averageEntry ?? '—'}</div><div>PROTECT ${c.stopLoss ?? '—'}</div><div>TARGET ${c.takeProfit ?? '—'}</div><div>FLOATING ${money(c.floatingMoney, commandState.financial?.currency)}</div><div>POSITIONS ${c.positionCount}</div><div>REPORTER ${esc(commandState.executionHealth?.reporter || '—')}</div></div>` : '<small>Campaign Core standing by.</small>';

    const caps = commandState.capabilities || {};
    document.getElementById('wcGroupManagement').innerHTML = ['PAUSE_BOT','RESUME_BOT','STOP_NEW_ENTRIES','RESUME_NEW_ENTRIES'].map((k)=>controlButton(k,caps[k])).join('');
    document.getElementById('wcGroupExit').innerHTML = ['CLOSE_CAMPAIGN','CLOSE_ALL','CLOSE_PROFIT','CLOSE_BUYS','CLOSE_SELLS'].map((k)=>controlButton(k,caps[k],'exit')).join('');
    document.getElementById('wcGroupProtection').innerHTML = ['TRAIL_TIGHTER','TRAIL_LOOSER','BREAK_EVEN','LOCK_PROFIT','STOP_ADDS','RESUME_ADDS','EMERGENCY_STOP'].map((k)=>controlButton(k,caps[k],k==='EMERGENCY_STOP'?'emergency':'')).join('');
    overlay.querySelectorAll('[data-command]').forEach((btn)=>btn.addEventListener('click',()=>arm(btn.dataset.command)));
  }

  async function arm(action, extra = {}) {
    try {
      proposal = await runtime.propose(action,{campaignId:selectedCampaignId,...extra});
      core?.setProposal(proposal);
      document.getElementById('wcProposalTitle').textContent = proposal.label || action.replaceAll('_',' ');
      document.getElementById('wcProposalScope').textContent = `SCOPE ${proposal.scope} · ${proposal.campaign?.symbol || proposal.position?.symbol || ''} · ${proposal.affectedCount} POSITION${proposal.affectedCount===1?'':'S'} AFFECTED`;
      document.getElementById('wcProposalEffect').textContent = `CURRENT FLOATING ${money(proposal.currentFloatingPL, proposal.currency)} · HOLD ${proposal.holdRequiredMs}ms TO SEND`;
      document.getElementById('wcProposal').hidden = false;
    } catch (error) { latestReceipt = { status:'failed', command:action, error:error.message }; renderReceipt(); }
  }

  function cancelProposal(){ proposal=null; core?.clearProposal(); document.getElementById('wcProposal').hidden=true; resetHold(); }
  let holdStart=0,holdTimer=0;
  function resetHold(){ clearInterval(holdTimer);holdTimer=0;holdStart=0;const bar=document.querySelector('#wcHold i');if(bar)bar.style.width='0%'; }
  function startHold(){ if(!proposal)return; holdStart=performance.now(); resetHold(); holdStart=performance.now(); holdTimer=setInterval(()=>{const elapsed=performance.now()-holdStart;const pct=Math.min(100,(elapsed/Math.max(1,proposal.holdRequiredMs))*100);document.querySelector('#wcHold i').style.width=`${pct}%`;},30); }
  async function finishHold(){ if(!proposal||!holdStart)return;const elapsed=performance.now()-holdStart;resetHold();if(elapsed<proposal.holdRequiredMs)return;const active=proposal;document.querySelector('#wcHold span').textContent='SENDING TO WISDO…';try{latestReceipt=await runtime.execute(active,Math.round(elapsed));renderReceipt();cancelProposal();}catch(error){latestReceipt={status:'failed',command:active.label,error:error.message};renderReceipt();document.querySelector('#wcHold span').textContent='HOLD TO CONFIRM';}}

  async function ensure3D(){
    if(renderer)return;
    THREE=await import(THREE_MODULE_URL);
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    scene=new THREE.Scene();scene.background=new THREE.Color(0x03070b);scene.fog=new THREE.Fog(0x061019,18,42);
    camera=new THREE.PerspectiveCamera(48,1,.08,100);buildRoom(THREE,scene);
    scene.add(new THREE.HemisphereLight(0x83ccea,0x08090a,2.4));const key=new THREE.DirectionalLight(0xffd59b,3.3);key.position.set(-10,16,8);key.castShadow=true;scene.add(key);const cyan=new THREE.PointLight(0x54dcff,26,24,2);cyan.position.set(0,6,1);scene.add(cyan);
    const parent=new THREE.Group();parent.position.set(0,0,0);scene.add(parent);core=createCampaignCoreRenderer({THREE,parent,position:[0,0,0]});if(commandState)core.setState(commandState,{campaignId:selectedCampaignId});
    resize();last=performance.now();raf=requestAnimationFrame(frame);
  }
  function resize(){if(!renderer)return;const rect=canvas.getBoundingClientRect();renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.setSize(Math.max(1,rect.width),Math.max(1,rect.height),false);camera.aspect=Math.max(.2,rect.width/Math.max(1,rect.height));camera.updateProjectionMatrix();}
  function frame(now){raf=requestAnimationFrame(frame);if(!opened)return;const dt=Math.min(.05,(now-last)/1000||.016);last=now;const cp=Math.cos(pitch);camera.position.set(Math.sin(yaw)*cp*distance,3.2+Math.sin(pitch)*distance*.45,Math.cos(yaw)*cp*distance);camera.lookAt(0,2.25,0);core?.update(dt,now/1000);renderer.render(scene,camera);}
  function blockKey(event){if(!opened)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return;}event.stopImmediatePropagation();}
  function open(){opened=true;document.exitPointerLock?.();overlay.hidden=false;window.addEventListener('keydown',blockKey,true);ensure3D().catch((e)=>{latestReceipt={status:'failed',error:`3D Command renderer unavailable: ${e.message}`};renderReceipt();});runtime.start().catch((e)=>{latestReceipt={status:'failed',error:e.message};renderReceipt();});setTimeout(resize,30);}
  function close(){opened=false;overlay.hidden=true;window.removeEventListener('keydown',blockKey,true);cancelProposal();}

  document.getElementById('wisdoCommandLaunch')?.addEventListener('click',open);document.getElementById('wcClose')?.addEventListener('click',close);document.getElementById('wcCancelProposal')?.addEventListener('click',cancelProposal);
  const hold=document.getElementById('wcHold');hold?.addEventListener('pointerdown',(e)=>{e.preventDefault();hold.setPointerCapture?.(e.pointerId);startHold();});hold?.addEventListener('pointerup',finishHold);hold?.addEventListener('pointercancel',resetHold);hold?.addEventListener('pointerleave',(e)=>{if(e.buttons)resetHold();});
  document.getElementById('wcAccountSelect')?.addEventListener('change',(e)=>runtime.selectAccount(e.target.value).catch((err)=>{latestReceipt={status:'failed',error:err.message};renderReceipt();}));
  canvas.addEventListener('pointerdown',(e)=>{dragging=true;lastPointer=[e.clientX,e.clientY];canvas.setPointerCapture?.(e.pointerId);});canvas.addEventListener('pointermove',(e)=>{if(!dragging||!lastPointer)return;const dx=e.clientX-lastPointer[0],dy=e.clientY-lastPointer[1];yaw-=dx*.006;pitch=Math.max(-.25,Math.min(.65,pitch+dy*.004));lastPointer=[e.clientX,e.clientY];});canvas.addEventListener('pointerup',()=>{dragging=false;lastPointer=null;});canvas.addEventListener('wheel',(e)=>{e.preventDefault();distance=Math.max(6.2,Math.min(14,distance+Math.sign(e.deltaY)*.8));},{passive:false});window.addEventListener('resize',resize,{passive:true});
  return { open, close, stop(){runtime.stop();cancelAnimationFrame(raf);renderer?.dispose?.();window.removeEventListener('resize',resize);window.removeEventListener('keydown',blockKey,true);overlay.remove();} };
}
