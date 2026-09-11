import { LOCAL_DESTINATIONS } from './world-config.js';
import { createLiteWorld } from './world-lite.js';
import { createWorldDataRuntime } from './world-data-runtime.js';

const $ = (id) => document.getElementById(id);
const STORAGE = Object.freeze({ settings: 'wisdo-world-settings-v3', helpSeen: 'wisdo-world-help-seen-v3' });
const money = (value, currency = 'USD') => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0)); }
  catch { return `$${Number(value || 0).toFixed(2)}`; }
};

const state = {
  catalog: null,
  session: null,
  destinations: [],
  nearest: null,
  guest: true,
  online: navigator.onLine,
  world: null,
  runtime: null,
  mode: 'loading',
  scene: 'home',
  telemetry: null,
  loadingValue: 4,
};

const defaultPreferences = Object.freeze({
  quality: 'auto', sensitivity: 1, invertY: false, volume: .6, muted: false,
  reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false,
});

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function readPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE.settings) || '{}');
    return { ...defaultPreferences, ...(saved && typeof saved === 'object' ? saved : {}) };
  } catch { return { ...defaultPreferences }; }
}
let preferences = readPreferences();
const savePreferences = () => { try { localStorage.setItem(STORAGE.settings, JSON.stringify(preferences)); } catch {} };

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || payload.message || `Request failed: ${response.status}`);
    error.status = response.status; error.payload = payload; throw error;
  }
  return payload;
}

function setLoading(phase, value) {
  state.loadingValue = Math.max(state.loadingValue, Number(value) || state.loadingValue);
  $('loadingPhase').textContent = phase;
  $('loadingBar').style.width = `${Math.min(100, state.loadingValue)}%`;
}

function completeLoading() {
  state.loadingValue = 100;
  $('loadingBar').style.width = '100%';
  $('loadingPhase').textContent = state.scene === 'home' ? 'WISDO Smart Home Online' : state.mode.includes('3d') ? 'WISDO Central Online' : 'WISDO World Lite Ready';
  setTimeout(() => $('loadingScreen').classList.add('complete'), 180);
  $('app').dataset.ready = 'true';
}

function toast(message) {
  const el = $('toast');
  el.textContent = String(message || ''); el.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.hidden = true; }, 2800);
}

function profile() {
  return state.session?.worldProfile || { callsign: state.guest ? 'Guest' : 'Operator', xp: 0, level: 1, avatarStyle: 'vanguard', title: state.guest ? 'World Preview' : 'World Explorer' };
}

function hydrateDestinations() {
  const server = Array.isArray(state.catalog?.destinations) && state.catalog.destinations.length ? state.catalog.destinations : LOCAL_DESTINATIONS;
  const accessRows = state.session?.access?.destinations || [];
  state.destinations = server.map((destination) => {
    const access = accessRows.find((item) => item.id === destination.id);
    return { ...destination, unlocked: state.guest ? Number(destination.minLevel || 0) === 0 : Boolean(access?.unlocked), visited: Boolean(access?.visited), minTier: access?.minTier || destination.minTier || 'Member' };
  });
}

function renderHeader() {
  const p = profile();
  const access = state.session?.access || { worldLabel: 'Member' };
  const mesh = state.session?.mesh?.summary || {};
  const reporterSummary = state.session?.worldData?.reporterSummary || {};
  $('callsign').textContent = p.callsign || 'Operator';
  $('tierBadge').textContent = String(access.worldLabel || 'Member').toUpperCase();
  $('accessLabel').textContent = String(access.worldLabel || 'Member').toUpperCase();
  $('xp').textContent = Number(p.xp || 0).toLocaleString();
  $('level').textContent = Number(p.level || state.session?.growth?.level || 1);
  $('accountCount').textContent = Number(state.session?.worldData?.accounts?.length ?? mesh.accounts ?? 0);
  $('onlineCount').textContent = Number(reporterSummary.online ?? mesh.onlineNodes ?? 0);
  $('meshCount').textContent = Number(state.session?.worldData?.reporters?.length ?? mesh.nodes ?? 0);
  $('xpBar').style.width = `${Math.min(100, (Number(p.xp || 0) % 250) / 2.5)}%`;
  $('worldVersion').textContent = `WISDO WORLD ${state.catalog?.version || state.session?.version || '2.0'}`;
  const dot = $('connectionDot');
  dot.className = `connection-dot ${state.online ? (state.session || state.guest ? 'online' : 'degraded') : 'degraded'}`;
  if (!state.online) $('syncLabel').textContent = 'Offline · live financial state may be stale';
  else if (state.guest) $('syncLabel').textContent = 'Preview mode · sign in to receive your WISDO residence';
  else if (state.scene === 'home') $('syncLabel').textContent = 'Private Smart Home · synced to authorized WISDO services';
  else $('syncLabel').textContent = 'WISDO Central · identity and platform state synced';
}

