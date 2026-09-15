import { compileWisdoCommand, toMt4Line, assertExecutionAllowed } from '../services/wisdoSmartControlService.js';

export function registerWisdoSmartControlRoutes(app, { commandBridge, demoOnly = process.env.DEMO_ONLY !== 'false' } = {}) {
  app.post('/api/wisdo/control/interpret', (req, res) => {
    try { res.json({ ok:true, plan:compileWisdoCommand(req.body?.text) }); }
    catch (error) { res.status(400).json({ ok:false, error:error.message }); }
  });
  app.post('/api/wisdo/control/execute', async (req, res) => {
    try {
      assertExecutionAllowed({ demoOnly, accountMode:req.body?.accountMode, confirmed:Boolean(req.body?.confirmed) });
      const plan = compileWisdoCommand(req.body?.text);
      const line = toMt4Line(plan);
      const receipt = await commandBridge.enqueue({ line, plan, actorId:req.user?.id, source:req.body?.source || 'web' });
      res.json({ ok:true, plan, receipt });
    } catch (error) { res.status(409).json({ ok:false, error:error.message }); }
  });
  app.post('/api/wisdo/presence/heartbeat', (req, res) => {
    // Presence can wake the assistant UI; it never grants trading authority.
    res.json({ ok:true, awake:Boolean(req.body?.optIn && req.body?.active), tradingActivated:false });
  });
  app.get('/api/wisdo/visual/contract', (_req, res) => res.json({
    ok:true, modes:['INSIGHT','GAMEPLAY'], palette:{ background:'#070707', gold:'#D4AF37', royalPurple:'#35155D', amber:'#FFBF00', silver:'#C0C0C0' },
    note:'Iceberg/heatmap values require a licensed order-book data feed; MT4 tick history alone is shown only as a proxy.'
  }));
}
