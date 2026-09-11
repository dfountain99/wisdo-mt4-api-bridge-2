import { AccountSelectionService } from './accountSelectionService.js';
import { movementForTrade, resolveInstrumentMetadata } from './worldMarketStateService.js';

const clean = (value, max = 120) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const finite = (value, fallback = null) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const boolOrNull = (value) => typeof value === 'boolean' ? value : value === 1 || value === '1' || String(value).toLowerCase() === 'true' ? true : value === 0 || value === '0' || String(value).toLowerCase() === 'false' ? false : null;

function firstFinite(...values) {
  for (const value of values) {
    const n = finite(value, null);
    if (n != null) return n;
  }
  return null;
}

function firstBoolean(...values) {
  for (const value of values) {
    const resolved = boolOrNull(value);
    if (resolved != null) return resolved;
  }
  return null;
}

function campaignIdentity(trade = {}) {
  const explicit = clean(trade.campaignId || trade.basketId || trade.campaignKey, 100);
  if (explicit) return { id: explicit, source: 'backend_campaign' };
  const symbol = clean(trade.symbol, 32).toUpperCase();
  const direction = clean(trade.type || trade.direction, 12).toUpperCase();
  const magic = trade.magicNumber == null ? '' : String(trade.magicNumber);
  const strategy = clean(trade.comment || trade.strategy, 80);
  const key = [symbol, direction, magic || 'no-magic', strategy || 'no-strategy'].join(':');
  return { id: `derived:${key}`, source: 'derived_grouping' };
}

function explicitClassification(trade = {}) {
  const value = clean(trade.classification || trade.positionClass || trade.entryClass || trade.entryType || trade.role, 32).toUpperCase();
  return value || null;
}

function normalizePosition(trade = {}, snapshot = {}) {
  const symbol = clean(trade.symbol, 32).toUpperCase();
  const direction = clean(trade.type || trade.direction, 12).toUpperCase();
  const metadata = resolveInstrumentMetadata(snapshot, trade, symbol);
  const entryPrice = finite(trade.openPrice ?? trade.entryPrice, null);
  const currentPrice = finite(trade.currentPrice, null);
  const movement = movementForTrade({ direction, entryPrice, currentPrice }, metadata);
  return {
    ticket: trade.ticket == null ? null : String(trade.ticket),
    symbol,
    direction,
    entryPrice,
    currentPrice,
    lots: finite(trade.lots, 0),
    stopLoss: firstFinite(trade.stopLoss, trade.sl),
    takeProfit: firstFinite(trade.takeProfit, trade.tp),
    floatingMoney: finite(trade.profit, 0) + finite(trade.swap, 0) + finite(trade.commission, 0),
    profit: finite(trade.profit, 0),
    swap: finite(trade.swap, 0),
    commission: finite(trade.commission, 0),
    magicNumber: trade.magicNumber == null ? null : trade.magicNumber,
    strategyName: clean(trade.strategyName || trade.comment, 80) || null,
    classification: explicitClassification(trade),
    openedAt: trade.openTime || trade.openedAt || null,
    movement: movement ? { value: movement.value, unit: movement.unit } : null,
  };
}

function sameFinite(values = []) {
  const rows = values.filter((value) => finite(value, null) != null).map(Number);
  if (!rows.length) return null;
  const first = rows[0];
  return rows.every((value) => Math.abs(value - first) <= Math.max(1e-9, Math.abs(first) * 1e-10)) ? first : null;
}

function extrema(values = []) {
  const rows = values.filter((value) => finite(value, null) != null).map(Number);
  return rows.length ? { min: Math.min(...rows), max: Math.max(...rows) } : null;
}