function renderSceneHelp() {
  const box = $('firstRunHelp');
  const label = box.querySelector('span');
  const hint = box.querySelector('strong');
  if (state.scene === 'home') {
    label.textContent = 'YOUR WISDO SMART HOME';
    hint.textContent = 'WASD MOVE · MOUSE LOOK · SHIFT SPRINT · SPACE JUMP · E INTERACT';
  } else {
    label.textContent = 'WISDO CENTRAL';
    hint.textContent = 'WASD MOVE · MOUSE LOOK · SHIFT SPRINT · SPACE JUMP · E ENTER';
  }
}

function updateNearest(entity) {
  state.nearest = entity || null;
  const prompt = $('proximity');
  const mobileInteract = $('interactBtn');
  if (!entity) { prompt.hidden = true; mobileInteract.hidden = true; return; }
  const homeStation = entity.kind === 'home-station';
  $('nearKicker').textContent = homeStation ? `SMART HOME · ${entity.short || 'SYSTEM'}` : entity.unlocked ? 'DESTINATION READY' : 'ACCESS REQUIRED';
  $('nearName').textContent = entity.name;
  $('nearHint').textContent = entity.unlocked === false ? `REQUIRES ${String(entity.minTier || 'ACCESS').toUpperCase()}` : homeStation ? '[E] INTERACT' : '[E] ENTER';
  prompt.hidden = false;
  mobileInteract.hidden = false;
  mobileInteract.textContent = entity.unlocked === false ? 'LOCKED' : homeStation ? 'USE' : 'ENTER';
}

function showModal(html) {
  state.world?.releasePointer?.();
  $('modalBody').innerHTML = html;
  $('modal').hidden = false;
}
function closeModal() { $('modal').hidden = true; $('modalBody').replaceChildren(); }

function accountModal() {
  const accounts = state.session?.worldData?.accounts || [];
  const active = state.session?.worldData?.activeAccount;
  const rows = accounts.map((account) => `
    <div class="list-row">
      <div><strong>${esc(account.nickname || account.accountNumberMasked || 'Trading Account')}</strong><br><small>${esc(account.accountNumberMasked || '')} · ${esc(account.accountType || '')} · ${esc(account.freshness?.state || account.health || '')}</small></div>
      <button class="action ${account.accountId === active?.accountId ? 'primary' : ''}" data-account="${esc(account.accountId)}">${account.accountId === active?.accountId ? 'ACTIVE' : 'SELECT'}</button>
    </div>`).join('') || '<div class="list-row"><div><strong>No linked accounts</strong><br><small>Connect a Reporter in Fast Mode to populate your Account Vault.</small></div></div>';
  showModal(`<span class="modal-kicker">ACCOUNT VAULT · AUTHORIZED ACCOUNTS</span><h2 id="modalTitle">Choose Home Context</h2><p>Selecting an account changes the financial context throughout your residence. It does not execute a trade.</p><div class="list">${rows}</div><div class="modal-actions"><a class="action" href="/member/link-account" data-nav>Connect Account</a><a class="action" href="/member/accounts" data-nav>Manage Accounts</a></div>`);
  document.querySelectorAll('[data-account]').forEach((button) => button.addEventListener('click', async () => {
    if (button.dataset.account === active?.accountId) return;
    button.disabled = true;
    try {
      state.session = await state.runtime.selectAccount(button.dataset.account);
      hydrateDestinations(); renderHeader(); accountModal(); toast('Active WISDO account changed');
    } catch (error) { toast(error.message); button.disabled = false; }
  }));
}

