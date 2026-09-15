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
import { registerArcadeRoutes } from './arcadeRoutes.js';
import { registerOgMasterWisdoRoutes } from './ogMasterWisdoRoutes.js';

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

  // Trading Arcade is an isolated simulation/education boundary. It does not
  // receive MT4 execution services and cannot place live orders.
  const arcade = registerArcadeRoutes(app, {
    pool: commandBusService.pool,
    logger,
  });

  // OG MASTER is an education/progression boundary. It consumes verified
  // Arcade progression for access gates but receives no MT4 execution service.
  const ogMasterWisdo = registerOgMasterWisdoRoutes(app, {
    pool: commandBusService.pool,
    arcadeProgression: arcade.progression,
    logger,
  });

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
        version: '3.12.0-og-master-playable',
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
          academy_master_api: '/api/world/academy/master',
          academy_master_health: '/health/world/academy-master',
          academy_master_execution: false,
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
        arcade: {
          build: 'ARCADE-ALPHA3',
          game_type: 'trading_simulation',
          api: '/api/arcade',
          progression_api: '/api/arcade/progression',
          season_leaderboard_api: '/api/arcade/season-leaderboard',
          health: '/health/arcade',
          catalog_games: arcade.catalog().length,
          playable_games: arcade.catalog().filter((game) => game.status === 'playable').length,
          wagering: false,
          live_mt4_execution: false,
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
    arcade,
    ogMasterWisdo,
    worldLivingSystems,
    worldMarkets,
    worldCommand,
  };
}
