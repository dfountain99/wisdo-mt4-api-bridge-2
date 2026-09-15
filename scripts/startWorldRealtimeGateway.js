import crypto from 'node:crypto';
import express from 'express';
import { createWorldRealtimeFabric } from '../services/worldRealtimeFabric.js';
import { verifyWorldRealtimeTicket, ticketHasScope } from '../services/worldRealtimeTicketService.js';
import { createWorldEventOutboxRepository } from '../storage/worldEventOutboxRepository.js';

const app = express();
const port = Number(process.env.PORT || process.env.WISDO_WORLD_REALTIME_PORT || 8790);
const maxStreams = Math.max(10, Number(process.env.WISDO_WORLD_MAX_STREAMS || 500));
const ticketSecret = String(process.env.WISDO_WORLD_REALTIME_TICKET_SECRET || '');
const serviceSecret = String(process.env.WISDO_WORLD_SERVICE_SECRET || '');
const fabric = createWorldRealtimeFabric();
const outbox = createWorldEventOutboxRepository();
const streams = new Set();
const recentEventIds = new Map();
let shuttingDown = false;

function clean(value, max = 160) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function finite(value, fallback = 0, min = -1000000, max = 1000000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function vec3(value = {}) {
  return {
    x: finite(value?.x),
    y: finite(value?.y),
    z: finite(value?.z),
  };
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function bearer(req) {
  const header = String(req.headers.authorization || '');
  return /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i, '').trim() : '';
}

function realtimeTicket(req) {
  return bearer(req) || clean(req.query?.ticket, 8192);
}

function requireTicket(scope) {
  return (req, res, next) => {
    if (ticketSecret.length < 32) return res.status(503).json({ ok: false, error: 'World realtime ticket service is not configured.' });
    const verified = verifyWorldRealtimeTicket(realtimeTicket(req), ticketSecret);
    if (!verified.ok) return res.status(401).json({ ok: false, error: verified.error });
    if (scope && !ticketHasScope(verified.ticket, scope)) return res.status(403).json({ ok: false, error: 'insufficient_scope' });
    req.worldTicket = verified.ticket;
    next();
  };
}

function requireService(req, res, next) {
  const supplied = req.headers['x-wisdo-service-secret'];
  if (serviceSecret.length < 32 || !safeEqual(serviceSecret, supplied)) return res.status(401).json({ ok: false, error: 'service_auth_required' });
  next();
}

function sseWrite(res, event, data, id = '') {
  if (res.writableEnded || res.destroyed) return false;
  if (id) res.write(`id: ${String(id).replace(/[\r\n]/g, '')}\n`);
  if (event) res.write(`event: ${String(event).replace(/[\r\n]/g, '')}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  return true;
}

function configuredOrigins() {
  const values = [
    process.env.PUBLIC_BASE_URL,
    process.env.WISDO_CLOUD_URL,
    ...(String(process.env.WISDO_WORLD_ALLOWED_ORIGINS || '').split(',')),
  ].map((value) => clean(value, 2048).replace(/\/$/, '')).filter(Boolean);
  const origins = new Set();
  for (const value of values) {
    try { origins.add(new URL(value).origin); } catch {}
  }
  return origins;
}

const allowedOrigins = configuredOrigins();

function allowCors(req, res, next) {
  const origin = clean(req.headers.origin, 2048);
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,Last-Event-ID');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') {
    if (origin && !allowedOrigins.has(origin)) return res.status(403).end();
    return res.status(204).end();
  }
  next();
}

function streamTopics(ticket) {
  return [...new Set([
    `instance.${ticket.instanceId}`,
    `account.${ticket.sub}`,
    `user.${ticket.sub}`,
  ])];
}

function rememberEvent(eventId) {
  const id = clean(eventId, 160);
  if (!id) return false;
  const now = Date.now();
  if (recentEventIds.has(id)) return true;
  recentEventIds.set(id, now);
  if (recentEventIds.size > 5000) {
    for (const [key, at] of recentEventIds) {
      if (now - at > 5 * 60 * 1000 || recentEventIds.size > 4000) recentEventIds.delete(key);
      if (recentEventIds.size <= 4000) break;
    }
  }
  return false;
}

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(allowCors);
app.use(express.json({ limit: '64kb', strict: true }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'wisdo-world-realtime', shuttingDown, streams: streams.size, pid: process.pid });
});

app.get('/ready', async (_req, res) => {
  const realtime = await fabric.health();
  const database = await outbox.health();
  const ok = Boolean(realtime.ok && database.ok && !shuttingDown && ticketSecret.length >= 32 && serviceSecret.length >= 32);
  res.status(ok ? 200 : 503).json({
    ok,
    service: 'wisdo-world-realtime',
    realtime,
    outbox: database,
    ticketConfigured: ticketSecret.length >= 32,
    serviceAuthConfigured: serviceSecret.length >= 32,
    corsOriginsConfigured: allowedOrigins.size,
    streams: streams.size,
  });
});

app.get('/v1/world/stream', requireTicket('world:events:read'), async (req, res) => {
  if (streams.size >= maxStreams) return res.status(503).json({ ok: false, error: 'world_stream_capacity' });
  const ticket = req.worldTicket;
  const topics = streamTopics(ticket);
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const stream = { userId: ticket.sub, instanceId: ticket.instanceId, openedAt: Date.now(), topics };
  streams.add(stream);
  const initialPresence = await fabric.listPresence(ticket.instanceId).catch(() => []);
  sseWrite(res, 'ready', {
    ok: true,
    userId: ticket.sub,
    worldId: ticket.worldId,
    instanceId: ticket.instanceId,
    serverTime: new Date().toISOString(),
    presence: initialPresence,
    execution: false,
  });

  const unsubscribers = [];
  try {
    for (const topic of topics) {
      const unsubscribe = await fabric.subscribe(topic, (event) => {
        if (res.writableEnded || res.destroyed) return;
        const eventId = event?.eventId || event?.id || '';
        // The same normalized financial event can intentionally be addressed to
        // both a private user topic and an instance topic. Deliver it once.
        if (eventId && rememberEvent(`${ticket.sub}:${eventId}`)) return;
        sseWrite(res, event.type || 'world.event', event, eventId);
      });
      unsubscribers.push(unsubscribe);
    }
  } catch {
    streams.delete(stream);
    for (const unsubscribe of unsubscribers) await unsubscribe().catch(() => undefined);
    sseWrite(res, 'error', { ok: false, error: 'subscription_failed' });
    return res.end();
  }

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(`: keepalive ${Date.now()}\n\n`);
  }, 15000);
  heartbeat.unref?.();

  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    clearInterval(heartbeat);
    streams.delete(stream);
    await Promise.allSettled(unsubscribers.map((unsubscribe) => unsubscribe()));
  };
  req.on('close', cleanup);
  req.on('aborted', cleanup);
});

app.post('/v1/world/presence', requireTicket('world:presence:write'), async (req, res, next) => {
  try {
    const ticket = req.worldTicket;
    const body = req.body || {};
    const presence = await fabric.setPresence({
      instanceId: ticket.instanceId,
      userId: ticket.sub,
      state: {
        worldId: ticket.worldId,
        scene: clean(ticket.metadata?.scene || body.scene, 80),
        displayName: clean(ticket.metadata?.displayName, 80) || 'Operator',
        title: clean(ticket.metadata?.title, 80) || 'Operator',
        position: vec3(body.position),
        rotation: {
          x: finite(body.rotation?.x, 0, -Math.PI * 4, Math.PI * 4),
          y: finite(body.rotation?.y, 0, -Math.PI * 4, Math.PI * 4),
          z: finite(body.rotation?.z, 0, -Math.PI * 4, Math.PI * 4),
        },
        velocity: vec3(body.velocity),
        locomotionState: clean(body.locomotionState || 'idle', 40),
        emote: clean(body.emote, 60) || null,
        speaking: Boolean(body.speaking),
      },
    });
    await fabric.publish({
      topic: `instance.${ticket.instanceId}`,
      type: 'presence.updated',
      partitionKey: ticket.instanceId,
      userId: ticket.sub,
      instanceId: ticket.instanceId,
      worldId: ticket.worldId,
      presence,
    });
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, presence, serverTime: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

app.delete('/v1/world/presence', requireTicket('world:presence:write'), async (req, res, next) => {
  try {
    const ticket = req.worldTicket;
    await fabric.removePresence(ticket.instanceId, ticket.sub);
    await fabric.publish({
      topic: `instance.${ticket.instanceId}`,
      type: 'presence.left',
      partitionKey: ticket.instanceId,
      userId: ticket.sub,
      instanceId: ticket.instanceId,
      worldId: ticket.worldId,
    });
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/v1/world/presence/:instanceId', requireTicket('world:presence:read'), async (req, res, next) => {
  try {
    const ticket = req.worldTicket;
    const requested = clean(req.params.instanceId, 160);
    if (requested !== ticket.instanceId && !ticketHasScope(ticket, 'world:presence:read:any')) {
      return res.status(403).json({ ok: false, error: 'instance_scope_mismatch' });
    }
    const presence = await fabric.listPresence(requested);
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, instanceId: requested, count: presence.length, presence, serverTime: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

app.post('/v1/world/events/internal', requireService, async (req, res, next) => {
  try {
    const body = req.body || {};
    const topic = clean(body.topic, 200);
    const type = clean(body.type || body.eventType, 160);
    if (!topic || !type) return res.status(400).json({ ok: false, error: 'topic_and_type_required' });
    const result = await outbox.enqueue({
      ...body,
      topic,
      type,
      source: clean(body.source || 'wisdo-core', 120),
      queuedAt: new Date().toISOString(),
    });
    res.status(result.inserted ? 202 : 200).json({ ok: true, eventId: result.eventId, duplicate: !result.inserted, durable: true });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error('WISDO World realtime request failed.', { message: error.message });
  if (!res.headersSent) res.status(500).json({ ok: false, error: 'world_realtime_error' });
});

const server = app.listen(port, async () => {
  try {
    await fabric.connect();
    await outbox.ensureSchema();
    console.log(`WISDO World realtime gateway listening on ${port}.`);
  } catch (error) {
    console.error('WISDO World realtime startup degraded.', { message: error.message });
    if (String(process.env.WISDO_WORLD_REQUIRE_REDIS || '').toLowerCase() === 'true') process.exitCode = 1;
  }
});

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`WISDO World realtime gateway shutting down (${signal}).`);
  for (const stream of streams) streams.delete(stream);
  await fabric.close().catch(() => undefined);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref?.();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
