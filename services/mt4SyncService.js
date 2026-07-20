import { createHmac, randomInt } from 'node:crypto';

import { logger } from '../logger.js';

const PAIRING_CODE_PATTERN = /^CEM-[A-Z0-9-]{4,96}$/i;
const ACCOUNT_NUMBER_PATTERN = /^\d{3,20}$/;

function toNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function toStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function toNumberArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.map((value) => toInteger(value)).filter((value) => value !== null))];
}

function normalizeTradeType(type) {
  const normalized = String(type || '').trim().toLowerCase();
  if (normalized.includes('buy')) {
    return 'buy';
  }

  if (normalized.includes('sell')) {
    return 'sell';
  }

  return normalized || 'unknown';
}

function toIsoStringOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function maskValue(value, visibleStart = 4, visibleEnd = 2) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return 'unknown';
  }

  if (normalized.length <= visibleStart + visibleEnd) {
    return '*'.repeat(Math.max(4, normalized.length));
  }

  return `${normalized.slice(0, visibleStart)}***${normalized.slice(-visibleEnd)}`;
}

function normalizeHeaderValue(headers, name) {
  const target = String(name || '').trim().toLowerCase();

  for (const [headerName, headerValue] of Object.entries(headers || {})) {
    if (headerName.toLowerCase() !== target) {
      continue;
    }

    return Array.isArray(headerValue) ? headerValue[0] : headerValue;
  }

  return '';
}

function normalizeTrade(trade, closed = false) {
  if (!trade || typeof trade !== 'object') {
    return null;
  }

  return {
    ticket: toInteger(trade.ticket),
    symbol: String(trade.symbol || '').trim(),
    type: normalizeTradeType(trade.type),
    lots: toNumber(trade.lots),
    openPrice: toNumber(trade.openPrice),
    currentPrice: closed ? undefined : toNumber(trade.currentPrice),
    closePrice: closed ? toNumber(trade.closePrice) : undefined,
    stopLoss: toNumber(trade.stopLoss),
    takeProfit: toNumber(trade.takeProfit),
    profit: toNumber(trade.profit),
    swap: toNumber(trade.swap),
    commission: toNumber(trade.commission),
    magicNumber: toInteger(trade.magicNumber),
    comment: String(trade.comment || '').trim(),
    openTime: toIsoStringOrNull(trade.openTime),
    closeTime: closed ? toIsoStringOrNull(trade.closeTime) : null,
  };
}


function compactHistorySnapshot(snapshot = {}) {
  return {
    accountNumber: snapshot.accountNumber,
    accountName: snapshot.accountName,
    brokerServer: snapshot.brokerServer,
    isDemo: snapshot.isDemo,
    eaName: snapshot.eaName,
    eaVersion: snapshot.eaVersion,
    balance: snapshot.balance,
    equity: snapshot.equity,
    margin: snapshot.margin,
    freeMargin: snapshot.freeMargin,
    marginLevel: snapshot.marginLevel,
    floatingPL: snapshot.floatingPL,
    dailyClosedPL: snapshot.dailyClosedPL,
    openTradeCount: snapshot.openTradeCount,
    buyTradeCount: snapshot.buyTradeCount,
    sellTradeCount: snapshot.sellTradeCount,
    totalLots: snapshot.totalLots,
    symbols: Array.isArray(snapshot.symbols) ? snapshot.symbols.slice(0, 50) : [],
    timestamp: snapshot.timestamp,
    terminalConnected: snapshot.terminalConnected,
    expertEnabled: snapshot.expertEnabled,
  };
}

function appendBoundedHistory(history, record) {
  const globalLimit = Math.max(50, Number(process.env.WISDO_MT4_HISTORY_GLOBAL_LIMIT || 500));
  const accountLimit = Math.max(10, Number(process.env.WISDO_MT4_HISTORY_ACCOUNT_LIMIT || 100));
  const result = [record];
  let accountCount = 1;
  for (const item of Array.isArray(history) ? history : []) {
    if (result.length >= globalLimit) break;
    if (String(item.accountId || '') === String(record.accountId || '')) {
      if (accountCount >= accountLimit) continue;
      accountCount += 1;
    }
    result.push(item);
  }
  return result;
}

export class Mt4SyncError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.expose = true;
  }
}

export class Mt4SyncService {
  constructor(config, repository, copyTradingService = null, wisdoMemoryService = null) {
    this.config = config;
    this.repository = repository;
    this.copyTradingService = copyTradingService;
    this.wisdoMemoryService = wisdoMemoryService;
    this.requestTimestamps = new Map();
    this.lastRateLimitSweepAt = 0;
    this.productEventSink = null;
    this.routePreparationByAccount = new Map();
    this.lastHistoryAtByAccount = new Map();
    this.pairingRecordCache = new Map();
    this.pairingRecoveryByCode = new Map();
    this.pairingCacheTtlMs = Math.max(30_000, Number(process.env.WISDO_PAIRING_CACHE_TTL_MS || 300_000));
  }

  attachWisdoMemoryService(service) {
    this.wisdoMemoryService = service;
  }

  attachCopyTradingService(service) {
    this.copyTradingService = service;
  }

  attachProductEventSink(sink) {
    this.productEventSink = sink || null;
  }

  getPublicBaseUrl() {
    if (this.config.api.publicBaseUrl && !this.config.api.publicBaseUrl.includes('YOUR_DOMAIN')) {
      return this.config.api.publicBaseUrl;
    }

    return `http://localhost:${this.config.api.port}`;
  }

  getSyncUrl() {
    return `${this.getPublicBaseUrl()}${this.config.api.mt4SyncPath}`;
  }

  isPublicBaseUrlReady() {
    return Boolean(this.config.api.publicBaseUrl) && !this.config.api.publicBaseUrl.includes('YOUR_DOMAIN');
  }

  requiresApiKey() {
    return Boolean(this.config.api.mt4SyncApiKey);
  }

