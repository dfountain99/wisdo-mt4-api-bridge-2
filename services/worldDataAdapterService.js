import { AccountSelectionService } from './accountSelectionService.js';

const clean = (value, max = 120) => String(value ?? '').trim().slice(0, max);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function maskAccount(value = '') {
  const raw = clean(value, 40);
  if (!raw) return '';
  if (raw.length <= 4) return '*'.repeat(raw.length);
  return `${raw.slice(0, 2)}${'*'.repeat(Math.max(3, raw.length - 4))}${raw.slice(-2)}`;
}

function freshness(lastSyncAt) {
  const parsed = Date.parse(lastSyncAt || '');
  if (!Number.isFinite(parsed)) return { state: 'disconnected', ageMs: null, stale: true };
  const ageMs = Math.max(0, Date.now() - parsed);
  if (ageMs <= 90_000) return { state: 'live', ageMs, stale: false };
  if (ageMs <= 5 * 60_000) return { state: 'stale', ageMs, stale: true };
  if (ageMs <= 30 * 60_000) return { state: 'degraded', ageMs, stale: true };
  return { state: 'offline', ageMs, stale: true };
}

function normalizePosition(trade = {}) {
  return {
    ticket: trade.ticket ?? null,
    symbol: clean(trade.symbol, 32),
    direction: clean(trade.type || trade.direction, 16).toLowerCase(),
    lots: finite(trade.lots, 0),
    entryPrice: finite(trade.openPrice, 0),
    currentPrice: finite(trade.currentPrice, 0),
    stopLoss: trade.stopLoss == null ? null : finite(trade.stopLoss, 0),
    takeProfit: trade.takeProfit == null ? null : finite(trade.takeProfit, 0),
    floatingPL: finite(trade.profit, 0) + finite(trade.swap, 0) + finite(trade.commission, 0),
    profit: finite(trade.profit, 0),
    swap: finite(trade.swap, 0),
    commission: finite(trade.commission, 0),
    magicNumber: trade.magicNumber ?? null,
    strategy: clean(trade.comment, 80),
    openedAt: trade.openTime || null,
  };
}

function normalizeAccount(account = {}, includePrivate = true) {
  const snapshot = account.latestSnapshot?.snapshot || account.snapshot || {};
  const lastSyncAt = account.lastSyncAt || account.latestSnapshot?.receivedAt || null;
  return {
    accountId: clean(account.accountId || account.id, 100),
    nickname: clean(account.nickname || account.accountName || snapshot.accountName || 'Trading Account', 80),
    accountNumber: includePrivate ? clean(account.mt4Login || account.accountNumber || snapshot.accountNumber, 40) : maskAccount(account.mt4Login || account.accountNumber || snapshot.accountNumber),
    accountNumberMasked: maskAccount(account.mt4Login || account.accountNumber || snapshot.accountNumber),
    broker: clean(account.brokerName || account.broker || snapshot.broker, 100),
    server: clean(account.brokerServer || account.server || snapshot.brokerServer, 120),
    accountType: clean(account.accountType || account.type || (snapshot.isDemo ? 'DEMO' : 'LIVE'), 24).toUpperCase(),
    health: clean(account.health || account.status || 'UNKNOWN', 24).toUpperCase(),
    isPrimary: Boolean(account.isPrimary),
    shared: Boolean(account.shared),
    lastSyncAt,
    freshness: freshness(lastSyncAt),
    balance: finite(snapshot.balance ?? account.balance, 0),
    equity: finite(snapshot.equity ?? account.equity, 0),
    floatingPL: finite(snapshot.floatingPL ?? snapshot.floatingProfit ?? account.floatingPL ?? account.floatingProfit, 0),
    dailyClosedPL: finite(snapshot.dailyClosedPL ?? snapshot.dailyProfit ?? account.dailyClosedPL ?? account.dailyProfit, 0),
    margin: finite(snapshot.margin, 0),
    freeMargin: finite(snapshot.freeMargin, 0),
    marginLevel: finite(snapshot.marginLevel, 0),
    terminalConnected: snapshot.terminalConnected !== false,
    expertEnabled: snapshot.expertEnabled !== false,
    openTradeCount: finite(snapshot.openTradeCount ?? (Array.isArray(snapshot.openTrades) ? snapshot.openTrades.length : 0), 0),
  };
}

