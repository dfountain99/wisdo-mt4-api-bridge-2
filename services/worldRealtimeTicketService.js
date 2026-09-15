import crypto from 'node:crypto';

const VERSION = 'v1';
const MAX_TOKEN_BYTES = 8192;
const DEFAULT_TTL_SECONDS = 120;
const MAX_TTL_SECONDS = 900;

function b64urlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function b64urlDecode(value) {
  return Buffer.from(String(value || ''), 'base64url').toString('utf8');
}

function clean(value, max = 160) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function requireSecret(secret) {
  const normalized = String(secret || '');
  if (normalized.length < 32) throw new Error('WISDO World realtime ticket secret must be at least 32 characters.');
  return normalized;
}

function sign(data, secret) {
  return crypto.createHmac('sha256', requireSecret(secret)).update(data).digest('base64url');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function normalizeScopes(scopes = []) {
  return [...new Set((Array.isArray(scopes) ? scopes : [scopes])
    .map((item) => clean(item, 80).toLowerCase())
    .filter(Boolean))]
    .slice(0, 32);
}

export function issueWorldRealtimeTicket({
  userId,
  worldId = 'wisdo.central',
  instanceId = 'central:default',
  scopes = ['world:presence:write', 'world:presence:read', 'world:events:read'],
  ttlSeconds = DEFAULT_TTL_SECONDS,
  metadata = {},
} = {}, secret = process.env.WISDO_WORLD_REALTIME_TICKET_SECRET) {
  const subject = clean(userId, 160);
  if (!subject) throw new Error('userId is required to issue a World realtime ticket.');
  const ttl = Math.min(MAX_TTL_SECONDS, Math.max(30, Number(ttlSeconds || DEFAULT_TTL_SECONDS)));
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    sub: subject,
    worldId: clean(worldId, 120) || 'wisdo.central',
    instanceId: clean(instanceId, 160) || 'central:default',
    scopes: normalizeScopes(scopes),
    iat: now,
    exp: now + ttl,
    jti: crypto.randomUUID(),
    metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {},
  };
  const encoded = b64urlEncode(JSON.stringify(payload));
  const signed = `${VERSION}.${encoded}`;
  return `${signed}.${sign(signed, secret)}`;
}

export function verifyWorldRealtimeTicket(token, secret = process.env.WISDO_WORLD_REALTIME_TICKET_SECRET, { nowMs = Date.now() } = {}) {
  const raw = String(token || '');
  if (!raw || Buffer.byteLength(raw) > MAX_TOKEN_BYTES) return { ok: false, error: 'invalid_ticket' };
  const parts = raw.split('.');
  if (parts.length !== 3 || parts[0] !== VERSION) return { ok: false, error: 'invalid_ticket' };
  const signed = `${parts[0]}.${parts[1]}`;
  let expected;
  try {
    expected = sign(signed, secret);
  } catch {
    return { ok: false, error: 'ticket_service_unconfigured' };
  }
  if (!safeEqual(expected, parts[2])) return { ok: false, error: 'invalid_ticket' };
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(parts[1]));
  } catch {
    return { ok: false, error: 'invalid_ticket' };
  }
  const now = Math.floor(Number(nowMs || Date.now()) / 1000);
  if (!payload?.sub || !payload?.instanceId || !Number.isFinite(Number(payload?.exp))) return { ok: false, error: 'invalid_ticket' };
  if (Number(payload.exp) <= now) return { ok: false, error: 'expired_ticket' };
  if (Number(payload.iat || 0) > now + 30) return { ok: false, error: 'invalid_ticket_time' };
  return {
    ok: true,
    ticket: {
      ...payload,
      sub: clean(payload.sub, 160),
      worldId: clean(payload.worldId, 120),
      instanceId: clean(payload.instanceId, 160),
      scopes: normalizeScopes(payload.scopes),
    },
  };
}

export function ticketHasScope(ticket, scope) {
  const wanted = clean(scope, 80).toLowerCase();
  const scopes = new Set(normalizeScopes(ticket?.scopes));
  return scopes.has(wanted) || scopes.has('world:*') || scopes.has('*');
}