function tradingModal() {
  const live = state.session?.homeRuntime?.live || state.session?.worldData || {};
  const positions = live.positions || [];
  const financial = live.financial;
  const currency = financial?.currency || 'USD';
  const rows = positions.map((position) => `
    <div class="list-row trade-row">
      <div><strong>${esc(position.symbol || 'TRADE')} · ${esc(String(position.direction || '').toUpperCase())}</strong><br><small>${Number(position.lots || 0)} lot · entry ${position.entryPrice || '—'} · current ${position.currentPrice || '—'} · magic ${position.magicNumber ?? '—'}</small></div>
      <strong>${esc(money(position.floatingPL, currency))}</strong>
    </div>`).join('') || '<div class="list-row"><div><strong>Trading Room standing by</strong><br><small>No live open positions were reported for the active account.</small></div></div>';
  showModal(`<span class="modal-kicker">TRADING ROOM · LIVE REPORTER DATA</span><h2 id="modalTitle">${financial ? `Floating ${esc(money(financial.floatingPL, currency))}` : 'No active financial feed'}</h2>
    <div class="metric-grid">
      <div class="metric"><span>BALANCE</span><strong>${financial ? esc(money(financial.balance, currency)) : '—'}</strong></div>
      <div class="metric"><span>EQUITY</span><strong>${financial ? esc(money(financial.equity, currency)) : '—'}</strong></div>
      <div class="metric"><span>POSITIONS</span><strong>${positions.length}</strong></div>
    </div><div class="list">${rows}</div><p class="locked-message">World presentation is read-only for trading execution. Any real account command remains behind WISDO authorization and confirmation.</p><div class="modal-actions"><a class="action primary" href="/member/command-center" data-nav>Open Trading Controls</a></div>`);
}

function meshModal() {
  if (state.guest) {
    showModal('<span class="modal-kicker">REPORTER MESH</span><h2 id="modalTitle">Sign in to view your infrastructure</h2><p>Reporter presence is private account data.</p><div class="modal-actions"><a class="action primary" href="/login?returnTo=/world/" data-nav>Sign In</a></div>');
    return;
  }
  const reporters = state.session?.worldData?.reporters || [];
  const summary = state.session?.worldData?.reporterSummary || {};
  const rows = reporters.map((node) => `<div class="list-row"><div><span class="dot ${node.status === 'live' ? 'online' : ''}"></span><strong>${esc(node.name || 'Reporter')}</strong><br><small>${esc(String(node.status || 'offline').toUpperCase())} · ${node.terminalConnected ? 'TERMINAL CONNECTED' : 'TERMINAL DISCONNECTED'} · ${node.expertEnabled ? 'EA ENABLED' : 'EA DISABLED'}</small></div><small>REPORT ONLY</small></div>`).join('') || '<div class="list-row"><div><strong>No Reporter nodes</strong><br><small>Pair MT4 to bring this room online.</small></div></div>';
  showModal(`<span class="modal-kicker">REPORTER / SYSTEM ROOM</span><h2 id="modalTitle">Reporter Mesh</h2><div class="metric-grid"><div class="metric"><span>TOTAL</span><strong>${Number(summary.total || 0)}</strong></div><div class="metric"><span>ONLINE</span><strong>${Number(summary.online || 0)}</strong></div><div class="metric"><span>STALE/OFFLINE</span><strong>${Number(summary.stale || 0) + Number(summary.offline || 0)}</strong></div></div><div class="list">${rows}</div><div class="modal-actions"><a class="action primary" href="/member/link-account" data-nav>Connect Reporter</a></div>`);
}

