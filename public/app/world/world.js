import { LOCAL_DESTINATIONS, WORLD_VERSION } from './world-config.js';
import { createLiteWorld } from './world-lite.js';

const $ = (id) => document.getElementById(id);
const STORAGE = Object.freeze({
  settings: 'wisdo-world-settings-v2',
  helpSeen: 'wisdo-world-help-seen-v2',
});

const state = {
  catalog: null,
  session: null,
  destinations: [],
  nearest: null,
  guest: true,
  online: navigator.onLine,
  world: null,
  mode: 'loading',
  telemetry: null,
  loadingValue: 4,
};

const defaultPreferences = Object.freeze({
  quality: 'auto',
  sensitivity: 1,
  invertY: false,
  volume: 0.6,
  muted: false,
  reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false,
});

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function readPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE.settings) || '{}');
    return { ...defaultPreferences, ...(saved && typeof saved === 'object' ? saved : {}) };
  } catch {
    return { ...defaultPreferences };
  }
}

let preferences = readPreferences();

function savePreferences() {
  try { localStorage.setItem(STORAGE.settings, JSON.stringify(preferences)); } catch {}
}

function setLoading(phase, value) {
  state.loadingValue = Math.max(state.loadingValue, Number(value) || state.loadingValue);
  $('loadingPhase').textContent = phase;
  $('loadingBar').style.width = `${Math.min(100, state.loadingValue)}%`;
}

