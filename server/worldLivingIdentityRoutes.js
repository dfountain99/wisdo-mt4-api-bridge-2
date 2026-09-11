import path from 'node:path';

import { getSessionUser } from './security.js';
import { resolveWorldTier } from './worldRoutes.js';
import { createWisdoPhase1Repository, ensureWisdoPhase1State } from '../services/repositories/wisdoPhase1Repository.js';
import { WorldEventEngineService } from '../services/worldEventEngineService.js';
import { WorldAvatarIdentityService } from '../services/worldAvatarIdentityService.js';

function sessionUser(req) {
  const user = getSessionUser(req);
  if (user?.id) return user;
  if ((process.env.NODE_ENV === 'test' || String(process.env.WISDO_ALLOW_TEST_IDENTITY || '').toLowerCase() === 'true') && req.headers['x-wisdo-test-user']) {
    return { id: String(req.headers['x-wisdo-test-user']), username: 'Test Operator', roles: ['admin'] };
  }
  return null;
}

function requireWorldUser(req, res, next) {
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Authentication required.', loginUrl: `/login?returnTo=${encodeURIComponent(req.originalUrl || '/world/')}` });
  req.worldUser = user;
  next();
}

function publicBaseUrl(req, config = {}) {
  return String(process.env.PUBLIC_BASE_URL || config?.api?.publicBaseUrl || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

function bearerToken(req) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function statusFor(error) {
  return Number(error?.statusCode || error?.status || 500);
}

async function viewerContext(repository, user) {
  const state = ensureWisdoPhase1State(await repository.loadState());
  const tier = resolveWorldTier(user, state);
  return {
    userId: String(user.id),
    tierKey: tier.key,
    tierLevel: tier.level,
    isSubscriber: tier.level >= 1,
    roles: user.roles || user.discordRoles || [],
  };
}

function sseWrite(res, envelope) {
  res.write(`id: ${String(envelope.eventId || Date.now())}\n`);
  res.write(`event: ${String(envelope.type || 'world.event')}\n`);
  res.write(`data: ${JSON.stringify(envelope)}\n\n`);
  res.flush?.();
}

export function registerWorldLivingIdentityRoutes(app, {
  config = {},
  logger = console,
  mt4SyncService = null,
  publicRoot,
} = {}) {
  if (!app?.get || !app?.post) throw new TypeError('Express app is required.');
  const repository = createWisdoPhase1Repository(config);
  const eventEngine = new WorldEventEngineService({ repository, logger });
  const avatarIdentity = new WorldAvatarIdentityService({ repository, eventEngine, logger });
  const tradeSignalService = mt4SyncService?.tradeSignalService || null;
  eventEngine.start({ tradeSignalService }).catch((error) => logger?.error?.('WISDO World Event Engine failed to initialize.', { message: error.message }));

  const scanFile = path.join(publicRoot, 'app', 'world', 'avatar-scan.html');
  app.get('/world/avatar-scan', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Wisdo-Workspace', 'avatar-scan');
    res.sendFile(scanFile);
  });

  app.get('/api/world/signals/active', requireWorldUser, async (req, res, next) => {
    try {
      const viewer = await viewerContext(repository, req.worldUser);
      const payload = await eventEngine.activeForViewer(viewer, { limit: 100 });
      res.json({ ok: true, ...payload, automaticExecution: false, reviewWindowMeaning: 'informational_decision_review_window' });
    } catch (error) { next(error); }
  });

  app.get('/api/world/signals/archive', requireWorldUser, async (req, res, next) => {
    try {
      const viewer = await viewerContext(repository, req.worldUser);
      const limit = Math.max(1, Math.min(500, Number.parseInt(req.query?.limit, 10) || 100));
      const payload = await eventEngine.archiveForViewer(viewer, { limit });
      res.json({ ok: true, ...payload });
    } catch (error) { next(error); }
  });

  app.get('/api/world/signals/:eventId', requireWorldUser, async (req, res, next) => {
    try {
      const viewer = await viewerContext(repository, req.worldUser);
      const event = await eventEngine.getForViewer(req.params.eventId, viewer);
      if (!event) return res.status(404).json({ ok: false, error: 'Signal event not found or not authorized.' });
      res.json({ ok: true, serverTimestamp: eventEngine.serverNowIso(), event });
    } catch (error) { next(error); }
  });

  app.get('/api/world/events', requireWorldUser, async (req, res, next) => {
    try {
      const viewer = await viewerContext(repository, req.worldUser);
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
      sseWrite(res, {
        type: 'world.events.ready',
        eventId: `world-events-ready:${viewer.userId}:${Date.now()}`,
        serverTimestamp: eventEngine.serverNowIso(),
        detail: { connected: true, transport: 'sse', automaticExecution: false },
      });
      const unsubscribe = eventEngine.subscribe(viewer, (event) => sseWrite(res, event));
      const heartbeat = setInterval(() => {
        sseWrite(res, {
          type: 'world.events.heartbeat',
          eventId: `heartbeat:${Date.now()}`,
          serverTimestamp: eventEngine.serverNowIso(),
          detail: { connected: true },
        });
      }, 20_000);
      heartbeat.unref?.();
      req.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    } catch (error) { next(error); }
  });

  app.get('/api/world/avatar/me', requireWorldUser, async (req, res, next) => {
    try { res.json(await avatarIdentity.getOperator(req.worldUser)); }
    catch (error) { next(error); }
  });

  app.post('/api/world/avatar/scan-session', requireWorldUser, (req, res, next) => {
    try {
      const session = avatarIdentity.createScanSession(req.worldUser, publicBaseUrl(req, config));
      res.status(201).json(session);
    } catch (error) { next(error); }
  });

  app.get('/api/world/avatar/scan-session/:sessionId', requireWorldUser, (req, res) => {
    const session = avatarIdentity.getOwnedSession(req.worldUser, req.params.sessionId);
    if (!session) return res.status(404).json({ ok: false, error: 'Avatar scan session not found.' });
    res.json({ ok: true, session, serverTimestamp: eventEngine.serverNowIso() });
  });

  app.post('/api/world/avatar/scan-session/complete', (req, res) => {
    try {
      const token = bearerToken(req);
      if (!token) return res.status(401).json({ ok: false, error: 'One-time avatar scan token is required.' });
      const result = avatarIdentity.submitScanDraft(token, req.body || {});
      res.json(result);
    } catch (error) {
      logger?.warn?.('Avatar scan draft rejected.', { message: error.message });
      res.status(statusFor(error)).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/world/avatar/accept', requireWorldUser, async (req, res) => {
    try {
      const sessionId = String(req.body?.sessionId || '').trim();
      if (!sessionId) return res.status(400).json({ ok: false, error: 'sessionId is required.' });
      res.json(await avatarIdentity.acceptScanSession(req.worldUser, sessionId, req.body?.edits || null));
    } catch (error) {
      res.status(statusFor(error)).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/world/avatar/manual', requireWorldUser, async (req, res) => {
    try { res.json(await avatarIdentity.saveManualOperator(req.worldUser, req.body?.avatar || req.body || {})); }
    catch (error) { res.status(statusFor(error) === 500 ? 400 : statusFor(error)).json({ ok: false, error: error.message }); }
  });

  app.get('/health/world-living-systems', async (_req, res) => {
    try {
      await repository.loadState();
      res.json({
        ok: true,
        service: 'wisdo-world-living-systems',
        eventTransport: 'sse',
        signalReviewWindowSeconds: 120,
        avatarScanRawCaptureStored: false,
        tradeExecutionFromWorldEvents: false,
        faceRecognitionAuthentication: false,
      });
    } catch (error) {
      res.status(503).json({ ok: false, service: 'wisdo-world-living-systems', error: error.message });
    }
  });

  return {
    eventEngine,
    avatarIdentity,
    signalApi: '/api/world/signals',
    eventStream: '/api/world/events',
    avatarApi: '/api/world/avatar',
    executionFromWorldEventsEnabled: false,
  };
}