function performanceModal() {
  const live = state.session?.homeRuntime?.live || state.session?.worldData || {};
  const financial = live.financial;
  const currency = financial?.currency || 'USD';
  const history = live.history || [];
  const rows = history.slice(-12).reverse().map((point) => `<div class="list-row"><small>${point.at ? new Date(point.at).toLocaleString() : 'Snapshot'}</small><div><strong>${esc(money(point.equity, currency))}</strong><br><small>Balance ${esc(money(point.balance, currency))} · Floating ${esc(money(point.floatingPL, currency))}</small></div></div>`).join('') || '<div class="list-row"><div><strong>No historical snapshots available yet</strong></div></div>';
  showModal(`<span class="modal-kicker">PERFORMANCE ROOM</span><h2 id="modalTitle">Authorized Account History</h2><div class="metric-grid"><div class="metric"><span>BALANCE</span><strong>${financial ? esc(money(financial.balance, currency)) : '—'}</strong></div><div class="metric"><span>EQUITY</span><strong>${financial ? esc(money(financial.equity, currency)) : '—'}</strong></div><div class="metric"><span>TODAY</span><strong>${financial ? esc(money(financial.dailyClosedPL, currency)) : '—'}</strong></div></div><div class="list">${rows}</div><div class="modal-actions"><a class="action primary" href="/member/accounts" data-nav>Full Analytics</a></div>`);
}

function coachModal() {
  showModal('<span class="modal-kicker">COACH · HOUSE INTELLIGENCE</span><h2 id="modalTitle">Coach Lives Here</h2><p>Coach can use the same authorized WISDO context that powers your home. World voice execution is not enabled as a shortcut around account security.</p><div class="modal-actions"><a class="action primary" href="/member/wisdo" data-nav>Open Coach</a><a class="action" href="/member/command-center" data-nav>Command Center</a></div>');
}

function progressModal() {
  const p = profile(); const growth = state.session?.growth || {};
  const achievements = growth.achievements || p.achievements || [];
  showModal(`<span class="modal-kicker">GROWTH ROOM</span><h2 id="modalTitle">${esc(p.callsign || 'Operator')}</h2><p>${esc(p.title || 'World Explorer')} · persistent WISDO identity.</p><div class="metric-grid"><div class="metric"><span>LEVEL</span><strong>${Number(growth.level || p.level || 1)}</strong></div><div class="metric"><span>XP</span><strong>${Number(growth.xp ?? p.xp ?? 0).toLocaleString()}</strong></div><div class="metric"><span>ACHIEVEMENTS</span><strong>${achievements.length}</strong></div><div class="metric"><span>COURSES</span><strong>${Number(growth.education?.completedLessons || 0)}</strong></div></div><div class="modal-actions"><button id="progressProfile" class="action primary">Customize Identity</button><a class="action" href="/member/education" data-nav>WISDO Academy</a></div>`);
  $('progressProfile')?.addEventListener('click', profileModal);
}

function profileModal() {
  const p = profile();
  if (state.guest) {
    showModal('<span class="modal-kicker">WORLD IDENTITY</span><h2 id="modalTitle">Sign in to build your identity</h2><div class="modal-actions"><a class="action primary" href="/login?returnTo=/world/" data-nav>Sign In</a></div>'); return;
  }
  showModal(`<span class="modal-kicker">WORLD IDENTITY</span><h2 id="modalTitle">Customize Operator</h2><form id="profileForm" class="profile-form"><label>CALLSIGN<input name="callsign" maxlength="48" value="${esc(p.callsign || '')}" required></label><label>TITLE<input name="title" maxlength="64" value="${esc(p.title || '')}" required></label><label class="full">AVATAR CLASS<select name="avatarStyle">${['vanguard','architect','sentinel','scholar'].map((value) => `<option value="${value}" ${p.avatarStyle === value ? 'selected' : ''}>${value.toUpperCase()}</option>`).join('')}</select></label><div class="full modal-actions"><button class="action primary" type="submit">Save Identity</button></div></form>`);
  $('profileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      state.session = await api('/api/world/profile', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) });
      state.world?.updateSnapshot?.(state.session); hydrateDestinations(); renderHeader(); closeModal(); toast('WISDO identity saved');
    } catch (error) { toast(error.message); }
  });
}

