import { getSessionUser } from './security.js';
import { resolveWorldTier } from './worldRoutes.js';
import { createWisdoPhase1Repository, ensureWisdoPhase1State } from '../services/repositories/wisdoPhase1Repository.js';
import { HistoricalMarketDataService } from '../services/historicalMarketDataService.js';
import { WorldMarketStateService, normalizeWorldTradeVisibility, WORLD_TRADE_VISIBILITY } from '../services/worldMarketStateService.js';

const clean = (value, max = 120) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const ALLOWED_INTERVALS = new Set(['1', '5', '15', '30', '60', '240', 'D']);

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

function statusForMarketData(error) {
  if (error?.provider === 'unconfigured') return 503;
  if (error?.provider) return 502;
  return Number(error?.statusCode || error?.status || 500);
}

export function registerWorldMarketRoutes(app, {
  config = {},
  logger = console,
  mt4SyncService = null,
  eventEngine = null,
} = {}) {
  if (!app?.get || !app?.post) throw new TypeError('Express app is required.');
  const worldRepository = createWisdoPhase1Repository(config);
  const mt4Repository = mt4SyncService?.repository || null;
  const historicalMarketData = new HistoricalMarketDataService(config, { logger });
  const marketState = mt4Repository
    ? new WorldMarketStateService({ worldRepository, mt4Repository, eventEngine, logger })
    : null;

  if (marketState) {
    marketState.start().catch((error) => logger?.error?.('WISDO World Market State failed to initialize.', { message: error.message }));
  } else {
    logger?.warn?.('WISDO World Market State is unavailable because the MT4 repository is missing.');
  }

  app.get('/api/world/markets/active', requireWorldUser, async (req, res, next) => {
    try {
      if (!marketState) return res.status(503).json({ ok: false, error: 'World market state is unavailable.' });
      await marketState.refresh({ broadcast: false });
      const viewer = await viewerContext(worldRepository, req.worldUser);
      res.json({ ok: true, ...marketState.snapshotForViewer(viewer) });
    } catch (error) { next(error); }
  });

  app.get('/api/world/markets/:symbol', requireWorldUser, async (req, res, next) => {
    try {
      if (!marketState) return res.status(503).json({ ok: false, error: 'World market state is unavailable.' });
      await marketState.refresh({ broadcast: false });
      const viewer = await viewerContext(worldRepository, req.worldUser);
      const market = marketState.getMarketForViewer(req.params.symbol, viewer);
      if (!market) return res.status(404).json({ ok: false, error: 'No authorized active WISDO market billboard exists for that symbol.' });
      res.json({ ok: true, serverTimestamp: new Date().toISOString(), market });
    } catch (error) { next(error); }
  });

  app.get('/api/world/markets/:symbol/candles', requireWorldUser, async (req, res) => {
    try {
      if (!marketState) return res.status(503).json({ ok: false, error: 'World market state is unavailable.' });
      await marketState.refresh({ broadcast: false });
      const viewer = await viewerContext(worldRepository, req.worldUser);
      const market = marketState.getMarketForViewer(req.params.symbol, viewer);
      if (!market) return res.status(404).json({ ok: false, error: 'No authorized active WISDO market billboard exists for that symbol.' });
      const interval = ALLOWED_INTERVALS.has(String(req.query?.interval || '5').toUpperCase()) ? String(req.query?.interval || '5').toUpperCase() : '5';
      const outputSize = Math.max(64, Math.min(240, Number.parseInt(req.query?.outputSize, 10) || 120));
      const chart = await historicalMarketData.getCandles({ symbol: market.symbol, interval, outputSize });
      res.json({
        ok: true,
        symbol: market.symbol,
        interval,
        provider: chart.provider,
        sourceName: chart.sourceName,
        providerSymbol: chart.providerSymbol,
        fetchedAt: chart.fetchedAt,
        candles: chart.candles,
        currentPrice: market.currentPrice,
        fakeData: false,
      });
    } catch (error) {
      res.status(statusForMarketData(error)).json({
        ok: false,
        error: error.message,
        provider: error?.provider || null,
        fakeData: false,
        fallback: 'Billboard remains available with verified participant/current-price data only.',
      });
    }
  });

  app.post('/api/world/markets/visibility', requireWorldUser, async (req, res, next) => {
    try {
      const visibility = normalizeWorldTradeVisibility(req.body?.visibility, '');
      if (!visibility) {
        return res.status(400).json({ ok: false, error: `visibility must be one of ${Object.values(WORLD_TRADE_VISIBILITY).join(', ')}` });
      }
      const audienceUserIds = Array.isArray(req.body?.audienceUserIds)
        ? [...new Set(req.body.audienceUserIds.map((item) => clean(item, 100)).filter(Boolean))].slice(0, 250)
        : [];
      let saved;
      await worldRepository.updateState((raw) => {
        const state = ensureWisdoPhase1State(raw);
        state.worldProfilesByUserId ||= {};
        const userId = String(req.worldUser.id);
        const profile = state.worldProfilesByUserId[userId] || {
          schemaVersion: 1,
          userId,
          callsign: clean(req.worldUser.username || req.worldUser.global_name || 'Operator', 48) || 'Operator',
          title: 'World Explorer',
          avatarStyle: 'vanguard',
          xp: 0,
          visitedDestinations: [],
          achievements: [],
          spawnPreference: 'home',
          createdAt: new Date().toISOString(),
        };
        profile.worldTradeVisibility = visibility;
        profile.worldTradeAudienceUserIds = visibility === WORLD_TRADE_VISIBILITY.TEAM ? audienceUserIds : [];
        profile.updatedAt = new Date().toISOString();
        state.worldProfilesByUserId[userId] = profile;
        saved = {
          visibility: profile.worldTradeVisibility,
          audienceUserIds: profile.worldTradeAudienceUserIds,
          privacyNotice: 'Public World market projection never includes account number, balance, equity, broker credentials, exact lot size, or monetary P/L.',
        };
        return state;
      });
      await marketState?.refresh();
      res.json({ ok: true, ...saved });
    } catch (error) { next(error); }
  });

  app.get('/health/world-markets', async (_req, res) => {
    try {
      if (!marketState) return res.status(503).json({ ok: false, service: 'wisdo-world-markets', reason: 'mt4_repository_unavailable' });
      await marketState.refresh({ broadcast: false });
      res.json({
        ok: true,
        service: 'wisdo-world-markets',
        stateSource: 'persisted-authorized-mt4-reporter-snapshots',
        fakeCandlesAllowed: false,
        executionFromWorldEnabled: false,
        visibilityScopes: Object.values(WORLD_TRADE_VISIBILITY),
        chartProviderConfigured: historicalMarketData.isConfigured('XAUUSD', '5'),
      });
    } catch (error) {
      res.status(503).json({ ok: false, service: 'wisdo-world-markets', error: error.message });
    }
  });

  return {
    marketState,
    marketApi: '/api/world/markets',
    executionFromWorldEnabled: false,
  };
}
