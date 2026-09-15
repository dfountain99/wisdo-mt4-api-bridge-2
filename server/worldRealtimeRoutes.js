import crypto from 'node:crypto';
import { getSessionUser, safeReturnPath } from './security.js';
import { buildPresenceSnapshot, ensurePresenceState } from '../services/culturePresenceService.js';
import { issueWorldRealtimeTicket } from '../services/worldRealtimeTicketService.js';
import { publicWorldInstance, resolveWorldInstance, worldRealtimeScopesForInstance } from '../services/worldInstanceService.js';

const WORLD_INSTANCE = 'central';
const MAX_PLAYERS = 24;
const MAX_CLIENTS = 32;
const HEARTBEAT_MS = 15_000;
const MIN_STATE_INTERVAL_MS = 90;
const PULSE_INTERVAL_MS = 1_250;

const room = {
  players: new Map(),
  clients: new Set(),
  lastEvent: null,
};

function parseBool(value) {
  return value === true || ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function clean(value, max = 2048) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function publicGatewayUrl() {
  const raw = clean(process.env.WISDO_WORLD_REALTIME_PUBLIC_URL, 2048).replace(/\/$/, '');
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') return '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function externalRealtimeReady() {
  return Boolean(publicGatewayUrl() && String(process.env.WISDO_WORLD_REALTIME_TICKET_SECRET || '').length >= 32);
}

function currentUser(req) {
  const session = getSessionUser(req);
  if (session?.id) return session;
  if ((process.env.NODE_ENV === 'test' || parseBool(process.env.WISDO_ALLOW_TEST_IDENTITY)) && req.headers['x-wisdo-test-user']) {
    return { id: String(req.headers['x-wisdo-test-user']), username: 'Test Member', roles: ['admin'] };
  }
  return null;
}

function requireUser(req, res, next) {
  const user = currentUser(req);
  if (!user) {
    if (String(req.headers.accept || '').includes('text/html')) {
      return res.redirect(`/login?returnTo=${encodeURIComponent(safeReturnPath(req.originalUrl, '/app/world?scene=central'))}`);
    }
    return res.status(401).json({ ok: false, error: 'Authentication required.' });
  }
  req.wisdoUser = user;
  next();
}

export function sanitizeWorldInstance(value) {
  return String(value || WORLD_INSTANCE).toLowerCase() === WORLD_INSTANCE ? WORLD_INSTANCE : null;
}

function finite(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

export function sanitizePlayerState(input = {}, previous = {}) {
  const allowedStates = new Set(['IDLE', 'WALK', 'RUN', 'SPRINT', 'JUMP', 'FALL']);
  const nextState = String(input.state || previous.state || 'IDLE').toUpperCase();
  return {
    x: finite(input.x, finite(previous.x, 0, -160, 160), -160, 160),
    y: finite(input.y, finite(previous.y, 0, -40, 120), -40, 120),
    z: finite(input.z, finite(previous.z, 0, -160, 160), -160, 160),
    yaw: finite(input.yaw, finite(previous.yaw, 0, -1000, 1000), -1000, 1000),
    state: allowedStates.has(nextState) ? nextState : 'IDLE',
  };
}

function cleanText(value, max = 48) {
  return String(value || '').trim().replace(/\s+/g, ' ').replace(/[<>]/g, '').slice(0, max);
}

function publicPlayer(player) {
  if (!player) return null;
  return {
    id: player.id,
    displayName: player.displayName,
    cultureId: player.cultureId,
    title: player.title,
    x: player.x,
    y: player.y,
    z: player.z,
    yaw: player.yaw,
    state: player.state,
    connectedAt: player.connectedAt,
    updatedAt: player.updatedAt,
  };
}

function writeSse(res, event, payload) {
  if (res.writableEnded || res.destroyed) return false;
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    res.flush?.();
    return true;
  } catch {
    return false;
  }
}

function broadcast(event, payload) {
  for (const client of [...room.clients]) {
    if (!writeSse(client.res, event, payload)) room.clients.delete(client);
  }
}

function snapshotPayload() {
  return {
    instance: WORLD_INSTANCE,
    players: [...room.players.values()].map(publicPlayer),
    online: room.players.size,
    lastEvent: room.lastEvent,
    serverTime: new Date().toISOString(),
  };
}

function broadcastSnapshot() {
  broadcast('snapshot', snapshotPayload());
}

function hasClientForUser(userId) {
  for (const client of room.clients) if (client.userId === userId) return true;
  return false;
}

async function identityForUser(loadEcosystemState, saveEcosystemState, user) {
  if (typeof loadEcosystemState === 'function' && typeof saveEcosystemState === 'function') {
    try {
      const state = ensurePresenceState(await loadEcosystemState());
      const hadPresence = Boolean(state.culturePresenceByUserId?.[String(user.id)]);
      const profile = buildPresenceSnapshot(state, user);
      if (!hadPresence) await saveEcosystemState(state);
      return {
        displayName: cleanText(profile.displayName || user.global_name || user.username || 'Operator'),
        cultureId: cleanText(profile.cultureId || '', 24),
        title: cleanText(profile.title || 'Operator', 40),
      };
    } catch {}
  }
  return {
    displayName: cleanText(user.global_name || user.username || 'Operator'),
    cultureId: '',
    title: 'Operator',
  };
}

function removeClient(client) {
  room.clients.delete(client);
  if (!hasClientForUser(client.userId)) {
    room.players.delete(client.userId);
    room.lastEvent = {
      id: crypto.randomUUID(),
      type: 'operator-left',
      userId: client.userId,
      at: new Date().toISOString(),
      execution: false,
    };
    broadcast('world-event', room.lastEvent);
    broadcastSnapshot();
  }
}

function resolveRequestedInstance(req, user) {
  const scene = clean(req.body?.scene ?? req.query?.scene ?? 'central', 80);
  return resolveWorldInstance({ scene, destinationId: scene, userId: user.id });
}

function realtimeConfigFor(instance) {
  const gatewayUrl = publicGatewayUrl();
  const external = externalRealtimeReady();
  return {
    ok: true,
    version: 'alpha4',
    mode: external ? 'external-gateway' : 'core-fallback',
    transport: external ? 'sse+http-presence' : 'same-origin-sse',
    gatewayUrl: external ? gatewayUrl : null,
    instance: publicWorldInstance(instance),
    heartbeatMs: external ? Math.max(1000, Number(process.env.WISDO_WORLD_CLIENT_HEARTBEAT_MS || 3000)) : MIN_STATE_INTERVAL_MS,
    reconnectBaseMs: 900,
    reconnectMaxMs: 15000,
    ticketTtlSeconds: Math.min(180, Math.max(45, Number(process.env.WISDO_WORLD_REALTIME_TICKET_TTL_SECONDS || 90))),
    execution: false,
    financialAuthority: 'wisdo-core-only',
  };
}

export function registerWorldRealtimeRoutes(app, { loadEcosystemState, saveEcosystemState, logger = null } = {}) {
  app.get('/api/world/realtime/config', requireUser, (req, res) => {
    try {
      const instance = resolveRequestedInstance(req, req.wisdoUser);
      res.set('Cache-Control', 'private, no-store');
      res.json(realtimeConfigFor(instance));
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/world/realtime/ticket', requireUser, async (req, res) => {
    try {
      if (!externalRealtimeReady()) {
        return res.status(503).json({ ok: false, error: 'External World realtime gateway is not configured.', mode: 'core-fallback' });
      }
      const instance = resolveRequestedInstance(req, req.wisdoUser);
      const identity = await identityForUser(loadEcosystemState, saveEcosystemState, req.wisdoUser);
      const ttlSeconds = Math.min(180, Math.max(45, Number(process.env.WISDO_WORLD_REALTIME_TICKET_TTL_SECONDS || 90)));
      const ticket = issueWorldRealtimeTicket({
        userId: String(req.wisdoUser.id),
        worldId: instance.worldId,
        instanceId: instance.instanceId,
        scopes: worldRealtimeScopesForInstance(instance),
        ttlSeconds,
        metadata: {
          scene: instance.scene,
          displayName: identity.displayName,
          title: identity.title,
        },
      });
      res.set('Cache-Control', 'private, no-store');
      res.json({
        ok: true,
        ticket,
        gatewayUrl: publicGatewayUrl(),
        instance: publicWorldInstance(instance),
        expiresInSeconds: ttlSeconds,
        execution: false,
      });
    } catch (error) {
      logger?.warn?.('World realtime ticket issuance failed.', { message: error.message, userId: req.wisdoUser?.id });
      res.status(500).json({ ok: false, error: 'World realtime ticket could not be issued.' });
    }
  });

  // Same-process WISDO Central transport remains as a zero-infrastructure fallback.
  // It is intentionally Central-only; Home and destination instances require the
  // external gateway so one Node process never becomes the persistent MMO server.
  app.get('/api/world/realtime/stream', requireUser, async (req, res) => {
    const instance = sanitizeWorldInstance(req.query.instance);
    if (!instance) return res.status(400).json({ ok: false, error: 'Only the WISDO Central fallback instance is enabled.' });
    if (room.clients.size >= MAX_CLIENTS) return res.status(503).json({ ok: false, error: 'WISDO Central realtime capacity is full. Retry shortly.' });

    const userId = String(req.wisdoUser.id);
    if (!room.players.has(userId) && room.players.size >= MAX_PLAYERS) {
      return res.status(503).json({ ok: false, error: 'WISDO Central player capacity is full. Retry shortly.' });
    }

    const identity = await identityForUser(loadEcosystemState, saveEcosystemState, req.wisdoUser);
    const now = new Date().toISOString();
    const previous = room.players.get(userId);
    const player = {
      id: userId,
      ...identity,
      ...sanitizePlayerState(previous || {}),
      connectedAt: previous?.connectedAt || now,
      updatedAt: now,
      lastInputAt: 0,
      lastPulseAt: previous?.lastPulseAt || 0,
    };
    room.players.set(userId, player);

    res.status(200);
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();
    req.socket?.setTimeout?.(0);

    const client = { res, userId };
    room.clients.add(client);
    writeSse(res, 'hello', { ok: true, selfId: userId, instance, serverTime: now, execution: false });

    room.lastEvent = {
      id: crypto.randomUUID(),
      type: 'operator-joined',
      userId,
      displayName: player.displayName,
      at: now,
      execution: false,
    };
    broadcast('world-event', room.lastEvent);
    broadcastSnapshot();

    const heartbeat = setInterval(() => {
      if (!res.writableEnded && !res.destroyed) {
        try { res.write(`: wisdo-heartbeat ${Date.now()}\n\n`); res.flush?.(); } catch {}
      }
    }, HEARTBEAT_MS);
    heartbeat.unref?.();

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      removeClient(client);
    };
    req.on('aborted', close);
    res.on('close', close);
  });

  app.post('/api/world/realtime/state', requireUser, (req, res) => {
    const instance = sanitizeWorldInstance(req.body?.instance);
    if (!instance) return res.status(400).json({ ok: false, error: 'Invalid World fallback instance.' });
    const userId = String(req.wisdoUser.id);
    const player = room.players.get(userId);
    if (!player) return res.status(409).json({ ok: false, error: 'Join the WISDO Central realtime stream before sending movement.' });

    const nowMs = Date.now();
    if (nowMs - Number(player.lastInputAt || 0) < MIN_STATE_INTERVAL_MS) {
      return res.status(202).json({ ok: true, accepted: false, reason: 'rate_limited' });
    }
    const next = sanitizePlayerState(req.body, player);
    Object.assign(player, next, { updatedAt: new Date(nowMs).toISOString(), lastInputAt: nowMs });
    const publicState = publicPlayer(player);
    broadcast('player-state', { instance, player: publicState, serverTime: player.updatedAt });
    res.set('Cache-Control', 'no-store');
    return res.json({ ok: true, accepted: true, serverTime: player.updatedAt });
  });

  app.post('/api/world/realtime/pulse', requireUser, (req, res) => {
    const instance = sanitizeWorldInstance(req.body?.instance);
    if (!instance) return res.status(400).json({ ok: false, error: 'Invalid World instance.' });
    const userId = String(req.wisdoUser.id);
    const player = room.players.get(userId);
    if (!player) return res.status(409).json({ ok: false, error: 'Join WISDO Central before sending a World pulse.' });
    const nowMs = Date.now();
    if (nowMs - Number(player.lastPulseAt || 0) < PULSE_INTERVAL_MS) {
      return res.status(429).json({ ok: false, error: 'World pulse cooldown active.' });
    }
    player.lastPulseAt = nowMs;
    room.lastEvent = {
      id: crypto.randomUUID(),
      type: 'world-pulse',
      sourceUserId: userId,
      displayName: player.displayName,
      label: cleanText(req.body?.label || 'SYNC PULSE', 48) || 'SYNC PULSE',
      at: new Date(nowMs).toISOString(),
      execution: false,
    };
    broadcast('world-event', room.lastEvent);
    res.set('Cache-Control', 'no-store');
    return res.json({ ok: true, event: room.lastEvent });
  });

  app.get('/api/world/realtime/status', requireUser, (req, res) => {
    let instance;
    try { instance = resolveRequestedInstance(req, req.wisdoUser); }
    catch { instance = resolveWorldInstance({ scene: 'central', userId: req.wisdoUser.id }); }
    res.set('Cache-Control', 'private, no-store');
    res.json({
      ok: true,
      mode: externalRealtimeReady() ? 'external-gateway' : 'core-fallback',
      externalReady: externalRealtimeReady(),
      instance: publicWorldInstance(instance),
      fallback: { instance: WORLD_INSTANCE, online: room.players.size, clients: room.clients.size, capacity: MAX_PLAYERS },
      execution: false,
    });
  });

  logger?.info?.('WISDO World realtime routes registered', {
    fallbackInstance: WORLD_INSTANCE,
    maxPlayers: MAX_PLAYERS,
    maxClients: MAX_CLIENTS,
    externalReady: externalRealtimeReady(),
  });
}