function mapModal() {
  if (state.scene === 'home' && !state.guest) {
    const rooms = state.session?.homeRuntime?.rooms || [];
    const rows = rooms.map((room) => `<div class="list-row"><div><strong>${esc(room.name)}</strong><br><small>${esc(room.purpose)}</small></div></div>`).join('');
    showModal(`<span class="modal-kicker">SMART HOME MAP</span><h2 id="modalTitle">${esc(state.session?.home?.displayName || 'WISDO Residence')}</h2><p>Your private home is one instance of the larger WISDO civilization.</p><div class="list">${rows}</div><div class="modal-actions"><button id="goCentral" class="action primary">Exit to WISDO Central</button></div>`);
    $('goCentral')?.addEventListener('click', () => { closeModal(); switchScene('central'); });
    return;
  }
  const rows = state.destinations.map((d) => `<div class="list-row"><div><span class="dot ${d.unlocked ? 'online' : ''}"></span><strong>${esc(d.name)}</strong><br><small>${d.unlocked ? 'Accessible' : `Requires ${esc(d.minTier)}`}${d.visited ? ' · visited' : ''}</small></div><button class="action" data-destination="${esc(d.id)}">Details</button></div>`).join('');
  showModal(`<span class="modal-kicker">WORLD MAP</span><h2 id="modalTitle">WISDO Central</h2><p>Public districts connect the larger platform.</p><div class="list">${rows}</div>${!state.guest ? '<div class="modal-actions"><button id="goHome" class="action primary">Return Home</button></div>' : ''}`);
  document.querySelectorAll('[data-destination]').forEach((button) => button.addEventListener('click', () => interactDestination(state.destinations.find((d) => d.id === button.dataset.destination))));
  $('goHome')?.addEventListener('click', () => { closeModal(); switchScene('home'); });
}

function destinationModal(destination) {
  const locked = !destination.unlocked;
  return `<span class="modal-kicker">${esc(destination.short || 'WISDO')} · ${locked ? 'ACCESS LOCKED' : 'ACCESS READY'}</span><h2 id="modalTitle">${esc(destination.icon || '◇')} ${esc(destination.name)}</h2><p>${esc(destination.description || '')}</p><div class="metric-grid"><div class="metric"><span>ACCESS</span><strong>${locked ? esc(destination.minTier) : 'OPEN'}</strong></div><div class="metric"><span>WORLD TIER</span><strong>${esc(state.session?.access?.worldLabel || 'Member')}</strong></div><div class="metric"><span>VISIT</span><strong>${destination.visited ? 'COMPLETE' : 'NEW'}</strong></div></div>${locked ? `<p class="locked-message">Requires ${esc(destination.minTier)} access. Server authorization remains authoritative.</p>` : ''}<div class="modal-actions">${locked ? '<a class="action gold" href="/pricing" data-nav>View Access</a>' : `<button class="action primary" id="enterDestination">Enter ${esc(destination.name)}</button>`}<button class="action" id="closeDestination">Stay Here</button></div>`;
}

async function interactDestination(destination) {
  if (!destination) return;
  showModal(destinationModal(destination));
  $('closeDestination')?.addEventListener('click', closeModal);
  $('enterDestination')?.addEventListener('click', async () => {
    if (!state.guest && destination.unlocked) {
      try {
        const result = await api('/api/world/visit', { method: 'POST', body: JSON.stringify({ destinationId: destination.id }) });
        if (result.state) state.session = result.state;
        if (result.xpAwarded) toast(`+${result.xpAwarded} XP · ${destination.name}`);
        hydrateDestinations(); renderHeader();
      } catch (error) { if (error.status === 403) return toast(error.message); }
    }
    state.world?.releasePointer?.(); window.location.assign(destination.route);
  });
}

function homeStationModal(station) {
  if (!station) return;
  switch (station.station) {
    case 'account-vault': return accountModal();
    case 'trading': return tradingModal();
    case 'reporter': return meshModal();
    case 'performance': return performanceModal();
    case 'coach': return coachModal();
    case 'growth': return progressModal();
    case 'fast-mode': state.world?.releasePointer?.(); return window.location.assign('/member/home');
    case 'front-door': return switchScene('central');
    default: return showModal(`<span class="modal-kicker">SMART HOME</span><h2 id="modalTitle">${esc(station.name)}</h2><p>${esc(station.description || '')}</p>`);
  }
}

