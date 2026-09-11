const $ = (id) => document.getElementById(id);

const state = {
  catalog: null,
  session: null,
  destinations: [],
  avatar: { x: 50, y: 62 },
  nearest: null,
  guest: false,
};

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(payload.error || payload.message || `Request failed: ${res.status}`);
    error.status = res.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 2600);
}

function tierLevel() {
  return Number(state.session?.access?.level || 0);
}

function profile() {
  return state.session?.worldProfile || { callsign: 'Guest', xp: 0, level: 1, avatarStyle: 'vanguard', title: 'World Preview' };
}

function destinationAccess(id) {
  return state.session?.access?.destinations?.find((item) => item.id === id) || null;
}

function hydrateDestinations() {
  const source = state.catalog?.destinations || [];
  state.destinations = source.map((destination) => {
    const access = destinationAccess(destination.id);
    return {
      ...destination,
      unlocked: state.guest ? destination.minLevel === 0 : Boolean(access?.unlocked),
      visited: Boolean(access?.visited),
      minTier: access?.minTier || destination.minTier || 'Member',
    };
  });
}

function renderBuildings() {
  hydrateDestinations();
  $('buildings').innerHTML = state.destinations.map((d) => `
    <button class="building ${d.unlocked ? '' : 'locked'}" data-id="${esc(d.id)}" style="left:${Number(d.x)}%;top:${Number(d.y)}%" aria-label="${esc(d.name)}">
      <span class="b-top"><span class="b-icon">${esc(d.icon || '◇')}</span><span class="lock">${d.unlocked ? '' : 'LOCKED'}</span></span>
      <strong>${esc(d.name)}</strong>
      <small>${esc(d.short || '')}</small>
      ${d.visited ? '<i class="visited-dot"></i>' : ''}
    </button>
  `).join('');
  document.querySelectorAll('.building').forEach((button) => {
    button.addEventListener('click', () => openDestination(button.dataset.id));
  });
}

function renderHeader() {
  const p = profile();
  const access = state.session?.access || { worldLabel: 'Member', level: 0 };
  const mesh = state.session?.mesh?.summary || { accounts: 0, onlineNodes: 0 };
  $('callsign').textContent = p.callsign || 'Operator';
  $('avatarLabel').textContent = (p.callsign || 'YOU').toUpperCase().slice(0, 12);
  $('tierBadge').textContent = String(access.worldLabel || 'Member').toUpperCase();
  $('accessLabel').textContent = String(access.worldLabel || 'Member').toUpperCase();
  $('xp').textContent = Number(p.xp || 0).toLocaleString();
  $('level').textContent = Number(p.level || 1);
  $('accountCount').textContent = Number(mesh.accounts || 0);
  $('onlineCount').textContent = Number(mesh.onlineNodes || 0);
  $('meshCount').textContent = Number(mesh.accounts || 0);
  $('xpBar').style.width = `${Math.min(100, (Number(p.xp || 0) % 250) / 2.5)}%`;
  $('syncLabel').textContent = state.guest ? 'Preview mode · login to persist your World' : 'Synced to your WISDO identity';
}

function moveAvatar(dx, dy) {
  state.avatar.x = Math.max(4, Math.min(96, state.avatar.x + dx));
  state.avatar.y = Math.max(17, Math.min(88, state.avatar.y + dy));
  const avatar = $('avatar');
  avatar.style.left = `${state.avatar.x}%`;
  avatar.style.top = `${state.avatar.y}%`;
  updateNearest();
}

function distance(a, b) {
  const dx = Number(a.x) - Number(b.x);
  const dy = Number(a.y) - Number(b.y);
  return Math.sqrt(dx * dx + dy * dy);
}

function updateNearest() {
  let nearest = null;
  let best = Infinity;
  for (const destination of state.destinations) {
    const d = distance(state.avatar, destination);
    if (d < best) { best = d; nearest = destination; }
  }
  const active = best < 11 ? nearest : null;
  state.nearest = active;
  document.querySelectorAll('.building').forEach((el) => el.classList.toggle('near', active?.id === el.dataset.id));
  if (!active) {
    $('proximity').hidden = true;
    return;
  }
  $('nearName').textContent = active.name;
  $('nearHint').textContent = active.unlocked ? 'Press E to interact' : `Requires ${active.minTier}`;
  $('proximity').hidden = false;
}