  getPairingSecret() {
    return String(
      process.env.MT4_PAIRING_SIGNING_SECRET ||
      this.config?.api?.mt4SyncApiKey ||
      this.config?.discordToken ||
      this.config?.clientId ||
      process.env.DISCORD_TOKEN ||
      'culturecoin-local-dev'
    );
  }

  getAcceptedApiKeys() {
    const values = [
      this.config?.api?.mt4SyncApiKey,
      process.env.MT4_SYNC_API_KEYS,
      process.env.MT4_SYNC_PREVIOUS_API_KEYS,
    ];
    return [...new Set(values
      .flatMap((value) => String(value || '').split(/[\n,;]/g))
      .map((value) => value.trim())
      .filter(Boolean))];
  }

  getPairingSecrets() {
    return [...new Set([
      process.env.MT4_PAIRING_SIGNING_SECRET,
      ...this.getAcceptedApiKeys(),
      this.config?.discordToken,
      process.env.DISCORD_TOKEN,
      this.config?.clientId,
      'culturecoin-local-dev',
    ].map((value) => String(value || '').trim()).filter(Boolean))];
  }

  signPairingPayload(discordUserId, nonce, secret = this.getPairingSecret()) {
    const payload = `${String(discordUserId || '').trim()}:${String(nonce || '').trim()}`;
    return createHmac('sha256', secret).update(payload).digest('hex').slice(0, 8).toUpperCase();
  }

  buildSignedPairingCode(discordUserId) {
    const userId = String(discordUserId || '').trim();
    const nonce = String(randomInt(100000, 1000000));
    if (!/^\d{5,25}$/.test(userId)) {
      return `CEM-${nonce}`;
    }
    return `CEM-U${userId}-${nonce}-${this.signPairingPayload(userId, nonce)}`;
  }

  parseSignedPairingCode(pairingCode) {
    const match = String(pairingCode || '').trim().match(/^CEM-U(\d{5,25})-(\d{6})-([A-F0-9]{8})$/i);
    if (!match) return null;
    const [, discordUserId, nonce, signature] = match;
    const normalizedSignature = String(signature).toUpperCase();
    const matchedSecret = this.getPairingSecrets().find((secret) => this.signPairingPayload(discordUserId, nonce, secret) === normalizedSignature);
    if (!matchedSecret) return null;
    return { discordUserId, nonce, signature: normalizedSignature };
  }

  getCachedPairingRecord(pairingCode) {
    const code = String(pairingCode || '').trim();
    const cached = this.pairingRecordCache.get(code);
    if (!cached) return null;
    if (Date.now() - cached.cachedAt > this.pairingCacheTtlMs) {
      this.pairingRecordCache.delete(code);
      return null;
    }
    return structuredClone(cached.record);
  }

  cachePairingRecord(record) {
    if (!record?.pairingCode) return record || null;
    const now = Date.now();
    const maxEntries = Math.max(100, Math.min(5000, Number(process.env.WISDO_PAIRING_CACHE_MAX || 1500)));
    for (const [key, cached] of this.pairingRecordCache) {
      if (now - Number(cached?.cachedAt || 0) > this.pairingCacheTtlMs) this.pairingRecordCache.delete(key);
      if (this.pairingRecordCache.size < maxEntries) break;
    }
    while (this.pairingRecordCache.size >= maxEntries) {
      const oldest = this.pairingRecordCache.keys().next().value;
      if (!oldest) break;
      this.pairingRecordCache.delete(oldest);
    }
    this.pairingRecordCache.set(String(record.pairingCode), { cachedAt: now, record: structuredClone(record) });
    return record;
  }

  async recoverSignedPairingCode(code, defaults = {}) {
    const existing = await this.repository.getPairingCode(code);
    if (existing) return this.cachePairingRecord(existing);

    const signed = this.parseSignedPairingCode(code);
    if (!signed) return null;

    const recoveredAt = new Date().toISOString();
    const recoveredRecord = {
      pairingCode: code,
      discordUserId: signed.discordUserId,
      channelId: String(defaults.channelId || ''),
      status: 'pending',
      createdAt: recoveredAt,
      expiresAt: null,
      connectedAt: null,
      accountNumber: null,
      requestedByUserId: signed.discordUserId,
      accountNickname: String(defaults.accountNickname || '').trim(),
      accountRole: String(defaults.accountRole || 'private').toLowerCase(),
      copyPermission: String(defaults.copyPermission || 'private').toLowerCase(),
      accountId: null,
      recoveredAfterRestart: true,
      recoveredAt,
    };

    // Cache first so concurrent Reporter sync/poll requests share one identity while
    // the buffered PostgreSQL write completes.
    this.cachePairingRecord(recoveredRecord);
    await this.repository.updateMt4State((state) => {
      state.pairingCodes ||= {};
      state.pairingCodes[code] ||= recoveredRecord;
      return state;
    });
    this.repository.flushMt4State?.().catch((error) => {
      logger.warn('Recovered pairing code is live in memory but durable flush is delayed.', {
        pairingCode: maskValue(code),
        message: error.message,
      });
    });

    logger.warn('Recovered signed MT4 pairing code after server restart.', {
      pairingCode: maskValue(code),
      discordUserId: signed.discordUserId,
    });
    return recoveredRecord;
  }

  async getOrRecoverPairingCode(pairingCode, defaults = {}) {
    const code = String(pairingCode || '').trim();
    if (!code) return null;
    const cached = this.getCachedPairingRecord(code);
    if (cached) return cached;
    if (this.pairingRecoveryByCode.has(code)) return structuredClone(await this.pairingRecoveryByCode.get(code));

    const maxRecoveries = Math.max(25, Math.min(1000, Number(process.env.WISDO_PAIRING_RECOVERY_MAX || 250)));
    while (this.pairingRecoveryByCode.size >= maxRecoveries) {
      const oldest = this.pairingRecoveryByCode.keys().next().value;
      if (oldest === undefined) break;
      this.pairingRecoveryByCode.delete(oldest);
    }
    const recovery = this.recoverSignedPairingCode(code, defaults)
      .finally(() => this.pairingRecoveryByCode.delete(code));
    this.pairingRecoveryByCode.set(code, recovery);
    const record = await recovery;
    return record ? structuredClone(record) : null;
  }

