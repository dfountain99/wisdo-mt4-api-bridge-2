const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const id = (value) => String(value ?? '');

export class WorldEventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(type, listener) {
    if (typeof listener !== 'function') return () => {};
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
    return () => this.listeners.get(type)?.delete(listener);
  }

  emit(type, detail = {}) {
    const event = Object.freeze({ type, detail, at: new Date().toISOString() });
    for (const listener of this.listeners.get(type) || []) {
      try { listener(event); } catch (error) { console.warn(`World listener failed: ${type}`, error); }
    }
    for (const listener of this.listeners.get('*') || []) {
      try { listener(event); } catch (error) { console.warn('World wildcard listener failed', error); }
    }
    return event;
  }

  clear() {
    this.listeners.clear();
  }
}

async function request(url, options = {}) {
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

function positionMap(snapshot) {
  const rows = snapshot?.worldData?.positions || snapshot?.homeRuntime?.live?.positions || [];
  return new Map(rows.map((row) => [id(row.ticket || `${row.symbol}:${row.openedAt}:${row.direction}`), row]));
}

function reporterMap(snapshot) {
  const rows = snapshot?.worldData?.reporters || snapshot?.homeRuntime?.live?.reporters || [];
  return new Map(rows.map((row) => [id(row.id || row.accountId), row]));
}

function diffState(previous, next, bus) {
  if (!previous) {
    bus.emit('world.ready', { snapshot: next });
    return;
  }

  const previousAccount = previous?.worldData?.activeAccount || null;
  const nextAccount = next?.worldData?.activeAccount || null;
  if (id(previousAccount?.accountId) !== id(nextAccount?.accountId)) {
    bus.emit('account.selected', { previous: previousAccount, account: nextAccount });
  }
  if (!same(previousAccount, nextAccount)) bus.emit('account.updated', { account: nextAccount, previous: previousAccount });

  const previousFinancial = previous?.worldData?.financial || null;
  const nextFinancial = next?.worldData?.financial || null;
  if (!same(previousFinancial, nextFinancial)) bus.emit('financial.updated', { financial: nextFinancial, previous: previousFinancial });

  const beforePositions = positionMap(previous);
  const afterPositions = positionMap(next);
  for (const [ticket, position] of afterPositions) {
    if (!beforePositions.has(ticket)) bus.emit('position.opened', { position });
    else if (!same(beforePositions.get(ticket), position)) bus.emit('position.updated', { position, previous: beforePositions.get(ticket) });
  }
  for (const [ticket, position] of beforePositions) {
    if (!afterPositions.has(ticket)) bus.emit('position.closed', { position });
  }

  const beforeReporters = reporterMap(previous);
  const afterReporters = reporterMap(next);
  for (const [reporterId, reporter] of afterReporters) {
    const before = beforeReporters.get(reporterId);
    if (!before || before.status !== reporter.status) {
      const type = reporter.status === 'live' ? 'reporter.online' : reporter.status === 'offline' || reporter.status === 'disconnected' ? 'reporter.offline' : 'reporter.updated';
      bus.emit(type, { reporter, previous: before || null });
    }
  }

  if (!same(previous?.growth, next?.growth)) bus.emit('xp.updated', { growth: next?.growth, previous: previous?.growth });
  if (!same(previous?.access, next?.access)) bus.emit('membership.updated', { access: next?.access, previous: previous?.access });
  if (!same(previous?.home, next?.home)) bus.emit('home.updated', { home: next?.home, previous: previous?.home });

  const previousUnread = Number(previous?.homeRuntime?.notifications?.unread || 0);
  const nextUnread = Number(next?.homeRuntime?.notifications?.unread || 0);
  if (nextUnread !== previousUnread) bus.emit('notification.updated', { unread: nextUnread, previousUnread });

  const beforeAchievements = new Set(previous?.worldProfile?.achievements || []);
  for (const achievement of next?.worldProfile?.achievements || []) {
    if (!beforeAchievements.has(achievement)) bus.emit('achievement.unlocked', { achievement });
  }
}

export function createWorldDataRuntime({ initial = null, onSnapshot = null, onStatus = null } = {}) {
  const bus = new WorldEventBus();
  let snapshot = initial;
  let timer = null;
  let stopped = false;
  let inFlight = null;
  let failures = 0;

  function delay() {
    if (document.hidden) return 10_000;
    return Math.min(15_000, 2_500 * Math.max(1, 2 ** Math.min(3, failures)));
  }

  function schedule() {
    clearTimeout(timer);
    if (!stopped) timer = setTimeout(refresh, delay());
  }

  async function refresh({ immediate = false } = {}) {
    if (stopped) return snapshot;
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const next = await request('/api/world/state');
        const previous = snapshot;
        snapshot = next;
        failures = 0;
        diffState(previous, next, bus);
        onSnapshot?.(next, previous);
        onStatus?.({ state: 'live', generatedAt: next?.worldData?.generatedAt || next?.updatedAt });
        return next;
      } catch (error) {
        failures += 1;
        onStatus?.({ state: error.status === 401 ? 'unauthorized' : 'degraded', error, failures });
        bus.emit('world.connection', { state: error.status === 401 ? 'unauthorized' : 'degraded', error: error.message });
        if (immediate) throw error;
        return snapshot;
      } finally {
        inFlight = null;
        schedule();
      }
    })();
    return inFlight;
  }

  async function selectAccount(accountId) {
    const next = await request('/api/world/account/select', { method: 'POST', body: JSON.stringify({ accountId }) });
    const previous = snapshot;
    snapshot = next;
    diffState(previous, next, bus);
    onSnapshot?.(next, previous);
    return next;
  }

  async function updateHome(patch = {}) {
    const next = await request('/api/world/home', { method: 'POST', body: JSON.stringify(patch) });
    const previous = snapshot;
    snapshot = next;
    diffState(previous, next, bus);
    onSnapshot?.(next, previous);
    return next;
  }

  function start() {
    stopped = false;
    if (!snapshot) refresh();
    else schedule();
    return api;
  }

  function stop() {
    stopped = true;
    clearTimeout(timer);
    bus.clear();
  }

  function onVisibility() {
    if (!document.hidden && !stopped) refresh();
  }
  document.addEventListener('visibilitychange', onVisibility);

  const api = {
    bus,
    start,
    stop() {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    },
    refresh,
    selectAccount,
    updateHome,
    get snapshot() { return snapshot; },
  };
  return api;
}