function completeLoading() {
  state.loadingValue = 100;
  $('loadingBar').style.width = '100%';
  $('loadingPhase').textContent = state.mode === '3d' ? 'WISDO Central Online' : 'WISDO World Lite Ready';
  window.setTimeout(() => $('loadingScreen').classList.add('complete'), 220);
  $('app').dataset.ready = 'true';
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || payload.message || `Request failed: ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function toast(message) {
  const el = $('toast');
  el.textContent = String(message || '');
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 2800);
}

function profile() {
  return state.session?.worldProfile || {
    callsign: state.guest ? 'Guest' : 'Operator',
    xp: 0,
    level: 1,
    avatarStyle: 'vanguard',
    title: state.guest ? 'World Preview' : 'World Explorer',
  };
}

function destinationAccess(id) {
  return state.session?.access?.destinations?.find((item) => item.id === id) || null;
}

function hydrateDestinations() {
  const server = Array.isArray(state.catalog?.destinations) && state.catalog.destinations.length
    ? state.catalog.destinations
    : LOCAL_DESTINATIONS;
  state.destinations = server.map((destination) => {
    const access = destinationAccess(destination.id);
    return {
      ...destination,
      unlocked: state.guest ? Number(destination.minLevel || 0) === 0 : Boolean(access?.unlocked),
      visited: Boolean(access?.visited),
      minTier: access?.minTier || destination.minTier || 'Member',
    };
  });
}

function renderHeader() {
  const p = profile();
  const access = state.session?.access || { worldLabel: 'Member', level: 0 };
  const mesh = state.session?.mesh?.summary || { accounts: 0, onlineNodes: 0 };
  $('callsign').textContent = p.callsign || 'Operator';
  $('tierBadge').textContent = String(access.worldLabel || 'Member').toUpperCase();
  $('accessLabel').textContent = String(access.worldLabel || 'Member').toUpperCase();
  $('xp').textContent = Number(p.xp || 0).toLocaleString();
  $('level').textContent = Number(p.level || 1);
  $('accountCount').textContent = Number(mesh.accounts || 0);
  $('onlineCount').textContent = Number(mesh.onlineNodes || 0);
  $('meshCount').textContent = Number(mesh.accounts || 0);
  $('xpBar').style.width = `${Math.min(100, (Number(p.xp || 0) % 250) / 2.5)}%`;
  $('worldVersion').textContent = `WISDO WORLD ${WORLD_VERSION}`;
  const dot = $('connectionDot');
  dot.className = `connection-dot ${state.online ? (state.catalog ? 'online' : 'degraded') : 'degraded'}`;
  if (!state.online) $('syncLabel').textContent = 'Offline · local exploration remains available';
  else if (!state.catalog) $('syncLabel').textContent = 'World network reconnecting · local exploration remains available';
  else if (state.guest) $('syncLabel').textContent = 'Preview mode · sign in to sync identity and Reporter Mesh';
  else $('syncLabel').textContent = 'Synced to your WISDO identity';
}

function updateNearest(destination) {
  state.nearest = destination || null;
  const prompt = $('proximity');
  const mobileInteract = $('interactBtn');
  if (!state.nearest) {
    prompt.hidden = true;
    mobileInteract.hidden = true;
    return;
  }
  $('nearKicker').textContent = state.nearest.unlocked ? 'DESTINATION READY' : 'ACCESS REQUIRED';
  $('nearName').textContent = state.nearest.name;
  $('nearHint').textContent = state.nearest.unlocked ? '[E] ENTER' : `REQUIRES ${String(state.nearest.minTier || 'ACCESS').toUpperCase()}`;
  prompt.hidden = false;
  mobileInteract.hidden = false;
  mobileInteract.textContent = state.nearest.unlocked ? 'ENTER' : 'LOCKED';
}

function showModal(html) {
  state.world?.releasePointer?.();
  $('modalBody').innerHTML = html;
  $('modal').hidden = false;
}

function closeModal() {
  $('modal').hidden = true;
  $('modalBody').replaceChildren();
}

function destinationModal(destination) {
  const locked = !destination.unlocked;
  return `
    <span class="modal-kicker">${esc(destination.short || 'WISDO')} · ${locked ? 'ACCESS LOCKED' : 'ACCESS READY'}</span>
    <h2 id="modalTitle">${esc(destination.icon || '◇')} ${esc(destination.name)}</h2>
    <p>${esc(destination.description || '')}</p>
    <div class="metric-grid">
      <div class="metric"><span>ACCESS</span><strong>${locked ? esc(destination.minTier) : 'OPEN'}</strong></div>
      <div class="metric"><span>WORLD TIER</span><strong>${esc(state.session?.access?.worldLabel || 'Member')}</strong></div>
      <div class="metric"><span>VISIT</span><strong>${destination.visited ? 'COMPLETE' : 'NEW'}</strong></div>
    </div>
    ${locked ? `<p class="locked-message">This location requires ${esc(destination.minTier)} access. Server-side WISDO permissions remain authoritative.</p>` : ''}
    <div class="modal-actions">
      ${locked ? '<a class="action gold" href="/pricing" data-nav>View access options</a>' : `<button class="action primary" id="enterDestination">Enter ${esc(destination.name)}</button>`}
      <button class="action" id="closeDestination">Stay in World</button>
    </div>`;
}

async function interactDestination(destination) {
  if (!destination) return;
  showModal(destinationModal(destination));
  $('closeDestination')?.addEventListener('click', closeModal);
  $('enterDestination')?.addEventListener('click', async () => {
    if (!state.guest && destination.unlocked) {
      try {
        const result = await api('/api/world/visit', {
          method: 'POST',
          body: JSON.stringify({ destinationId: destination.id }),
        });
        if (result.state) state.session = result.state;
        if (result.xpAwarded) toast(`+${result.xpAwarded} XP · ${destination.name}`);
        hydrateDestinations();
        renderHeader();
      } catch (error) {
        if (error.status === 403) return toast(error.message);
        console.warn('World visit sync unavailable', error);
      }
    }
    state.world?.releasePointer?.();
    window.location.assign(destination.route);
  });
}

function mapModal() {
  const rows = state.destinations.map((d) => `
    <div class="list-row">
      <div><span class="dot ${d.unlocked ? 'online' : ''}"></span><strong>${esc(d.name)}</strong><br><small>${d.unlocked ? 'Accessible' : `Requires ${esc(d.minTier)}`}${d.visited ? ' · visited' : ''}</small></div>
      <button class="action" data-destination="${esc(d.id)}">Details</button>
    </div>`).join('');
  showModal(`<span class="modal-kicker">WORLD MAP</span><h2 id="modalTitle">WISDO Central</h2><p>Every physical location opens an existing WISDO system.</p><div class="list">${rows}</div>`);
  document.querySelectorAll('[data-destination]').forEach((button) => button.addEventListener('click', () => interactDestination(state.destinations.find((d) => d.id === button.dataset.destination))));
}

async function meshModal() {
  if (state.guest) {
    showModal(`<span class="modal-kicker">REPORTER MESH</span><h2 id="modalTitle">Sign in to view your network</h2><p>Your linked trading accounts and reporter presence remain protected by the existing WISDO session.</p><div class="modal-actions"><a class="action primary" href="/login?returnTo=/app/world" data-nav>Login with Discord</a></div>`);
    return;
  }
  showModal('<span class="modal-kicker">REPORTER MESH</span><h2 id="modalTitle">Loading your nodes…</h2>');
  try {
    const mesh = await api('/api/world/mesh');
    const rows = (mesh.nodes || []).map((node) => `
      <div class="list-row">
        <div><span class="dot ${node.status === 'online' ? 'online' : ''}"></span><strong>${esc(node.name)}</strong><br><small>${esc(node.type)} · ${esc(node.status || 'offline')}</small></div>
        <small>${node.canExecuteTrades ? 'EXECUTION ROUTE' : 'REPORT / SIGNAL ONLY'}</small>
      </div>`).join('') || '<div class="list-row"><div><strong>No linked reporters yet</strong><br><small>Connect an account to populate Reporter Mesh.</small></div></div>';
    showModal(`
      <span class="modal-kicker">REPORTER MESH · LIVE WISDO STATE</span>
      <h2 id="modalTitle">Your Network</h2>
      <p>${esc(mesh.safetyNotice || '')}</p>
      <div class="metric-grid">
        <div class="metric"><span>ACCOUNTS</span><strong>${Number(mesh.summary?.accounts || 0)}</strong></div>
        <div class="metric"><span>NODES</span><strong>${Number(mesh.summary?.nodes || 0)}</strong></div>
        <div class="metric"><span>ONLINE</span><strong>${Number(mesh.summary?.onlineNodes || 0)}</strong></div>
      </div>
      <div class="list">${rows}</div>
      <div class="modal-actions"><a class="action primary" href="/member/link-account" data-nav>Connect Account</a><a class="action" href="/member/accounts" data-nav>Manage Accounts</a></div>`);
  } catch (error) {
    showModal(`<span class="modal-kicker">REPORTER MESH</span><h2 id="modalTitle">Network unavailable</h2><p>${esc(error.message)}</p><p>You can continue exploring WISDO World locally.</p>`);
  }
}

function progressModal() {
  const p = profile();
  const visited = state.destinations.filter((d) => d.visited).length;
  showModal(`
    <span class="modal-kicker">WORLD PROGRESSION</span>
    <h2 id="modalTitle">${esc(p.callsign || 'Operator')}</h2>
    <p>${esc(p.title || 'World Explorer')} · progression is stored by the existing WISDO platform.</p>
    <div class="metric-grid">
      <div class="metric"><span>LEVEL</span><strong>${Number(p.level || 1)}</strong></div>
      <div class="metric"><span>XP</span><strong>${Number(p.xp || 0).toLocaleString()}</strong></div>
      <div class="metric"><span>PLACES</span><strong>${visited}/${state.destinations.length}</strong></div>
    </div>
    <div class="modal-actions"><button id="progressProfile" class="action primary">Customize Identity</button></div>`);
  $('progressProfile')?.addEventListener('click', profileModal);
}

function profileModal() {
  const p = profile();
  if (state.guest) {
    showModal(`<span class="modal-kicker">WORLD IDENTITY</span><h2 id="modalTitle">Build your WISDO identity</h2><p>Sign in to save your callsign, title, avatar class, XP, and visited locations.</p><div class="modal-actions"><a class="action primary" href="/login?returnTo=/app/world" data-nav>Login with Discord</a></div>`);
    return;
  }
  showModal(`
    <span class="modal-kicker">WORLD IDENTITY</span>
    <h2 id="modalTitle">Customize Operator</h2>
    <form id="profileForm" class="profile-form">
      <label>CALLSIGN<input name="callsign" maxlength="48" value="${esc(p.callsign || '')}" required></label>
      <label>TITLE<input name="title" maxlength="64" value="${esc(p.title || '')}" required></label>
      <label class="full">AVATAR CLASS<select name="avatarStyle">
        ${['vanguard','architect','sentinel','scholar'].map((value) => `<option value="${value}" ${p.avatarStyle === value ? 'selected' : ''}>${value.toUpperCase()}</option>`).join('')}
      </select></label>
      <div class="full modal-actions"><button class="action primary" type="submit">Save Identity</button></div>
    </form>`);
  $('profileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      state.session = await api('/api/world/profile', { method: 'POST', body: JSON.stringify(body) });
      hydrateDestinations();
      renderHeader();
      closeModal();
      toast('WISDO identity saved');
    } catch (error) { toast(error.message); }
  });
}

function settingsModal() {
  showModal(`
    <span class="modal-kicker">WORLD SETTINGS</span>
    <h2 id="modalTitle">Gameplay & Graphics</h2>
    <form id="settingsForm" class="settings-grid">
      <label class="setting">GRAPHICS<select name="quality"><option value="auto">AUTO</option><option value="low">LOW</option><option value="medium">MEDIUM</option><option value="high">HIGH</option></select></label>
      <label class="setting">MOUSE SENSITIVITY<input name="sensitivity" type="range" min="0.45" max="2.1" step="0.05" value="${Number(preferences.sensitivity || 1)}"></label>
      <label class="setting">MASTER VOLUME<input name="volume" type="range" min="0" max="1" step="0.05" value="${Number(preferences.volume || 0.6)}"></label>
      <label class="setting check"><input name="invertY" type="checkbox" ${preferences.invertY ? 'checked' : ''}> INVERT Y</label>
      <label class="setting check"><input name="muted" type="checkbox" ${preferences.muted ? 'checked' : ''}> MUTE</label>
      <label class="setting check"><input name="reducedMotion" type="checkbox" ${preferences.reducedMotion ? 'checked' : ''}> REDUCED MOTION</label>
      <div class="modal-actions"><button class="action primary" type="submit">Apply</button><button id="liteModeBtn" class="action" type="button">Open Lite Mode</button></div>
    </form>`);
  const quality = $('settingsForm').elements.quality;
  quality.value = preferences.quality || 'auto';
  $('settingsForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    preferences = {
      ...preferences,
      quality: form.elements.quality.value,
      sensitivity: Number(form.elements.sensitivity.value),
      volume: Number(form.elements.volume.value),
      invertY: Boolean(form.elements.invertY.checked),
      muted: Boolean(form.elements.muted.checked),
      reducedMotion: Boolean(form.elements.reducedMotion.checked),
    };
    savePreferences();
    state.world?.setPreferences?.(preferences);
    closeModal();
    toast('World settings applied');
  });
  $('liteModeBtn').addEventListener('click', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('lite', '1');
    window.location.assign(url);
  });
}

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch { return false; }
}

function shouldUseLite() {
  return new URLSearchParams(window.location.search).get('lite') === '1' || !webglAvailable();
}

function setupDebug() {
  const params = new URLSearchParams(location.search);
  if (params.get('debug') !== '1') return;
  $('debugPanel').hidden = false;
}

function renderDebug(data) {
  state.telemetry = data;
  if ($('debugPanel').hidden) return;
  $('debugPanel').textContent = [
    `MODE ${state.mode.toUpperCase()}`,
    `FPS ${data?.fps ?? '-'}`,
    `DRAW ${data?.drawCalls ?? '-'}`,
    `TRI ${Number(data?.triangles || 0).toLocaleString()}`,
    `QUALITY ${String(data?.quality || preferences.quality).toUpperCase()}`,
    `XYZ ${data?.player ? `${data.player.x}, ${data.player.y}, ${data.player.z}` : '-'}`,
    `TARGET ${state.nearest?.id || '-'}`,
  ].join('\n');
}

function bindUi() {
  $('modalClose').addEventListener('click', closeModal);
  $('modalBackdrop').addEventListener('click', closeModal);
  $('mapBtn').addEventListener('click', mapModal);
  $('dockMap').addEventListener('click', mapModal);
  $('meshBtn').addEventListener('click', meshModal);
  $('dockMesh').addEventListener('click', meshModal);
  $('dockAchievements').addEventListener('click', progressModal);
  $('profileBtn').addEventListener('click', profileModal);
  $('settingsBtn').addEventListener('click', settingsModal);
  document.addEventListener('click', (event) => {
    const nav = event.target.closest?.('[data-nav]');
    if (nav) state.world?.releasePointer?.();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('modal').hidden) closeModal();
  });
  window.addEventListener('online', () => { state.online = true; renderHeader(); refreshSession(); });
  window.addEventListener('offline', () => { state.online = false; renderHeader(); });
}

function bindFirstRunHelp() {
  let seen = false;
  try { seen = localStorage.getItem(STORAGE.helpSeen) === '1'; } catch {}
  if (seen) $('firstRunHelp').classList.add('dismissed');
  const dismiss = () => {
    $('firstRunHelp').classList.add('dismissed');
    try { localStorage.setItem(STORAGE.helpSeen, '1'); } catch {}
  };
  window.addEventListener('keydown', (event) => {
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(event.key.toLowerCase())) dismiss();
  }, { once: true });
  $('worldStage').addEventListener('pointerdown', dismiss, { once: true });
}

async function loadPlatformState() {
  setLoading('Connecting to WISDO systems', 15);
  try {
    state.catalog = await api('/api/world/catalog');
  } catch (error) {
    console.warn('World catalog network unavailable', error);
    state.catalog = null;
  }
  setLoading('Loading operator identity', 27);
  try {
    state.session = await api('/api/world/me');
    state.guest = false;
  } catch (error) {
    if (error.status !== 401) console.warn('World identity sync unavailable', error);
    state.session = null;
    state.guest = true;
  }
  hydrateDestinations();
  renderHeader();
}

async function refreshSession() {
  if (!navigator.onLine) return;
  try {
    state.catalog = await api('/api/world/catalog');
    if (!state.guest) state.session = await api('/api/world/me');
    hydrateDestinations();
    renderHeader();
  } catch (error) {
    console.warn('World reconnect attempt unavailable', error);
    renderHeader();
  }
}

async function startLite(reason = '') {
  state.world?.destroy?.();
  state.world = null;
  state.mode = 'lite';
  $('canvasMount').hidden = true;
  $('liteMount').hidden = false;
  setLoading(reason ? 'Starting Lite Mode' : 'Loading Lite Mode', 78);
  state.world = createLiteWorld({
    mount: $('liteMount'),
    destinations: state.destinations,
    onNearestChange: updateNearest,
    onInteract: interactDestination,
  });
  renderHeader();
  if (reason) toast(`Lite Mode active · ${reason}`);
  completeLoading();
}

async function start3d() {
  setLoading('Loading 3D engine', 40);
  try {
    const { createWorldExperience } = await import('./world3d.js');
    state.mode = '3d';
    $('canvasMount').hidden = false;
    $('liteMount').hidden = true;
    state.world = await createWorldExperience({
      mount: $('canvasMount'),
      destinations: state.destinations,
      preferences,
      onPhase: (message) => setLoading(message, Math.min(88, state.loadingValue + 8)),
      onNearestChange: updateNearest,
      onInteract: interactDestination,
      onTelemetry: renderDebug,
      onFatal: (error) => startLite(error?.message || '3D renderer unavailable'),
      onReady: () => {
        setLoading('Spawning operator', 94);
        completeLoading();
      },
    });
  } catch (error) {
    console.error('WISDO World 3D start failed', error);
    await startLite('3D graphics unavailable');
  }
}

function destroy() {
  state.world?.destroy?.();
  state.world = null;
}

async function boot() {
  bindUi();
  bindFirstRunHelp();
  setupDebug();
  renderHeader();
  await loadPlatformState();
  if (shouldUseLite()) await startLite(new URLSearchParams(location.search).get('lite') === '1' ? 'Lite Mode selected' : 'WebGL unavailable');
  else await start3d();
}

window.addEventListener('pagehide', destroy, { once: true });
boot().catch(async (error) => {
  console.error('WISDO World boot failed', error);
  if (!state.destinations.length) {
    state.catalog = null;
    hydrateDestinations();
  }
  renderHeader();
  await startLite('World recovery mode');
});
