const TRADE_VISIBILITY = Object.freeze({
  PRIVATE: 'PRIVATE',
  FRIENDS: 'FRIENDS',
  TEAM: 'TEAM',
  MEMBERS: 'MEMBERS',
  PUBLIC: 'PUBLIC',
});

const VISIBILITY_SET = new Set(Object.values(TRADE_VISIBILITY));
const clean = (value, max = 120) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const finite = (value, fallback = null) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const nowIso = () => new Date().toISOString();

export function normalizeWorldTradeVisibility(value, fallback = TRADE_VISIBILITY.PRIVATE) {
  const normalized = clean(value || fallback, 24).toUpperCase();
  return VISIBILITY_SET.has(normalized) ? normalized : fallback;
}

function freshestSnapshotRecord(state, accountId) {
  return state?.latestSnapshotsByAccountId?.[accountId] || null;
}

function ownerProfile(worldState, userId) {
  const profile = worldState?.worldProfilesByUserId?.[String(userId)] || {};
  return {
    callsign: clean(profile.callsign || `Operator ${String(userId || '').slice(-4) || 'WISDO'}`, 48),
    avatarStyle: clean(profile.avatarStyle || 'vanguard', 32),
    operatorIdentity: profile.operatorIdentity && typeof profile.operatorIdentity === 'object'
      ? {
          avatarVersion: finite(profile.operatorIdentity.avatarVersion, 1),
          headPreset: clean(profile.operatorIdentity.headPreset || '', 48),
          hairPreset: clean(profile.operatorIdentity.hairPreset || '', 48),
          facialHairPreset: clean(profile.operatorIdentity.facialHairPreset || '', 48),
          bodyPreset: clean(profile.operatorIdentity.bodyPreset || '', 48),
          outfit: clean(profile.operatorIdentity.outfit || '', 48),
        }
      : null,
    visibility: normalizeWorldTradeVisibility(profile.worldTradeVisibility),
    audienceUserIds: Array.isArray(profile.worldTradeAudienceUserIds)
      ? [...new Set(profile.worldTradeAudienceUserIds.map((item) => clean(item, 100)).filter(Boolean))].slice(0, 250)
      : [],
  };
}

function metadataCandidates(snapshot = {}, trade = {}, symbol = '') {
  const symbolUpper = clean(symbol, 32).toUpperCase();
  const collections = [
    snapshot.instrumentMetadata,
    snapshot.symbolMetadata,
    snapshot.marketInfo,
    snapshot.symbolInfo,
    snapshot.instruments,
  ];
  const rows = [{ ...trade }];
  for (const collection of collections) {
    if (!collection) continue;
    if (Array.isArray(collection)) {
      const match = collection.find((item) => clean(item?.symbol || item?.name, 32).toUpperCase() === symbolUpper);
      if (match) rows.push(match);
    } else if (typeof collection === 'object') {
      const direct = collection[symbolUpper] || collection[symbol] || (clean(collection.symbol || collection.name, 32).toUpperCase() === symbolUpper ? collection : null);
      if (direct) rows.push(direct);
    }
  }
  return rows;
}

export function resolveInstrumentMetadata(snapshot = {}, trade = {}, symbol = '') {
  const rows = metadataCandidates(snapshot, trade, symbol);
  let digits = null;
  let pointSize = null;
  let pipSize = null;
  let tickSize = null;
  for (const row of rows) {
    digits ??= finite(row?.digits, null);
    pointSize ??= finite(row?.pointSize ?? row?.point ?? row?.point_size, null);
    pipSize ??= finite(row?.pipSize ?? row?.pip ?? row?.pip_size, null);
    tickSize ??= finite(row?.tickSize ?? row?.tick_size, null);
  }
  if (pipSize && pipSize > 0) {
    return { symbol: clean(symbol, 32).toUpperCase(), digits, pointSize, pipSize, tickSize, displayUnit: 'PIPS', divisor: pipSize, source: 'reporter_metadata' };
  }
  if (pointSize && pointSize > 0 && Number.isFinite(digits)) {
    const normalizedPip = (digits === 3 || digits === 5) ? pointSize * 10 : pointSize;
    return { symbol: clean(symbol, 32).toUpperCase(), digits, pointSize, pipSize: normalizedPip, tickSize, displayUnit: 'PIPS', divisor: normalizedPip, source: 'reporter_digits_point' };
  }
  if (tickSize && tickSize > 0) {
    return { symbol: clean(symbol, 32).toUpperCase(), digits, pointSize, pipSize: null, tickSize, displayUnit: 'POINTS', divisor: tickSize, source: 'reporter_tick_size' };
  }
  if (pointSize && pointSize > 0) {
    return { symbol: clean(symbol, 32).toUpperCase(), digits, pointSize, pipSize: null, tickSize, displayUnit: 'POINTS', divisor: pointSize, source: 'reporter_point_size' };
  }
  return { symbol: clean(symbol, 32).toUpperCase(), digits, pointSize, pipSize, tickSize, displayUnit: 'PRICE Δ', divisor: null, source: 'unit_unverified' };
}

