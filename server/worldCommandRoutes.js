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
  conversationalVoice = null,
  logger = console,
} = {}) {
  if (!app?.get || !app?.post) throw new TypeError('Express app is required.');
  let service = null;
  try {
    service = new WorldCommandCenterService({ mt4SyncService, mt4CommandService, eventEngine, logger });
  } catch (error) {
    logger?.warn?.('WISDO World Command Center disabled.', { message: error.message });
  }

  const conversationService = conversationalVoice?.conversationService || null;
  const adaptiveFabricService = conversationalVoice?.adaptiveFabricService || null;
  const intentPool = adaptiveFabricService?.pool || null;

  app.post('/api/world/intent', requireWorldUser, async (req, res) => {
    try {
      if (!conversationService) return res.status(503).json({ ok:false, error:'WISDO Intent OS is unavailable.' });
      const text = String(req.body?.text || '').trim();
      if (!text) return res.status(400).json({ ok:false, error:'Tell WISDO what you want to happen.' });
      const result = await conversationService.answer({
        userId: String(req.worldUser.id),
        discordUserId: String(req.worldUser.id),
        channel: 'web',
        sessionId: req.body?.sessionId || null,
        accountId: req.body?.accountId || null,
        symbol: req.body?.symbol || null,
        campaignId: req.body?.campaignId || null,
        magicNumber: req.body?.magicNumber ?? null,
        selectedTicket: req.body?.selectedTicket || null,
        text,
      });
      res.status(result.state === 'queued' ? 202 : 200).json({ ok: result.ok !== false, ...result });
    } catch (error) {
      res.status(statusFor(error)).json({ ok:false, error:error.message, code:error.code || null });
    }
  });

  app.get('/api/world/intentions', requireWorldUser, async (req, res, next) => {
    try {
      if (!adaptiveFabricService || !intentPool) return res.status(503).json({ ok:false, error:'WISDO standing-intention fabric is unavailable.' });
      const rows = await adaptiveFabricService.listBehaviors(String(req.worldUser.id), { limit: 60 });
      const runtime = await intentPool.query(`SELECT behavior_id,account_id,state,open_tickets,deadline_at,last_checked_at,last_triggered_at,metadata,updated_at FROM wisdo_behavior_runtime_state WHERE owner_user_id=$1 ORDER BY updated_at DESC`,[String(req.worldUser.id)]);
      const byBehavior = new Map(runtime.rows.map((row)=>[String(row.behavior_id),row]));
      const intentions = rows.filter((row)=>row.status !== 'cancelled').map((row)=>({
        behaviorId: row.behavior_id,
        name: row.name,
        purpose: row.purpose,
        status: row.status,
        scope: row.scope,
        trigger: row.definition?.trigger || null,
        actions: row.definition?.actions || [],
        verification: row.definition?.verification || null,
        lastRuntime: byBehavior.get(String(row.behavior_id)) || null,
        updatedAt: row.updated_at,
      }));
      res.json({ ok:true, intentions });
    } catch (error) { next(error); }
  });

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
