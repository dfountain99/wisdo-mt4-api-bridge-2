import { worldEventBus } from './world-event-bus.js';

const STORAGE_KEY = 'wisdo-world-companion-v1';
const MODES = new Set(['glance', 'expanded', 'focus', 'collapsed']);
const SIDE_MODES = new Set(['auto', 'right', 'left']);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const money = (value, currency = 'USD') => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(number); }
  catch { return `${number.toFixed(2)} ${currency}`; }
};
const escText = (value = '') => String(value).replace(/[\n\r\t]+/g, ' ').slice(0, 72);

function readPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      mode: MODES.has(stored.mode) ? stored.mode : 'glance',
      side: SIDE_MODES.has(stored.side) ? stored.side : 'auto',
      streamer: Boolean(stored.streamer),
    };
  } catch { return { mode: 'glance', side: 'auto', streamer: false }; }
}

function persistPreferences(preferences) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch {}
}

async function requestSnapshot() {
  const response = await fetch('/api/world/state', { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`World state unavailable (${response.status})`);
  return response.json();
}

function normalizeSnapshot(snapshot) {
  const world = snapshot?.worldData || snapshot?.homeRuntime?.live || {};
  return {
    account: world.activeAccount || world.account || null,
    financial: world.financial || null,
    positions: Array.isArray(world.positions) ? world.positions : [],
    reporters: Array.isArray(world.reporters) ? world.reporters : [],
    generatedAt: world.generatedAt || snapshot?.updatedAt || null,
  };
}

function freshestSignal(signalState) {
  const rows = [...signalState.values()].filter((row) => row && row.presentationStatus !== 'expired' && row.tradeStatus !== 'closed');
  rows.sort((a, b) => Date.parse(b.tradeTimestamp || b.serverTimestamp || 0) - Date.parse(a.tradeTimestamp || a.serverTimestamp || 0));
  return rows[0] || null;
}

function signalRemaining(signal, clockOffsetMs) {
  const expires = Date.parse(signal?.expiresAt || '');
  if (!Number.isFinite(expires)) return null;
  return Math.max(0, Math.ceil((expires - (Date.now() + clockOffsetMs)) / 1000));
}

function line(ctx, text, x, y, { font = '600 28px system-ui', fill = '#dff8ff', align = 'left' } = {}) {
  ctx.font = font; ctx.fillStyle = fill; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(escText(text), x, y);
}

function installLinkControl(api) {
  if (document.getElementById('wisdoLinkControl')) return () => {};
  const nav = document.querySelector('.top-actions');
  if (!nav) return () => {};
  const button = document.createElement('button');
  button.id = 'wisdoLinkControl';
  button.className = 'chip';
  button.type = 'button';
  button.textContent = 'WISDO Link';
  button.setAttribute('aria-label', 'Open WISDO Link companion controls');
  nav.prepend(button);

  const panel = document.createElement('div');
  panel.id = 'wisdoLinkPanel';
  panel.hidden = true;
  panel.style.cssText = 'position:fixed;z-index:8800;right:max(14px,env(safe-area-inset-right));top:82px;width:min(330px,calc(100vw - 28px));padding:14px;border:1px solid rgba(202,166,93,.42);border-radius:18px;background:rgba(5,10,16,.94);backdrop-filter:blur(12px);box-shadow:0 22px 70px rgba(0,0,0,.42);color:#eefaff;font:600 12px/1.45 system-ui';
  document.body.appendChild(panel);

  const render = () => {
    const state = api.state;
    panel.innerHTML = `<div style="color:#caa65d;letter-spacing:.16em;font-size:10px">WISDO LINK · PRIVATE OWNER UI</div><strong style="display:block;font-size:19px;margin:4px 0 10px">Companion Dashboard</strong><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px"><button data-mode="glance">GLANCE</button><button data-mode="expanded">EXPANDED</button><button data-mode="focus">FOCUS</button><button data-mode="collapsed">ORB</button><button data-side="${state.side === 'right' ? 'left' : 'right'}">SIDE: ${state.side.toUpperCase()}</button><button data-streamer="1">STREAMER: ${state.streamer ? 'ON' : 'OFF'}</button></div><small style="display:block;color:#8da8b9;margin-top:10px">Live financial state remains server-authoritative. WISDO Link never bypasses Command confirmation.</small>`;
    panel.querySelectorAll('button').forEach((el) => { el.style.cssText = 'border:1px solid rgba(111,229,255,.24);border-radius:12px;background:#0a1520;color:#eaf9ff;padding:10px;font:700 10px system-ui;letter-spacing:.08em'; });
    panel.querySelectorAll('[data-mode]').forEach((el) => el.addEventListener('click', () => { api.setMode(el.dataset.mode); render(); }));
    panel.querySelector('[data-side]')?.addEventListener('click', () => { api.setSide(panel.querySelector('[data-side]').dataset.side); render(); });
    panel.querySelector('[data-streamer]')?.addEventListener('click', () => { api.setStreamer(!api.state.streamer); render(); });
  };
  const toggle = () => { panel.hidden = !panel.hidden; if (!panel.hidden) render(); };
  button.addEventListener('click', toggle);
  const closeOutside = (event) => { if (!panel.hidden && !panel.contains(event.target) && event.target !== button) panel.hidden = true; };
  document.addEventListener('pointerdown', closeOutside);
  return () => { document.removeEventListener('pointerdown', closeOutside); button.remove(); panel.remove(); };
}

export function startWorldCompanionDashboard() {
  let stopped = false;
  let spatial = globalThis.WisdoWorldSpatialContext || null;
  let group = null;
  let panelMesh = null;
  let orbMesh = null;
  let texture = null;
  let canvas = null;
  let context = null;
  let raf = 0;
  let snapshot = null;
  let connection = 'loading';
  let playerState = null;
  let lastPaint = 0;
  let signalClockOffsetMs = 0;
  let temporaryModeUntil = 0;
  const signals = new Map();
  const preferences = readPreferences();
  const listeners = [];
  const unsubscribers = [];
  const desired = { mode: preferences.mode, side: preferences.side, streamer: preferences.streamer };

  const listen = (target, type, fn, options) => { target.addEventListener(type, fn, options); listeners.push(() => target.removeEventListener(type, fn, options)); };
  const subscribe = (type, fn) => { const off = worldEventBus.on(type, fn); unsubscribers.push(off); };
  const api = {
    get state() { return Object.freeze({ mode: desired.mode, side: desired.side, streamer: desired.streamer, connection }); },
    setMode(mode) { if (MODES.has(mode)) { desired.mode = mode; persistPreferences(desired); temporaryModeUntil = 0; } },
    setSide(side) { if (SIDE_MODES.has(side)) { desired.side = side; persistPreferences(desired); } },
    setStreamer(value) { desired.streamer = Boolean(value); persistPreferences(desired); paint(true); },
    collapse() { desired.mode = 'collapsed'; persistPreferences(desired); },
    expand() { desired.mode = 'expanded'; persistPreferences(desired); },
  };
  const removeLink = installLinkControl(api);

  function setSpatial(next) {
    if (!next || next === spatial && group) return;
    detachSpatial();
    spatial = next;
    if (!spatial?.THREE || !spatial?.scene || !spatial?.camera) return;
    const THREE = spatial.THREE;
    group = new THREE.Group();
    group.name = 'WISDOCompanionDashboard';
    group.userData.privateOwnerUi = true;
    canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 576; context = canvas.getContext('2d');
    texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    panelMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.42, .80), new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, depthWrite: false }));
    panelMesh.name = 'WISDOCompanionPanel';
    group.add(panelMesh);
    const orbMaterial = new THREE.MeshStandardMaterial({ color: 0x0a1720, emissive: 0x08647a, emissiveIntensity: 1.05, metalness: .66, roughness: .24 });
    orbMesh = new THREE.Mesh(new THREE.SphereGeometry(.12, 20, 14), orbMaterial); orbMesh.name = 'WISDOLinkOrb'; orbMesh.visible = false; group.add(orbMesh);
    spatial.scene.add(group); paint(true);
  }

  function detachSpatial() {
    if (!group) return;
    try { spatial?.scene?.remove?.(group); } catch {}
    group.traverse((object) => { object.geometry?.dispose?.(); const mats = Array.isArray(object.material) ? object.material : [object.material]; mats.forEach((material) => material?.dispose?.()); });
    texture?.dispose?.(); group = null; panelMesh = null; orbMesh = null; texture = null; canvas = null; context = null;
  }

  function paint(force = false) {
    if (!context || !texture) return;
    const now = performance.now(); if (!force && now - lastPaint < 250) return; lastPaint = now;
    const data = normalizeSnapshot(snapshot);
    const financial = data.financial;
    const signal = freshestSignal(signals);
    const currency = financial?.currency || 'USD';
    const reportersOnline = data.reporters.filter((row) => row.status === 'live' || row.status === 'online').length;
    const mode = performance.now() < temporaryModeUntil ? 'expanded' : desired.mode;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height); gradient.addColorStop(0, 'rgba(4,10,16,.97)'); gradient.addColorStop(1, 'rgba(6,24,34,.93)'); context.fillStyle = gradient; context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#caa65d'; context.lineWidth = 5; context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    line(context, 'WISDO COMPANION', 46, 48, { font: '800 23px system-ui', fill: '#caa65d' });
    line(context, connection.toUpperCase(), 974, 48, { font: '700 20px system-ui', fill: connection === 'live' ? '#75edff' : '#f0ba79', align: 'right' });
    if (desired.streamer) line(context, 'STREAMER MODE · PRIVATE VALUES HIDDEN', 46, 88, { font: '700 21px system-ui', fill: '#9bb1bf' });
    else line(context, escText(data.account?.nickname || data.account?.accountNumberMasked || 'AUTHORIZED ACCOUNT'), 46, 88, { font: '700 22px system-ui', fill: '#f4f1e8' });

    const positionCount = data.positions.length;
    const activeSymbol = signal?.symbol || data.positions[0]?.symbol || 'STANDBY';
    line(context, activeSymbol, 46, 155, { font: '900 48px system-ui', fill: '#f7fbff' });
    line(context, `${positionCount} POSITION${positionCount === 1 ? '' : 'S'}`, 46, 204, { font: '700 22px system-ui', fill: '#7deaff' });
    line(context, `REPORTERS ${reportersOnline}/${data.reporters.length}`, 46, 242, { font: '700 20px system-ui', fill: '#a8bfcc' });

    if (signal) {
      const remaining = signalRemaining(signal, signalClockOffsetMs);
      line(context, `SIGNAL · ${signal.symbol || ''} ${String(signal.direction || '').toUpperCase()}`, 974, 155, { font: '800 25px system-ui', fill: '#caa65d', align: 'right' });
      line(context, remaining == null ? 'SERVER EVENT' : `REVIEW ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`, 974, 194, { font: '700 21px system-ui', fill: '#76edff', align: 'right' });
    }

    if (mode === 'glance' || mode === 'collapsed') {
      line(context, desired.streamer ? 'EQUITY HIDDEN' : `EQUITY ${financial ? money(financial.equity, currency) : '—'}`, 46, 340, { font: '800 29px system-ui', fill: '#eaf7ff' });
      line(context, financial ? (financial.freshness?.state || data.generatedAt ? 'AUTHORIZED WORLD STATE' : 'STATE READY') : 'WAITING FOR AUTHORIZED DATA', 46, 392, { font: '600 18px system-ui', fill: '#8fa9b8' });
    } else {
      const rows = [
        ['BALANCE', desired.streamer ? 'HIDDEN' : financial ? money(financial.balance, currency) : '—'],
        ['EQUITY', desired.streamer ? 'HIDDEN' : financial ? money(financial.equity, currency) : '—'],
        ['FLOATING P/L', desired.streamer ? 'HIDDEN' : financial ? money(financial.floatingPL, currency) : '—'],
        ['OPEN POSITIONS', String(positionCount)],
      ];
      rows.forEach(([label, value], index) => { const x = index % 2 ? 540 : 46; const y = 330 + Math.floor(index / 2) * 104; line(context, label, x, y, { font: '700 18px system-ui', fill: '#8ca7b7' }); line(context, value, x, y + 38, { font: '800 30px system-ui', fill: '#eefaff' }); });
    }
    line(context, 'OWNER-PRIVATE · LIVE ACTIONS REQUIRE WISDO COMMAND CONFIRMATION', 46, 532, { font: '700 15px system-ui', fill: '#708b9c' });
    texture.needsUpdate = true;
  }

  function candidatePositions(THREE, operator) {
    const camera = spatial.camera;
    const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; if (forward.lengthSq() < .001) forward.set(0, 0, -1); forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const side = desired.side === 'left' ? -1 : desired.side === 'right' ? 1 : 1;
    const origin = operator.position.clone(); origin.y += 1.45;
    return [
      origin.clone().addScaledVector(forward, 1.55).addScaledVector(right, 1.05 * side),
      origin.clone().addScaledVector(forward, 1.45).addScaledVector(right, -1.05 * side),
      origin.clone().addScaledVector(forward, 1.15).addScaledVector(right, .72 * side).add(new THREE.Vector3(0, .55, 0)),
      origin.clone().addScaledVector(forward, .88).addScaledVector(right, .56 * side),
    ];
  }

  function validCandidate(THREE, candidate, operator) {
    const camera = spatial.camera;
    const rayDirection = candidate.clone().sub(camera.position); const distance = rayDirection.length(); if (distance < .25) return false; rayDirection.normalize();
    const ray = new THREE.Raycaster(camera.position, rayDirection, .05, Math.max(.05, distance - .2));
    const hits = ray.intersectObjects(spatial.scene.children, true).filter((hit) => !group?.getObjectById?.(hit.object.id) && hit.object !== operator && !operator?.getObjectById?.(hit.object.id));
    return hits.length === 0;
  }

  function frame(now) {
    if (stopped) return; raf = requestAnimationFrame(frame);
    if (!spatial || globalThis.WisdoWorldSpatialContext !== spatial) setSpatial(globalThis.WisdoWorldSpatialContext || null);
    if (!group || !spatial?.camera) return;
    const operator = spatial.scene.getObjectByName('WisdoOperator'); if (!operator) { group.visible = false; return; }
    const sprinting = playerState?.state === 'SPRINT';
    const commandOpen = document.getElementById('wisdoCommandOverlay')?.hidden === false;
    const requestedMode = performance.now() < temporaryModeUntil ? 'expanded' : desired.mode;
    const collapseForContext = sprinting || commandOpen || requestedMode === 'collapsed';
    const THREE = spatial.THREE;
    let target = null;
    for (const candidate of candidatePositions(THREE, operator)) { if (validCandidate(THREE, candidate, operator)) { target = candidate; break; } }
    if (!target) target = operator.position.clone().add(new THREE.Vector3(0, 1.75, 0));
    group.visible = true;
    group.position.lerp(target, 1 - Math.exp(-9 * 1 / 60));
    group.quaternion.slerp(spatial.camera.quaternion, 1 - Math.exp(-12 * 1 / 60));
    panelMesh.visible = !collapseForContext && Boolean(target);
    orbMesh.visible = collapseForContext || !target;
    if (panelMesh.visible) {
      const focus = requestedMode === 'focus'; const expanded = requestedMode === 'expanded';
      const scale = focus ? 1.38 : expanded ? 1.12 : 1; panelMesh.scale.lerp(new THREE.Vector3(scale, scale, scale), .16);
    }
    paint(false);
  }

  const onPlayer = (event) => { playerState = event.detail || null; };
  listen(window, 'wisdo:world-player-state', onPlayer);
  listen(window, 'wisdo:spatial-context-ready', () => setSpatial(globalThis.WisdoWorldSpatialContext || null));
  subscribe('world.connection', (event) => { connection = event.detail?.state || connection; paint(true); });
  subscribe('financial.updated', () => requestSnapshot().then((next) => { snapshot = next; connection = 'live'; paint(true); }).catch(() => { connection = 'stale'; paint(true); }));
  subscribe('account.selected', () => requestSnapshot().then((next) => { snapshot = next; paint(true); }).catch(() => {}));
  subscribe('position.opened', () => requestSnapshot().then((next) => { snapshot = next; paint(true); }).catch(() => {}));
  subscribe('position.closed', () => requestSnapshot().then((next) => { snapshot = next; paint(true); }).catch(() => {}));
  subscribe('reporter.online', () => requestSnapshot().then((next) => { snapshot = next; paint(true); }).catch(() => {}));
  subscribe('reporter.offline', () => requestSnapshot().then((next) => { snapshot = next; paint(true); }).catch(() => {}));
  for (const type of ['bot.signal.created', 'bot.signal.updated', 'bot.signal.expired']) subscribe(type, (event) => {
    const signal = event.detail || {};
    if (event.serverTimestamp) { const parsed = Date.parse(event.serverTimestamp); if (Number.isFinite(parsed)) signalClockOffsetMs = parsed - Date.now(); }
    if (type === 'bot.signal.expired' || signal.tradeStatus === 'closed' || signal.presentationStatus === 'expired') signals.delete(signal.eventId || event.eventId);
    else signals.set(signal.eventId || event.eventId, signal);
    if (type === 'bot.signal.created') temporaryModeUntil = performance.now() + 8_000;
    paint(true);
  });

  requestSnapshot().then((next) => { if (stopped) return; snapshot = next; connection = 'live'; paint(true); }).catch(() => { connection = 'stale'; paint(true); });
  setSpatial(spatial);
  raf = requestAnimationFrame(frame);
  globalThis.WisdoCompanionDashboard = Object.freeze(api);

  return Object.freeze({
    ...api,
    stop() {
      if (stopped) return; stopped = true; cancelAnimationFrame(raf); listeners.splice(0).forEach((off) => off()); unsubscribers.splice(0).forEach((off) => off()); removeLink(); detachSpatial(); delete globalThis.WisdoCompanionDashboard;
    },
  });
}