export function movementForTrade(trade = {}, metadata = {}) {
  const direction = clean(trade.type || trade.direction, 12).toUpperCase();
  const entry = finite(trade.openPrice ?? trade.entryPrice, null);
  const current = finite(trade.currentPrice, null);
  if (!['BUY', 'SELL'].includes(direction) || entry == null || current == null) return null;
  const raw = direction === 'BUY' ? current - entry : entry - current;
  const divisor = finite(metadata.divisor, null);
  return {
    raw,
    value: divisor && divisor > 0 ? raw / divisor : raw,
    unit: metadata.displayUnit || 'PRICE Δ',
  };
}

function tradeCampaignKey(trade = {}) {
  const explicit = clean(trade.campaignId || trade.basketId, 100);
  if (explicit) return explicit;
  return [clean(trade.magicNumber ?? '', 30), clean(trade.comment || trade.strategy, 60)].join(':');
}

function visibilityAllows(profile, ownerUserId, viewer = {}) {
  const viewerId = clean(viewer.userId || viewer.id, 100);
  if (viewerId && viewerId === String(ownerUserId)) return true;
  switch (profile.visibility) {
    case TRADE_VISIBILITY.PUBLIC:
    case TRADE_VISIBILITY.MEMBERS:
      return Boolean(viewerId);
    case TRADE_VISIBILITY.TEAM:
      return Boolean(viewerId && profile.audienceUserIds.includes(viewerId));
    // FRIENDS intentionally fails closed until the relationship graph is explicitly wired.
    case TRADE_VISIBILITY.FRIENDS:
    case TRADE_VISIBILITY.PRIVATE:
    default:
      return false;
  }
}

function aggregateOwnerTrades(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const key = [row.ownerUserId, row.symbol, row.direction, row.campaignId].join('|');
    const current = groups.get(key) || {
      ownerUserId: row.ownerUserId,
      operatorAlias: row.operatorAlias,
      avatarStyle: row.avatarStyle,
      operatorIdentity: row.operatorIdentity,
      symbol: row.symbol,
      direction: row.direction,
      campaignId: row.campaignId,
      openedAt: row.openedAt,
      currentPrice: row.currentPrice,
      visibility: row.visibility,
      audienceUserIds: row.audienceUserIds,
      metadata: row.metadata,
      positionCount: 0,
      weightedEntrySum: 0,
      weightSum: 0,
      tickets: [],
      latestSyncAt: row.latestSyncAt,
      stale: row.stale,
    };
    const weight = Math.max(0.000001, finite(row.lots, 0) || 1);
    current.positionCount += 1;
    current.weightedEntrySum += finite(row.entryPrice, 0) * weight;
    current.weightSum += weight;
    current.currentPrice = row.currentPrice ?? current.currentPrice;
    current.openedAt = !current.openedAt || (row.openedAt && Date.parse(row.openedAt) < Date.parse(current.openedAt)) ? row.openedAt : current.openedAt;
    current.latestSyncAt = !current.latestSyncAt || Date.parse(row.latestSyncAt || 0) > Date.parse(current.latestSyncAt || 0) ? row.latestSyncAt : current.latestSyncAt;
    current.stale = current.stale && row.stale;
    if (row.ticket != null) current.tickets.push(String(row.ticket));
    groups.set(key, current);
  }
  return [...groups.values()].map((row) => {
    const avgEntry = row.weightSum > 0 ? row.weightedEntrySum / row.weightSum : null;
    const movement = movementForTrade({ direction: row.direction, entryPrice: avgEntry, currentPrice: row.currentPrice }, row.metadata);
    return {
      ...row,
      avgEntry,
      movement,
      weightSum: undefined,
      weightedEntrySum: undefined,
    };
  });
}

