import { getSessionUser } from './security.js';
import { WorldCommandCenterService } from '../services/worldCommandCenterService.js';

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
  if (!user) return res.status(401).json({ ok: false, error: 'Authentication required.' });
  req.worldUser = user;
  next();
}

function statusFor(error) {
  return Math.max(400, Math.min(599, Number(error?.statusCode || error?.status || 500)));
}

export function registerWorldCommandRoutes(app, {
  mt4SyncService = null,
  mt4CommandService = null,
  eventEngine = null,
  logger = console,
} = {}) {
  if (!app?.get || !app?.post) throw new TypeError('Express app is required.');
  let service = null;
  try {
    service = new WorldCommandCenterService({ mt4SyncService, mt4CommandService, eventEngine, logger });
  } catch (error) {
    logger?.warn?.('WISDO World Command Center disabled.', { message: error.message });
  }

  app.get('/api/world/command/state', requireWorldUser, async (req, res, next) => {
    try {
      if (!service) return res.status(503).json({ ok: false, error: 'World Command Center is unavailable.' });
      const state = await service.state(req.worldUser.id, { accountId: String(req.query?.accountId || '') });
      res.json({ ok: true, ...state });
    } catch (error) { next(error); }
  });

  app.post('/api/world/command/propose', requireWorldUser, async (req, res) => {
    try {
      if (!service) return res.status(503).json({ ok: false, error: 'World Command Center is unavailable.' });
      const proposal = await service.propose(req.worldUser.id, req.body || {});
      res.status(201).json({ ok: true, proposal });
    } catch (error) {
      res.status(statusFor(error)).json({ ok: false, error: error.message, code: error.code || null });
    }
  });

  app.post('/api/world/command/execute', requireWorldUser, async (req, res) => {
    try {
      if (!service) return res.status(503).json({ ok: false, error: 'World Command Center is unavailable.' });
      const receipt = await service.execute(req.worldUser.id, req.body || {});
      res.status(202).json({
        ok: true,
        receipt,
        executionNotice: 'Command was accepted by WISDO. Visual state must wait for Reporter/server acknowledgement and refreshed trading state.',
      });
    } catch (error) {
      res.status(statusFor(error)).json({ ok: false, error: error.message, code: error.code || null });
    }
  });

  app.get('/api/world/command/receipts', requireWorldUser, async (req, res, next) => {
    try {
      if (!service) return res.status(503).json({ ok: false, error: 'World Command Center is unavailable.' });
      const receipts = await service.receipts(req.worldUser.id, {
        accountId: String(req.query?.accountId || ''),
        limit: Number(req.query?.limit || 40),
      });
      res.json({ ok: true, receipts });
    } catch (error) { next(error); }
  });

  app.get('/api/world/command/receipts/:commandId', requireWorldUser, async (req, res, next) => {
    try {
      if (!service) return res.status(503).json({ ok: false, error: 'World Command Center is unavailable.' });
      const receipt = await service.receiptById(req.worldUser.id, req.params.commandId);
      if (!receipt) return res.status(404).json({ ok: false, error: 'Command receipt not found.' });
      res.json({ ok: true, receipt });
    } catch (error) { next(error); }
  });

  app.get('/health/world-command', async (_req, res) => {
    res.status(service ? 200 : 503).json({
      ok: Boolean(service),
      service: 'wisdo-world-command-center',
      executionAuthority: 'existing-mt4-command-service',
      directBrokerCredentialsInWorld: false,
      confirmationRequiredForDangerousCommands: true,
      worldCommandQueueEnabled: Boolean(service),
    });
  });

  return {
    service,
    api: '/api/world/command',
    executionAuthority: 'mt4-command-service',
  };
}