function interactEntity(entity) {
  if (entity?.kind === 'home-station') return homeStationModal(entity);
  return interactDestination(entity);
}

function settingsModal() {
  const home = state.session?.home;
  showModal(`<span class="modal-kicker">WORLD SETTINGS</span><h2 id="modalTitle">Graphics, Privacy & Home</h2><form id="settingsForm" class="settings-grid"><label class="setting">GRAPHICS<select name="quality"><option value="auto">AUTO</option><option value="low">LOW</option><option value="medium">MEDIUM</option><option value="high">HIGH</option></select></label><label class="setting">MOUSE SENSITIVITY<input name="sensitivity" type="range" min="0.45" max="2.1" step="0.05" value="${Number(preferences.sensitivity || 1)}"></label><label class="setting check"><input name="invertY" type="checkbox" ${preferences.invertY ? 'checked' : ''}> INVERT Y</label><label class="setting check"><input name="reducedMotion" type="checkbox" ${preferences.reducedMotion ? 'checked' : ''}> REDUCED MOTION</label>${home ? `<label class="setting">HOME THEME<select name="theme">${['obsidian','midnight','glass','warm-modern'].map((value) => `<option value="${value}" ${home.cosmetics?.theme === value ? 'selected' : ''}>${value.toUpperCase()}</option>`).join('')}</select></label><label class="setting">FINANCIAL PRIVACY<select name="financialVisibility"><option value="owner_only" ${home.privacy?.financialVisibility === 'owner_only' ? 'selected' : ''}>OWNER ONLY</option><option value="hidden_when_visitors" ${home.privacy?.financialVisibility === 'hidden_when_visitors' ? 'selected' : ''}>HIDE WITH VISITORS</option><option value="authorized_visitors" ${home.privacy?.financialVisibility === 'authorized_visitors' ? 'selected' : ''}>AUTHORIZED VISITORS</option></select></label>` : ''}<div class="modal-actions"><button class="action primary" type="submit">Apply</button><button id="liteModeBtn" class="action" type="button">Open Lite Mode</button></div></form>`);
  $('settingsForm').elements.quality.value = preferences.quality || 'auto';
  $('settingsForm').addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget;
    preferences = { ...preferences, quality: form.elements.quality.value, sensitivity: Number(form.elements.sensitivity.value), invertY: Boolean(form.elements.invertY.checked), reducedMotion: Boolean(form.elements.reducedMotion.checked) };
    savePreferences(); state.world?.setPreferences?.(preferences);
    if (home && state.runtime) {
      try { state.session = await state.runtime.updateHome({ theme: form.elements.theme.value, financialVisibility: form.elements.financialVisibility.value }); state.world?.updateSnapshot?.(state.session); } catch (error) { toast(error.message); }
    }
    closeModal(); toast('World settings applied');
  });
  $('liteModeBtn').addEventListener('click', () => { const url = new URL(location.href); url.searchParams.set('lite', '1'); location.assign(url); });
}

function webglAvailable() {
  try { const canvas = document.createElement('canvas'); return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl'))); }
  catch { return false; }
}
function shouldUseLite() { return new URLSearchParams(location.search).get('lite') === '1' || !webglAvailable(); }

function setupDebug() { if (new URLSearchParams(location.search).get('debug') === '1') $('debugPanel').hidden = false; }
function renderDebug(data) {
  state.telemetry = data;
  if ($('debugPanel').hidden) return;
  $('debugPanel').textContent = [`SCENE ${state.scene.toUpperCase()}`, `MODE ${state.mode.toUpperCase()}`, `FPS ${data?.fps ?? '-'}`, `DRAW ${data?.drawCalls ?? '-'}`, `TRI ${Number(data?.triangles || 0).toLocaleString()}`, `QUALITY ${String(data?.quality || preferences.quality).toUpperCase()}`, `XYZ ${data?.player ? `${data.player.x}, ${data.player.y}, ${data.player.z}` : '-'}`, `TARGET ${state.nearest?.id || '-'}`].join('\n');
}

function bindUi() {
  $('modalClose').addEventListener('click', closeModal); $('modalBackdrop').addEventListener('click', closeModal);
  $('mapBtn').addEventListener('click', mapModal); $('dockMap').addEventListener('click', mapModal);
  $('meshBtn').addEventListener('click', meshModal); $('dockMesh').addEventListener('click', meshModal);
  $('dockAchievements').addEventListener('click', progressModal); $('profileBtn').addEventListener('click', profileModal); $('settingsBtn').addEventListener('click', settingsModal);
  document.addEventListener('click', (event) => { if (event.target.closest?.('[data-nav]')) state.world?.releasePointer?.(); });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('modal').hidden) closeModal(); });
  window.addEventListener('online', () => { state.online = true; renderHeader(); state.runtime?.refresh(); });
  window.addEventListener('offline', () => { state.online = false; renderHeader(); });
}