function publicParticipant(row, serverNowMs) {
  const openedMs = Date.parse(row.openedAt || '');
  return {
    participantId: `${row.ownerUserId}:${row.symbol}:${row.direction}:${row.campaignId}`,
    operatorAlias: row.operatorAlias,
    avatarStyle: row.avatarStyle,
    operatorIdentity: row.operatorIdentity,
    symbol: row.symbol,
    direction: row.direction,
    positionCount: row.positionCount,
    avgEntry: row.avgEntry,
    currentPrice: row.currentPrice,
    movement: row.movement ? { value: row.movement.value, unit: row.movement.unit } : null,
    openedAt: row.openedAt,
    ageSeconds: Number.isFinite(openedMs) ? Math.max(0, Math.floor((serverNowMs - openedMs) / 1000)) : null,
    dataState: row.stale ? 'STALE' : 'LIVE',
  };
}

function stableHash(markets = []) {
  return JSON.stringify(markets.map((market) => [
    market.symbol,
    market.participants.map((p) => [p.participantId, p.direction, p.positionCount, p.currentPrice, p.movement?.value, p.dataState]),
  ]));
}

export class WorldMarketStateService {
  constructor({ worldRepository, mt4Repository, eventEngine = null, logger = console, refreshMs = 4000, maxSnapshotAgeMs = 300000 } = {}) {
    if (!worldRepository?.loadState) throw new TypeError('WorldMarketStateService requires the WISDO World repository.');
    if (!mt4Repository?.getMt4State) throw new TypeError('WorldMarketStateService requires the MT4 repository.');
    this.worldRepository = worldRepository;
    this.mt4Repository = mt4Repository;
    this.eventEngine = eventEngine;
    this.logger = logger;
    this.refreshMs = Math.max(1500, Math.min(30000, Number(refreshMs) || 4000));
    this.maxSnapshotAgeMs = Math.max(90000, Math.min(30 * 60_000, Number(maxSnapshotAgeMs) || 300000));
    this.rawParticipants = [];
    this.updatedAt = null;
    this.timer = null;
    this.refreshPromise = null;
    this.lastProjectedHashByViewerKey = new Map();
  }

  async start() {
    await this.refresh({ broadcast: false });
    if (!this.timer) {
      this.timer = setInterval(() => this.refresh().catch((error) => this.logger?.warn?.('World market refresh failed.', { message: error.message })), this.refreshMs);
      this.timer.unref?.();
    }
    return this;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.lastProjectedHashByViewerKey.clear();
  }

  async refresh({ broadcast = true } = {}) {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.#refresh({ broadcast }).finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }

  async #refresh({ broadcast }) {
    const [mt4State, worldState] = await Promise.all([this.mt4Repository.getMt4State(), this.worldRepository.loadState()]);
    const serverNow = Date.now();
    const rows = [];
    for (const [accountId, connection] of Object.entries(mt4State.connectionsByAccountId || {})) {
      const ownerUserId = String(connection?.discordUserId || '');
      if (!ownerUserId) continue;
      const record = freshestSnapshotRecord(mt4State, accountId);
      const snapshot = record?.snapshot || {};
      const receivedAt = record?.receivedAt || connection?.lastSyncAt || '';
      const receivedMs = Date.parse(receivedAt || '');
      if (!Number.isFinite(receivedMs) || serverNow - receivedMs > this.maxSnapshotAgeMs) continue;
      const stale = serverNow - receivedMs > 90000;
      const profile = ownerProfile(worldState, ownerUserId);
      for (const trade of Array.isArray(snapshot.openTrades) ? snapshot.openTrades : []) {
        const symbol = clean(trade?.symbol, 32).toUpperCase();
        const direction = clean(trade?.type || trade?.direction, 12).toUpperCase();
        const entryPrice = finite(trade?.openPrice ?? trade?.entryPrice, null);
        const currentPrice = finite(trade?.currentPrice, null);
        if (!symbol || !['BUY', 'SELL'].includes(direction) || entryPrice == null || currentPrice == null) continue;
        rows.push({
          ownerUserId,
          operatorAlias: profile.callsign,
          avatarStyle: profile.avatarStyle,
          operatorIdentity: profile.operatorIdentity,
          visibility: profile.visibility,
          audienceUserIds: profile.audienceUserIds,
          accountId,
          ticket: trade.ticket,
          symbol,
          direction,
          entryPrice,
          currentPrice,
          lots: finite(trade.lots, 0),
          openedAt: trade.openTime || null,
          campaignId: tradeCampaignKey(trade),
          metadata: resolveInstrumentMetadata(snapshot, trade, symbol),
          latestSyncAt: receivedAt,
          stale,
        });
      }
    }
    this.rawParticipants = aggregateOwnerTrades(rows);
    this.updatedAt = nowIso();
    if (broadcast && this.eventEngine?.publish) {
      this.eventEngine.publish('world.market.updated', null, {
        eventId: `world-market:${this.updatedAt}`,
        projector: (viewer) => this.snapshotForViewer(viewer),
      });
    }
    return { participantGroups: this.rawParticipants.length, updatedAt: this.updatedAt };
  }

