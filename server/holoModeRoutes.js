import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSessionUser, safeReturnPath } from './security.js';

const PAGE = fileURLToPath(new URL('../public/holomode.html', import.meta.url));
const DOMAINS = new Set(['light', 'switch']);
const NO_CACHE = { 'Cache-Control': 'no-store' };

export function parseAllowedEntities(value = '') {
  return [...new Set(String(value).split(',').map((x) => x.trim().toLowerCase()).filter((id) =>
    /^(light|switch)\.[a-z0-9_]+$/.test(id)
  ))];
}

export function sanitizeHomeEntities(states = [], allowed = []) {
  const ids = new Set(allowed);
  if (!Array.isArray(states)) return [];
  return states.filter((entry) => ids.has(entry?.entity_id)).map((entry) => ({
    id: entry.entity_id,
    name: String(entry.attributes?.friendly_name || entry.entity_id).slice(0, 100),
    state: String(entry.state || 'unknown').slice(0, 40),
    lastUpdated: entry.last_updated || null,
    available: !['unknown', 'unavailable'].includes(entry.state),
  }));
}

export function validateHomeAction(body, allowed) {
  const id = String(body?.entityId || '').trim().toLowerCase();
  const action = String(body?.action || '').trim().toLowerCase();
  const domain = id.split('.')[0];
  if (!DOMAINS.has(domain) || !allowed.includes(id)) return { ok: false, error: 'Device is not approved for HoloMode control.' };
  if (!['turn_on', 'turn_off'].includes(action)) return { ok: false, error: 'Only turning approved lights and switches on or off is supported.' };
  if (body?.confirmed !== true) return { ok: false, error: 'A fresh confirmation is required.' };
  return { ok: true, id, action, domain };
}

export function isTrustedWriteOrigin({ origin, host, protocol, fetchSite, marker }) {
  if (marker !== 'confirmed' || !origin || !host || !['http', 'https'].includes(protocol)) return false;
  if (fetchSite && !['same-origin', 'none'].includes(fetchSite)) return false;
  try {
    return new URL(origin).origin === new URL(`${protocol}://${host}`).origin;
  } catch {
    return false;
  }
}

export function isHomeOwner(user, ownerId) {
  return Boolean(user?.id && ownerId && String(user.id) === String(ownerId));
}

function auth(req, res, next) {
  const user = getSessionUser(req);
  if (!user?.id) {
    if ((req.headers.accept || '').includes('text/html')) {
      const returnTo = safeReturnPath(req.originalUrl || '/app/holomode', '/app/holomode');
      return res.redirect('/login?returnTo=' + encodeURIComponent(returnTo));
    }
    return res.status(401).json({ ok: false, error: 'Sign in to WISDO to use HoloMode.' });
  }
  req.holoUser = user;
  next();
}

function config() {
  const baseUrl = String(process.env.WISDO_HOME_ASSISTANT_URL || '').replace(/\/$/, '');
  const token = String(process.env.WISDO_HOME_ASSISTANT_TOKEN || '');
  const allowed = parseAllowedEntities(process.env.WISDO_HOLO_ALLOWED_ENTITIES);
  const ownerId = String(process.env.WISDO_HOLO_OWNER_USER_ID || process.env.OWNER_USER_ID || '');
  let url = null;
  try {
    const candidate = new URL(baseUrl);
    if (['http:', 'https:'].includes(candidate.protocol) && !candidate.username && !candidate.password && candidate.pathname === '/') url = candidate.origin;
  } catch { /* Not configured */ }
  return { url, token, allowed, ownerId, configured: Boolean(url && token && ownerId && allowed.length) };
}

async function haRequest(settings, endpoint, options = {}) {
  const response = await fetch(settings.url + endpoint, {
    ...options,
    headers: { Authorization: 'Bearer ' + settings.token, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(6500),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('Home Assistant responded with HTTP ' + response.status);
  return response.json();
}

export function registerHoloModeRoutes(app) {
  app.get('/app/holomode', auth, (_req, res) => {
    res.set(NO_CACHE);
    res.sendFile(PAGE);
  });

  app.get('/api/holomode/bootstrap', auth, (req, res) => {
    const home = config();
    res.set(NO_CACHE).json({
      ok: true,
      user: { id: String(req.holoUser.id), name: String(req.holoUser.username || req.holoUser.global_name || 'WISDO Member') },
      capabilities: {
        tradingAccounts: '/api/v2/accounts',
        tradingWorkspace: '/app/accounts',
        tradingCommands: '/app/command-center',
        homeEnabled: home.configured && isHomeOwner(req.holoUser, home.ownerId),
        homeReadOnly: !home.configured || !isHomeOwner(req.holoUser, home.ownerId),
        character: 'webgl-procedural-v1',
        voice: 'browser-speech-optional',
      },
    });
  });

  app.get('/api/holomode/home/entities', auth, async (req, res) => {
    const home = config();
    res.set(NO_CACHE);
    if (!isHomeOwner(req.holoUser, home.ownerId)) return res.status(403).json({ ok: false, error: 'Home access is not assigned to this account.' });
    if (!home.configured) return res.json({ ok: true, configured: false, entities: [] });
    try {
      const states = await haRequest(home, '/api/states');
      return res.json({ ok: true, configured: true, entities: sanitizeHomeEntities(states, home.allowed) });
    } catch (error) {
      return res.status(502).json({ ok: false, error: 'Home Assistant is unreachable. Check the gateway connection.' });
    }
  });

  app.post('/api/holomode/home/action', auth, async (req, res) => {
    const home = config();
    res.set(NO_CACHE);
    if (!isHomeOwner(req.holoUser, home.ownerId)) return res.status(403).json({ ok: false, error: 'Home access is not assigned to this account.' });
    if (!home.configured) return res.status(503).json({ ok: false, error: 'Home Assistant is not configured.' });
    const allowedOrigin = isTrustedWriteOrigin({
      origin: req.get('origin'), host: req.get('host'), protocol: req.protocol,
      fetchSite: req.get('sec-fetch-site'), marker: req.get('x-wisdo-holomode'),
    });
    if (!allowedOrigin) return res.status(403).json({ ok: false, error: 'Same-origin confirmed request required.' });
    const intent = validateHomeAction(req.body, home.allowed);
    if (!intent.ok) return res.status(400).json({ ok: false, error: intent.error });
    try {
      await haRequest(home, '/api/services/' + intent.domain + '/' + intent.action, {
        method: 'POST', body: JSON.stringify({ entity_id: intent.id }),
      });
      return res.json({
        ok: true, status: 'submitted', verified: false,
        message: 'Home Assistant accepted the request. Refresh device status to verify the result.',
        entityId: intent.id, action: intent.action,
      });
    } catch {
      return res.status(502).json({ ok: false, error: 'Home Assistant did not confirm receipt of the request.' });
    }
  });
}