  generatePairingCode(discordUserId = '') {
    return this.buildSignedPairingCode(discordUserId);
  }

  getPairingExpiryDate() {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.config.api.mt4PairingCodeTtlHours);
    return expiresAt;
  }

  isPairingExpired(pairingRecord, now = new Date()) {
    if (!pairingRecord?.expiresAt) {
      return false;
    }

    return new Date(pairingRecord.expiresAt) < now;
  }

  async expirePairingCode(pairingCode) {
    if (!pairingCode) {
      return null;
    }

    await this.repository.updateMt4State((state) => {
      if (state.pairingCodes[pairingCode]) {
        state.pairingCodes[pairingCode].status = 'expired';
      }

      return state;
    });

    const expired = await this.repository.getPairingCode(pairingCode);
    if (expired) this.cachePairingRecord(expired);
    return expired;
  }

  async issuePairingCode({ discordUserId, channelId, requestedByUserId, accountNickname = '', accountRole = 'private', copyPermission = 'private', forceNew = true } = {}) {
    const latestPairing = await this.getLatestPairingForUser(discordUserId);

    // Multi-account support: each MT4 terminal/account needs its own pairing code.
    // Older builds reused one pending code per user; this caused account-number mismatch conflicts.
    if (!forceNew && latestPairing?.status === 'pending') {
      if (this.isPairingExpired(latestPairing)) {
        await this.expirePairingCode(latestPairing.pairingCode);
      } else {
        return {
          ...latestPairing,
          reused: true,
        };
      }
    }

    const createdAt = new Date();
    const expiresAt = this.getPairingExpiryDate();
    const pairingCode = this.generatePairingCode(discordUserId);

    const record = {
      pairingCode,
      discordUserId,
      channelId,
      status: 'pending',
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      connectedAt: null,
      accountNumber: null,
      requestedByUserId: requestedByUserId || discordUserId,
      accountNickname: String(accountNickname || '').trim(),
      accountRole: String(accountRole || 'private').toLowerCase(),
      copyPermission: String(copyPermission || 'private').toLowerCase(),
      accountId: null,
    };

    await this.repository.updateMt4State((state) => {
      state.pairingCodes ||= {};
      // Do not expire other pending codes for this Discord user. One person may be pairing
      // demo, live, VPS, and mobile companion terminals at the same time.
      state.pairingCodes[pairingCode] = record;
      return state;
    });

    this.cachePairingRecord(record);
    return record;
  }

  async getLatestPairingForUser(discordUserId) {
    return this.repository.getLatestPairingForUser(discordUserId);
  }

  async getConnection(discordUserId) {
    return this.repository.getPrimaryMt4Connection
      ? this.repository.getPrimaryMt4Connection(discordUserId)
      : this.repository.getMt4Connection(discordUserId);
  }

  async getAccounts(discordUserId) {
    return this.repository.getMt4Accounts ? this.repository.getMt4Accounts(discordUserId) : [];
  }

  async getLatestSnapshot(discordUserId) {
    return this.repository.getLatestMt4Snapshot(discordUserId);
  }

  async getSnapshotHistory(discordUserId, limit = 50) {
    return this.repository.getMt4SnapshotHistory(discordUserId, limit);
  }

  getFreshnessInfo(snapshotRecord) {
    if (!snapshotRecord?.receivedAt) {
      return {
        isFresh: false,
        isStale: false,
        ageMinutes: null,
      };
    }

    const receivedAt = new Date(snapshotRecord.receivedAt);
    if (Number.isNaN(receivedAt.getTime())) {
      return {
        isFresh: false,
        isStale: true,
        ageMinutes: null,
      };
    }

    const ageMs = Date.now() - receivedAt.getTime();
    const ageMinutes = ageMs / 60_000;

    return {
      isFresh: ageMinutes <= this.config.wisdo.mt4StaleMinutes,
      isStale: ageMinutes > this.config.wisdo.mt4StaleMinutes,
      ageMinutes,
    };
  }

  async getFreshSnapshot(discordUserId) {
    const snapshotRecord = await this.getLatestSnapshot(discordUserId);
    if (!snapshotRecord) {
      return null;
    }

    const freshness = this.getFreshnessInfo(snapshotRecord);
    if (!freshness.isFresh) {
      return null;
    }

    return {
      ...snapshotRecord,
      freshness,
    };
  }

  attachTradeSignalService(service) {
    this.tradeSignalService = service;
  }

  normalizeSignalRole(value) {
    return String(value || 'private').trim().toLowerCase();
  }

  isSignalEligibleAccount(connectionRecord) {
    const role = this.normalizeSignalRole(connectionRecord?.accountRole);
    const forceAll = String(process.env.WISDO_SIGNALS_FROM_ALL_CONNECTED || 'true').toLowerCase() !== 'false';

    // Followers are receivers only. Everything else can create signals by default so
    // a connected account does not silently fail because it was left as private.
    if (role === 'follower') return false;
    if (role === 'leader' || role === 'both') return true;
    return forceAll;
  }

  getTradeSignalKey(accountId, trade) {
    return [
      accountId,
      trade?.ticket || '',
      trade?.openTime || '',
      trade?.symbol || '',
      trade?.type || '',
    ].join('|');
  }

  async processTradeSignals({ connectionRecord, latestSnapshotRecord, priorTracking = undefined }) {
    if (!this.tradeSignalService) {
      return { opened: 0, closed: 0, skipped: true, reason: 'tradeSignalService not attached', tracking: null };
    }

    const snapshot = latestSnapshotRecord?.snapshot || {};
    const accountId = connectionRecord.accountId;
    const openTrades = Array.isArray(snapshot.openTrades) ? snapshot.openTrades : [];
    const eligible = this.isSignalEligibleAccount(connectionRecord);

    if (!eligible) {
      return { opened: 0, closed: 0, skipped: true, reason: `account role ${connectionRecord.accountRole || 'private'} is not signal eligible`, tracking: null };
    }

    let opened = 0;
    let closed = 0;
    const nowOpenKeys = openTrades.map((trade) => this.getTradeSignalKey(accountId, trade));
    const managesTrackingPersistence = priorTracking === undefined;
    if (managesTrackingPersistence) {
      const liveState = await this.repository.getMt4State?.() || {};
      priorTracking = liveState.signalTrackingByAccountId?.[accountId] || null;
    }
    const tracking = {
      openKeys: Array.isArray(priorTracking?.openKeys) ? [...priorTracking.openKeys] : [],
      tradeKeyToSignalId: { ...(priorTracking?.tradeKeyToSignalId || {}) },
    };
    const previousKeys = tracking.openKeys;
    const previousSet = new Set(previousKeys);
    const nowSet = new Set(nowOpenKeys);

    // Persist all newly detected trades in one operation. Copier execution and Discord
    // presentation are queued behind a bounded worker so 100+ trades cannot hold the
    // Reporter HTTP request at Render's 30-second boundary.
    const newSignalInputs = [];
    for (let i = 0; i < openTrades.length; i += 1) {
      const trade = openTrades[i];
      const key = nowOpenKeys[i];
      if (!key || previousSet.has(key)) continue;
      newSignalInputs.push({
        key,
        leaderUserId: connectionRecord.discordUserId,
        leaderAccountId: accountId,
        leaderAccountNumber: connectionRecord.accountNumber,
        leaderServer: connectionRecord.brokerServer,
        leaderChannelId: connectionRecord.channelId,
        eaName: connectionRecord.eaName || snapshot.eaName,
        eaVersion: connectionRecord.eaVersion || snapshot.eaVersion,
        trade,
        snapshot,
      });
    }

    if (newSignalInputs.length && this.tradeSignalService.createSignalsBatch) {
      try {
        const signals = await this.tradeSignalService.createSignalsBatch(newSignalInputs);
        for (let index = 0; index < signals.length; index += 1) {
          const signal = signals[index];
          const key = newSignalInputs[index]?.key;
          if (signal?.signalId && key) {
            tracking.tradeKeyToSignalId[key] = signal.signalId;
            opened += 1;
          }
        }
      } catch (error) {
        logger.warn('Trade signal batch creation failed during MT4 sync.', { accountId, count: newSignalInputs.length, message: error.message });
      }
    } else {
      for (const input of newSignalInputs) {
        try {
          const signal = await this.tradeSignalService.createSignal(input);
          if (signal?.signalId) {
            tracking.tradeKeyToSignalId[input.key] = signal.signalId;
            opened += 1;
          }
        } catch (error) {
          logger.warn('Trade signal creation failed during MT4 sync.', { accountId, ticket: input.trade?.ticket, message: error.message });
        }
      }
    }

    const closeEvents = [];
    for (const oldKey of previousKeys) {
      if (nowSet.has(oldKey)) continue;
      closed += 1;
      const signalId = tracking.tradeKeyToSignalId?.[oldKey] || null;
      const [, sourceTicket = ''] = String(oldKey).split('|');
      const closedSymbol = String(oldKey).split('|')[3] || '';
      const closedSide = String(oldKey).split('|')[4] || '';
      closeEvents.push({
        signalId,
        leaderAccountId: accountId,
        leaderUserId: connectionRecord.discordUserId,
        leaderAccountNumber: connectionRecord.accountNumber,
        sourceTicket,
        symbol: closedSymbol,
        side: closedSide,
      });
      delete tracking.tradeKeyToSignalId[oldKey];
    }

    if (closeEvents.length && this.tradeSignalService.queueSignalClosuresBatch) {
      this.tradeSignalService.queueSignalClosuresBatch(closeEvents);
    } else {
      for (const event of closeEvents) {
        if (this.tradeSignalService?.queueAutoCopyCloseRoutes && event.sourceTicket) {
          try { await this.tradeSignalService.queueAutoCopyCloseRoutes(event); }
          catch (error) { logger.warn('Culture Lane close command creation failed during MT4 sync.', { accountId, sourceTicket: event.sourceTicket, message: error.message }); }
        }
        if (this.copyTradingService && event.sourceTicket) {
          try {
            await this.copyTradingService.queueMasterSignal({
              masterUserId: event.leaderUserId, masterAccountNumber: event.leaderAccountNumber, sourceTicket: event.sourceTicket,
              symbol: event.symbol, side: event.side, lots: 0.01, action: 'close', signalId: event.signalId,
            });
          } catch (error) { logger.warn('Copy close command creation failed during MT4 sync.', { accountId, sourceTicket: event.sourceTicket, message: error.message }); }
        }
      }
    }

    const activeSignalMap = {};
    for (const key of nowOpenKeys) {
      if (tracking.tradeKeyToSignalId?.[key]) activeSignalMap[key] = tracking.tradeKeyToSignalId[key];
    }

    const nextTracking = {
      openKeys: nowOpenKeys,
      tradeKeyToSignalId: activeSignalMap,
      updatedAt: new Date().toISOString(),
    };
    if (managesTrackingPersistence) {
      await this.repository.updateMt4State((state) => {
        state.signalTrackingByAccountId ||= {};
        state.signalTrackingByAccountId[accountId] = nextTracking;
        return state;
      });
    }

    return {
      opened,
      closed,
      skipped: false,
      reason: null,
      tracking: nextTracking,
    };
  }

  normalizeSnapshotPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Mt4SyncError(400, 'Invalid MT4 payload');
    }

    const snapshot = {
      pairingCode: String(payload.pairingCode || '').trim(),
      accountNumber: String(payload.accountNumber || '').trim(),
      accountName: String(payload.accountName || '').trim(),
      brokerServer: String(payload.brokerServer || '').trim(),
      isDemo: toBoolean(payload.isDemo, false),
      eaName: String(payload.eaName || '').trim(),
      eaVersion: String(payload.eaVersion || '').trim(),
      reporterVersion: String(payload.reporterVersion || '').trim(),
      reporterCapabilities: toStringArray(payload.reporterCapabilities),
      magicNumberFilter: toInteger(payload.magicNumberFilter) || 0,
      symbolFilter: String(payload.symbolFilter || '').trim(),
      balance: toNumber(payload.balance),
      equity: toNumber(payload.equity),
      margin: toNumber(payload.margin),
      freeMargin: toNumber(payload.freeMargin),
      marginLevel: toNumber(payload.marginLevel),
      floatingPL: toNumber(payload.floatingPL),
      dailyClosedPL: toNumber(payload.dailyClosedPL),
      openTradeCount: toInteger(payload.openTradeCount) || 0,
      buyTradeCount: toInteger(payload.buyTradeCount) || 0,
      sellTradeCount: toInteger(payload.sellTradeCount) || 0,
      totalLots: toNumber(payload.totalLots),
      symbols: toStringArray(payload.symbols),
      magicNumbersSeen: toNumberArray(payload.magicNumbersSeen),
      openTrades: Array.isArray(payload.openTrades)
        ? payload.openTrades.map((trade) => normalizeTrade(trade)).filter(Boolean)
        : [],
      closedTradesToday: Array.isArray(payload.closedTradesToday)
        ? payload.closedTradesToday.map((trade) => normalizeTrade(trade, true)).filter(Boolean)
        : [],
      timestamp: toIsoStringOrNull(payload.timestamp) || new Date().toISOString(),
      terminalConnected: toBoolean(payload.terminalConnected, true),
      expertEnabled: toBoolean(payload.expertEnabled, true),
    };

    if (!snapshot.pairingCode || !PAIRING_CODE_PATTERN.test(snapshot.pairingCode)) {
      throw new Mt4SyncError(400, 'Invalid pairing code');
    }

    if (!snapshot.accountNumber || !ACCOUNT_NUMBER_PATTERN.test(snapshot.accountNumber)) {
      throw new Mt4SyncError(400, 'Account number is required');
    }

    if (snapshot.balance === null || snapshot.equity === null) {
      throw new Mt4SyncError(400, 'Balance and equity are required');
    }

    if (
      snapshot.openTradeCount < 0 ||
      snapshot.buyTradeCount < 0 ||
      snapshot.sellTradeCount < 0 ||
      (snapshot.totalLots !== null && snapshot.totalLots < 0)
    ) {
      throw new Mt4SyncError(400, 'Invalid MT4 trade totals');
    }

    return snapshot;
  }

  validateApiKey(headers) {
    const acceptedKeys = this.getAcceptedApiKeys();
    if (!acceptedKeys.length) return { ok: true, mode: 'disabled' };

    const headerValue = String(normalizeHeaderValue(headers, 'x-culturecoin-apikey') || '').trim();
    if (headerValue && acceptedKeys.includes(headerValue)) return { ok: true, mode: 'api-key' };
    throw new Mt4SyncError(401, 'Invalid API key');
  }

  async validateReporterAuth(headers, { pairingCode = '' } = {}) {
    try {
      return this.validateApiKey(headers);
    } catch (error) {
      if (!(error instanceof Mt4SyncError) || error.statusCode !== 401) throw error;
    }

    const allowPairingAuth = String(process.env.MT4_ALLOW_PAIRING_CODE_AUTH || 'true').toLowerCase() !== 'false';
    if (!allowPairingAuth || !pairingCode) throw new Mt4SyncError(401, 'Invalid Reporter credentials');

    const signed = this.parseSignedPairingCode(pairingCode);
    if (signed) return { ok: true, mode: 'signed-pairing' };

    const known = this.getCachedPairingRecord(pairingCode) || await this.repository.getPairingCode(pairingCode);
    if (known && known.status !== 'expired' && !this.isPairingExpired(known)) {
      this.cachePairingRecord(known);
      return { ok: true, mode: 'known-pairing' };
    }

    throw new Mt4SyncError(401, 'Invalid Reporter credentials');
  }

  checkRateLimit(key) {
    const now = Date.now();
    const configuredInterval = Number(process.env.WISDO_MT4_SYNC_MIN_INTERVAL_MS || 750);
    const minimumIntervalMs = Number.isFinite(configuredInterval)
      ? Math.max(100, Math.min(10_000, configuredInterval))
      : 750;

    const maxEntries = Math.max(100, Math.min(10_000, Number(process.env.WISDO_MT4_RATE_LIMIT_CACHE_MAX || 1500)));
    if (now - Number(this.lastRateLimitSweepAt || 0) >= 60_000 || this.requestTimestamps.size >= maxEntries) {
      for (const [entryKey, timestamp] of this.requestTimestamps.entries()) {
        if (now - timestamp > 60_000) this.requestTimestamps.delete(entryKey);
      }
      this.lastRateLimitSweepAt = now;
    }
    if (!this.requestTimestamps.has(key)) {
      while (this.requestTimestamps.size >= maxEntries) {
        const oldest = this.requestTimestamps.keys().next().value;
        if (oldest === undefined) break;
        this.requestTimestamps.delete(oldest);
      }
    }

    const previous = this.requestTimestamps.get(key);
    const elapsedMs = previous ? now - previous : Number.POSITIVE_INFINITY;

    if (previous && elapsedMs < minimumIntervalMs) {
      return {
        allowed: false,
        retryAfterMs: Math.max(1, minimumIntervalMs - elapsedMs),
        minimumIntervalMs,
      };
    }

    this.requestTimestamps.set(key, now);
    return { allowed: true, retryAfterMs: 0, minimumIntervalMs };
  }

  async getDeskMt4Status(discordUserId) {
    const [rawPairing, connection, latestSnapshot, snapshotHistory] = await Promise.all([
      this.getLatestPairingForUser(discordUserId),
      this.getConnection(discordUserId),
      this.getLatestSnapshot(discordUserId),
      this.getSnapshotHistory(discordUserId, 25),
    ]);

    const pairing =
      rawPairing?.status === 'pending' && this.isPairingExpired(rawPairing)
        ? await this.expirePairingCode(rawPairing.pairingCode)
        : rawPairing;

    const freshness = this.getFreshnessInfo(latestSnapshot);
    const warnings = [];

    if (pairing?.status === 'expired') {
      warnings.push('Pairing code expired. Run /connect-mt4 again before reconnecting MT4.');
    }

    if (latestSnapshot && freshness.isStale) {
      warnings.push(
        `Latest MT4 snapshot is stale. Auto-fill uses fresh data only, and this snapshot is older than ${this.config.wisdo.mt4StaleMinutes} minutes.`,
      );
    }

    if (latestSnapshot?.snapshot?.terminalConnected === false) {
      warnings.push('MT4 terminal is reporting as disconnected.');
    }

    if (latestSnapshot?.snapshot?.expertEnabled === false) {
      warnings.push('MT4 AutoTrading / expert execution is reporting as disabled.');
    }

    return {
      pairing,
      connection,
      latestSnapshot,
      snapshotHistory,
      freshness,
      warnings,
      connectionState: latestSnapshot
        ? freshness.isFresh
          ? 'connected'
          : 'stale'
        : pairing?.status === 'pending'
          ? 'pending'
          : 'not-connected',
    };
  }

  async receiveSnapshot(payload, headers = {}) {
    const snapshot = this.normalizeSnapshotPayload(payload);
    const auth = await this.validateReporterAuth(headers, { pairingCode: snapshot.pairingCode });
    const pairingRecord = await this.getOrRecoverPairingCode(snapshot.pairingCode);

    if (!pairingRecord) {
      logger.warn('MT4 sync rejected because pairing code was unknown.', {
        pairingCode: maskValue(snapshot.pairingCode),
      });
      throw new Mt4SyncError(400, 'Invalid pairing code');
    }

    if (pairingRecord.status !== 'connected' && this.isPairingExpired(pairingRecord)) {
      await this.expirePairingCode(snapshot.pairingCode);
      logger.warn('MT4 sync rejected because pairing code was expired.', {
        pairingCode: maskValue(snapshot.pairingCode),
        discordUserId: pairingRecord.discordUserId,
      });
      throw new Mt4SyncError(400, 'Pairing code expired');
    }

    const accountId = this.repository.getMt4AccountId
      ? this.repository.getMt4AccountId(snapshot.accountNumber, snapshot.brokerServer)
      : `${snapshot.accountNumber}:${snapshot.brokerServer}`;
    const rateLimit = this.checkRateLimit(`${snapshot.pairingCode}:${snapshot.accountNumber}`);

    if (!rateLimit.allowed) {
      return {
        ok: true,
        status: 'coalesced',
        message: 'Rapid duplicate snapshot coalesced',
        discordUserId: pairingRecord.discordUserId,
        accountId,
        coalesced: true,
        retryAfterMs: rateLimit.retryAfterMs,
        copySignalsOpened: 0,
        copySignalsClosed: 0,
        signalSkipped: true,
        signalSkipReason: 'rapid-duplicate-snapshot',
      };
    }

    // One cached live-state read replaces multiple full PostgreSQL namespace loads.
    const mt4StateBeforeSnapshot = await this.repository.getMt4State?.() || {};
    const existingConnection = mt4StateBeforeSnapshot.connectionsByAccountId?.[accountId]
      || mt4StateBeforeSnapshot.connections?.[pairingRecord.discordUserId]
      || null;
    const lockedAccountNumber = pairingRecord.accountNumber;

    if (lockedAccountNumber && String(lockedAccountNumber) !== String(snapshot.accountNumber)) {
      logger.warn('MT4 sync rejected because account number did not match existing connection.', {
        discordUserId: pairingRecord.discordUserId,
        expectedAccountNumber: maskValue(lockedAccountNumber, 2, 2),
        receivedAccountNumber: maskValue(snapshot.accountNumber, 2, 2),
      });
      throw new Mt4SyncError(409, 'Account number mismatch');
    }

    const receivedAt = new Date().toISOString();
    const nextStatus = pairingRecord.status === 'connected' ? 'updated' : 'connected';
    const existingAccountSettings = mt4StateBeforeSnapshot.accountSettingsByAccountId?.[accountId] || {};
    const connectionRecord = {
      discordUserId: pairingRecord.discordUserId,
      channelId: pairingRecord.channelId,
      accountId,
      pairingCode: snapshot.pairingCode,
      accountNumber: String(snapshot.accountNumber),
      brokerServer: snapshot.brokerServer,
      eaName: snapshot.eaName,
      eaVersion: snapshot.eaVersion,
      magicNumberFilter: snapshot.magicNumberFilter,
      symbolFilter: snapshot.symbolFilter,
      accountNickname: existingAccountSettings.nickname || pairingRecord.accountNickname || `${snapshot.accountNumber} ${snapshot.brokerServer}`,
      nickname: existingAccountSettings.nickname || pairingRecord.accountNickname || `${snapshot.accountNumber} ${snapshot.brokerServer}`,
      accountRole: existingAccountSettings.accountRole || pairingRecord.accountRole || 'private',
      copyPermission: existingAccountSettings.copyPermission || pairingRecord.copyPermission || 'private',
      status: 'connected',
      lastSyncAt: receivedAt,
      connectedAt: pairingRecord.connectedAt || existingConnection?.connectedAt || receivedAt,
    };

    const latestSnapshotRecord = {
      discordUserId: pairingRecord.discordUserId,
      channelId: pairingRecord.channelId,
      accountId,
      snapshot,
      receivedAt,
    };

    const priorTracking = mt4StateBeforeSnapshot.signalTrackingByAccountId?.[accountId] || null;
    const signalSummary = await this.processTradeSignals({
      connectionRecord,
      latestSnapshotRecord,
      priorTracking,
    });

    const historyRecord = {
      discordUserId: latestSnapshotRecord.discordUserId,
      channelId: latestSnapshotRecord.channelId,
      accountId,
      snapshot: compactHistorySnapshot(snapshot),
      receivedAt,
      pairingCode: snapshot.pairingCode,
      copySignalsOpened: signalSummary.opened,
      copySignalsClosed: signalSummary.closed,
      signalSkipped: signalSummary.skipped,
      signalSkipReason: signalSummary.reason,
    };

    const historyIntervalMs = Math.max(5000, Number(process.env.WISDO_MT4_HISTORY_INTERVAL_MS || 15000));
    const lastHistoryAt = Number(this.lastHistoryAtByAccount.get(accountId) || 0);
    const shouldAppendHistory = nextStatus === 'connected'
      || signalSummary.opened > 0
      || signalSummary.closed > 0
      || Date.now() - lastHistoryAt >= historyIntervalMs;

    // One short authoritative transaction persists pairing, connection, latest snapshot,
    // signal tracking and bounded history. v6.0.6 used up to three transactions per beat.
    await this.repository.updateMt4State((state) => {
      state.pairingCodes ||= {};
      state.connectionsByAccountId ||= {};
      state.latestSnapshotsByAccountId ||= {};
      state.activeAccountByUserId ||= {};
      state.accountSettingsByAccountId ||= {};
      state.signalTrackingByAccountId ||= {};
      state.pairingCodes[snapshot.pairingCode] = {
        ...pairingRecord,
        status: 'connected',
        connectedAt: pairingRecord.connectedAt || receivedAt,
        accountNumber: String(snapshot.accountNumber),
        accountId,
      };
      state.connectionsByAccountId[accountId] = {
        ...(state.connectionsByAccountId[accountId] || {}),
        ...connectionRecord,
      };
      state.latestSnapshotsByAccountId[accountId] = latestSnapshotRecord;
      state.accountSettingsByAccountId[accountId] = {
        ...(state.accountSettingsByAccountId[accountId] || {}),
        nickname: state.accountSettingsByAccountId[accountId]?.nickname || connectionRecord.nickname,
        accountRole: state.accountSettingsByAccountId[accountId]?.accountRole || connectionRecord.accountRole,
        copyPermission: state.accountSettingsByAccountId[accountId]?.copyPermission || connectionRecord.copyPermission,
        visibility: state.accountSettingsByAccountId[accountId]?.visibility || 'private',
        copyRisk: state.accountSettingsByAccountId[accountId]?.copyRisk || { enabled: false, mode: 'fixed_lot', fixedLot: 0.01, maxLot: 0.05, multiplier: 1, maxOpenTrades: 5, copyBuys: true, copySells: true, copySLTP: true },
      };
      if (signalSummary.tracking) state.signalTrackingByAccountId[accountId] = signalSummary.tracking;
      if (!state.activeAccountByUserId[pairingRecord.discordUserId]) {
        state.activeAccountByUserId[pairingRecord.discordUserId] = accountId;
      }
      if (state.activeAccountByUserId[pairingRecord.discordUserId] === accountId || !state.connections?.[pairingRecord.discordUserId]) {
        state.connections ||= {};
        state.latestSnapshots ||= {};
        state.connections[pairingRecord.discordUserId] = connectionRecord;
        state.latestSnapshots[pairingRecord.discordUserId] = latestSnapshotRecord;
      }
      if (shouldAppendHistory) state.snapshotHistory = appendBoundedHistory(state.snapshotHistory, historyRecord);
      return state;
    });
    if (shouldAppendHistory) {
      this.lastHistoryAtByAccount.set(accountId, Date.now());
      while (this.lastHistoryAtByAccount.size > 1500) this.lastHistoryAtByAccount.delete(this.lastHistoryAtByAccount.keys().next().value);
    }
    this.cachePairingRecord({
      ...pairingRecord,
      status: 'connected',
      connectedAt: pairingRecord.connectedAt || receivedAt,
      accountNumber: String(snapshot.accountNumber),
      accountId,
    });

    // Route reconciliation and AI/product ledgers are important but must never hold the
    // MT4 HTTP response open. They run immediately after the authoritative heartbeat.
    const priorPreparation = this.routePreparationByAccount.get(accountId);
    const prepareDue = !priorPreparation || Date.now() - Number(priorPreparation.preparedAt || 0) >= 60000;
    if (prepareDue && this.productEventSink?.prepareSnapshot) {
      const record = { preparedAt: Date.now(), promise: null };
      record.promise = (async () => this.productEventSink.prepareSnapshot({ connectionRecord, latestSnapshotRecord }))()
        .catch((error) => {
          this.routePreparationByAccount.delete(accountId);
          logger.warn('WISDO product relay preparation failed after MT4 sync.', {
            discordUserId: pairingRecord.discordUserId,
            accountId,
            message: error.message,
          });
        });
      this.routePreparationByAccount.set(accountId, record);
      while (this.routePreparationByAccount.size > 1000) this.routePreparationByAccount.delete(this.routePreparationByAccount.keys().next().value);
    }

    setImmediate(() => {
      if (this.wisdoMemoryService?.updateFromSnapshot) {
        this.wisdoMemoryService.updateFromSnapshot({ connectionRecord, latestSnapshotRecord }).catch((error) => {
          logger.warn('WISDO memory update failed after MT4 sync.', {
            discordUserId: pairingRecord.discordUserId,
            accountId,
            message: error.message,
          });
        });
      }
      if (this.productEventSink?.ingestSnapshot) {
        this.productEventSink.ingestSnapshot({ connectionRecord, latestSnapshotRecord, signalSummary }).catch((error) => {
          logger.warn('WISDO product ledger update failed after MT4 sync.', {
            discordUserId: pairingRecord.discordUserId,
            accountId,
            message: error.message,
          });
        });
      }
    });

    logger.info('MT4 snapshot received', {
      discordUserId: pairingRecord.discordUserId,
      accountId,
      accountNumber: maskValue(snapshot.accountNumber, 2, 2),
      openTradeCount: snapshot.openTradeCount,
      status: nextStatus,
      copySignalsOpened: signalSummary.opened,
      copySignalsClosed: signalSummary.closed,
      signalSkipped: signalSummary.skipped,
      signalSkipReason: signalSummary.reason,
    });

    return {
      ok: true,
      status: nextStatus,
      message: 'Snapshot received',
      discordUserId: pairingRecord.discordUserId,
      accountId,
      copySignalsOpened: signalSummary.opened,
      copySignalsClosed: signalSummary.closed,
      signalSkipped: signalSummary.skipped,
      signalSkipReason: signalSummary.reason,
      authMode: auth?.mode || 'unknown',
    };
  }

