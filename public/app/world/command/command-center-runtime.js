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
  link.rel = 'stylesheet';
  link.href = '/app/world/command/command-center.css?v=20260912-command-world-v4';
  link.dataset.wisdoCommandCss = '1';
  document.head.appendChild(link);
}

function commandMarkup() {
  return `<section id="wisdoCommandOverlay" class="wisdo-command-overlay" hidden aria-label="WISDO Campaign Command Center">
    <header class="wisdo-command-top">
      <div class="wisdo-command-brand"><span>WISDO WORLD</span><strong>CAMPAIGN COMMAND CENTER</strong></div>
      <div class="wisdo-command-scope">
        <div><span>ACCOUNT</span><strong id="wcScopeAccount">—</strong></div>
        <div><span>SYMBOL</span><strong id="wcScopeSymbol">—</strong></div>
        <div><span>CAMPAIGN</span><strong id="wcScopeCampaign">—</strong></div>
        <div><span>LINK</span><strong id="wcScopeLink">—</strong></div>
      </div>
      <div class="wisdo-command-actions">
        <button id="wcIntelToggle" class="wisdo-command-hud-toggle" type="button">INTEL</button>
        <button id="wcDeckToggle" class="wisdo-command-hud-toggle" type="button">COMMANDS</button>
        <button id="wcClose" class="wisdo-command-close" type="button">EXIT</button>
      </div>
    </header>
    <main class="wisdo-command-stage">
      <canvas id="wcCanvas" class="wisdo-command-canvas"></canvas>
      <div class="wisdo-command-chart-note">LIVE CAMPAIGN DIGITAL TWIN · DRAG TO ORBIT · SCROLL TO ZOOM</div>
      <div class="wisdo-command-crosshair"></div>
      <div class="wisdo-command-room-label"><span>LIVE EXECUTION ENVIRONMENT</span><strong>WISDO MARKET CORE</strong><i></i></div>
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
    <footer class="wisdo-command-deck" aria-label="Campaign controls">
      <div class="wisdo-command-deck-head"><strong>COMMAND DECK</strong><button id="wcDeckClose" class="wisdo-command-deck-close" type="button" aria-label="Close command deck">×</button></div>
      <div class="wisdo-command-groups">
        <div><h3>BOT / ENTRY CONTROL</h3><div id="wcGroupManagement" class="wisdo-command-group"></div></div>
        <div><h3>CAMPAIGN / EXIT CONTROL</h3><div id="wcGroupExit" class="wisdo-command-group"></div></div>
        <div><h3>PROTECTION / EMERGENCY</h3><div id="wcGroupProtection" class="wisdo-command-group"></div></div>
      </div>
    </footer>
  </section>`;
}

function appendLaunchButton() {
  const nav = document.querySelector('.top-actions');
  if (!nav || document.getElementById('wisdoCommandLaunch')) return;
  const button = document.createElement('button');
  button.id = 'wisdoCommandLaunch';
  button.className = 'chip wisdo-command-launch';
  button.textContent = 'Command';
  nav.prepend(button);
}