function destinationModal(destination) {
  const locked = !destination.unlocked;
  const visited = destination.visited ? 'Visited' : 'Not visited yet';
  return `
    <span class="modal-kicker">${esc(destination.short || 'WISDO')} · ${locked ? 'ACCESS LOCKED' : 'ACCESS READY'}</span>
    <h2>${esc(destination.icon || '◇')} ${esc(destination.name)}</h2>
    <p>${esc(destination.description || '')}</p>
    <div class="metric-grid">
      <div class="metric"><span>ACCESS</span><strong>${locked ? esc(destination.minTier) : 'OPEN'}</strong></div>
      <div class="metric"><span>STATUS</span><strong>${visited}</strong></div>
      <div class="metric"><span>WORLD TIER</span><strong>${esc(state.session?.access?.worldLabel || 'Member')}</strong></div>
    </div>
    ${locked ? `<p class="locked-message">🔒 This wing requires ${esc(destination.minTier)} access. The existing WISDO server remains the authority for membership and permissions.</p>` : ''}
    <div class="modal-actions">
      ${locked ? '<a class="action gold" href="/pricing">View access options</a>' : `<button class="action primary" id="enterDestination">Enter ${esc(destination.name)}</button>`}
      <button class="action" id="closeDestination">Stay in Plaza</button>
    </div>
  `;
}

async function openDestination(id) {
  const destination = state.destinations.find((item) => item.id === id);
  if (!destination) return;
  showModal(destinationModal(destination));
  $('closeDestination')?.addEventListener('click', closeModal);
  $('enterDestination')?.addEventListener('click', async () => {
    if (!state.guest) {
      try {
        const result = await api('/api/world/visit', { method: 'POST', body: JSON.stringify({ destinationId: destination.id }) });
        if (result.state) state.session = result.state;
        if (result.xpAwarded) toast(`+${result.xpAwarded} XP · first visit to ${destination.name}`);
        renderHeader();
        renderBuildings();
      } catch (error) {
        if (error.status === 403) {
          toast(error.message);
          return;
        }
        console.warn('World visit sync failed', error);
      }
    }
    window.location.assign(destination.route);
  });
}

function showModal(html) {
  $('modalBody').innerHTML = html;
  $('modal').hidden = false;
}

function closeModal() {
  $('modal').hidden = true;
  $('modalBody').innerHTML = '';
}

function mapModal() {
  const items = state.destinations.map((d) => `<div class="list-row"><div><span class="dot ${d.unlocked ? 'online' : ''}"></span><strong>${esc(d.name)}</strong><br><small>${d.unlocked ? 'Accessible' : `Requires ${esc(d.minTier)}`}${d.visited ? ' · visited' : ''}</small></div><button class="action" data-map-dest="${esc(d.id)}">View</button></div>`).join('');
  showModal(`<span class="modal-kicker">WORLD MAP</span><h2>WISDO Plaza</h2><p>Every building is a doorway into the existing WISDO operating system.</p><div class="list">${items}</div>`);
  document.querySelectorAll('[data-map-dest]').forEach((button) => button.addEventListener('click', () => openDestination(button.dataset.mapDest)));
}

async function meshModal() {
  if (state.guest) {
    showModal(`<span class="modal-kicker">REPORTER MESH</span><h2>Login required</h2><p>Your live linked accounts and reporter state appear here after you sign in.</p><div class="modal-actions"><a class="action primary" href="/login?returnTo=/world/">Login with Discord</a></div>`);
    return;
  }
  showModal('<span class="modal-kicker">REPORTER MESH</span><h2>Loading your nodes…</h2>');
  try {
    const mesh = await api('/api/world/mesh');
    const rows = (mesh.nodes || []).map((node) => `
      <div class="list-row">
        <div><span class="dot ${node.status === 'online' ? 'online' : ''}"></span><strong>${esc(node.name)}</strong><br><small>${esc(node.type)} · ${esc(node.status || 'offline')}</small></div>
        <small>${node.canExecuteTrades ? 'EXECUTION ENABLED' : 'REPORT / SIGNAL ONLY'}</small>
      </div>`).join('') || '<div class="list-row"><div><strong>No linked reporters yet</strong><br><small>Connect an MT4 account to populate this mesh.</small></div></div>';
    showModal(`
      <span class="modal-kicker">REPORTER MESH · LIVE SERVER STATE</span>
      <h2>Your WISDO Network</h2>
      <p>${esc(mesh.safetyNotice || '')}</p>
      <div class="metric-grid">
        <div class="metric"><span>ACCOUNTS</span><strong>${Number(mesh.summary?.accounts || 0)}</strong></div>
        <div class="metric"><span>NODES</span><strong>${Number(mesh.summary?.nodes || 0)}</strong></div>
        <div class="metric"><span>ONLINE</span><strong>${Number(mesh.summary?.onlineNodes || 0)}</strong></div>
      </div>
      <div class="list">${rows}</div>
      <div class="modal-actions"><a class="action primary" href="/member/link-account">Connect Account</a><a class="action" href="/member/accounts">Manage Accounts</a></div>
    `);
  } catch (error) {
    showModal(`<span class="modal-kicker">REPORTER MESH</span><h2>Could not load mesh</h2><p>${esc(error.message)}</p>`);
  }
}