function bindFirstRunHelp() {
  let seen = false; try { seen = localStorage.getItem(STORAGE.helpSeen) === '1'; } catch {}
  if (seen) $('firstRunHelp').classList.add('dismissed');
  const dismiss = () => { $('firstRunHelp').classList.add('dismissed'); try { localStorage.setItem(STORAGE.helpSeen, '1'); } catch {} };
  window.addEventListener('keydown', (event) => { if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(event.key.toLowerCase())) dismiss(); }, { once: true });
  $('worldStage').addEventListener('pointerdown', dismiss, { once: true });
}

async function loadPlatformState() {
  setLoading('Connecting to WISDO systems', 14);
  try { state.catalog = await api('/api/world/catalog'); } catch (error) { console.warn('Catalog unavailable', error); }
  setLoading('Loading WISDO identity and residence', 28);
  try {
    state.session = await api('/api/world/me'); state.guest = false;
    state.runtime = createWorldDataRuntime({
      initial: state.session,
      onSnapshot: (next) => { state.session = next; hydrateDestinations(); renderHeader(); state.world?.updateSnapshot?.(next); if (state.mode === 'home-lite') renderHomeLite(); },
      onStatus: ({ state: status }) => { if (status === 'degraded') $('syncLabel').textContent = 'Connection degraded · showing last authorized state'; },
    }).start();
  } catch (error) {
    if (error.status !== 401) console.warn('Identity sync unavailable', error);
    state.session = null; state.guest = true;
  }
  hydrateDestinations();
  const requested = new URLSearchParams(location.search).get('scene');
  state.scene = state.guest ? 'central' : requested === 'central' ? 'central' : 'home';
  renderSceneHelp(); renderHeader();
}

function renderHomeLite() {
  const mount = $('liteMount');
  const live = state.session?.homeRuntime?.live || state.session?.worldData || {};
  const financial = live.financial; const currency = financial?.currency || 'USD';
  const reporters = live.reporters || []; const positions = live.positions || [];
  mount.innerHTML = `<section class="home-lite-shell"><header><span>PRIVATE INSTANCE</span><h2>${esc(state.session?.home?.displayName || 'WISDO SMART HOME')}</h2><p>${esc(profile().callsign || 'Operator')} · ${esc(state.session?.access?.worldLabel || 'Member')}</p></header><div class="home-lite-grid"><button data-home-action="trading"><span>TRADING ROOM</span><strong>${financial ? esc(money(financial.floatingPL, currency)) : 'STANDBY'}</strong><small>${positions.length} open positions</small></button><button data-home-action="account-vault"><span>ACCOUNT VAULT</span><strong>${esc(live.account?.nickname || 'SELECT')}</strong><small>${esc(live.account?.accountNumberMasked || '')}</small></button><button data-home-action="reporter"><span>REPORTER ROOM</span><strong>${reporters.filter((r) => r.status === 'live').length}/${reporters.length}</strong><small>online nodes</small></button><button data-home-action="performance"><span>PERFORMANCE</span><strong>${financial ? esc(money(financial.equity, currency)) : '—'}</strong><small>current equity</small></button><button data-home-action="growth"><span>GROWTH ROOM</span><strong>LV ${Number(state.session?.growth?.level || 1)}</strong><small>${Number(state.session?.growth?.xp || 0).toLocaleString()} XP</small></button><button data-home-action="coach"><span>COACH</span><strong>ONLINE</strong><small>WISDO intelligence</small></button></div><button class="home-lite-exit" data-home-action="front-door">EXIT TO WISDO CENTRAL</button></section>`;
  mount.querySelectorAll('[data-home-action]').forEach((button) => button.addEventListener('click', () => homeStationModal({ station: button.dataset.homeAction, name: button.textContent.trim(), kind: 'home-station' })));
}