function groupCampaigns(snapshot = {}) {
  const rawTrades = Array.isArray(snapshot.openTrades) ? snapshot.openTrades : [];
  const map = new Map();
  for (const raw of rawTrades) {
    const position = normalizePosition(raw, snapshot);
    if (!position.symbol || !['BUY', 'SELL'].includes(position.direction) || position.entryPrice == null) continue;
    const identity = campaignIdentity(raw);
    const key = identity.id;
    const row = map.get(key) || {
      campaignId: key,
      campaignIdentitySource: identity.source,
      symbol: position.symbol,
      direction: position.direction,
      strategyId: clean(raw.strategyId || raw.botId || raw.eaId, 100) || null,
      strategyName: clean(raw.strategyName || raw.botName || raw.comment || snapshot.eaName, 100) || null,
      magicNumbers: new Set(),
      positions: [],
      createdAt: position.openedAt,
      updatedAt: snapshot.timestamp || null,
      metadata: resolveInstrumentMetadata(snapshot, raw, position.symbol),
    };
    if (position.magicNumber != null) row.magicNumbers.add(String(position.magicNumber));
    row.positions.push(position);
    if (!row.createdAt || (position.openedAt && Date.parse(position.openedAt) < Date.parse(row.createdAt))) row.createdAt = position.openedAt;
    map.set(key, row);
  }
  return [...map.values()].map((row) => {
    const totalLots = row.positions.reduce((sum, position) => sum + Number(position.lots || 0), 0);
    const weightedEntry = totalLots > 0
      ? row.positions.reduce((sum, position) => sum + Number(position.entryPrice || 0) * Number(position.lots || 0), 0) / totalLots
      : row.positions.reduce((sum, position) => sum + Number(position.entryPrice || 0), 0) / Math.max(1, row.positions.length);
    const currentPrice = row.positions.map((position) => finite(position.currentPrice, null)).find((value) => value != null) ?? null;
    const movement = movementForTrade({ direction: row.direction, entryPrice: weightedEntry, currentPrice }, row.metadata);
    const stopValues = row.positions.map((position) => position.stopLoss).filter((value) => value != null && value !== 0);
    const targetValues = row.positions.map((position) => position.takeProfit).filter((value) => value != null && value !== 0);
    const uniqueMagic = [...row.magicNumbers];
    return {
      campaignId: row.campaignId,
      campaignIdentitySource: row.campaignIdentitySource,
      symbol: row.symbol,
      direction: row.direction,
      strategyId: row.strategyId,
      strategyName: row.strategyName,
      magicNumber: uniqueMagic.length === 1 ? uniqueMagic[0] : null,
      canTargetByMagic: uniqueMagic.length === 1,
      primaryEntry: row.positions.length ? row.positions[0].entryPrice : null,
      averageEntry: weightedEntry,
      currentPrice,
      positions: row.positions,
      positionCount: row.positions.length,
      totalLots,
      stopLoss: sameFinite(stopValues),
      stopRange: sameFinite(stopValues) == null ? extrema(stopValues) : null,
      takeProfit: sameFinite(targetValues),
      targetRange: sameFinite(targetValues) == null ? extrema(targetValues) : null,
      trailState: {
        distance: firstFinite(snapshot.trailDistance, snapshot.trailingDistance, snapshot.trailPoints),
        unit: clean(snapshot.trailUnit || snapshot.trailingUnit, 20) || null,
        source: firstFinite(snapshot.trailDistance, snapshot.trailingDistance, snapshot.trailPoints) != null ? 'reporter_snapshot' : 'unavailable',
      },
      addsEnabled: firstBoolean(snapshot.addsEnabled, snapshot.addEngineEnabled, snapshot.allowAdds),
      botEnabled: firstBoolean(snapshot.botEnabled, snapshot.tradingEnabled, snapshot.expertEnabled),
      floatingMoney: row.positions.reduce((sum, position) => sum + Number(position.floatingMoney || 0), 0),
      floatingMovement: movement ? { value: movement.value, unit: movement.unit } : null,
      instrumentMetadata: {
        digits: row.metadata?.digits ?? null,
        pointSize: row.metadata?.pointSize ?? null,
        pipSize: row.metadata?.pipSize ?? null,
        tickSize: row.metadata?.tickSize ?? null,
        displayUnit: row.metadata?.displayUnit || 'PRICE Δ',
        source: row.metadata?.source || 'unit_unverified',
      },
      plannedAdds: Array.isArray(snapshot.plannedAdds)
        ? snapshot.plannedAdds.filter((item) => clean(item?.symbol, 32).toUpperCase() === row.symbol).map((item) => ({ price: finite(item.price, null), label: clean(item.label || item.type, 32) || 'PLANNED', source: 'reporter_snapshot' })).filter((item) => item.price != null)
        : [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
}

function executionHealth(account = {}, snapshot = {}) {
  const lastSyncAt = account.lastSyncAt || account.latestSnapshot?.receivedAt || null;
  const parsed = Date.parse(lastSyncAt || '');
  const ageMs = Number.isFinite(parsed) ? Math.max(0, Date.now() - parsed) : null;
  const reporterState = ageMs == null ? 'DISCONNECTED' : ageMs <= 90_000 ? 'LIVE' : ageMs <= 5 * 60_000 ? 'STALE' : 'OFFLINE';
  const terminalConnected = typeof snapshot.terminalConnected === 'boolean' ? snapshot.terminalConnected : null;
  const expertEnabled = typeof snapshot.expertEnabled === 'boolean' ? snapshot.expertEnabled : null;
  return {
    reporter: reporterState,
    lastSyncAt,
    ageMs,
    terminalConnected,
    expertEnabled,
    commandLinkReady: reporterState === 'LIVE' && terminalConnected !== false,
  };
}

export class WorldCampaignStateService {
  constructor({ mt4SyncService = null } = {}) {
    this.mt4SyncService = mt4SyncService;
    this.repository = mt4SyncService?.repository || null;
    this.accountSelection = this.repository ? new AccountSelectionService({ repository: this.repository }) : null;
  }

  async accessibleAccounts(userId) {
    if (!this.accountSelection) return [];
    return this.accountSelection.list(String(userId));
  }

  async snapshot(userId, { accountId = '' } = {}) {
    const accounts = await this.accessibleAccounts(userId);
    let account = null;
    if (accountId) account = accounts.find((item) => String(item.accountId) === String(accountId)) || null;
    else account = accounts.find((item) => item.isPrimary) || null;
    if (!account) {
      return {
        account: null,
        accounts: accounts.map((item) => ({ accountId: item.accountId, nickname: item.nickname || item.accountName || 'Trading Account', isPrimary: Boolean(item.isPrimary), shared: Boolean(item.shared), sharePermission: item.sharePermission || null })),
        campaigns: [],
        selectedCampaignId: null,
        financial: null,
        executionHealth: { reporter: 'DISCONNECTED', commandLinkReady: false },
        generatedAt: new Date().toISOString(),
      };
    }
    const snapshot = account.latestSnapshot?.snapshot || account.snapshot || {};
    const campaigns = groupCampaigns(snapshot);
    const currency = clean(snapshot.currency || account.currency || 'USD', 12) || 'USD';
    return {
      account: {
        accountId: String(account.accountId),
        nickname: clean(account.nickname || account.accountName || snapshot.accountName || 'Trading Account', 80),
        accountNumberMasked: account.accountNumber ? `****${String(account.accountNumber).slice(-4)}` : '',
        accountType: snapshot.isDemo === true ? 'DEMO' : snapshot.isDemo === false ? 'LIVE' : clean(account.type || account.accountType || 'UNKNOWN', 16).toUpperCase(),
        shared: Boolean(account.shared),
        sharePermission: account.sharePermission || null,
        ownerUserId: String(account.ownerUserId || account.discordUserId || userId),
      },
      accounts: accounts.map((item) => ({ accountId: item.accountId, nickname: item.nickname || item.accountName || 'Trading Account', isPrimary: Boolean(item.isPrimary), shared: Boolean(item.shared), sharePermission: item.sharePermission || null })),
      campaigns,
      selectedCampaignId: campaigns[0]?.campaignId || null,
      financial: {
        balance: finite(snapshot.balance, 0),
        equity: finite(snapshot.equity, 0),
        floatingPL: finite(snapshot.floatingPL, 0),
        margin: finite(snapshot.margin, 0),
        freeMargin: finite(snapshot.freeMargin, 0),
        marginLevel: finite(snapshot.marginLevel, 0),
        currency,
      },
      executionHealth: executionHealth(account, snapshot),
      bot: {
        name: clean(snapshot.eaName || account.eaName, 100) || null,
        version: clean(snapshot.eaVersion || account.eaVersion, 40) || null,
        enabled: firstBoolean(snapshot.botEnabled, snapshot.tradingEnabled, snapshot.expertEnabled),
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