async resetUserAccount(discordUserId) {
  const userId = String(discordUserId || '').trim();

  if (!userId) {
    throw new Mt4SyncError(400, 'Discord user ID is required');
  }

  const resetAt = new Date().toISOString();

  const summary = {
    discordUserId: userId,
    connectionCleared: false,
    latestSnapshotCleared: false,
    pairingCodesExpired: 0,
    snapshotHistoryRemoved: 0,
    resetAt,
  };

  await this.repository.updateMt4State((state) => {
    if (!state.pairingCodes) state.pairingCodes = {};
    if (!state.connections) state.connections = {};
    if (!state.latestSnapshots) state.latestSnapshots = {};
    if (!state.signalTrackingByAccountId) state.signalTrackingByAccountId = {};
    if (!Array.isArray(state.snapshotHistory)) state.snapshotHistory = [];

    for (const pairing of Object.values(state.pairingCodes)) {
      if (String(pairing.discordUserId) === userId) {
        pairing.status = 'expired';
        pairing.accountNumber = null;
        pairing.connectedAt = null;
        pairing.expiredAt = resetAt;
        summary.pairingCodesExpired += 1;
      }
    }

    if (state.connections[userId]) {
      delete state.connections[userId];
      summary.connectionCleared = true;
    }

    if (state.latestSnapshots[userId]) {
      delete state.latestSnapshots[userId];
      summary.latestSnapshotCleared = true;
    }

    for (const [accountId, connection] of Object.entries(state.connectionsByAccountId || {})) {
      if (String(connection?.discordUserId) === userId) delete state.signalTrackingByAccountId[accountId];
    }

    const beforeHistory = state.snapshotHistory.length;

    state.snapshotHistory = state.snapshotHistory.filter((record) => {
      return String(record.discordUserId) !== userId;
    });

    summary.snapshotHistoryRemoved = beforeHistory - state.snapshotHistory.length;

    return state;
  });

  logger.info('MT4 user account reset completed.', summary);

  return summary;
}
  buildConnectInstructions(pairingRecord) {
    const publicBaseUrl = this.getPublicBaseUrl();
    const syncUrl = this.getSyncUrl();
    const publicUrlNotice = this.isPublicBaseUrlReady()
      ? ''
      : '\nAdmin note: PUBLIC_BASE_URL is still using a placeholder/local value, so MT4 cannot reach this API from a remote terminal until that is updated.\n';
    const pairingNotice = pairingRecord.reused
      ? 'This pairing code was already active for your desk, so the bot kept the same code to avoid reconnect confusion.\n'
      : '';
    const apiKeyStep = this.requiresApiKey()
      ? '7. Paste the MT4 sync API key into the Reporter EA ApiKey input.'
      : null;
    const webRequestStepNumber = this.requiresApiKey() ? 8 : 7;
    const allowWebRequestStepNumber = this.requiresApiKey() ? 9 : 8;
    const baseUrlStepNumber = this.requiresApiKey() ? 10 : 9;
    const autoTradingStepNumber = this.requiresApiKey() ? 11 : 10;
    const statusStepNumber = this.requiresApiKey() ? 12 : 11;

    return [
      'Your MT4 pairing code is:',
      '',
      pairingRecord.pairingCode,
      '',
      pairingNotice,
      'Student setup:',
      '',
      '1. Open MT4.',
      '2. Compile the attached CultureCoin_MT4_Reporter.mq4 in MetaEditor and install the resulting v1.58 EX4 into MQL4 -> Experts.',
      '3. Remove the older Reporter from the follower chart, then restart MT4 or refresh Navigator.',
      '4. Attach the newly compiled CultureCoin_MT4_Reporter v1.58 to any chart.',
      '5. Paste this pairing code into the PairingCode input.',
      `6. Set SyncUrl to: ${syncUrl}`,
      apiKeyStep,
      `${webRequestStepNumber}. In MT4 go to Tools -> Options -> Expert Advisors.`,
      `${allowWebRequestStepNumber}. Check "Allow WebRequest for listed URL."`,
      `${baseUrlStepNumber}. Add this base URL: ${publicBaseUrl}`,
      `${autoTradingStepNumber}. Make sure AutoTrading is ON.`,
      `${statusStepNumber}. Run /mt4-status in Discord.`,
      '',
      'You do not need to run Node.',
      'You do not need to touch code.',
      'You do not need to change your main EA.',
      publicUrlNotice,
      pairingRecord.expiresAt ? `This repair/add-account code expires at: ${new Date(pairingRecord.expiresAt).toLocaleString('en-US')}` : 'This signed pairing code can recover after server refresh. Once MT4 claims it, the account is locked to that code. Generate a new code only for repair or another terminal.',
    ]
      .filter(Boolean)
      .join('\n');
  }
}