  snapshotForViewer(viewer = {}) {
    const serverNowMs = Date.now();
    const visible = this.rawParticipants.filter((row) => visibilityAllows({ visibility: row.visibility, audienceUserIds: row.audienceUserIds }, row.ownerUserId, viewer));
    const bySymbol = new Map();
    for (const row of visible) {
      const participant = publicParticipant(row, serverNowMs);
      const market = bySymbol.get(row.symbol) || { symbol: row.symbol, participants: [], currentPrice: row.currentPrice, latestSyncAt: row.latestSyncAt, metadata: row.metadata };
      market.participants.push(participant);
      if (Date.parse(row.latestSyncAt || 0) >= Date.parse(market.latestSyncAt || 0)) {
        market.currentPrice = row.currentPrice;
        market.latestSyncAt = row.latestSyncAt;
        market.metadata = row.metadata;
      }
      bySymbol.set(row.symbol, market);
    }
    const markets = [...bySymbol.values()]
      .map((market) => {
        market.participants.sort((a, b) => String(a.operatorAlias).localeCompare(String(b.operatorAlias)) || String(a.participantId).localeCompare(String(b.participantId)));
        const buyParticipants = market.participants.filter((row) => row.direction === 'BUY').length;
        const sellParticipants = market.participants.filter((row) => row.direction === 'SELL').length;
        return {
          billboardId: `market-${market.symbol.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          status: 'ACTIVE',
          symbol: market.symbol,
          activeOperatorCount: new Set(market.participants.map((row) => row.participantId.split(':')[0])).size,
          activePositionGroups: market.participants.length,
          buyParticipants,
          sellParticipants,
          currentPrice: market.currentPrice,
          marketUnit: market.metadata?.displayUnit || 'PRICE Δ',
          instrumentMetadata: {
            digits: market.metadata?.digits ?? null,
            pointSize: market.metadata?.pointSize ?? null,
            pipSize: market.metadata?.pipSize ?? null,
            tickSize: market.metadata?.tickSize ?? null,
            displayUnit: market.metadata?.displayUnit || 'PRICE Δ',
            source: market.metadata?.source || 'unit_unverified',
          },
          participants: market.participants,
          latestSyncAt: market.latestSyncAt,
          audienceLabel: 'WISDO WORLD PARTICIPANTS',
        };
      })
      .sort((a, b) => b.activeOperatorCount - a.activeOperatorCount || a.symbol.localeCompare(b.symbol));
    return {
      serverTimestamp: new Date(serverNowMs).toISOString(),
      updatedAt: this.updatedAt,
      activeMarketCount: markets.length,
      markets,
      executionFromWorldEnabled: false,
      note: 'Market billboards represent only positions authorized for this viewer. Counts are WISDO participants, not overall market sentiment.',
    };
  }

  getMarketForViewer(symbol, viewer = {}) {
    const target = clean(symbol, 32).toUpperCase();
    return this.snapshotForViewer(viewer).markets.find((market) => market.symbol === target) || null;
  }
}

export { TRADE_VISIBILITY as WORLD_TRADE_VISIBILITY };
