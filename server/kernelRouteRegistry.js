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
import { registerVoiceBotAuthorityRoutes } from './voiceBotAuthorityRoutes.js';
import { registerConversationalVoiceRoutes } from './conversationalVoiceRoutes.js';
import { registerWisdoWorldRoutes } from './worldRoutes.js';
import { registerWorldLivingIdentityRoutes } from './worldLivingIdentityRoutes.js';
import { registerWorldMarketRoutes } from './worldMarketRoutes.js';
import { registerWorldCommandRoutes } from './worldCommandRoutes.js';
import { registerWorldRealtimeRoutes } from './worldRealtimeRoutes.js';
import { registerWorldBuildRoutes } from './worldBuildRoutes.js';

/**
 * Registers the modern Wisdo Kernel services as one cohesive boundary.
 * Legacy/member routes remain in apiServer.js while the Kernel can evolve
 * independently without adding another chain of imports and registrations.
 */
export function registerWisdoKernelRoutes(app, {
  config,
  logger,
  mt4CommandService,
  mt4SyncService,
  copyTradingService,
  commandRegistryAudit,
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

  const conversationalVoice = registerConversationalVoiceRoutes(app, {
    commandBusService,
    voiceService,
    mt4CommandService,
    mt4SyncService,
    copyTradingService,
    commandRegistryAudit,
    logger,
  });

  registerVoiceCreatorRoutes(app, {
    commandBusService,
    voiceCreatorService,
    voiceService,
    conversationalVoice,
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

  const voiceBotAuthorityService = registerVoiceBotAuthorityRoutes(app, {
    commandBusService,
    pool: commandBusService.pool,
    logger,
  });

  const workspaces = registerStaticWorkspaceRoutes(app, {
    publicRoot,
    logger,
  });

  const world = registerWisdoWorldRoutes(app, {
    config,
    logger,
    mt4SyncService,
    publicRoot,
  });

  const worldBuild = registerWorldBuildRoutes(app);

  // Multiplayer is intentionally registered as a separate World-only boundary.
  // It owns ephemeral presence/movement only and never receives MT4 execution services.
  registerWorldRealtimeRoutes(app, { logger });

  const worldLivingSystems = registerWorldLivingIdentityRoutes(app, {
    config,
    logger,
    mt4SyncService,
    publicRoot,
  });

  const worldMarkets = registerWorldMarketRoutes(app, {
    config,
    logger,
    mt4SyncService,
    eventEngine: worldLivingSystems.eventEngine,
  });

  const worldCommand = registerWorldCommandRoutes(app, {
    logger,
    mt4SyncService,
    mt4CommandService,
    eventEngine: worldLivingSystems.eventEngine,
  });

  app.get('/health/kernel', async (_req, res, next) => {
    try {
      const commandBus = await commandBusService.health();
      const requiredMissing = workspaces.missing.filter((item) => item.required);
      const ok = Boolean(commandBus?.ok) && requiredMissing.length === 0;
      res.status(ok ? 200 : 503).json({
        ok,
        service: 'wisdo-master-kernel',
        version: '3.8.0',
        command_bus: commandBus,
        workspaces: {
          registered: workspaces.registered.map(({ slug, route }) => ({ slug, route })),
          required_missing: requiredMissing.map(({ slug }) => slug),
        },
        world: {
          route: world.route,
          api: world.api,
          build_api: worldBuild.api,
          build: worldBuild.build,
          realtime_api: '/api/world/realtime',
          realtime_instance: 'central',
          execution_from_world_enabled: world.executionFromWorldEnabled,
          event_stream: worldLivingSystems.eventStream,
          signal_api: worldLivingSystems.signalApi,
          avatar_api: worldLivingSystems.avatarApi,
          market_api: worldMarkets.marketApi,
          command_api: worldCommand.api,
          command_authority: worldCommand.executionAuthority,
          execution_from_world_events_enabled: worldLivingSystems.executionFromWorldEventsEnabled,
          execution_from_world_markets_enabled: worldMarkets.executionFromWorldEnabled,
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
    conversationalVoice,
    roomStateService,
    voiceBotAuthorityService,
    workspaces,
    world,
    worldBuild,
    worldLivingSystems,
    worldMarkets,
    worldCommand,
  };
}
