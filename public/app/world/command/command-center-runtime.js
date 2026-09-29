import { THREE_MODULE_URL } from '../world-config.js';
import { createCampaignCoreRenderer } from './campaign-core-renderer.js';
import { createWorldCommandRuntime } from './command-runtime.js';
import { createRankAscension } from './rank-ascension.js';
import { createGuardianCommandDeck } from './guardian-command-deck.js';
import { createWisdoTimeEngine } from './wisdo-time-engine.js';
import { createTruthDock } from './truth-dock.js';

const money = (value, currency = 'USD') => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0)); }
  catch { return `$${Number(value || 0).toFixed(2)}`; }
};
const esc = (value = '') => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

function ensureStyles() {
  const styles = [
    ['/app/world/command/command-center.css?v=20260928-base', 'wisdoCommandCss'],
    ['/app/world/command/wisdo-core-v5.css?v=20260928-core-v5', 'wisdoCoreCss'],
    ['/app/world/command/wisdo-core-v6.css?v=20260928-core-v6', 'wisdoCoreV6Css'],
    ['/app/world/command/wisdo-core-v7.css?v=20260928-singularity-route', 'wisdoCoreV7Css'],
    ['/app/world/command/wisdo-core-v8-rank-ascension.css?v=20260928-rank-ascension', 'wisdoCoreV8RankCss'],
    ['/app/world/command/wisdo-core-v10-living-controls.css?v=20260928-v10-3-guardian-handoff', 'wisdoCoreV10Css'],
    ['/app/world/command/wisdo-core-v11-truth-dock.css?v=20260929-v11-truth-dock', 'wisdoCoreV11Css'],
    ['/app/world/command/wisdo-core-v12-connected.css?v=20260929-v12-connected-command-spine', 'wisdoCoreV12Css'],
  ];
  for (const [href, key] of styles) {
    const attr = `data-${key.replace(/[A-Z]/g, m => '-'+m.toLowerCase())}`;
    const existing = document.querySelector(`link[${attr}]`);
    if (existing) {
      const expected = new URL(href, location.href).href;
      if (existing.href !== expected) existing.href = href;
      continue;
    }
    const link=document.createElement('link'); link.rel='stylesheet'; link.href=href; link.dataset[key]='1'; document.head.appendChild(link);
  }
}

