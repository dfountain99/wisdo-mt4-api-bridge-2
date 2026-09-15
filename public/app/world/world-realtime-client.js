const KNOWN_EXTERNAL_EVENTS = Object.freeze([
  'presence.updated',
  'presence.left',
  'position.opened',
  'position.closed',
  'bot.signal.created',
  'bot.signal.updated',
  'bot.signal.expired',
  'reporter.online',
  'reporter.offline',
  'campaign.created',
  'campaign.updated',
  'campaign.closed',
  'achievement.unlocked',
  'world.event',
]);

function safeJson(value, fallback = null) {
  try { return JSON.parse(String(value || '')); } catch { return fallback; }
}

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sceneKey(value = 'central') {
  const scene = String(value || 'central').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  return scene || 'central';
}

function sleepJitter(base, attempt, max) {
  const cap = Math.min(max, base * (2 ** Math.min(6, attempt)));
  return Math.floor(cap * (.7 + Math.random() * .6));
}

async function sameOriginJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `Realtime request failed (${response.status})`);
    error.status = response.status;
    error.payload = body;
    throw error;
  }
  return body;
}

export function createWorldRealtimeClient({
  initialScene = 'central',
  onStatus = () => {},
  onRoster = () => {},
  onEvent = () => {},
  logger = console,
} = {}) {
  const state = {
    scene: sceneKey(initialScene),
    mode: 'idle',
    config: null,
    ticket: null,
    source: null,
    stopped: false,
    generation: 0,
    reconnectAttempt: 0,
    reconnectTimer: null,
    presenceTimer: null,
    latestPlayer: null,
    roster: new Map(),
    seenEventIds: new Map(),
    serverOffsetMs: 0,
    connectedAt: null,
    lastEventAt: null,
    lastPresenceAt: null,
  };

  function status(extra = {}) {
    const payload = {
      state: state.mode,
      scene: state.scene,
      mode: state.config?.mode || 'unknown',
      instance: state.config?.instance || null,
      online: state.roster.size,
      connectedAt: state.connectedAt,
      lastEventAt: state.lastEventAt,
      lastPresenceAt: state.lastPresenceAt,
      ...extra,
    };
    onStatus(payload);
    window.dispatchEvent(new CustomEvent('wisdo:world-realtime-status', { detail: payload }));
  }

  function updateServerClock(serverTime) {
    const parsed = Date.parse(serverTime || '');
    if (Number.isFinite(parsed)) state.serverOffsetMs = parsed - Date.now();
  }

  function rememberEvent(id) {
    const key = String(id || '').trim();
    if (!key) return false;
    if (state.seenEventIds.has(key)) return true;
    const now = Date.now();
    state.seenEventIds.set(key, now);
    if (state.seenEventIds.size > 1500) {
      for (const [eventId, at] of state.seenEventIds) {
        if (now - at > 5 * 60 * 1000 || state.seenEventIds.size > 1000) state.seenEventIds.delete(eventId);
        if (state.seenEventIds.size <= 1000) break;
      }
    }
    return false;
  }

  function emitRoster() {
    const roster = [...state.roster.values()];
    onRoster(roster);
    window.dispatchEvent(new CustomEvent('wisdo:world-presence-roster', {
      detail: { scene: state.scene, instance: state.config?.instance || null, roster },
    }));
    status();
  }

  function ingestPresence(row) {
    if (!row?.userId) return;
    state.roster.set(String(row.userId), row);
    emitRoster();
  }

  function removePresence(userId) {
    if (!userId) return;
    state.roster.delete(String(userId));
    emitRoster();
  }

  function dispatchEvent(event = {}) {
    const normalized = event?.payload && event.type && !event.payload.type
      ? { ...event.payload, type: event.type, eventId: event.eventId || event.payload.eventId, envelope: event }
      : event;
    const type = String(normalized?.type || event?.type || 'world.event');
    const eventId = normalized?.eventId || normalized?.id || event?.eventId || event?.id || '';
    if (eventId && rememberEvent(eventId)) return;
    state.lastEventAt = new Date().toISOString();

    if (type === 'presence.updated') ingestPresence(normalized.presence || event.presence);
    else if (type === 'presence.left') removePresence(normalized.userId || event.userId);

    onEvent(normalized);
    window.dispatchEvent(new CustomEvent('wisdo:world-realtime-event', { detail: normalized }));
    window.dispatchEvent(new CustomEvent(`wisdo:${type}`, { detail: normalized }));
    status();
  }

  function stopTimers() {
    clearTimeout(state.reconnectTimer);
    clearInterval(state.presenceTimer);
    state.reconnectTimer = null;
    state.presenceTimer = null;
  }

  function closeSource() {
    try { state.source?.close?.(); } catch {}
    state.source = null;
  }

  async function externalPresence(method = 'POST') {
    if (!state.ticket?.ticket || !state.ticket?.gatewayUrl) return;
    const url = `${String(state.ticket.gatewayUrl).replace(/\/$/, '')}/v1/world/presence`;
    const body = method === 'DELETE' ? undefined : JSON.stringify({
      scene: state.scene,
      position: state.latestPlayer?.position || { x: 0, y: 0, z: 0 },
      rotation: state.latestPlayer?.rotation || { x: 0, y: 0, z: 0 },
      velocity: state.latestPlayer?.velocity || { x: 0, y: 0, z: 0 },
      locomotionState: state.latestPlayer?.locomotionState || 'IDLE',
      emote: state.latestPlayer?.emote || null,
      speaking: Boolean(state.latestPlayer?.speaking),
    });
    const response = await fetch(url, {
      method,
      mode: 'cors',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${state.ticket.ticket}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body,
    });
    if (!response.ok) throw new Error(`Presence gateway rejected update (${response.status})`);
    const payload = await response.json().catch(() => ({}));
    updateServerClock(payload.serverTime);
    state.lastPresenceAt = new Date().toISOString();
    if (payload.presence) ingestPresence(payload.presence);
  }

  async function fallbackPresence() {
    if (state.scene !== 'central') return;
    const player = state.latestPlayer || {};
    const payload = await sameOriginJson('/api/world/realtime/state', {
      method: 'POST',
      body: JSON.stringify({
        instance: 'central',
        x: finite(player.position?.x),
        y: finite(player.position?.y),
        z: finite(player.position?.z),
        yaw: finite(player.rotation?.y),
        state: String(player.locomotionState || 'IDLE').toUpperCase(),
      }),
    }).catch((error) => {
      if (![202, 409].includes(error.status)) throw error;
      return error.payload || {};
    });
    updateServerClock(payload.serverTime);
    state.lastPresenceAt = new Date().toISOString();
  }

  function startPresenceLoop(generation) {
    clearInterval(state.presenceTimer);
    const interval = state.config?.mode === 'external-gateway'
      ? Math.max(1000, Number(state.config?.heartbeatMs || 3000))
      : 500;
    const send = async () => {
      if (state.stopped || generation !== state.generation || !state.latestPlayer) return;
      try {
        if (state.config?.mode === 'external-gateway') await externalPresence('POST');
        else await fallbackPresence();
      } catch (error) {
        logger?.warn?.('WISDO World presence update failed.', { message: error.message });
        status({ degraded: true, error: error.message });
      }
    };
    send();
    state.presenceTimer = setInterval(send, interval);
  }

  function scheduleReconnect(generation) {
    if (state.stopped || generation !== state.generation || state.reconnectTimer) return;
    const base = Number(state.config?.reconnectBaseMs || 900);
    const max = Number(state.config?.reconnectMaxMs || 15000);
    const wait = sleepJitter(base, state.reconnectAttempt++, max);
    state.mode = 'reconnecting';
    status({ reconnectInMs: wait });
    state.reconnectTimer = setTimeout(() => {
      state.reconnectTimer = null;
      connect().catch((error) => {
        logger?.warn?.('WISDO World realtime reconnect failed.', { message: error.message });
        scheduleReconnect(generation);
      });
    }, wait);
  }

  function bindExternalSource(source, generation) {
    source.addEventListener('ready', (message) => {
      if (generation !== state.generation) return;
      const payload = safeJson(message.data, {});
      updateServerClock(payload.serverTime);
      state.roster.clear();
      for (const row of payload.presence || []) if (row?.userId) state.roster.set(String(row.userId), row);
      state.mode = 'online'; state.connectedAt = new Date().toISOString(); state.reconnectAttempt = 0;
      emitRoster(); startPresenceLoop(generation);
    });
    for (const type of KNOWN_EXTERNAL_EVENTS) {
      source.addEventListener(type, (message) => {
        if (generation !== state.generation) return;
        const payload = safeJson(message.data, null);
        if (payload) dispatchEvent(payload);
      });
    }
    source.onerror = () => {
      if (generation !== state.generation || state.stopped) return;
      closeSource(); clearInterval(state.presenceTimer); state.presenceTimer = null;
      scheduleReconnect(generation);
    };
  }

  function bindFallbackSource(source, generation) {
    source.addEventListener('hello', (message) => {
      if (generation !== state.generation) return;
      const payload = safeJson(message.data, {});
      updateServerClock(payload.serverTime);
      state.mode = 'online'; state.connectedAt = new Date().toISOString(); state.reconnectAttempt = 0;
      status(); startPresenceLoop(generation);
    });
    source.addEventListener('snapshot', (message) => {
      if (generation !== state.generation) return;
      const payload = safeJson(message.data, {});
      updateServerClock(payload.serverTime);
      state.roster.clear();
      for (const player of payload.players || []) state.roster.set(String(player.id), {
        userId: String(player.id), displayName: player.displayName, title: player.title,
        position: { x: player.x, y: player.y, z: player.z }, rotation: { x: 0, y: player.yaw, z: 0 },
        locomotionState: player.state, updatedAt: player.updatedAt,
      });
      emitRoster();
    });
    source.addEventListener('player-state', (message) => {
      if (generation !== state.generation) return;
      const payload = safeJson(message.data, {}); const player = payload.player;
      if (!player?.id) return;
      ingestPresence({
        userId: String(player.id), displayName: player.displayName, title: player.title,
        position: { x: player.x, y: player.y, z: player.z }, rotation: { x: 0, y: player.yaw, z: 0 },
        locomotionState: player.state, updatedAt: player.updatedAt,
      });
    });
    source.addEventListener('world-event', (message) => {
      const payload = safeJson(message.data, null); if (payload) dispatchEvent(payload);
    });
    source.onerror = () => {
      if (generation !== state.generation || state.stopped) return;
      closeSource(); clearInterval(state.presenceTimer); state.presenceTimer = null;
      scheduleReconnect(generation);
    };
  }

  async function connect() {
    if (state.stopped) return;
    const generation = state.generation;
    closeSource(); clearInterval(state.presenceTimer); state.presenceTimer = null;
    state.mode = 'connecting'; status();
    const config = await sameOriginJson(`/api/world/realtime/config?scene=${encodeURIComponent(state.scene)}`);
    if (generation !== state.generation || state.stopped) return;
    state.config = config;

    if (config.mode === 'external-gateway') {
      const ticket = await sameOriginJson('/api/world/realtime/ticket', {
        method: 'POST', body: JSON.stringify({ scene: state.scene }),
      });
      if (generation !== state.generation || state.stopped) return;
      state.ticket = ticket;
      const source = new EventSource(`${String(ticket.gatewayUrl).replace(/\/$/, '')}/v1/world/stream?ticket=${encodeURIComponent(ticket.ticket)}`);
      state.source = source;
      bindExternalSource(source, generation);
      return;
    }

    state.ticket = null;
    if (state.scene !== 'central') {
      state.mode = 'standby'; state.roster.clear(); emitRoster();
      return;
    }
    const source = new EventSource('/api/world/realtime/stream?instance=central');
    state.source = source;
    bindFallbackSource(source, generation);
  }

  async function leaveCurrent() {
    if (state.config?.mode === 'external-gateway' && state.ticket?.ticket) {
      await externalPresence('DELETE').catch(() => undefined);
    }
  }

  async function setScene(nextScene) {
    const next = sceneKey(nextScene);
    if (next === state.scene && state.source) return;
    await leaveCurrent();
    state.generation += 1;
    stopTimers(); closeSource(); state.roster.clear(); state.ticket = null; state.config = null;
    state.scene = next; state.mode = 'switching'; emitRoster();
    await connect().catch((error) => {
      logger?.warn?.('WISDO World realtime scene join failed.', { scene: next, message: error.message });
      scheduleReconnect(state.generation);
    });
  }

  function updatePlayerState({ telemetry = null, scene = state.scene, locomotionState = null, rotation = null, velocity = null, emote = null, speaking = false } = {}) {
    if (sceneKey(scene) !== state.scene) return;
    const player = telemetry?.player || telemetry?.position || null;
    if (!player) return;
    state.latestPlayer = {
      position: { x: finite(player.x), y: finite(player.y), z: finite(player.z) },
      rotation: rotation || { x: 0, y: finite(player.yaw ?? telemetry?.yaw), z: 0 },
      velocity: velocity || telemetry?.velocity || { x: 0, y: 0, z: 0 },
      locomotionState: locomotionState || player.state || telemetry?.locomotionState || 'IDLE',
      emote,
      speaking,
    };
  }

  async function start() {
    state.stopped = false; state.generation += 1;
    await connect().catch((error) => {
      logger?.warn?.('WISDO World realtime initial connection failed.', { message: error.message });
      scheduleReconnect(state.generation);
    });
    return api;
  }

  async function stop() {
    if (state.stopped) return;
    state.stopped = true;
    await leaveCurrent();
    state.generation += 1; stopTimers(); closeSource(); state.roster.clear();
    state.mode = 'stopped'; status();
  }

  const api = Object.freeze({
    start,
    stop,
    setScene,
    updatePlayerState,
    get serverNow() { return Date.now() + state.serverOffsetMs; },
    get scene() { return state.scene; },
    get mode() { return state.mode; },
    get roster() { return [...state.roster.values()]; },
    get snapshot() {
      return {
        scene: state.scene,
        mode: state.mode,
        config: state.config,
        online: state.roster.size,
        connectedAt: state.connectedAt,
        lastEventAt: state.lastEventAt,
        lastPresenceAt: state.lastPresenceAt,
      };
    },
  });
  return api;
}
