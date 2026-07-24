import { WisdoCommandBusService } from '../services/wisdoCommandBusService.js';

function bearer(req) {
  const value = String(req.headers.authorization || '');
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : '';
}

export function registerCommandBusRoutes(app, dependencies = {}) {
  const service = new WisdoCommandBusService(dependencies);
  async function auth(req, res, next) {
    try {
      const device = await service.authenticateDevice(req.headers['x-wisdo-device-id'], bearer(req));
      if (!device) return res.status(401).json({ ok: false, error: 'Invalid device credentials.' });
      req.wisdoDevice = device; next();
    } catch (error) { next(error); }
  }

  app.post('/api/device/v1/enroll', async (req, res, next) => {
    try { res.status(201).json({ ok: true, device: await service.enrollDevice(req.body || {}) }); }
    catch (error) { next(error); }
  });
  app.get('/api/device/v1/health', auth, async (req, res, next) => {
    try { res.json({ ...(await service.health()), device: req.wisdoDevice }); } catch (error) { next(error); }
  });
  app.get('/api/device/v1/bots', auth, async (req, res, next) => {
    try { res.json({ ok: true, bots: await service.listBots(req.wisdoDevice) }); } catch (error) { next(error); }
  });
  app.post('/api/device/v1/bots/register', auth, async (req, res, next) => {
    try { res.status(201).json({ ok: true, bot: await service.registerBot(req.wisdoDevice, req.body || {}) }); } catch (error) { next(error); }
  });
  app.post('/api/device/v1/commands', auth, async (req, res, next) => {
    try { res.status(202).json({ ok: true, command: await service.issueCommand(req.wisdoDevice, req.body || {}) }); } catch (error) { next(error); }
  });
  app.get('/api/device/v1/commands/:commandId', auth, async (req, res, next) => {
    try { const command = await service.getCommand(req.wisdoDevice, req.params.commandId); if (!command) return res.status(404).json({ ok:false,error:'Command not found.' }); res.json({ok:true,command}); } catch (error) { next(error); }
  });
  app.post('/api/agent/v1/commands/lease', auth, async (req, res, next) => {
    try { res.json({ ok:true, commands: await service.leaseCommands(req.wisdoDevice, req.body?.limit) }); } catch (error) { next(error); }
  });
  app.post('/api/agent/v1/commands/:commandId/complete', auth, async (req, res, next) => {
    try { res.json({ ok:true, command: await service.completeCommand(req.wisdoDevice, req.params.commandId, req.body || {}) }); } catch (error) { next(error); }
  });

  app.get('/api/device/v1/operations', auth, async (req, res, next) => {
    try {
      const [devices,bots,commands] = await Promise.all([
        service.pool.query(`SELECT device_id,device_name,device_type,status,last_seen_at,capabilities FROM wisdo_devices WHERE owner_user_id=$1 ORDER BY device_type,device_name`,[req.wisdoDevice.owner_user_id]),
        service.pool.query(`SELECT bot_id,bot_name,account_id,terminal_name,status,last_seen_at,capabilities FROM wisdo_bots WHERE owner_user_id=$1 ORDER BY bot_name`,[req.wisdoDevice.owner_user_id]),
        service.pool.query(`SELECT command_id,intent,target_type,target_id,status,result_message,created_at,completed_at FROM wisdo_commands WHERE owner_user_id=$1 ORDER BY created_at DESC LIMIT 100`,[req.wisdoDevice.owner_user_id])
      ]);
      res.json({ok:true,devices:devices.rows,bots:bots.rows,commands:commands.rows,health:await service.health()});
    } catch(error){ next(error); }
  });

  app.get('/health/command-bus', async (_req, res, next) => {
    try { res.json(await service.health()); } catch (error) { next(error); }
  });
  return service;
}