function progressModal() {
  const p = profile();
  const visited = state.destinations.filter((item) => item.visited).length;
  showModal(`
    <span class="modal-kicker">WORLD PROGRESSION</span>
    <h2>${esc(p.callsign || 'Operator')}</h2>
    <p>${esc(p.title || 'World Explorer')} · progress is stored in the existing WISDO repository.</p>
    <div class="metric-grid">
      <div class="metric"><span>LEVEL</span><strong>${Number(p.level || 1)}</strong></div>
      <div class="metric"><span>XP</span><strong>${Number(p.xp || 0).toLocaleString()}</strong></div>
      <div class="metric"><span>PLACES VISITED</span><strong>${visited}/${state.destinations.length}</strong></div>
    </div>
    <div class="modal-actions"><button id="progressProfile" class="action primary">Customize Identity</button></div>
  `);
  $('progressProfile')?.addEventListener('click', profileModal);
}

function profileModal() {
  const p = profile();
  if (state.guest) {
    showModal(`<span class="modal-kicker">WORLD IDENTITY</span><h2>Build your WISDO identity</h2><p>Login to save a callsign, title, avatar class, XP, and visited destinations.</p><div class="modal-actions"><a class="action primary" href="/login?returnTo=/world/">Login with Discord</a></div>`);
    return;
  }
  showModal(`
    <span class="modal-kicker">WORLD IDENTITY</span>
    <h2>Customize Your Operator</h2>
    <form id="profileForm" class="profile-form">
      <label>CALLSIGN<input name="callsign" maxlength="48" value="${esc(p.callsign || '')}" required></label>
      <label>TITLE<input name="title" maxlength="64" value="${esc(p.title || '')}" required></label>
      <label class="full">AVATAR CLASS<select name="avatarStyle">
        ${['vanguard','architect','sentinel','scholar'].map((v) => `<option value="${v}" ${p.avatarStyle === v ? 'selected' : ''}>${v.toUpperCase()}</option>`).join('')}
      </select></label>
      <div class="full modal-actions"><button class="action primary" type="submit">Save Identity</button></div>
    </form>
  `);
  $('profileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      state.session = await api('/api/world/profile', { method: 'POST', body: JSON.stringify(body) });
      renderHeader();
      toast('WISDO identity saved');
      closeModal();
    } catch (error) {
      toast(error.message);
    }
  });
}

function bindControls() {
  const steps = { ArrowUp: [0,-2], w:[0,-2], W:[0,-2], ArrowDown:[0,2], s:[0,2], S:[0,2], ArrowLeft:[-2,0], a:[-2,0], A:[-2,0], ArrowRight:[2,0], d:[2,0], D:[2,0] };
  window.addEventListener('keydown', (event) => {
    if (!$('modal').hidden) {
      if (event.key === 'Escape') closeModal();
      return;
    }
    if (steps[event.key]) {
      event.preventDefault();
      moveAvatar(...steps[event.key]);
    }
    if ((event.key === 'e' || event.key === 'E' || event.key === 'Enter') && state.nearest) openDestination(state.nearest.id);
  });
  document.querySelectorAll('[data-move]').forEach((button) => {
    const delta = { up:[0,-3], down:[0,3], left:[-3,0], right:[3,0] }[button.dataset.move];
    button.addEventListener('click', () => moveAvatar(...delta));
  });
  $('interactBtn').addEventListener('click', () => state.nearest && openDestination(state.nearest.id));
  $('modalClose').addEventListener('click', closeModal);
  $('modalBackdrop').addEventListener('click', closeModal);
  ['mapBtn','dockMap'].forEach((id) => $(id).addEventListener('click', mapModal));
  ['meshBtn','dockMesh'].forEach((id) => $(id).addEventListener('click', meshModal));
  $('dockAchievements').addEventListener('click', progressModal);
  $('profileBtn').addEventListener('click', profileModal);
}

async function boot() {
  bindControls();
  try {
    state.catalog = await api('/api/world/catalog');
  } catch (error) {
    $('syncLabel').textContent = `World catalog unavailable: ${error.message}`;
    return;
  }

  try {
    state.session = await api('/api/world/me');
    state.guest = false;
  } catch (error) {
    if (error.status === 401) {
      state.guest = true;
      state.session = {
        worldProfile: { callsign: 'Guest', title: 'World Preview', avatarStyle: 'vanguard', xp: 0, level: 1, visitedDestinations: [] },
        access: { tierKey: 'member', worldLabel: 'Member', level: 0, destinations: state.catalog.destinations.map((d) => ({ ...d, unlocked: d.minLevel === 0, visited: false })) },
        mesh: { summary: { accounts: 0, onlineNodes: 0 } },
      };
      toast('Preview mode · login to save progress and load your accounts');
    } else {
      console.warn('World session failed', error);
      state.guest = true;
    }
  }

  renderHeader();
  renderBuildings();
  moveAvatar(0, 0);
  $('app').dataset.ready = 'true';
}

boot();