function commandMarkup() {
  return `<section id="wisdoCommandOverlay" class="wisdo-command-overlay" hidden aria-label="WISDO Campaign Command Center">
    <header class="wisdo-command-top">
      <div class="wisdo-command-brand"><span>CONNECT · COPY · CONTROL</span><strong>WISDO <b>CORE</b></strong></div>
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
      <nav class="wisdo-v7-nav"><button class="active">CORE</button><button>FLOW</button><button>PROTOCOLS</button><button>TIME</button><button>INTEL</button><button>SETTINGS</button></nav>
      <div class="wisdo-v7-symbol"><strong id="wcV7Symbol">—</strong><span id="wcV7CampaignName">Campaign standing by</span></div>
      <div class="wisdo-v7-states"><span>OBSERVING</span><span>ARMED</span><span class="active" id="wcV7TradingState">TRADING</span><span>PROTECTING</span><span>COLLECTING</span></div>
      <section id="wcV7Progress" class="wisdo-v7-panel"><h3>CAMPAIGN PROGRESS</h3><strong class="big" id="wcV7ProgressText">LIVE STATE</strong><div class="wisdo-v7-progress"><i id="wcV7ProgressBar"></i></div><div class="row"><span>Current P/L</span><b class="good" id="wcV7PL">—</b></div><div class="row"><span>Entries</span><b id="wcV7Entries">0</b></div></section>
      <section id="wcV7State" class="wisdo-v7-panel"><h3>CURRENT STATE</h3><strong class="big" id="wcV7StateName">Observing</strong><div class="row"><span>Direction</span><b id="wcV7Direction">—</b></div><div class="row"><span>Entry Mode</span><b>EA Managed</b></div><div class="row"><span>Protection</span><b id="wcV7Protection">—</b></div></section>
      <section id="wcV7Window" class="wisdo-v7-panel"><h3>TRADING WINDOW</h3><strong class="big">WISDO TIME</strong><div class="row"><span>Schedule</span><b>NOT CONFIGURED</b></div><div class="row"><span>Enforcement</span><b>STANDBY</b></div></section>
      <section id="wcV7Sense" class="wisdo-v7-panel"><h3>MARKET SENSE</h3><div class="row"><span>Symbol</span><b id="wcV7SenseSymbol">—</b></div><div class="row"><span>Direction</span><b id="wcV7SenseDirection">—</b></div><div class="row"><span>Session</span><b id="wcV12SenseSession">NOT REPORTED</b></div><div class="row"><span>Entry Gate</span><b id="wcV12SenseEntry">UNKNOWN</b></div><div class="row"><span>Flow Leg</span><b id="wcV12SenseLeg">—</b></div><div class="row"><span>Intent</span><b id="wcV12SenseIntent">—</b></div><div class="row"><span>Continue / Reverse</span><b id="wcV12SenseProb">—</b></div><div class="row"><span>Pressure</span><b id="wcV12SensePressure">—</b></div><div class="row"><span>Reporter</span><b class="good" id="wcV7Reporter">—</b></div><div class="row"><span>EA Link</span><b id="wcV7Link">—</b></div><div class="row"><span>Structure Rail</span><b id="wcV12SenseRail">—</b></div></section>
      <section id="wcV7Next" class="wisdo-v7-panel"><h3>NEXT EXPECTED EVENT</h3><strong class="big" id="wcV7NextText">Waiting for live state</strong><div class="row"><span>Scan</span><b>●</b></div><div class="row"><span>Validate → Enter → Manage</span><b>○ ○ ○</b></div></section>
      <section id="wcV7Protocol" class="wisdo-v7-panel"><h3>ACTIVE PROTOCOL</h3><strong class="big">DIRECT CONTROL</strong><div class="row"><span>Flow engine</span><b>STANDBY</b></div><div class="row"><span>Next</span><b>Await intent</b></div></section>
      <div class="wisdo-v7-time" aria-hidden="true"></div>
      <nav class="wisdo-core-input-rail" aria-label="WISDO input modes"><button class="wisdo-core-mode active" data-core-mode="touch">TOUCH</button><button class="wisdo-core-mode" data-core-mode="spatial">SPATIAL</button><button class="wisdo-core-mode" data-core-mode="voice">VOICE</button><button class="wisdo-core-mode" data-core-mode="text">TEXT</button><button class="wisdo-core-mode" data-core-mode="keys">KEYS</button></nav>
      <div class="wisdo-core-intent"><i></i><b>INTENT BUS</b><span id="wcIntentState">OBSERVING · INPUT READY · EXECUTION REQUIRES VERIFIED CONFIRMATION</span></div>
      <div class="wisdo-core-time" aria-hidden="true"><span class="wisdo-core-time-label">WISDO TIME · <b>WINDOW LAYER</b></span></div>
      <canvas id="wcCanvas" class="wisdo-command-canvas"></canvas>
      <div class="wisdo-command-chart-note">LIVE CAMPAIGN DIGITAL TWIN · DRAG TO ORBIT · SCROLL TO ZOOM</div>
      <div class="wisdo-command-crosshair"></div>
      <div class="wisdo-v6-protocol"><span>PROTOCOL</span><i></i><b id="wcProtocol">DIRECT CONTROL</b><i></i><span id="wcNextCondition">AWAITING INTENT</span></div>
      <div class="wisdo-command-room-label"><span>CAMPAIGN INTELLIGENCE</span><strong>WISDO CORE</strong><i></i></div>
      <aside class="wisdo-v6-status" aria-label="Live campaign truth"><section><span>CAMPAIGN</span><strong id="wcV6Campaign">STANDING BY</strong></section><section class="gold"><span>OBJECTIVE</span><strong id="wcV6Objective">AWAITING LIVE STATE</strong></section><section><span>POSITIONS</span><strong id="wcV6Positions">0</strong></section><section><span>FLOATING</span><strong id="wcV6Floating">—</strong></section></aside>
      <aside class="wisdo-v6-ack"><span>EA TRUTH LOOP</span><strong id="wcV6Ack">NO COMMAND SENT · WISDO WILL NOT DISPLAY SUCCESS BEFORE EA ACKNOWLEDGES</strong></aside>
      <button id="wcMobileInputToggle" class="wisdo-v10-mobile-input-toggle" type="button" aria-expanded="false">INPUT · GESTURE</button>\n      <div class="wisdo-v7-inputs" id="wcMobileInputModes"><button type="button" data-mobile-input="gesture"><b>↕</b>Touch / mouse · Swipe guardian</button><button type="button" disabled><b>◌</b>Camera gestures · NOT CONNECTED</button><button type="button" data-mobile-input="voice"><b>◉</b>Voice · Speak to WISDO</button><button type="button" data-mobile-input="keys"><b>⌨</b>Keys · Keyboard commands</button></div>
      <form id="wcIntentComposer" class="wisdo-v6-composer"><input id="wcIntentInput" autocomplete="off" placeholder="Tell WISDO what you want the campaign to do…" aria-label="WISDO intent"><button type="submit">INTERPRET</button></form>
      <div class="wisdo-v7-actions"><button data-command="RESUME_NEW_ENTRIES">BOOST<em>Entry control</em></button><button data-command="PAUSE_BOT">PAUSE<em>Bot</em></button><button data-command="LOCK_PROFIT">PROTECT<em>Profit</em></button><button data-command="CLOSE_CAMPAIGN">COLLECT<em>Campaign</em></button><button data-command="STOP_ADDS">STOP ADDS<em>New entries</em></button><button data-command="CLOSE_CAMPAIGN">CLOSE<em>Campaign</em></button></div>
      <div class="wisdo-v7-gesture"><strong>LIVE GUARDIAN GESTURES</strong><div><span>↑ AUTO</span><span>← PROTECT</span><span>→ TAKE PROFIT</span><span>↓ RETRACT</span></div></div>
      <div class="wisdo-core-flow" aria-label="WISDO intent flow"><div class="wisdo-core-node active"><strong>INPUT</strong> MULTIMODAL</div><i class="wisdo-core-arrow"></i><div class="wisdo-core-node"><strong>INTENT</strong> INTERPRET</div><i class="wisdo-core-arrow"></i><div class="wisdo-core-node guard"><strong>GUARD</strong> VALIDATE</div><i class="wisdo-core-arrow"></i><div class="wisdo-core-node"><strong>EA</strong> EXECUTE</div><i class="wisdo-core-arrow"></i><div class="wisdo-core-node"><strong>ACK</strong> VERIFY</div></div>
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

export function startCampaignCommandCenter({ initialAccountId = '' } = {}) {
  ensureStyles();
  if (!document.getElementById('wisdoCommandOverlay')) document.body.insertAdjacentHTML('beforeend', commandMarkup());
  appendLaunchButton();

  const overlay = document.getElementById('wisdoCommandOverlay');
  const canvas = document.getElementById('wcCanvas');
  const rankAscension = createRankAscension({ overlay });
  let truthDock = null;
  const runtime = createWorldCommandRuntime({
    initialAccountId,
    onState: (state, meta) => {
      commandState = state;
      selectedCampaignId = meta?.selectedCampaignId || state.selectedCampaignId || selectedCampaignId;
      renderState();
      core?.setState(state, { campaignId: selectedCampaignId });
      const activeCampaign = state?.campaigns?.find((row) => row.campaignId === selectedCampaignId) || state?.campaigns?.[0] || null;
      rankAscension.setCampaignState(state, activeCampaign);
      guardianDeck.setState({ ...state, selectedCampaignId });
      timeEngine.setState(state, activeCampaign);
      truthDock?.setState(state, activeCampaign);
      rankAscension.refresh(state?.account?.accountId || '').catch(() => {});
    },
    onStatus: ({ state }) => {
      const el = document.getElementById('wcScopeLink');
      if (el) el.textContent = state === 'live' ? 'READY' : 'DEGRADED';
    },
    onReceipt: (receipt) => {
      latestReceipt = receipt;
      renderReceipt();
      core?.showReceipt(receipt);
      rankAscension.onReceipt(receipt);
      guardianDeck.receipt(receipt);
      truthDock?.setReceipt(receipt);
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
  let guardianGesture = null;
  let opened = false;

  const guardianDeck = createGuardianCommandDeck({
    overlay,
    onRequest: ({ action }) => arm(action),
    onVisualState: ({ control, mode }) => {
      rankAscension.setControlMode(control, mode);
      const pose = control === 'PROTECT' ? 'protect' : control === 'TAKE_PROFIT' ? 'profit' : control === 'AUTO' ? 'auto' : 'idle';
      rankAscension.setGuardianPose(pose);
      core?.setGuardianControlState?.(control, mode);
      core?.animateGuardianPose?.(pose);
    },
  });

  const timeEngine = createWisdoTimeEngine(document.getElementById('wcV7Window'), {
    resetWindowSeconds: 120,
    onVisualState: ({ progress, live, paused }) => {
      core?.setTemporalRing?.(progress);
      core?.setTimePulse?.(live ? (paused ? 1 : .72) : .16);
    },
  });

  truthDock = createTruthDock({
    overlay,
    onAccountChange: async (accountId) => {
      if (!accountId) return;
      sessionStorage.setItem('wisdo.selectedAccountId', accountId);
      const workspaceSelector = document.querySelector('#mobile-account');
      if (workspaceSelector && [...workspaceSelector.options].some((option) => option.value === accountId)) workspaceSelector.value = accountId;
      await runtime.selectAccount(accountId);
      window.dispatchEvent(new CustomEvent('wisdo:core-account-bound', { detail: { accountId } }));
    },
  });

  function campaign() {
    return commandState?.campaigns?.find((row) => row.campaignId === selectedCampaignId) || commandState?.campaigns?.[0] || null;
  }

  function renderReceipt() {
    const el = document.getElementById('wcReceipt');
    if (!el) return;
    const r = latestReceipt;
    if (!r) { el.textContent = 'No command sent.'; const ack=document.getElementById('wcV6Ack'); if(ack) ack.textContent='NO COMMAND SENT · WISDO WILL NOT DISPLAY SUCCESS BEFORE EA ACKNOWLEDGES'; return; }
    const cls = r.status === 'completed' ? 'wisdo-command-ok' : r.status === 'failed' ? 'wisdo-command-error' : '';
    const ack=document.getElementById('wcV6Ack'); if(ack) ack.textContent=`${String(r.status || 'pending').toUpperCase()} · ${r.command || 'COMMAND'}${r.result?.message ? ' · '+r.result.message : ''}${r.error ? ' · '+r.error : ''}`;
    el.innerHTML = `<div class="${cls}"><strong>${esc(String(r.status || 'pending').toUpperCase())}</strong></div><div>${esc(r.command || '')}</div><div>ID ${esc(r.commandId || '')}</div><div>REQUEST ${esc(r.requestedAt || '')}</div>${r.result?.message ? `<div>${esc(r.result.message)}</div>` : ''}${r.error ? `<div class="wisdo-command-error">${esc(r.error)}</div>` : ''}`;
  }

  function renderState() {
    if (!commandState) return;
    const acct = commandState.account;
    const c = campaign();
    const control=commandState.campaignControl||null;
    document.getElementById('wcScopeAccount').textContent = acct ? `${acct.accountNumberMasked || acct.nickname || 'ACCOUNT'} · LINKED` : 'SELECT ACCOUNT';
    document.getElementById('wcScopeSymbol').textContent = c?.symbol || control?.symbol || '—';
    document.getElementById('wcScopeCampaign').textContent = c?.strategyName || c?.campaignId?.slice(0, 22) || (control?.live ? `EA ${Math.trunc(Number(control.campaignId||0))}` : commandState.bot?.name || '—');
    document.getElementById('wcScopeLink').textContent = commandState.executionHealth?.commandLinkReady ? 'EA VERIFIED' : 'NOT READY';
    const intentState = document.getElementById('wcIntentState');
    if (intentState) intentState.textContent = commandState.executionHealth?.commandLinkReady ? 'OBSERVING · INPUT READY · EA LINK VERIFIED' : 'OBSERVING · INPUT READY · EA LINK DEGRADED';
    const v7=(id,val)=>{const e=document.getElementById(id);if(e)e.textContent=val;};
    const campaignProgressState=control?.progress||null;
    const campaignBase=Number(campaignProgressState?.campaignBase||0);
    const targetEquity=Number(campaignProgressState?.targetEquity||0);
    const campaignProfit=Number(campaignProgressState?.realized||0)+Number(campaignProgressState?.floating||0);
    const campaignTargetGain=targetEquity-campaignBase;
    const goalProgress=control?.live && campaignBase>0 && campaignTargetGain>0
      ? Math.max(0,Math.min(100,(campaignProfit/campaignTargetGain)*100))
      : null;
    v7('wcV7Symbol',c?.symbol||control?.symbol||'—'); v7('wcV7CampaignName',c?.strategyName||c?.campaignId?.slice(0,18)|| (control?.live?'EA campaign control live':'Campaign standing by')); v7('wcV7PL',money(c?.floatingMoney??campaignProfit??0,commandState.financial?.currency)); v7('wcV7Entries',String(c?.positionCount??control?.positions?.length??0)); v7('wcV7Direction',c?.direction|| (control?.direction===1?'BUY':control?.direction===-1?'SELL':'—')); v7('wcV7Protection',c?.stopLoss ? 'ACTIVE' : control?.live ? 'EA CONTROL LIVE' : 'NOT VERIFIED'); v7('wcV7SenseSymbol',c?.symbol||control?.symbol||'—'); v7('wcV7SenseDirection',c?.direction|| (control?.direction===1?'BUY':control?.direction===-1?'SELL':'—')); v7('wcV7Reporter',commandState.executionHealth?.reporter||'—'); v7('wcV7Link',commandState.executionHealth?.commandLinkReady?'VERIFIED':'DEGRADED'); v7('wcV7StateName',c?'Trading Campaign':control?.live?'EA Campaign Control':'Observing'); v7('wcV7NextText',control?.paused?'EA PAUSED · WAITING FOR RESUME RULE':control?.session?.reported&&control.session.entryAllowed===false?'NEW ENTRIES BLOCKED BY EA TIME WINDOW':c||control?.live?'Waiting for EA / market event':'Waiting for live campaign'); v7('wcV7ProgressText',goalProgress!=null?`${goalProgress.toFixed(0)}% TO NEXT H620 MILESTONE`:control?.live?'EA CAMPAIGN · TARGET TELEMETRY NOT REPORTED':c?'LIVE CAMPAIGN':'LIVE STATE');
    v7('wcV12SenseSession',control?.live&&control?.session?.reported?`${control.session.name} · Q ${Number(control.session.quality||0).toFixed(2)}`:'NOT REPORTED');
    v7('wcV12SenseEntry',control?.live&&control?.session?.reported?(control.session.entryAllowed?'ALLOWED':'BLOCKED'):'UNKNOWN');
    const sense=control?.marketSense||null;
    v7('wcV12SenseLeg',control?.live?sense?.flowLeg?`LEG ${sense.flowLeg}`:'OBSERVE':'—');
    v7('wcV12SenseIntent',control?.live&&sense?`${Math.round(Number(sense.intentScore||0)*100)}%`:'—');
    v7('wcV12SenseProb',control?.live&&sense?`${Math.round(Number(sense.continuationProbability||0)*100)}% / ${Math.round(Number(sense.reversalProbability||0)*100)}%`:'—');
    v7('wcV12SensePressure',control?.live&&sense?`${Number(sense.pressureBias||0).toFixed(2)}${sense.continuationDefense?' · DEFEND':''}`:'—');
    v7('wcV12SenseRail',control?.live&&Number(control?.rail)>0?`${Number(control.rail).toFixed(5)} · PHASE ${Number(control.phase||0)}`:'—');
    const pbar=document.getElementById('wcV7ProgressBar'); if(pbar)pbar.style.width=goalProgress==null?'0%':`${goalProgress.toFixed(1)}%`;
    const v6Campaign=document.getElementById('wcV6Campaign'); if(v6Campaign) v6Campaign.textContent=c ? `${c.symbol} · ${c.direction} · ${c.strategyName || 'CAMPAIGN'}` : 'STANDING BY';
    const v6Objective=document.getElementById('wcV6Objective'); if(v6Objective) v6Objective.textContent=c ? `PROTECT ${c.stopLoss ?? '—'} · TARGET ${c.takeProfit ?? '—'}` : 'AWAITING LIVE STATE';
    const v6Positions=document.getElementById('wcV6Positions'); if(v6Positions) v6Positions.textContent=String(c?.positionCount || 0);
    const v6Floating=document.getElementById('wcV6Floating'); if(v6Floating) v6Floating.textContent=money(c?.floatingMoney || 0,commandState.financial?.currency);

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
      overlay.classList.remove('deck-open', 'intel-open', 'mobile-input-open', 'truth-dock-open');
      syncToggleButtons();
      return proposal;
    } catch (error) {
      latestReceipt = { status: 'failed', command: action, error: error.message };
      renderReceipt();
      return null;
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
    const guardianVisual = guardianDeck.state;
    core.setGuardianControlState?.(guardianVisual.control, guardianVisual.mode);
    timeEngine.render();
    resize();
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function syncViewportMode() {
    const widths = [
      Number(window.innerWidth || 0),
      Number(document.documentElement?.clientWidth || 0),
      Number(window.visualViewport?.width || 0),
    ].filter((value) => Number.isFinite(value) && value > 0);
    const viewportWidth = widths.length ? Math.min(...widths) : 1024;
    const mobile = viewportWidth <= 760;
    overlay.classList.toggle('mobile-command-chamber', mobile);
    overlay.dataset.viewportMode = mobile ? 'mobile' : 'desktop';
    document.documentElement.classList.toggle('wisdo-core-mobile-active', mobile && opened);
    if (!mobile) {
      overlay.classList.remove('mobile-input-open');
      overlay.querySelectorAll('.mobile-expanded').forEach((node) => node.classList.remove('mobile-expanded'));
      mobileInputToggle?.setAttribute('aria-expanded', 'false');
    }
    return mobile;
  }

  function resize() {
    syncViewportMode();
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
    document.getElementById('wcIntelToggle')?.classList.toggle('active', overlay.classList.contains('truth-dock-open'));
  }
  function toggleDeck(force) {
    const next = typeof force === 'boolean' ? force : !overlay.classList.contains('deck-open');
    overlay.classList.toggle('deck-open', next);
    if (next) overlay.classList.remove('truth-dock-open');
    syncToggleButtons();
  }
  function toggleIntel(force) {
    const next = typeof force === 'boolean' ? force : !overlay.classList.contains('truth-dock-open');
    overlay.classList.toggle('truth-dock-open', next);
    if (next) overlay.classList.remove('deck-open');
    syncToggleButtons();
  }

  function blockKey(event) {
    if (!opened) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (overlay.classList.contains('deck-open')) { toggleDeck(false); return; }
      if (overlay.classList.contains('truth-dock-open')) { toggleIntel(false); return; }
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
    syncViewportMode();
    overlay.classList.toggle('truth-dock-open', !overlay.classList.contains('mobile-command-chamber'));
    syncToggleButtons();
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
    overlay.classList.remove('deck-open', 'intel-open', 'mobile-input-open');
    document.documentElement.classList.remove('wisdo-core-mobile-active');
    window.removeEventListener('keydown', blockKey, true);
    cancelProposal();
    guardianDeck.retractAll();
  }

  document.getElementById('wisdoCommandLaunch')?.addEventListener('click', open);
  document.getElementById('wcClose')?.addEventListener('click', close);
  document.getElementById('wcDeckToggle')?.addEventListener('click', () => toggleDeck());
  document.getElementById('wcIntelToggle')?.addEventListener('click', () => toggleIntel());
  document.getElementById('wcDeckClose')?.addEventListener('click', () => toggleDeck(false));
  document.getElementById('wcCancelProposal')?.addEventListener('click', cancelProposal);

  document.getElementById('wcIntentComposer')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input=document.getElementById('wcIntentInput');
    const raw=String(input?.value || '').trim();
    if(!raw) return;
    const normalized=raw.toUpperCase().replace(/[^A-Z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
    const direct=[
      [/^(PAUSE|PAUSE BOT)$/, 'PAUSE_BOT'],
      [/^(RESUME|RESUME BOT)$/, 'RESUME_BOT'],
      [/^(STOP NEW ENTRIES|LOCK ENTRIES)$/, 'STOP_NEW_ENTRIES'],
      [/^(RESUME NEW ENTRIES|UNLOCK ENTRIES)$/, 'RESUME_NEW_ENTRIES'],
      [/^(CLOSE CAMPAIGN|COLLECT CAMPAIGN)$/, 'CLOSE_CAMPAIGN'],
      [/^(CLOSE PROFIT|COLLECT PROFIT)$/, 'CLOSE_PROFIT'],
      [/^(BREAK EVEN|BREAKEVEN)$/, 'BREAK_EVEN'],
      [/^(LOCK PROFIT|PROTECT PROFIT)$/, 'LOCK_PROFIT'],
      [/^(STOP ADDS|HOLD ADDS)$/, 'STOP_ADDS'],
      [/^(RESUME ADDS)$/, 'RESUME_ADDS'],
      [/^(EMERGENCY STOP)$/, 'EMERGENCY_STOP']
    ];
    const match=direct.find(([re])=>re.test(normalized));
    const state=document.getElementById('wcIntentState');
    if(!match){ if(state) state.textContent='INTENT UNDERSTOOD AS LANGUAGE · NO SAFE LIVE MAPPING YET · NOTHING SENT'; return; }
    if(state) state.textContent=`INTENT PREVIEW · ${match[1].replaceAll('_',' ')} · AWAITING SERVER PROPOSAL`;
    arm(match[1]);
    input.value='';
  });

  const mobileInputToggle = document.getElementById('wcMobileInputToggle');
  mobileInputToggle?.addEventListener('click', () => {
    const open = !overlay.classList.contains('mobile-input-open');
    overlay.classList.toggle('mobile-input-open', open);
    mobileInputToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  overlay.querySelectorAll('[data-mobile-input]').forEach((btn) => btn.addEventListener('click', () => {
    const mode = String(btn.dataset.mobileInput || 'touch').toUpperCase();
    if (mobileInputToggle) mobileInputToggle.textContent = `INPUT · ${mode}`;
    overlay.classList.remove('mobile-input-open');
    mobileInputToggle?.setAttribute('aria-expanded', 'false');
    const intentState = document.getElementById('wcIntentState');
    if (intentState) intentState.textContent = `${mode} INPUT SELECTED · COMMANDS STILL REQUIRE PREVIEW + VERIFIED CONFIRMATION`;
  }));

  ['wcV7Progress','wcV7State','wcV7Sense','wcV7Next'].forEach((id) => {
    const panel = document.getElementById(id);
    if (!panel) return;
    panel.setAttribute('tabindex','0');
    panel.setAttribute('role','button');
    panel.setAttribute('aria-expanded','false');
    const togglePanel = () => {
      if (!overlay.classList.contains('mobile-command-chamber')) return;
      const expanded = !panel.classList.contains('mobile-expanded');
      panel.classList.toggle('mobile-expanded', expanded);
      panel.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    };
    panel.addEventListener('click', togglePanel);
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); togglePanel(); }
    });
  });

  overlay.querySelectorAll('[data-core-mode]').forEach((btn) => btn.addEventListener('click', () => {
    overlay.querySelectorAll('[data-core-mode]').forEach((node) => node.classList.toggle('active', node === btn));
    const intentState = document.getElementById('wcIntentState');
    const mode = String(btn.dataset.coreMode || 'touch').toUpperCase();
    if (intentState) intentState.textContent = `${mode} INPUT SELECTED · COMMANDS STILL REQUIRE PREVIEW + VERIFIED CONFIRMATION`;
  }));

  const guardianHost = document.getElementById('wcV8CharacterChamber');
  const gestureFeedback=document.createElement('div');
  gestureFeedback.className='wisdo-v12-gesture-feedback';
  gestureFeedback.textContent='SWIPE ↑ AUTO · ← PROTECT · → TAKE PROFIT · ↓ RETRACT';
  guardianHost?.appendChild(gestureFeedback);
  const announceGesture = (text,tone='') => {
    const intentState = document.getElementById('wcIntentState');
    if (intentState) intentState.textContent = text;
    if(gestureFeedback){
      gestureFeedback.textContent=text;
      gestureFeedback.dataset.tone=tone;
      gestureFeedback.classList.remove('pulse'); void gestureFeedback.offsetWidth; gestureFeedback.classList.add('pulse');
    }
  };
  const beginGuardianGesture = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    guardianGesture = { x: event.clientX, y: event.clientY, at: performance.now(), pointerId: event.pointerId };
    guardianHost?.classList.add('gesture-tracking');
    guardianHost?.setPointerCapture?.(event.pointerId);
  };
  const requestGestureControl=async(control,label)=>{
    announceGesture(`GESTURE RECOGNIZED · ${label} · OPENING VERIFIED PROPOSAL`,'pending');
    const result=await guardianDeck.requestControl(control);
    if(result?.ok) announceGesture(`${label} PROPOSAL OPEN · HOLD TO CONFIRM BEFORE EA COMMAND`,'ok');
    else announceGesture(`${label} UNAVAILABLE · ${result?.reason||'EA LINK NOT READY'} · NOTHING SENT`,'error');
  };
  const finishGuardianGesture = async (event) => {
    if (!guardianGesture || guardianGesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - guardianGesture.x;
    const dy = event.clientY - guardianGesture.y;
    const distance = Math.hypot(dx, dy);
    guardianGesture = null;
    guardianHost?.classList.remove('gesture-tracking');
    if (distance < 38) {
      announceGesture('GUARDIAN READY · SWIPE ↑ AUTO · ← PROTECT · → TAKE PROFIT · ↓ RETRACT');
      return;
    }
    if (Math.abs(dy) > Math.abs(dx) && dy < -38) { await requestGestureControl('AUTO','AUTO'); return; }
    if (Math.abs(dy) > Math.abs(dx) && dy > 38) {
      guardianDeck.retractAll();
      announceGesture('GUARDIAN CONTROLS RETRACTED · NOTHING SENT');
      return;
    }
    if (dx < -38) { await requestGestureControl('PROTECT','PROTECT'); return; }
    if (dx > 38) await requestGestureControl('TAKE_PROFIT','TAKE PROFIT');
  };
  guardianHost?.addEventListener('pointerdown', beginGuardianGesture);
  guardianHost?.addEventListener('pointerup', finishGuardianGesture);
  guardianHost?.addEventListener('pointercancel', () => { guardianGesture = null; guardianHost?.classList.remove('gesture-tracking'); });

  const onWorkspaceAccountSelected = (event) => {
    const accountId = String(event.detail?.selectedAccountId || '');
    if (!accountId || accountId === runtime.accountId) return;
    sessionStorage.setItem('wisdo.selectedAccountId', accountId);
    runtime.selectAccount(accountId).catch((error) => {
      latestReceipt = { status: 'failed', command: 'ACCOUNT_BIND', error: error.message };
      renderReceipt();
    });
  };
  window.addEventListener('wisdo:account-selected', onWorkspaceAccountSelected);

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
  window.visualViewport?.addEventListener('resize', resize, { passive: true });
  syncViewportMode();

  return {
    open,
    close,
    stop() {
      runtime.stop();
      guardianDeck.destroy();
      timeEngine.destroy();
      rankAscension.stop();
      cancelAnimationFrame(raf);
      renderer?.dispose?.();
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.removeEventListener('keydown', blockKey, true);
      window.removeEventListener('wisdo:account-selected', onWorkspaceAccountSelected);
      guardianHost?.removeEventListener('pointerdown', beginGuardianGesture);
      guardianHost?.removeEventListener('pointerup', finishGuardianGesture);
      truthDock?.destroy();
      document.documentElement.classList.remove('wisdo-core-mobile-active');
      overlay.remove();
    },
  };
}
