import { registerCommandBusRoutes } from './commandBusRoutes.js';
import { registerAdaptiveFabricRoutes } from './adaptiveFabricRoutes.js';
import { registerAtlasRoutes } from './atlasRoutes.js';
import { registerVoiceRoutes } from './voiceRoutes.js';
import { registerVoiceCreatorRoutes } from './voiceCreatorRoutes.js';
import { registerUniversalControlRoutes } from './universalControlRoutes.js';
import { registerPhaseTwoEightRoutes } from './phaseTwoEightRoutes.js';
import { registerStaticWorkspaceRoutes } from './staticWorkspaceRoutes.js';
import { WisdoVoiceCreatorService } from '../services/wisdoVoiceCreatorService.js';
import { registerRoomStateRoutes } from './roomStateRoutes.js';

/**
 * Registers the modern Wisdo Kernel services as one cohesive boundary.
 * Legacy/member routes remain in apiServer.js while the Kernel can evolve
 * independently without adding another chain of imports and registrations.
 */
export function registerWisdoKernelRoutes(app, {
  config,
  logger,
  mt4CommandService,
  publicRoot,
} = {}) {
  const commandBusService = registerCommandBusRoutes(app, {
    config,
    logger,
    mt4CommandService,
  });

  registerAdaptiveFabricRoutes(app, {
    commandBusService,
    pool: commandBusService.pool,
    logger,
  });

  registerAtlasRoutes(app, {
    commandBusService,
    pool: commandBusService.pool,
    logger,
  });

  const voiceCreatorService = new WisdoVoiceCreatorService({
    pool: commandBusService.pool,
    logger,
  });

  const voiceService = registerVoiceRoutes(app, {
    commandBusService,
    voiceCreatorService,
    logger,
  });

  registerVoiceCreatorRoutes(app, {
    commandBusService,
    voiceCreatorService,
    voiceService,
    logger,
  });

  registerUniversalControlRoutes(app, {
    commandBusService,
    pool: commandBusService.pool,
    logger,
  });

  const roomStateService = registerRoomStateRoutes(app, { commandBusService, pool: commandBusService.pool, logger });

  registerPhaseTwoEightRoutes(app, {
    commandBusService,
    pool: commandBusService.pool,
    logger,
  });

  const workspaces = registerStaticWorkspaceRoutes(app, {
    publicRoot,
    logger,
  });

  app.get('/health/kernel', async (_req, res, next) => {
    try {
      const commandBus = await commandBusService.health();
      const requiredMissing = workspaces.missing.filter((item) => item.required);
      const ok = Boolean(commandBus?.ok) && requiredMissing.length === 0;
      res.status(ok ? 200 : 503).json({
        ok,
        service: 'wisdo-master-kernel',
        version: '3.3.0',
        command_bus: commandBus,
        workspaces: {
          registered: workspaces.registered.map(({ slug, route }) => ({ slug, route })),
          required_missing: requiredMissing.map(({ slug }) => slug),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  return {
    commandBusService,
    voiceCreatorService,
    voiceService,
    roomStateService,
    workspaces,
  };
}