function buildRoom(THREE, scene) {
  const black = new THREE.MeshStandardMaterial({ color: 0x04080d, roughness: .27, metalness: .8 });
  const graphite = new THREE.MeshStandardMaterial({ color: 0x101a22, roughness: .34, metalness: .68 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x526571, roughness: .23, metalness: .88 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0c2734, roughness: .08, metalness: .18, transparent: true, opacity: .32, transmission: .12, clearcoat: .9 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd2ad57, emissive: 0x553603, emissiveIntensity: 1.2, roughness: .22, metalness: .82 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0x72e8ff, emissive: 0x075d7a, emissiveIntensity: 1.75, roughness: .16, metalness: .28 });
  const cyanBasic = new THREE.MeshBasicMaterial({ color: 0x72e8ff, toneMapped: false });
  const goldBasic = new THREE.MeshBasicMaterial({ color: 0xe1ba5f, toneMapped: false });

  const floor = new THREE.Mesh(new THREE.CylinderGeometry(12.7, 13.1, .62, 96), graphite);
  floor.position.y = -.34;
  floor.receiveShadow = true;
  scene.add(floor);

  const lowerDisc = new THREE.Mesh(new THREE.CylinderGeometry(8.6, 9.1, .28, 72), black);
  lowerDisc.position.y = .02;
  lowerDisc.receiveShadow = true;
  scene.add(lowerDisc);

  const corePit = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.2, .3, 72), new THREE.MeshStandardMaterial({ color: 0x07131b, roughness: .2, metalness: .7 }));
  corePit.position.y = .18;
  scene.add(corePit);

  const glassDeck = new THREE.Mesh(new THREE.RingGeometry(5.35, 8.35, 96), glass);
  glassDeck.rotation.x = -Math.PI / 2;
  glassDeck.position.y = .23;
  scene.add(glassDeck);

  const floorRings = [];
  [[5.18,.055,cyanBasic],[6.85,.035,goldBasic],[8.55,.045,cyanBasic],[11.15,.026,goldBasic]].forEach(([radius,tube,material]) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 128), material);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = .29;
    scene.add(ring);
    floorRings.push(ring);
  });

  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.45, .12, 3.55), i % 2 ? graphite : black);
    bridge.position.set(Math.cos(angle) * 10.0, .28, Math.sin(angle) * 10.0);
    bridge.rotation.y = -angle + Math.PI / 2;
    bridge.receiveShadow = true;
    scene.add(bridge);
    const guide = new THREE.Mesh(new THREE.BoxGeometry(.045, .025, 3.1), i % 2 ? cyanBasic : goldBasic);
    guide.position.copy(bridge.position);
    guide.position.y = .36;
    guide.rotation.y = bridge.rotation.y;
    scene.add(guide);
  }

  const upperRing = new THREE.Group();
  const ringOuter = new THREE.Mesh(new THREE.TorusGeometry(11.7, .09, 10, 128), steel);
  ringOuter.rotation.x = Math.PI / 2;
  ringOuter.position.y = 6.9;
  upperRing.add(ringOuter);
  const ringLight = new THREE.Mesh(new THREE.TorusGeometry(10.9, .025, 6, 128), cyanBasic);
  ringLight.rotation.x = Math.PI / 2;
  ringLight.position.y = 6.82;
  upperRing.add(ringLight);
  scene.add(upperRing);

  for (let i = 0; i < 18; i += 1) {
    const angle = (i / 18) * Math.PI * 2;
    const radius = 13.35;
    const h = 5.3 + (i % 3) * .7;
    const bay = new THREE.Group();
    bay.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    bay.rotation.y = -angle + Math.PI / 2;

    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.18, h, .52), i % 6 === 0 ? glass : black);
    pillar.position.y = h / 2;
    pillar.castShadow = true;
    bay.add(pillar);

    const spine = new THREE.Mesh(new THREE.BoxGeometry(.045, h * .7, .58), i % 3 === 0 ? goldBasic : cyanBasic);
    spine.position.set(-.43, h * .54, .03);
    bay.add(spine);

    if (i % 2 === 0) {
      const consoleBase = new THREE.Mesh(new THREE.BoxGeometry(1.72, .72, .95), graphite);
      consoleBase.position.set(0,.52,-1.25);
      consoleBase.rotation.x = -.13;
      bay.add(consoleBase);
      const consoleScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.25,.42), new THREE.MeshBasicMaterial({ color: i % 4 === 0 ? 0xd2ad57 : 0x63dff8, transparent:true, opacity:.55, toneMapped:false }));
      consoleScreen.position.set(0,.86,-1.74);
      consoleScreen.rotation.x = -.13;
      bay.add(consoleScreen);
    }
    scene.add(bay);
  }

  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(.16, 6.2, .25), steel);
    rib.position.set(Math.cos(angle) * 11.72, 3.65, Math.sin(angle) * 11.72);
    rib.rotation.z = .10 * Math.sin(angle);
    rib.rotation.y = -angle;
    scene.add(rib);
  }

  const moteCount = window.matchMedia?.('(max-width: 620px)').matches ? 180 : 360;
  const motePositions = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 4.7 + Math.random() * 8.1;
    motePositions[i * 3] = Math.cos(angle) * radius;
    motePositions[i * 3 + 1] = .5 + Math.random() * 7.2;
    motePositions[i * 3 + 2] = Math.sin(angle) * radius;
  }
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const motes = new THREE.Points(moteGeometry, new THREE.PointsMaterial({ color: 0x65dff7, size: .025, transparent: true, opacity: .42, depthWrite: false, toneMapped: false }));
  scene.add(motes);

  const beacon = new THREE.PointLight(0x59ddff, 34, 20, 2);
  beacon.position.set(0, 3.9, 0);
  scene.add(beacon);
  const goldLight = new THREE.PointLight(0xd8ac54, 16, 15, 2);
  goldLight.position.set(0, 1.1, 0);
  scene.add(goldLight);

  return {
    black, steel, glass, gold, cyan, cyanBasic,
    update(t) {
      upperRing.rotation.y = Math.sin(t * .08) * .04;
      motes.rotation.y = t * .012;
      floorRings[0].material.opacity = 1;
      beacon.intensity = 31 + Math.sin(t * 1.4) * 5;
      goldLight.intensity = 14 + Math.sin(t * 1.05 + 1) * 3;
    },
  };
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
    onState: (state, meta) => {
      commandState = state;
      selectedCampaignId = meta?.selectedCampaignId || state.selectedCampaignId || selectedCampaignId;
      renderState();
      core?.setState(state, { campaignId: selectedCampaignId });
    },
    onStatus: ({ state }) => {
      const el = document.getElementById('wcScopeLink');
      if (el) el.textContent = state === 'live' ? 'READY' : 'DEGRADED';
    },
    onReceipt: (receipt) => {
      latestReceipt = receipt;
      renderReceipt();
      core?.showReceipt(receipt);
      if (['completed','failed','expired','cancelled'].includes(String(receipt?.status || '').toLowerCase())) runtime.refresh().catch(() => {});
    },
  });

  let commandState = null;
  let selectedCampaignId = null;
  let latestReceipt = null;
  let proposal = null;
  let THREE = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let core = null;
  let roomFx = null;
  let raf = 0;
  let last = performance.now();
  let yaw = .46;
  let pitch = .23;
  let distance = window.matchMedia?.('(max-width: 620px)').matches ? 13.6 : 11.8;
  let dragging = false;
  let lastPointer = null;
  let opened = false;

  function campaign() {
    return commandState?.campaigns?.find((row) => row.campaignId === selectedCampaignId) || commandState?.campaigns?.[0] || null;
  }

  function renderReceipt() {
    const el = document.getElementById('wcReceipt');
    if (!el) return;
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
    document.getElementById('wcScopeCampaign').textContent = c?.strategyName || c?.campaignId?.slice(0, 22) || '—';
    document.getElementById('wcScopeLink').textContent = commandState.executionHealth?.commandLinkReady ? 'READY' : 'DISABLED';

    const accountSelect = document.getElementById('wcAccountSelect');
    accountSelect.innerHTML = (commandState.accounts || []).map((a) => `<option value="${esc(a.accountId)}" ${a.accountId === acct?.accountId ? 'selected' : ''}>${esc(a.nickname || a.accountId)}${a.shared ? ' · SHARED' : ''}</option>`).join('');

    const campaignList = document.getElementById('wcCampaignList');
    campaignList.innerHTML = (commandState.campaigns || []).map((row) => `<button data-campaign="${esc(row.campaignId)}" class="${row.campaignId === selectedCampaignId ? 'active' : ''}">${esc(row.symbol)} ${esc(row.direction)} · ${esc(row.strategyName || 'CAMPAIGN')} · ${row.positionCount}</button>`).join('') || '<small>No active campaigns.</small>';
    campaignList.querySelectorAll('[data-campaign]').forEach((btn) => btn.addEventListener('click', () => {
      selectedCampaignId = btn.dataset.campaign;
      runtime.selectCampaign(selectedCampaignId);
      core?.selectCampaign(selectedCampaignId);
      renderState();
    }));

    const pos = document.getElementById('wcPositionList');
    pos.innerHTML = (c?.positions || []).map((p) => `<div class="wisdo-command-position"><div><strong>${esc(p.classification || 'POSITION')} ${esc(String(p.ticket || ''))}</strong><br><small>${esc(p.direction)} · ENTRY ${p.entryPrice} · ${money(p.floatingMoney, commandState.financial?.currency)}</small></div><button data-close-position="${esc(String(p.ticket || ''))}">CLOSE</button></div>`).join('') || '<small>No open positions in selected campaign.</small>';
    pos.querySelectorAll('[data-close-position]').forEach((btn) => btn.addEventListener('click', () => arm('CLOSE_POSITION', { positionId: btn.dataset.closePosition })));

    const cs = document.getElementById('wcCampaignState');
    cs.innerHTML = c ? `<div class="wisdo-command-receipt"><div>${esc(c.symbol)} ${esc(c.direction)}</div><div>${esc(c.strategyName || 'CAMPAIGN')}</div><div>CURRENT ${c.currentPrice ?? '—'}</div><div>AVG ${c.averageEntry ?? '—'}</div><div>PROTECT ${c.stopLoss ?? '—'}</div><div>TARGET ${c.takeProfit ?? '—'}</div><div>FLOATING ${money(c.floatingMoney, commandState.financial?.currency)}</div><div>POSITIONS ${c.positionCount}</div><div>REPORTER ${esc(commandState.executionHealth?.reporter || '—')}</div></div>` : '<small>Campaign Core standing by.</small>';

    const caps = commandState.capabilities || {};
    document.getElementById('wcGroupManagement').innerHTML = ['PAUSE_BOT','RESUME_BOT','STOP_NEW_ENTRIES','RESUME_NEW_ENTRIES'].map((k) => controlButton(k, caps[k])).join('');
    document.getElementById('wcGroupExit').innerHTML = ['CLOSE_CAMPAIGN','CLOSE_ALL','CLOSE_PROFIT','CLOSE_BUYS','CLOSE_SELLS'].map((k) => controlButton(k, caps[k], 'exit')).join('');
    document.getElementById('wcGroupProtection').innerHTML = ['TRAIL_TIGHTER','TRAIL_LOOSER','BREAK_EVEN','LOCK_PROFIT','STOP_ADDS','RESUME_ADDS','EMERGENCY_STOP'].map((k) => controlButton(k, caps[k], k === 'EMERGENCY_STOP' ? 'emergency' : '')).join('');
    overlay.querySelectorAll('[data-command]').forEach((btn) => btn.addEventListener('click', () => arm(btn.dataset.command)));
  }

  async function arm(action, extra = {}) {
    try {
      proposal = await runtime.propose(action, { campaignId: selectedCampaignId, ...extra });
      core?.setProposal(proposal);
      document.getElementById('wcProposalTitle').textContent = proposal.label || action.replaceAll('_', ' ');
      document.getElementById('wcProposalScope').textContent = `SCOPE ${proposal.scope} · ${proposal.campaign?.symbol || proposal.position?.symbol || ''} · ${proposal.affectedCount} POSITION${proposal.affectedCount === 1 ? '' : 'S'} AFFECTED`;
      document.getElementById('wcProposalEffect').textContent = `CURRENT FLOATING ${money(proposal.currentFloatingPL, proposal.currency)} · HOLD ${proposal.holdRequiredMs}ms TO SEND`;
      document.getElementById('wcProposal').hidden = false;
      overlay.classList.remove('deck-open', 'intel-open');
      syncToggleButtons();
    } catch (error) {
      latestReceipt = { status: 'failed', command: action, error: error.message };
      renderReceipt();
    }
  }

  function cancelProposal() {
    proposal = null;
    core?.clearProposal();
    document.getElementById('wcProposal').hidden = true;
    resetHold();
  }

  let holdStart = 0;
  let holdTimer = 0;
  function resetHold() {
    clearInterval(holdTimer);
    holdTimer = 0;
    holdStart = 0;
    const bar = document.querySelector('#wcHold i');
    if (bar) bar.style.width = '0%';
  }
  function startHold() {
    if (!proposal) return;
    resetHold();
    holdStart = performance.now();
    holdTimer = setInterval(() => {
      const elapsed = performance.now() - holdStart;
      const pct = Math.min(100, (elapsed / Math.max(1, proposal.holdRequiredMs)) * 100);
      document.querySelector('#wcHold i').style.width = `${pct}%`;
    }, 30);
  }
  async function finishHold() {
    if (!proposal || !holdStart) return;
    const elapsed = performance.now() - holdStart;
    resetHold();
    if (elapsed < proposal.holdRequiredMs) return;
    const active = proposal;
    document.querySelector('#wcHold span').textContent = 'SENDING TO WISDO…';
    try {
      latestReceipt = await runtime.execute(active, Math.round(elapsed));
      renderReceipt();
      cancelProposal();
    } catch (error) {
      latestReceipt = { status: 'failed', command: active.label, error: error.message };
      renderReceipt();
      document.querySelector('#wcHold span').textContent = 'HOLD TO CONFIRM';
    }
  }

  async function ensure3D() {
    if (renderer) return;
    THREE = await import(THREE_MODULE_URL);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x010407, 1);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010407);
    scene.fog = new THREE.FogExp2(0x031019, .025);
    camera = new THREE.PerspectiveCamera(48, 1, .08, 120);
    roomFx = buildRoom(THREE, scene);

    const hemi = new THREE.HemisphereLight(0x8fdfff, 0x05080a, 1.7);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffd79b, 3.1);
    key.position.set(-10, 16, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x62dfff, 2.2);
    rim.position.set(12, 8, -10);
    scene.add(rim);

    const parent = new THREE.Group();
    scene.add(parent);
    core = createCampaignCoreRenderer({
      THREE,
      parent,
      position: [0, 0, 0],
      materials: { black: roomFx.black, steel: roomFx.steel, glass: roomFx.glass, gold: roomFx.gold, goldGlow: roomFx.gold, cyan: roomFx.cyan, cyanBasic: roomFx.cyanBasic },
    });
    if (commandState) core.setState(commandState, { campaignId: selectedCampaignId });
    resize();
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    if (!renderer) return;
    const rect = canvas.getBoundingClientRect();
    const mobile = rect.width < 650;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.35 : 1.7));
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
    camera.aspect = Math.max(.2, rect.width / Math.max(1, rect.height));
    camera.updateProjectionMatrix();
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!opened) return;
    const dt = Math.min(.05, (now - last) / 1000 || .016);
    last = now;
    const cp = Math.cos(pitch);
    camera.position.set(Math.sin(yaw) * cp * distance, 3.25 + Math.sin(pitch) * distance * .5, Math.cos(yaw) * cp * distance);
    camera.lookAt(0, 2.0, 0);
    roomFx?.update(now / 1000);
    core?.update(dt, now / 1000);
    renderer.render(scene, camera);
  }

  function syncToggleButtons() {
    document.getElementById('wcDeckToggle')?.classList.toggle('active', overlay.classList.contains('deck-open'));
    document.getElementById('wcIntelToggle')?.classList.toggle('active', overlay.classList.contains('intel-open'));
  }
  function toggleDeck(force) {
    const next = typeof force === 'boolean' ? force : !overlay.classList.contains('deck-open');
    overlay.classList.toggle('deck-open', next);
    if (next) overlay.classList.remove('intel-open');
    syncToggleButtons();
  }
  function toggleIntel(force) {
    const next = typeof force === 'boolean' ? force : !overlay.classList.contains('intel-open');
    overlay.classList.toggle('intel-open', next);
    if (next) overlay.classList.remove('deck-open');
    syncToggleButtons();
  }

  function blockKey(event) {
    if (!opened) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (overlay.classList.contains('deck-open')) { toggleDeck(false); return; }
      if (overlay.classList.contains('intel-open')) { toggleIntel(false); return; }
      close();
      return;
    }
    event.stopImmediatePropagation();
  }

  function open() {
    opened = true;
    document.exitPointerLock?.();
    overlay.hidden = false;
    overlay.classList.remove('deck-open', 'intel-open');
    syncToggleButtons();
    window.addEventListener('keydown', blockKey, true);
    ensure3D().catch((e) => {
      latestReceipt = { status: 'failed', error: `3D Command renderer unavailable: ${e.message}` };
      renderReceipt();
    });
    runtime.start().catch((e) => {
      latestReceipt = { status: 'failed', error: e.message };
      renderReceipt();
    });
    setTimeout(resize, 30);
  }

  function close() {
    opened = false;
    overlay.hidden = true;
    overlay.classList.remove('deck-open', 'intel-open');
    window.removeEventListener('keydown', blockKey, true);
    cancelProposal();
  }

  document.getElementById('wisdoCommandLaunch')?.addEventListener('click', open);
  document.getElementById('wcClose')?.addEventListener('click', close);
  document.getElementById('wcDeckToggle')?.addEventListener('click', () => toggleDeck());
  document.getElementById('wcIntelToggle')?.addEventListener('click', () => toggleIntel());
  document.getElementById('wcDeckClose')?.addEventListener('click', () => toggleDeck(false));
  document.getElementById('wcCancelProposal')?.addEventListener('click', cancelProposal);

  const hold = document.getElementById('wcHold');
  hold?.addEventListener('pointerdown', (e) => { e.preventDefault(); hold.setPointerCapture?.(e.pointerId); startHold(); });
  hold?.addEventListener('pointerup', finishHold);
  hold?.addEventListener('pointercancel', resetHold);
  hold?.addEventListener('pointerleave', (e) => { if (e.buttons) resetHold(); });

  document.getElementById('wcAccountSelect')?.addEventListener('change', (e) => runtime.selectAccount(e.target.value).catch((err) => {
    latestReceipt = { status: 'failed', error: err.message };
    renderReceipt();
  }));

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastPointer = [e.clientX, e.clientY];
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || !lastPointer) return;
    const dx = e.clientX - lastPointer[0];
    const dy = e.clientY - lastPointer[1];
    yaw -= dx * .006;
    pitch = Math.max(-.18, Math.min(.62, pitch + dy * .004));
    lastPointer = [e.clientX, e.clientY];
  });
  canvas.addEventListener('pointerup', () => { dragging = false; lastPointer = null; });
  canvas.addEventListener('pointercancel', () => { dragging = false; lastPointer = null; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    distance = Math.max(7.2, Math.min(17, distance + Math.sign(e.deltaY) * .8));
  }, { passive: false });
  window.addEventListener('resize', resize, { passive: true });

  return {
    open,
    close,
    stop() {
      runtime.stop();
      cancelAnimationFrame(raf);
      renderer?.dispose?.();
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', blockKey, true);
      overlay.remove();
    },
  };
}
