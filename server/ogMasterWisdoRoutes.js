import { getSessionUser } from './security.js';
import { OgMasterWisdoProgressionService } from '../services/ogMasterWisdoProgressionService.js';

function bool(value) {
  return value === true || ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function currentUser(req) {
  const session = getSessionUser(req);
  if (session?.id) return session;
  if ((process.env.NODE_ENV === 'test' || bool(process.env.WISDO_ALLOW_TEST_IDENTITY)) && req.headers['x-wisdo-test-user']) {
    return { id: String(req.headers['x-wisdo-test-user']), username: 'Test Member', roles: ['admin'] };
  }
  return null;
}

function requireUser(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Authentication required.' });
  req.wisdoUser = user;
  next();
}

function sendError(res, error) {
  const status = Number(error?.statusCode) || 400;
  res.status(status).json({ ok: false, error: error?.message || 'OG MASTER request failed.' });
}

export function registerOgMasterWisdoRoutes(app, { pool, arcadeProgression = null, logger = console } = {}) {
  if (!app?.get || !app?.post) throw new TypeError('Express app is required.');
  const service = new OgMasterWisdoProgressionService({ pool, arcadeProgression, logger });

  app.get('/api/world/academy/master', requireUser, async (req, res) => {
    try {
      res.set('Cache-Control', 'private, no-store');
      res.json({ ok: true, master: await service.profile(req.wisdoUser.id), executionFromWorldEnabled: false });
    } catch (error) {
      logger?.warn?.('OG MASTER profile failed.', { message: error?.message });
      sendError(res, error);
    }
  });

  app.post('/api/world/academy/master/mission', requireUser, async (req, res) => {
    try {
      const missionId = String(req.body?.missionId || '').trim();
      const answers = Array.isArray(req.body?.answers) ? req.body.answers : null;
      if (!missionId || !answers) return res.status(400).json({ ok: false, error: 'missionId and answers are required.' });
      const result = await service.submitMission(req.wisdoUser.id, missionId, answers);
      res.set('Cache-Control', 'private, no-store');
      res.json({ ok: true, ...result, executionFromWorldEnabled: false });
    } catch (error) {
      logger?.warn?.('OG MASTER mission submission failed.', { message: error?.message });
      sendError(res, error);
    }
  });

  app.get('/health/world/academy-master', async (_req, res) => {
    try {
      res.json(await service.health());
    } catch (error) {
      res.status(503).json({ ok: false, service: 'og-master-wisdo-progression', error: error?.message || 'Health check failed.', liveMt4Execution: false });
    }
  });

  return service;
}