async function startLite(reason = '') {
  state.world?.destroy?.(); state.world = null;
  $('canvasMount').hidden = true; $('liteMount').hidden = false;
  if (state.scene === 'home' && !state.guest) {
    state.mode = 'home-lite'; renderHomeLite();
    state.world = { mode: 'home-lite', destroy: () => $('liteMount').replaceChildren(), updateSnapshot: renderHomeLite, releasePointer() {}, setPreferences() {} };
  } else {
    state.mode = 'lite';
    state.world = createLiteWorld({ mount: $('liteMount'), destinations: state.destinations, onNearestChange: updateNearest, onInteract: interactDestination });
  }
  if (reason) toast(`Lite Mode active · ${reason}`);
  completeLoading();
}

async function startHome3d() {
  setLoading('Loading your private Smart Home', 46);
  try {
    const { createHomeExperience } = await import('./home3d.js');
    state.mode = 'home3d'; $('canvasMount').hidden = false; $('liteMount').hidden = true;
    state.world = await createHomeExperience({ mount: $('canvasMount'), snapshot: state.session, preferences, onPhase: (message) => setLoading(message, Math.min(92, state.loadingValue + 9)), onNearestChange: updateNearest, onInteract: interactEntity, onTelemetry: renderDebug, onFatal: (error) => startLite(error?.message || 'Home renderer unavailable'), onReady: completeLoading });
  } catch (error) { console.error('Smart Home 3D start failed', error); await startLite('Smart Home graphics unavailable'); }
}

async function startCentral3d() {
  setLoading('Loading WISDO Central', 46);
  try {
    const { createWorldExperience } = await import('./world3d.js');
    state.mode = '3d'; $('canvasMount').hidden = false; $('liteMount').hidden = true;
    state.world = await createWorldExperience({ mount: $('canvasMount'), destinations: state.destinations, preferences, onPhase: (message) => setLoading(message, Math.min(92, state.loadingValue + 9)), onNearestChange: updateNearest, onInteract: interactDestination, onTelemetry: renderDebug, onFatal: (error) => startLite(error?.message || 'Central renderer unavailable'), onReady: completeLoading });
  } catch (error) { console.error('Central 3D start failed', error); await startLite('Central graphics unavailable'); }
}

async function switchScene(scene) {
  const next = scene === 'home' && !state.guest ? 'home' : 'central';
  if (state.scene === next && state.world) return;
  closeModal(); updateNearest(null); state.world?.destroy?.(); state.world = null; state.scene = next;
  const url = new URL(location.href); url.searchParams.set('scene', next); history.replaceState({}, '', url);
  $('loadingScreen').classList.remove('complete'); state.loadingValue = 12; renderSceneHelp(); renderHeader();
  if (shouldUseLite()) await startLite(); else if (next === 'home') await startHome3d(); else await startCentral3d();
}

function destroy() { state.runtime?.stop?.(); state.world?.destroy?.(); state.world = null; }

async function boot() {
  bindUi(); bindFirstRunHelp(); setupDebug(); renderHeader();
  await loadPlatformState();
  if (shouldUseLite()) await startLite(new URLSearchParams(location.search).get('lite') === '1' ? 'Lite Mode selected' : 'WebGL unavailable');
  else if (state.scene === 'home') await startHome3d();
  else await startCentral3d();
}

window.addEventListener('pagehide', destroy, { once: true });
boot().catch(async (error) => {
  console.error('WISDO World boot failed', error);
  state.scene = state.guest ? 'central' : 'home';
  renderHeader(); renderSceneHelp(); await startLite('World recovery mode');
});
