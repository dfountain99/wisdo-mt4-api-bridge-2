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
    this.productEventSink = null;
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
      this.config?.api?.mt4SyncApiKey ||
      this.config?.discordToken ||
      this.config?.clientId ||
      process.env.MT4_PAIRING_SIGNING_SECRET ||
      process.env.DISCORD_TOKEN ||
      'culturecoin-local-dev'
    );
  }

  signPairingPayload(discordUserId, nonce) {
    const payload = `${String(discordUserId || '').trim()}:${String(nonce || '').trim()}`;
    return createHmac('sha256', this.getPairingSecret()).update(payload).digest('hex').slice(0, 8).toUpperCase();
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
    const expected = this.signPairingPayload(discordUserId, nonce);
    if (String(signature).toUpperCase() !== expected) return null;
    return { discordUserId, nonce, signature: expected };
  }

  async getOrRecoverPairingCode(pairingCode, defaults = {}) {
    const code = String(pairingCode || '').trim();
    if (!code) return null;

    const existing = await this.repository.getPairingCode(code);
    if (existing) return existing;

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

    await this.repository.updateMt4State((state) => {
      state.pairingCodes ||= {};
      state.pairingCodes[code] = recoveredRecord;
      return state;
    });

    logger.warn('Recovered signed MT4 pairing code after server restart.', {
      pairingCode: maskValue(code),
      discordUserId: signed.discordUserId,
    });

    return recoveredRecord;
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

    return this.repository.getPairingCode(pairingCode);
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

  async processTradeSignals({ connectionRecord, latestSnapshotRecord }) {
    if (!this.tradeSignalService) {
      return { opened: 0, closed: 0, skipped: true, reason: 'tradeSignalService not attached' };
    }

    const snapshot = latestSnapshotRecord?.snapshot || {};
    const accountId = connectionRecord.accountId;
    const openTrades = Array.isArray(snapshot.openTrades) ? snapshot.openTrades : [];
    const eligible = this.isSignalEligibleAccount(connectionRecord);

    if (!eligible) {
      return { opened: 0, closed: 0, skipped: true, reason: `account role ${connectionRecord.accountRole || 'private'} is not signal eligible` };
    }

    let opened = 0;
    let closed = 0;
    const nowOpenKeys = openTrades.map((trade) => this.getTradeSignalKey(accountId, trade));

    await this.repository.updateMt4State(async (state) => {
      state.signalTrackingByAccountId ||= {};
      const tracking = state.signalTrackingByAccountId[accountId] || { openKeys: [], tradeKeyToSignalId: {} };
      const previousKeys = Array.isArray(tracking.openKeys) ? tracking.openKeys : [];
      const previousSet = new Set(previousKeys);
      const nowSet = new Set(nowOpenKeys);

      for (let i = 0; i < openTrades.length; i += 1) {
        const trade = openTrades[i];
        const key = nowOpenKeys[i];
        if (!key || previousSet.has(key)) continue;

        try {
          const signal = await this.tradeSignalService.createSignal({
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
          if (signal?.signalId) {
            tracking.tradeKeyToSignalId ||= {};
            tracking.tradeKeyToSignalId[key] = signal.signalId;
            opened += 1;
          }
        } catch (error) {
          logger.warn('Trade signal creation failed during MT4 sync.', {
            accountId,
            ticket: trade?.ticket,
            message: error.message,
          });
        }
      }

      for (const oldKey of previousKeys) {
        if (!nowSet.has(oldKey)) {
          closed += 1;
          const signalId = tracking.tradeKeyToSignalId?.[oldKey] || null;
          const [, sourceTicket = ''] = String(oldKey).split('|');
          const closedSymbol = String(oldKey).split('|')[3] || '';
          const closedSide = String(oldKey).split('|')[4] || '';
          if (this.tradeSignalService?.queueAutoCopyCloseRoutes && sourceTicket) {
            try {
              await this.tradeSignalService.queueAutoCopyCloseRoutes({
                signalId,
                leaderAccountId: accountId,
                sourceTicket,
                symbol: closedSymbol,
                side: closedSide,
              });
            } catch (error) {
              logger.warn('Culture Lane close command creation failed during MT4 sync.', {
                accountId,
                sourceTicket,
                message: error.message,
              });
            }
          }
          if (this.copyTradingService && sourceTicket) {
            try {
              await this.copyTradingService.queueMasterSignal({
                masterUserId: connectionRecord.discordUserId,
                masterAccountNumber: connectionRecord.accountNumber,
                sourceTicket,
                symbol: closedSymbol,
                side: closedSide,
                lots: 0.01,
                action: 'close',
                signalId,
              });
            } catch (error) {
              logger.warn('Copy close command creation failed during MT4 sync.', {
                accountId,
                sourceTicket,
                message: error.message,
              });
            }
          }
        }
      }

      state.signalTrackingByAccountId[accountId] = {
        ...tracking,
        openKeys: nowOpenKeys,
        updatedAt: new Date().toISOString(),
      };

      return state;
    });

    return { opened, closed, skipped: false, reason: null };
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
    if (!this.config.api.mt4SyncApiKey) {
      return;
    }

    const headerValue = normalizeHeaderValue(headers, 'x-culturecoin-apikey');

    if (String(headerValue || '').trim() !== this.config.api.mt4SyncApiKey) {
      throw new Mt4SyncError(401, 'Invalid API key');
    }
  }

  checkRateLimit(key) {
    const now = Date.now();

    for (const [entryKey, timestamp] of this.requestTimestamps.entries()) {
      if (now - timestamp > 60_000) {
        this.requestTimestamps.delete(entryKey);
      }
    }

    const previous = this.requestTimestamps.get(key);

    if (previous && now - previous < 1000) {
      throw new Mt4SyncError(429, 'Too many MT4 sync requests');
    }

    this.requestTimestamps.set(key, now);
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
    this.validateApiKey(headers);

    const snapshot = this.normalizeSnapshotPayload(payload);
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

    this.checkRateLimit(`${snapshot.pairingCode}:${snapshot.accountNumber}`);

    const existingConnection = await this.getConnection(pairingRecord.discordUserId);
    const lockedAccountNumber = pairingRecord.accountNumber;

    // Pairing codes are account-locked after first successful sync. The same Discord user
    // may own multiple MT4 accounts, but every account must use its own pairing code.
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
    const accountId = this.repository.getMt4AccountId
      ? this.repository.getMt4AccountId(snapshot.accountNumber, snapshot.brokerServer)
      : `${snapshot.accountNumber}:${snapshot.brokerServer}`;
    const mt4StateBeforeSnapshot = await this.repository.getMt4State?.();
    const existingAccountSettings = mt4StateBeforeSnapshot?.accountSettingsByAccountId?.[accountId] || {};
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

    if (this.productEventSink?.prepareSnapshot) {
      await this.productEventSink.prepareSnapshot({ connectionRecord, latestSnapshotRecord }).catch((error) => {
        logger.warn('WISDO product relay preparation failed before MT4 signal processing.', {
          discordUserId: pairingRecord.discordUserId,
          accountId,
          message: error.message,
        });
      });
    }

    const signalSummary = await this.processTradeSignals({ connectionRecord, latestSnapshotRecord });

    const historyRecord = {
      ...latestSnapshotRecord,
      pairingCode: snapshot.pairingCode,
      accountId,
      copySignalsOpened: signalSummary.opened,
      copySignalsClosed: signalSummary.closed,
      signalSkipped: signalSummary.skipped,
      signalSkipReason: signalSummary.reason,
    };

    await this.repository.updateMt4State((state) => {
      state.pairingCodes[snapshot.pairingCode] = {
        ...pairingRecord,
        status: 'connected',
        connectedAt: pairingRecord.connectedAt || receivedAt,
        accountNumber: String(snapshot.accountNumber),
        accountId,
      };
      state.connectionsByAccountId ||= {};
      state.latestSnapshotsByAccountId ||= {};
      state.activeAccountByUserId ||= {};
      state.accountSettingsByAccountId ||= {};
      state.connectionsByAccountId[accountId] = connectionRecord;
      state.latestSnapshotsByAccountId[accountId] = latestSnapshotRecord;
      state.accountSettingsByAccountId[accountId] = {
        ...(state.accountSettingsByAccountId[accountId] || {}),
        nickname: state.accountSettingsByAccountId[accountId]?.nickname || connectionRecord.nickname,
        accountRole: state.accountSettingsByAccountId[accountId]?.accountRole || connectionRecord.accountRole,
        copyPermission: state.accountSettingsByAccountId[accountId]?.copyPermission || connectionRecord.copyPermission,
        visibility: state.accountSettingsByAccountId[accountId]?.visibility || 'private',
        copyRisk: state.accountSettingsByAccountId[accountId]?.copyRisk || { enabled: false, mode: 'fixed_lot', fixedLot: 0.01, maxLot: 0.05, multiplier: 1, maxOpenTrades: 5, copyBuys: true, copySells: true, copySLTP: true },
      };
      if (!state.activeAccountByUserId[pairingRecord.discordUserId]) {
        state.activeAccountByUserId[pairingRecord.discordUserId] = accountId;
      }
      if (state.activeAccountByUserId[pairingRecord.discordUserId] === accountId || !state.connections[pairingRecord.discordUserId]) {
        state.connections[pairingRecord.discordUserId] = connectionRecord;
        state.latestSnapshots[pairingRecord.discordUserId] = latestSnapshotRecord;
      }
      state.snapshotHistory = [historyRecord, ...state.snapshotHistory].filter((record, index, array) => {
        if (index >= 1000) {
          return false;
        }

        const userHistory = array
          .slice(0, index + 1)
          .filter((item) => item.discordUserId === record.discordUserId);

        return userHistory.length <= 250;
      });
      return state;
    });

    if (this.wisdoMemoryService?.updateFromSnapshot) {
      await this.wisdoMemoryService.updateFromSnapshot({ connectionRecord, latestSnapshotRecord }).catch((error) => {
        logger.warn('WISDO memory update failed after MT4 sync.', {
          discordUserId: pairingRecord.discordUserId,
          accountId,
          message: error.message,
        });
      });
    }

    if (this.productEventSink?.ingestSnapshot) {
      await this.productEventSink.ingestSnapshot({ connectionRecord, latestSnapshotRecord, signalSummary }).catch((error) => {
        logger.warn('WISDO product ledger update failed after MT4 sync.', {
          discordUserId: pairingRecord.discordUserId,
          accountId,
          message: error.message,
        });
      });
    }

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
      '2. Compile the attached CultureCoin_MT4_Reporter.mq4 in MetaEditor and install the resulting v1.56 EX4 into MQL4 -> Experts.',
      '3. Remove the older Reporter from the follower chart, then restart MT4 or refresh Navigator.',
      '4. Attach the newly compiled CultureCoin_MT4_Reporter v1.56 to any chart.',
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