function normalizeHistory(records = []) {
  return (Array.isArray(records) ? records : [])
    .filter((record) => record?.snapshot)
    .slice(0, 40)
    .reverse()
    .map((record) => ({
      at: record.receivedAt || record.snapshot?.timestamp || null,
      balance: finite(record.snapshot?.balance, 0),
      equity: finite(record.snapshot?.equity, 0),
      floatingPL: finite(record.snapshot?.floatingPL, 0),
    }));
}

export class WorldDataAdapterService {
  constructor({ mt4SyncService = null, logger = console } = {}) {
    this.mt4SyncService = mt4SyncService;
    this.repository = mt4SyncService?.repository || null;
    this.logger = logger;
    this.accountSelection = this.repository ? new AccountSelectionService({ repository: this.repository }) : null;
  }

  async accountsFor(userId) {
    if (!this.accountSelection) return [];
    return this.accountSelection.list(String(userId));
  }

  async selectAccount(userId, accountId) {
    if (!this.accountSelection) {
      const error = new Error('Trading-account service is unavailable.');
      error.statusCode = 503;
      throw error;
    }
    return this.accountSelection.select(String(userId), String(accountId));
  }

  async snapshot(userId, { includePrivate = true } = {}) {
    const accounts = await this.accountsFor(userId);
    const activeRaw = accounts.find((item) => item.isPrimary) || accounts[0] || null;
    const activeAccount = activeRaw ? normalizeAccount(activeRaw, includePrivate) : null;
    const liveSnapshot = activeRaw?.latestSnapshot?.snapshot || activeRaw?.snapshot || {};
    const positions = (Array.isArray(liveSnapshot.openTrades) ? liveSnapshot.openTrades : []).slice(0, 100).map(normalizePosition);
    let history = [];
    try {
      history = this.mt4SyncService?.getSnapshotHistory
        ? normalizeHistory(await this.mt4SyncService.getSnapshotHistory(String(userId), 40))
        : [];
    } catch (error) {
      this.logger?.warn?.('WISDO World history adapter could not load snapshot history.', { message: error.message });
    }
    const publicAccounts = accounts.map((account) => normalizeAccount(account, includePrivate));
    const reporters = publicAccounts.map((account) => ({
      id: `reporter:${account.accountId}`,
      accountId: account.accountId,
      name: account.nickname || `${account.accountType} Reporter`,
      status: account.freshness.state,
      lastSeenAt: account.lastSyncAt,
      latencyMs: null,
      terminalConnected: account.terminalConnected,
      expertEnabled: account.expertEnabled,
      canExecuteTradesFromWorld: false,
    }));

    return {
      accounts: publicAccounts,
      activeAccount,
      financial: activeAccount ? {
        balance: activeAccount.balance,
        equity: activeAccount.equity,
        floatingPL: activeAccount.floatingPL,
        dailyClosedPL: activeAccount.dailyClosedPL,
        margin: activeAccount.margin,
        freeMargin: activeAccount.freeMargin,
        marginLevel: activeAccount.marginLevel,
        currency: clean(liveSnapshot.currency || activeRaw?.currency || 'USD', 12) || 'USD',
      } : null,
      positions,
      history,
      reporters,
      reporterSummary: {
        total: reporters.length,
        online: reporters.filter((item) => item.status === 'live').length,
        stale: reporters.filter((item) => item.status === 'stale' || item.status === 'degraded').length,
        offline: reporters.filter((item) => item.status === 'offline' || item.status === 'disconnected').length,
      },
      selectedSymbol: clean(liveSnapshot.symbol || positions[0]?.symbol || '', 32),
      source: 'authorized-wisdo-services',
      executionFromWorldEnabled: false,
      generatedAt: new Date().toISOString(),
    };
  }
}
