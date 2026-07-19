import { randomUUID } from 'node:crypto';
import { createDatabaseStateStore } from './stateStore.js';

function profileState() {
  return { profiles: {} };
}

function deskState() {
  return { desks: {} };
}

function logState() {
  return { logs: [] };
}

const MT4_HISTORY_GLOBAL_LIMIT = Math.max(50, Number(process.env.WISDO_MT4_HISTORY_GLOBAL_LIMIT || 500));
const MT4_HISTORY_ACCOUNT_LIMIT = Math.max(10, Number(process.env.WISDO_MT4_HISTORY_ACCOUNT_LIMIT || 100));
const MT4_SIGNAL_TRACKING_ACCOUNT_LIMIT = Math.max(10, Number(process.env.WISDO_MT4_SIGNAL_TRACKING_ACCOUNT_LIMIT || 250));

function compactSnapshotForHistory(snapshot = {}) {
  return {
    accountNumber: String(snapshot.accountNumber || ''),
    accountName: String(snapshot.accountName || ''),
    brokerServer: String(snapshot.brokerServer || ''),
    isDemo: Boolean(snapshot.isDemo),
    eaName: String(snapshot.eaName || ''),
    eaVersion: String(snapshot.eaVersion || ''),
    balance: Number(snapshot.balance || 0),
    equity: Number(snapshot.equity || 0),
    margin: Number(snapshot.margin || 0),
    freeMargin: Number(snapshot.freeMargin || 0),
    marginLevel: Number(snapshot.marginLevel || 0),
    floatingPL: Number(snapshot.floatingPL || 0),
    dailyClosedPL: Number(snapshot.dailyClosedPL || 0),
    openTradeCount: Number(snapshot.openTradeCount || 0),
    buyTradeCount: Number(snapshot.buyTradeCount || 0),
    sellTradeCount: Number(snapshot.sellTradeCount || 0),
    totalLots: Number(snapshot.totalLots || 0),
    symbols: Array.isArray(snapshot.symbols) ? snapshot.symbols.slice(0, 50).map(String) : [],
    timestamp: snapshot.timestamp || null,
    terminalConnected: snapshot.terminalConnected !== false,
    expertEnabled: snapshot.expertEnabled !== false,
  };
}

function compactSnapshotHistoryRecord(record = {}) {
  return {
    discordUserId: String(record.discordUserId || ''),
    channelId: String(record.channelId || ''),
    accountId: String(record.accountId || ''),
    pairingCode: String(record.pairingCode || ''),
    receivedAt: record.receivedAt || new Date().toISOString(),
    copySignalsOpened: Number(record.copySignalsOpened || 0),
    copySignalsClosed: Number(record.copySignalsClosed || 0),
    signalSkipped: Boolean(record.signalSkipped),
    signalSkipReason: record.signalSkipReason || null,
    snapshot: compactSnapshotForHistory(record.snapshot || {}),
  };
}

function trimSnapshotHistory(history = []) {
  const perAccount = new Map();
  const result = [];
  for (const raw of Array.isArray(history) ? history : []) {
    if (result.length >= MT4_HISTORY_GLOBAL_LIMIT) break;
    const record = compactSnapshotHistoryRecord(raw);
    const key = record.accountId || `user:${record.discordUserId}`;
    const count = perAccount.get(key) || 0;
    if (count >= MT4_HISTORY_ACCOUNT_LIMIT) continue;
    perAccount.set(key, count + 1);
    result.push(record);
  }
  return result;
}

function normalizeSignalTracking(input = {}) {
  const rows = Object.entries(input && typeof input === 'object' ? input : {})
    .sort(([, left], [, right]) => new Date(right?.updatedAt || 0) - new Date(left?.updatedAt || 0))
    .slice(0, MT4_SIGNAL_TRACKING_ACCOUNT_LIMIT);
  const result = {};
  for (const [accountId, raw] of rows) {
    const openKeys = Array.isArray(raw?.openKeys) ? raw.openKeys.map(String).filter(Boolean).slice(0, 1000) : [];
    const map = raw?.tradeKeyToSignalId && typeof raw.tradeKeyToSignalId === 'object' ? raw.tradeKeyToSignalId : {};
    result[accountId] = {
      openKeys,
      tradeKeyToSignalId: Object.fromEntries(openKeys.filter((key) => map[key]).map((key) => [key, String(map[key])])),
      updatedAt: raw?.updatedAt || null,
    };
  }
  return result;
}

function mt4State() {
  return {
    pairingCodes: {},
    connections: {},
    connectionsByAccountId: {},
    activeAccountByUserId: {},
    accountSettingsByAccountId: {},
    accountSharesById: {},
    accountAccessRequestsById: {},
    brokerLinkRequestsById: {},
    copyRoutesById: {},
    tradeLinksById: {},
    copyLinksById: {},
    latestSnapshots: {},
    latestSnapshotsByAccountId: {},
    signalTrackingByAccountId: {},
    snapshotHistory: [],
  };
}

function commerceState() {
  return {
    bots: {},
    quotes: {},
    orders: {},
    licenses: {},
    welcomes: {},
  };
}

function normalizeMt4State(state) {
  const connectionsByAccountId = state?.connectionsByAccountId || {};
  const latestSnapshotsByAccountId = state?.latestSnapshotsByAccountId || {};

  // Backward compatibility: older builds stored one connection/snapshot per user.
  for (const [discordUserId, connection] of Object.entries(state?.connections || {})) {
    if (!connection?.accountNumber) continue;
    const accountId = connection.accountId || buildMt4AccountId(connection.accountNumber, connection.brokerServer || connection.server || '');
    connectionsByAccountId[accountId] ||= { ...connection, accountId, discordUserId };
  }

  for (const [discordUserId, snapshot] of Object.entries(state?.latestSnapshots || {})) {
    const snap = snapshot?.snapshot || snapshot;
    if (!snap?.accountNumber) continue;
    const accountId = snapshot.accountId || buildMt4AccountId(snap.accountNumber, snap.brokerServer || snap.server || '');
    latestSnapshotsByAccountId[accountId] ||= { ...snapshot, accountId, discordUserId };
  }

  return {
    pairingCodes: state?.pairingCodes || {},
    connections: state?.connections || {},
    connectionsByAccountId,
    activeAccountByUserId: state?.activeAccountByUserId || {},
    accountSettingsByAccountId: state?.accountSettingsByAccountId || {},
    accountSharesById: state?.accountSharesById || {},
    accountAccessRequestsById: state?.accountAccessRequestsById || {},
    brokerLinkRequestsById: state?.brokerLinkRequestsById || {},
    copyRoutesById: state?.copyRoutesById || {},
    tradeLinksById: state?.tradeLinksById || {},
    copyLinksById: state?.copyLinksById || {},
    latestSnapshots: state?.latestSnapshots || {},
    latestSnapshotsByAccountId,
    signalTrackingByAccountId: normalizeSignalTracking(state?.signalTrackingByAccountId || {}),
    snapshotHistory: trimSnapshotHistory(state?.snapshotHistory || []),
  };
}

function buildMt4AccountId(accountNumber, brokerServer = '') {
  const acct = String(accountNumber || '').trim();
  const server = String(brokerServer || '').trim() || 'server';
  return `${acct}:${server}`.replace(/[^a-zA-Z0-9:_.-]/g, '_');
}


function normalizePermission(value = 'view_only') {
  const normalized = String(value || 'view_only').trim().toLowerCase();
  const allowed = ['view_only', 'signal_only', 'copy_allowed', 'control_allowed', 'admin'];
  return allowed.includes(normalized) ? normalized : 'view_only';
}

function normalizeCopyRisk(input = {}, previous = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const prev = previous && typeof previous === 'object' ? previous : {};
  const next = {
    enabled: src.enabled !== undefined ? Boolean(src.enabled) : Boolean(prev.enabled ?? false),
    mode: String(src.mode || prev.mode || 'fixed_lot'),
    fixedLot: Number(src.fixedLot ?? src.targetFixedLot ?? src.followerFixedLot ?? prev.fixedLot ?? 0.01),
    multiplier: Number(src.multiplier ?? src.riskSetting ?? prev.multiplier ?? 1),
    riskSettingPercent: Number(src.riskSettingPercent ?? prev.riskSettingPercent ?? ((Number(src.multiplier ?? prev.multiplier ?? 1)) * 100)),
    riskPercent: Number(src.riskPercent ?? src.targetRiskPercent ?? src.followerRiskPercent ?? prev.riskPercent ?? 1),
    masterRiskPercent: Number(src.masterRiskPercent ?? src.sourceRiskPercent ?? prev.masterRiskPercent ?? 1),
    targetRiskPercent: Number(src.targetRiskPercent ?? src.followerRiskPercent ?? src.riskPercent ?? prev.targetRiskPercent ?? prev.riskPercent ?? 1),
    masterFixedLot: Number(src.masterFixedLot ?? src.sourceFixedLot ?? prev.masterFixedLot ?? 0),
    targetFixedLot: Number(src.targetFixedLot ?? src.followerFixedLot ?? src.fixedLot ?? prev.targetFixedLot ?? prev.fixedLot ?? 0.01),
    maxLot: Number(src.maxLot ?? prev.maxLot ?? 0.05),
    maxOpenTrades: Number(src.maxOpenTrades ?? prev.maxOpenTrades ?? 5),
    maxDailyLossPercent: Number(src.maxDailyLossPercent ?? prev.maxDailyLossPercent ?? 0),
    maxDrawdownPercent: Number(src.maxDrawdownPercent ?? prev.maxDrawdownPercent ?? 0),
    allowedSymbols: Array.isArray(src.allowedSymbols) ? src.allowedSymbols.map(String).filter(Boolean) : (Array.isArray(prev.allowedSymbols) ? prev.allowedSymbols : []),
    symbolMapping: src.symbolMapping && typeof src.symbolMapping === 'object' ? { ...src.symbolMapping } : (prev.symbolMapping && typeof prev.symbolMapping === 'object' ? { ...prev.symbolMapping } : {}),
    blockedSymbols: Array.isArray(src.blockedSymbols) ? src.blockedSymbols.map(String).filter(Boolean) : (Array.isArray(prev.blockedSymbols) ? prev.blockedSymbols : []),
    copyBuys: src.copyBuys !== undefined ? Boolean(src.copyBuys) : Boolean(prev.copyBuys ?? true),
    copySells: src.copySells !== undefined ? Boolean(src.copySells) : Boolean(prev.copySells ?? true),
    copySLTP: src.copySLTP !== undefined ? Boolean(src.copySLTP) : Boolean(prev.copySLTP ?? false),
    copyPendingOrders: src.copyPendingOrders !== undefined ? Boolean(src.copyPendingOrders) : Boolean(prev.copyPendingOrders ?? false),
    reverseCopy: src.reverseCopy !== undefined ? Boolean(src.reverseCopy) : Boolean(prev.reverseCopy ?? false),
    copierPaused: src.copierPaused !== undefined ? Boolean(src.copierPaused) : Boolean(prev.copierPaused ?? false),
    equityFloor: Number(src.equityFloor ?? prev.equityFloor ?? 0),
  };
  if (!Number.isFinite(next.fixedLot) || next.fixedLot <= 0) next.fixedLot = 0.01;
  if (!Number.isFinite(next.targetFixedLot) || next.targetFixedLot <= 0) next.targetFixedLot = next.fixedLot;
  if (!Number.isFinite(next.multiplier) || next.multiplier <= 0) next.multiplier = 1;
  if (!Number.isFinite(next.riskSettingPercent) || next.riskSettingPercent <= 0) next.riskSettingPercent = next.multiplier * 100;
  if (!Number.isFinite(next.riskPercent) || next.riskPercent <= 0) next.riskPercent = 1;
  if (!Number.isFinite(next.maxLot) || next.maxLot <= 0) next.maxLot = 0.05;
  if (!Number.isFinite(next.maxOpenTrades) || next.maxOpenTrades < 1) next.maxOpenTrades = 5;
  if (!['fixed_lot', 'multiplier', 'same_lot', 'equity_ratio', 'balance_ratio', 'risk_percent'].includes(next.mode)) next.mode = 'fixed_lot';
  return next;
}

function normalizeCommerceState(state) {
  return {
    bots: state?.bots || {},
    quotes: state?.quotes || {},
    orders: state?.orders || {},
    licenses: state?.licenses || {},
    welcomes: state?.welcomes || {},
  };
}

export class OperatorDeskRepository {
  constructor(_dataDir) {
    this.profileStore = createDatabaseStateStore('profiles', profileState);
    this.deskStore = createDatabaseStateStore('desks', deskState);
    this.logStore = createDatabaseStateStore('logs', logState);
    this.mt4Store = createDatabaseStateStore('mt4', mt4State);
    this.commerceStore = createDatabaseStateStore('commerce', commerceState);
  }

  async initialize() {
    await Promise.all([
      this.profileStore.ensure(),
      this.deskStore.ensure(),
      this.logStore.ensure(),
      this.mt4Store.ensure(),
      this.commerceStore.ensure(),
    ]);
  }

  async close() {
    await Promise.all([
      this.profileStore.close?.(),
      this.deskStore.close?.(),
      this.logStore.close?.(),
      this.mt4Store.close?.(),
      this.commerceStore.close?.(),
    ]);
  }

  async getProfile(userId) {
    const state = await this.profileStore.read();
    return state.profiles?.[userId] || null;
  }

  async saveProfile(profile) {
    await this.profileStore.update((state) => ({
      profiles: {
        ...(state.profiles || {}),
        [profile.discordUserId]: profile,
      },
    }));

    return profile;
  }

  async getAllProfiles() {
    const state = await this.profileStore.read();
    return Object.values(state.profiles || {});
  }

  async getDesk(userId) {
    const state = await this.deskStore.read();
    return state.desks?.[userId] || null;
  }

  async getAllDesks() {
    const state = await this.deskStore.read();
    return Object.values(state.desks || {});
  }

  async findDeskByChannelId(channelId) {
    const desks = await this.getAllDesks();
    return desks.find((desk) => desk.channelId === channelId || desk.voiceChannelId === channelId) || null;
  }

  async saveDesk(desk) {
    await this.deskStore.update((state) => ({
      desks: {
        ...(state.desks || {}),
        [desk.discordUserId]: desk,
      },
    }));

    return desk;
  }

  async getAllLogs() {
    const state = await this.logStore.read();
    return Array.isArray(state.logs) ? state.logs : [];
  }

  async addLog(log) {
    await this.logStore.update((state) => ({
      logs: [...(Array.isArray(state.logs) ? state.logs : []), log],
    }));

    return log;
  }

  async upsertLog(matchFn, nextLog) {
    let replaced = false;

    await this.logStore.update((state) => {
      const logs = Array.isArray(state.logs) ? [...state.logs] : [];
      const index = logs.findIndex(matchFn);

      if (index >= 0) {
        logs[index] = {
          ...logs[index],
          ...nextLog,
        };
        replaced = true;
      } else {
        logs.push(nextLog);
      }

      return { logs };
    });

    return {
      log: nextLog,
      replaced,
    };
  }

  async getMt4State() {
    return normalizeMt4State(await this.mt4Store.read());
  }

  async loadMt4State() {
    return this.getMt4State();
  }

  async updateMt4State(updater) {
    const next = await this.mt4Store.update(async (state) => {
      const normalized = normalizeMt4State(state);
      const updated = await updater(normalized);
      return normalizeMt4State(updated || normalized);
    });
    return normalizeMt4State(next);
  }

  async flushMt4State() {
    return this.mt4Store?.adapter?.flushBufferedWrites?.() || null;
  }

  async getPairingCode(pairingCode) {
    const state = await this.getMt4State();
    return state.pairingCodes[pairingCode] || null;
  }

  async getLatestPairingForUser(discordUserId) {
    const state = await this.getMt4State();
    return (
      Object.values(state.pairingCodes)
        .filter((record) => record.discordUserId === discordUserId)
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0] || null
    );
  }

  getMt4AccountId(accountNumber, brokerServer = '') {
    return buildMt4AccountId(accountNumber, brokerServer);
  }

  async getMt4Accounts(discordUserId) {
    const state = await this.getMt4State();
    const userId = String(discordUserId || '');
    const accounts = Object.values(state.connectionsByAccountId || {})
      .filter((connection) => String(connection.discordUserId) === userId)
      .map((connection) => this.hydrateMt4Account(state, connection, userId, { shared: false }))
      .sort((a, b) => new Date(b.lastSyncAt || b.connectedAt || 0) - new Date(a.lastSyncAt || a.connectedAt || 0));

    if (accounts.length > 0 && !accounts.some((account) => account.isPrimary)) {
      accounts[0].isPrimary = true;
    }

    return accounts;
  }

  hydrateMt4Account(state, connection, viewerUserId, share = {}) {
    const accountId = connection.accountId || buildMt4AccountId(connection.accountNumber, connection.brokerServer || connection.server || '');
    const settings = state.accountSettingsByAccountId?.[accountId] || {};
    const latestSnapshot = state.latestSnapshotsByAccountId?.[accountId] || null;
    const snap = latestSnapshot?.snapshot || {};
    return {
      ...connection,
      ...settings,
      accountId,
      latestSnapshot,
      server: connection.brokerServer || snap.brokerServer || connection.server || '',
      type: snap.isDemo ? 'Demo' : 'Live',
      balance: Number(snap.balance ?? 0),
      equity: Number(snap.equity ?? 0),
      floatingPL: Number(snap.floatingPL ?? 0),
      dailyClosedPL: Number(snap.dailyClosedPL ?? 0),
      openTrades: Number(snap.openTradeCount ?? 0),
      terminalConnected: snap.terminalConnected !== false,
      expertEnabled: snap.expertEnabled !== false,
      lastSyncAt: latestSnapshot?.receivedAt || connection.lastSyncAt || '',
      copyRisk: normalizeCopyRisk(settings.copyRisk || {}, settings.copyRisk || {}),
      shared: Boolean(share.shared),
      shareId: share.shareId || null,
      sharePermission: share.permission || null,
      ownerUserId: share.ownerUserId || connection.discordUserId,
      isPrimary: state.activeAccountByUserId?.[String(viewerUserId || '')]
        ? state.activeAccountByUserId[String(viewerUserId || '')] === accountId
        : false,
    };
  }

  async getAccessibleMt4Accounts(discordUserId) {
    const state = await this.getMt4State();
    const userId = String(discordUserId || '');
    const owned = Object.values(state.connectionsByAccountId || {})
      .filter((connection) => String(connection.discordUserId) === userId)
      .map((connection) => this.hydrateMt4Account(state, connection, userId, { shared: false }));

    const shared = Object.values(state.accountSharesById || {})
      .filter((share) => String(share.targetUserId) === userId && String(share.status || 'active') === 'active')
      .map((share) => {
        const connection = state.connectionsByAccountId?.[share.accountId];
        if (!connection) return null;
        return this.hydrateMt4Account(state, connection, userId, { ...share, shared: true });
      })
      .filter(Boolean);

    const all = [...owned, ...shared]
      .sort((a, b) => new Date(b.lastSyncAt || b.connectedAt || 0) - new Date(a.lastSyncAt || a.connectedAt || 0));

    if (all.length > 0 && !all.some((account) => account.isPrimary)) all[0].isPrimary = true;
    return all;
  }


  async getDiscoverableMt4Accounts(discordUserId, options = {}) {
    const state = await this.getMt4State();
    const viewerId = String(discordUserId || '');
    const now = Date.now();
    const maxAgeMinutes = Number(options.maxAgeMinutes || 1440);
    const existingShares = new Set(Object.values(state.accountSharesById || {})
      .filter((share) => String(share.targetUserId) === viewerId && String(share.status || 'active') === 'active')
      .map((share) => String(share.accountId)));
    return Object.values(state.connectionsByAccountId || {})
      .filter((connection) => String(connection.discordUserId) !== viewerId)
      .map((connection) => this.hydrateMt4Account(state, connection, viewerId, { shared: false }))
      .filter((account) => {
        if (existingShares.has(String(account.accountId))) return false;
        const latestMs = account.lastSyncAt ? new Date(account.lastSyncAt).getTime() : 0;
        const activeEnough = latestMs > 0 && (now - latestMs) <= maxAgeMinutes * 60 * 1000;
        const visibility = String(account.visibility || account.copyPermission || 'private').toLowerCase();
        const role = String(account.accountRole || 'private').toLowerCase();
        const canDiscover = visibility !== 'private' || ['leader', 'both'].includes(role) || ['signal_only', 'copy_allowed', 'control_allowed', 'admin'].includes(visibility);
        return activeEnough && canDiscover;
      })
      .map((account) => ({
        ...account,
        discoverable: true,
        ownerUserId: String(account.ownerUserId || account.discordUserId || ''),
        maskedAccountNumber: account.accountNumber ? `****${String(account.accountNumber).slice(-4)}` : '',
      }))
      .sort((a, b) => new Date(b.lastSyncAt || 0) - new Date(a.lastSyncAt || 0));
  }

  async createAccountAccessRequest({ requesterUserId, ownerUserId, accountId, permission = 'copy_allowed', note = '' } = {}) {
    const requestId = randomUUID();
    const now = new Date().toISOString();
    let request = null;
    await this.updateMt4State((state) => {
      const account = state.connectionsByAccountId?.[accountId];
      if (!account) return state;
      const owner = String(ownerUserId || account.discordUserId || '');
      if (!owner || String(account.discordUserId) !== owner) return state;
      if (String(requesterUserId || '') === owner) return state;
      state.accountAccessRequestsById ||= {};
      request = {
        requestId,
        requesterUserId: String(requesterUserId || ''),
        ownerUserId: owner,
        accountId: String(accountId || ''),
        permission: normalizePermission(permission),
        status: 'pending',
        note: String(note || '').slice(0, 500),
        createdAt: now,
        updatedAt: now,
      };
      state.accountAccessRequestsById[requestId] = request;
      return state;
    });
    return request;
  }

  async getAccountAccessRequestsForUser(discordUserId) {
    const state = await this.getMt4State();
    const userId = String(discordUserId || '');
    return Object.values(state.accountAccessRequestsById || {})
      .filter((request) => String(request.requesterUserId) === userId || String(request.ownerUserId) === userId)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }

  async approveAccountAccessRequest(ownerUserId, requestId) {
    const ownerId = String(ownerUserId || '');
    let approved = null;
    let share = null;
    await this.updateMt4State((state) => {
      const request = state.accountAccessRequestsById?.[requestId];
      if (!request || String(request.ownerUserId) !== ownerId || String(request.status || 'pending') !== 'pending') return state;
      const account = state.connectionsByAccountId?.[request.accountId];
      if (!account || String(account.discordUserId) !== ownerId) return state;
      const now = new Date().toISOString();
      request.status = 'approved';
      request.updatedAt = now;
      request.approvedAt = now;
      const shareId = randomUUID();
      share = {
        shareId,
        ownerUserId: ownerId,
        targetUserId: String(request.requesterUserId || ''),
        accountId: String(request.accountId || ''),
        permission: normalizePermission(request.permission || 'copy_allowed'),
        status: 'active',
        createdAt: now,
        updatedAt: now,
        sourceRequestId: requestId,
      };
      state.accountSharesById ||= {};
      state.accountSharesById[shareId] = share;
      approved = { ...request };
      return state;
    });
    return approved ? { request: approved, share } : null;
  }

  async rejectAccountAccessRequest(ownerUserId, requestId) {
    const ownerId = String(ownerUserId || '');
    let rejected = null;
    await this.updateMt4State((state) => {
      const request = state.accountAccessRequestsById?.[requestId];
      if (!request || String(request.ownerUserId) !== ownerId || String(request.status || 'pending') !== 'pending') return state;
      request.status = 'rejected';
      request.updatedAt = new Date().toISOString();
      rejected = { ...request };
      return state;
    });
    return rejected;
  }

  async createBrokerLinkRequest(discordUserId, request = {}) {
    const requestId = randomUUID();
    const now = new Date().toISOString();
    const userId = String(discordUserId || '');
    const platform = String(request.platform || 'MT4').toUpperCase();
    const brokerName = String(request.brokerName || request.broker || '').trim();
    const brokerServer = String(request.brokerServer || request.server || '').trim();
    const brokerLogin = String(request.brokerLogin || request.accountNumber || '').replace(/[^0-9]/g, '').trim();
    const desiredRole = String(request.desiredRole || request.accountRole || 'private').toLowerCase();
    const connectionMode = String(request.connectionMode || 'reporter_pairing').toLowerCase();
    const botName = String(request.botName || '').trim();
    const pairingCode = String(request.pairingCode || '').trim();
    const accountId = brokerLogin
      ? buildMt4AccountId(brokerLogin, brokerServer || brokerName || platform)
      : `pending:${requestId}`;
    let saved = null;
    await this.updateMt4State((state) => {
      state.brokerLinkRequestsById ||= {};
      state.connectionsByAccountId ||= {};
      state.accountSettingsByAccountId ||= {};
      state.pairingCodes ||= {};
      const copyPermission = desiredRole === 'leader' ? 'signal_only' : desiredRole === 'follower' ? 'copy_allowed' : desiredRole === 'both' ? 'copy_allowed' : 'private';
      const visibility = desiredRole === 'leader' || desiredRole === 'both' ? 'signal_only' : desiredRole === 'follower' ? 'private' : 'private';
      saved = {
        requestId,
        userId,
        platform,
        brokerName,
        brokerServer,
        brokerLogin,
        accountNumber: brokerLogin,
        accountId,
        accountType: String(request.accountType || 'demo').toLowerCase(),
        connectionMode,
        desiredRole,
        botName,
        note: String(request.note || '').slice(0, 500),
        status: brokerLogin ? 'live_pending_reporter' : 'pairing_required',
        pairingCode,
        createdAt: now,
        updatedAt: now,
      };
      state.brokerLinkRequestsById[requestId] = saved;

      // Live broker-link form: immediately create a pending reporter account card
      // so it appears in desk dropdowns before the MT4 Reporter completes verification.
      if (brokerLogin) {
        const previous = state.connectionsByAccountId[accountId] || {};
        state.connectionsByAccountId[accountId] = {
          ...previous,
          discordUserId: userId,
          accountId,
          pairingCode,
          accountNumber: brokerLogin,
          brokerServer,
          server: brokerServer,
          platform,
          accountNickname: String(request.nickname || botName || `${brokerName || platform} ${brokerLogin}`).trim(),
          nickname: String(request.nickname || botName || `${brokerName || platform} ${brokerLogin}`).trim(),
          accountRole: desiredRole,
          copyPermission,
          connectionMode,
          brokerName,
          botName,
          status: 'pending_reporter_pairing',
          pendingReporter: true,
          liveFormLinked: true,
          connectedAt: previous.connectedAt || null,
          createdAt: previous.createdAt || now,
          updatedAt: now,
          lastSyncAt: previous.lastSyncAt || '',
        };
        state.accountSettingsByAccountId[accountId] = {
          ...(state.accountSettingsByAccountId[accountId] || {}),
          nickname: String(request.nickname || botName || `${brokerName || platform} ${brokerLogin}`).trim(),
          accountRole: desiredRole,
          copyPermission,
          visibility,
          brokerLinkRequestId: requestId,
          connectionMode,
          copyRisk: normalizeCopyRisk(state.accountSettingsByAccountId[accountId]?.copyRisk || {
            enabled: desiredRole === 'follower' || desiredRole === 'both',
            mode: 'fixed_lot',
            fixedLot: 0.01,
            maxLot: 0.05,
            multiplier: 1,
            maxOpenTrades: 5,
            copyBuys: true,
            copySells: true,
            copySLTP: false,
            copyPendingOrders: false,
          }, state.accountSettingsByAccountId[accountId]?.copyRisk || {}),
          updatedAt: now,
        };
        if (pairingCode && state.pairingCodes[pairingCode]) {
          state.pairingCodes[pairingCode] = {
            ...state.pairingCodes[pairingCode],
            accountId,
            accountNumber: brokerLogin,
            brokerServer,
            brokerLinkRequestId: requestId,
            accountNickname: state.connectionsByAccountId[accountId].nickname,
            accountRole: desiredRole,
            copyPermission,
          };
        }
        state.activeAccountByUserId ||= {};
        state.activeAccountByUserId[userId] ||= accountId;
      }
      return state;
    });
    return saved;
  }

  async cancelBrokerLinkRequest(discordUserId, requestId) {
    const userId = String(discordUserId || '');
    let cancelled = null;
    await this.updateMt4State((state) => {
      const request = state.brokerLinkRequestsById?.[requestId];
      if (!request || String(request.userId) !== userId) return state;
      request.status = 'cancelled';
      request.updatedAt = new Date().toISOString();
      cancelled = { ...request };
      if (request.accountId && state.connectionsByAccountId?.[request.accountId]?.pendingReporter) {
        delete state.connectionsByAccountId[request.accountId];
        delete state.accountSettingsByAccountId?.[request.accountId];
      }
      return state;
    });
    return cancelled;
  }

  async getBrokerLinkRequestsForUser(discordUserId) {
    const state = await this.getMt4State();
    const userId = String(discordUserId || '');
    return Object.values(state.brokerLinkRequestsById || {})
      .filter((request) => String(request.userId) === userId)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }


  async saveTradeLink(link = {}) {
    const now = new Date().toISOString();
    const userId = String(link.userId || link.discordUserId || '');
    const accountNumber = String(link.accountNumber || '').replace(/[^0-9]/g, '').trim();
    const brokerServer = String(link.brokerServer || link.server || '').trim();
    const pairingCode = String(link.pairingCode || '').trim();
    const accountId = accountNumber ? buildMt4AccountId(accountNumber, brokerServer || link.broker || link.platform || 'server') : `pending:${link.linkId || randomUUID()}`;
    const saved = {
      ...link,
      linkId: String(link.linkId || randomUUID()),
      userId,
      discordUserId: userId,
      accountId,
      accountNumber,
      brokerServer,
      server: brokerServer,
      pairingCode,
      status: String(link.status || 'PENDING').toUpperCase(),
      createdAt: link.createdAt || now,
      updatedAt: now,
    };
    await this.updateMt4State((state) => {
      state.tradeLinksById ||= {};
      state.connectionsByAccountId ||= {};
      state.accountSettingsByAccountId ||= {};
      state.pairingCodes ||= {};
      state.tradeLinksById[saved.linkId] = saved;
      if (accountNumber) {
        state.connectionsByAccountId[accountId] = {
          ...(state.connectionsByAccountId[accountId] || {}),
          discordUserId: userId,
          accountId,
          pairingCode,
          accountNumber,
          brokerServer,
          server: brokerServer,
          platform: String(link.platform || 'MT4').toUpperCase(),
          accountNickname: String(link.nickname || `${link.platform || 'MT4'} ${accountNumber}`).trim(),
          nickname: String(link.nickname || `${link.platform || 'MT4'} ${accountNumber}`).trim(),
          accountRole: link.copyMode ? 'follower' : String(link.accountRole || 'private').toLowerCase(),
          copyPermission: link.copyMode ? 'copy_allowed' : String(link.copyPermission || 'private').toLowerCase(),
          connectionMode: 'trade_link_form',
          brokerName: String(link.broker || '').trim(),
          status: 'pending_reporter_pairing',
          pendingReporter: true,
          liveFormLinked: true,
          connectedAt: null,
          createdAt: saved.createdAt,
          updatedAt: now,
          lastSyncAt: '',
        };
        state.accountSettingsByAccountId[accountId] = {
          ...(state.accountSettingsByAccountId[accountId] || {}),
          nickname: String(link.nickname || `${link.platform || 'MT4'} ${accountNumber}`).trim(),
          accountRole: link.copyMode ? 'follower' : String(link.accountRole || 'private').toLowerCase(),
          copyPermission: link.copyMode ? 'copy_allowed' : String(link.copyPermission || 'private').toLowerCase(),
          visibility: 'private',
          tradeLinkId: saved.linkId,
          copyRisk: normalizeCopyRisk(state.accountSettingsByAccountId[accountId]?.copyRisk || {
            enabled: Boolean(link.copyMode),
            mode: 'fixed_lot',
            fixedLot: 0.01,
            maxLot: 0.05,
            maxOpenTrades: 5,
            copyBuys: true,
            copySells: true,
            copySLTP: false,
            copyPendingOrders: false,
          }, state.accountSettingsByAccountId[accountId]?.copyRisk || {}),
          updatedAt: now,
        };
        if (pairingCode) {
          state.pairingCodes[pairingCode] = {
            ...(state.pairingCodes[pairingCode] || {}),
            pairingCode,
            discordUserId: userId,
            channelId: String(link.deskChannelId || ''),
            status: 'pending',
            createdAt: saved.createdAt,
            expiresAt: null,
            connectedAt: null,
            accountNumber,
            brokerServer,
            accountId,
            requestedByUserId: userId,
            accountNickname: state.connectionsByAccountId[accountId].nickname,
            accountRole: state.connectionsByAccountId[accountId].accountRole,
            copyPermission: state.connectionsByAccountId[accountId].copyPermission,
            tradeLinkId: saved.linkId,
          };
        }
        state.activeAccountByUserId ||= {};
        state.activeAccountByUserId[userId] ||= accountId;
      }
      return state;
    });
    return saved;
  }

  async getTradeLinksForUser(discordUserId) {
    const state = await this.getMt4State();
    const userId = String(discordUserId || '');
    return Object.values(state.tradeLinksById || {})
      .filter((link) => String(link.userId || link.discordUserId) === userId)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }

  async revokeTradeLink(linkId, reason = 'portal_revoke') {
    let revoked = null;
    await this.updateMt4State((state) => {
      const link = state.tradeLinksById?.[linkId];
      if (!link) return state;
      link.status = 'REVOKED';
      link.revokedAt = new Date().toISOString();
      link.revokeReason = String(reason || 'portal_revoke');
      link.updatedAt = link.revokedAt;
      revoked = { ...link };
      if (link.accountId && state.connectionsByAccountId?.[link.accountId]?.pendingReporter) {
        delete state.connectionsByAccountId[link.accountId];
        delete state.accountSettingsByAccountId?.[link.accountId];
      }
      return state;
    });
    return revoked;
  }

  async saveCopyLink(copyLink = {}) {
    const now = new Date().toISOString();
    const saved = {
      ...copyLink,
      copyLinkId: String(copyLink.copyLinkId || randomUUID()),
      status: String(copyLink.status || 'PENDING_REPORTER_PAIRING').toUpperCase(),
      createdAt: copyLink.createdAt || now,
      updatedAt: now,
    };
    await this.updateMt4State((state) => {
      state.copyLinksById ||= {};
      state.copyLinksById[saved.copyLinkId] = saved;
      return state;
    });
    return saved;
  }

  async getAllCopyLinks() {
    const state = await this.getMt4State();
    return Object.values(state.copyLinksById || {})
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }

  async getPrimaryMt4Connection(discordUserId) {
    const state = await this.getMt4State();
    const userId = String(discordUserId || '');
    const activeId = state.activeAccountByUserId?.[userId];
    if (activeId && state.connectionsByAccountId?.[activeId]) {
      return state.connectionsByAccountId[activeId];
    }
    const accounts = await this.getMt4Accounts(userId);
    return accounts[0] || state.connections[userId] || null;
  }

  async getMt4ConnectionByAccountId(discordUserId, accountId) {
    const state = await this.getMt4State();
    const userId = String(discordUserId || '');
    const record = state.connectionsByAccountId?.[accountId] || null;
    if (!record) return null;
    if (String(record.discordUserId) === userId) return this.hydrateMt4Account(state, record, userId, { shared: false });

    const share = Object.values(state.accountSharesById || {}).find((item) =>
      String(item.targetUserId) === userId &&
      String(item.accountId) === String(accountId) &&
      String(item.status || 'active') === 'active'
    );
    if (!share) return null;
    return this.hydrateMt4Account(state, record, userId, { ...share, shared: true });
  }

  async setPrimaryMt4Account(discordUserId, accountId) {
    const userId = String(discordUserId || '');
    let selected = null;
    await this.updateMt4State((state) => {
      const record = state.connectionsByAccountId?.[accountId];
      if (record && String(record.discordUserId) === userId) {
        state.activeAccountByUserId ||= {};
        state.activeAccountByUserId[userId] = accountId;
        state.connections[userId] = record;
        selected = record;
      }
      return state;
    });
    return selected;
  }

  async updateMt4AccountSettings(discordUserId, accountId, settings = {}) {
    const userId = String(discordUserId || '');
    let updated = null;
    await this.updateMt4State((state) => {
      const record = state.connectionsByAccountId?.[accountId];
      if (!record || String(record.discordUserId) !== userId) return state;
      state.accountSettingsByAccountId ||= {};
      const previous = state.accountSettingsByAccountId[accountId] || {};
      const next = {
        ...previous,
        nickname: settings.nickname !== undefined ? String(settings.nickname || '').trim() : previous.nickname,
        accountRole: settings.accountRole !== undefined ? String(settings.accountRole || 'private').toLowerCase() : previous.accountRole,
        copyPermission: settings.copyPermission !== undefined ? String(settings.copyPermission || 'private').toLowerCase() : previous.copyPermission,
        visibility: settings.visibility !== undefined ? String(settings.visibility || 'private').toLowerCase() : previous.visibility,
        copyRisk: settings.copyRisk !== undefined ? normalizeCopyRisk(settings.copyRisk, previous.copyRisk) : normalizeCopyRisk(previous.copyRisk || {}, previous.copyRisk || {}),
        updatedAt: new Date().toISOString(),
      };
      state.accountSettingsByAccountId[accountId] = next;
      state.connectionsByAccountId[accountId] = {
        ...record,
        nickname: next.nickname || record.nickname,
        accountNickname: next.nickname || record.accountNickname,
        accountRole: next.accountRole || record.accountRole,
        copyPermission: next.copyPermission || record.copyPermission,
      };
      updated = this.hydrateMt4Account(state, state.connectionsByAccountId[accountId], userId, { shared: false });
      return state;
    });
    return updated;
  }

  async updateMt4AccountCopyRisk(discordUserId, accountId, copyRisk = {}) {
    const current = await this.getMt4ConnectionByAccountId(discordUserId, accountId);
    const previous = current?.copyRisk || {};
    return this.updateMt4AccountSettings(discordUserId, accountId, { copyRisk: normalizeCopyRisk(copyRisk, previous) });
  }

  async createAccountShare({ ownerUserId, targetUserId, accountId, permission = 'view_only' } = {}) {
    const shareId = randomUUID();
    const now = new Date().toISOString();
    let share = null;
    await this.updateMt4State((state) => {
      const record = state.connectionsByAccountId?.[accountId];
      if (!record || String(record.discordUserId) !== String(ownerUserId)) return state;
      state.accountSharesById ||= {};
      share = {
        shareId,
        ownerUserId: String(ownerUserId || ''),
        targetUserId: String(targetUserId || ''),
        accountId: String(accountId || ''),
        permission: normalizePermission(permission),
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      state.accountSharesById[shareId] = share;
      return state;
    });
    return share;
  }

  async getAccountSharesForUser(discordUserId) {
    const state = await this.getMt4State();
    const userId = String(discordUserId || '');
    return Object.values(state.accountSharesById || {}).filter((share) =>
      (String(share.ownerUserId) === userId || String(share.targetUserId) === userId) && String(share.status || 'active') === 'active'
    );
  }


  async deleteAccountShare(discordUserId, shareId) {
    const userId = String(discordUserId || '');
    let removed = null;
    await this.updateMt4State((state) => {
      const share = state.accountSharesById?.[shareId];
      if (!share || String(share.ownerUserId) !== userId) return state;
      removed = { ...share, status: 'revoked', revokedAt: new Date().toISOString() };
      delete state.accountSharesById[shareId];
      return state;
    });
    return removed;
  }

  async upsertCopyRoute(discordUserId, route = {}) {
    const userId = String(discordUserId || '');
    const now = new Date().toISOString();
    const routeId = String(route.routeId || `route_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`);
    let saved = null;
    await this.updateMt4State((state) => {
      const follower = state.connectionsByAccountId?.[route.followerAccountId];
      const authorizedOwnerUserIds = new Set([userId, ...(Array.isArray(route.authorizedOwnerUserIds) ? route.authorizedOwnerUserIds : [])].map((value) => String(value || '')).filter(Boolean));
      if (!follower || !authorizedOwnerUserIds.has(String(follower.discordUserId || follower.ownerUserId || ''))) return state;
      const leader = state.connectionsByAccountId?.[route.leaderAccountId];
      const leaderSettings = state.accountSettingsByAccountId?.[route.leaderAccountId] || {};
      const hasSharedLeader = Object.values(state.accountSharesById || {}).some((share) =>
        String(share.targetUserId) === userId && String(share.accountId) === String(route.leaderAccountId) && ['copy_allowed','control_allowed','admin','signal_only'].includes(normalizePermission(share.permission)) && String(share.status || 'active') === 'active'
      );
      const communityVisible = ['community','public','copy_allowed'].includes(String(leaderSettings.visibility || leaderSettings.copyPermission || leader.copyPermission || '').toLowerCase());
      const leaderOwnedByAuthorizedIdentity = authorizedOwnerUserIds.has(String(leader?.discordUserId || leader?.ownerUserId || ''));
      if (!leader || (!leaderOwnedByAuthorizedIdentity && !hasSharedLeader && !communityVisible)) return state;
      state.copyRoutesById ||= {};
      const previous = state.copyRoutesById[routeId] || {};
      saved = {
        ...previous,
        routeId,
        ownerUserId: userId,
        leaderAccountId: String(route.leaderAccountId || ''),
        followerAccountId: String(route.followerAccountId || ''),
        productLeaderAccountId: String(route.productLeaderAccountId || previous.productLeaderAccountId || route.leaderAccountId || ''),
        productFollowerAccountId: String(route.productFollowerAccountId || previous.productFollowerAccountId || route.followerAccountId || ''),
        status: String(route.status || previous.status || 'active').toLowerCase(),
        risk: normalizeCopyRisk(route.risk || route.copyRisk || {}, previous.risk || {}),
        createdAt: previous.createdAt || now,
        updatedAt: now,
      };
      state.copyRoutesById[routeId] = saved;
      return state;
    });
    return saved;
  }

  async getCopyRoutesForUser(discordUserId) {
    const state = await this.getMt4State();
    const userId = String(discordUserId || '');
    return Object.values(state.copyRoutesById || {}).filter((route) => String(route.ownerUserId) === userId);
  }

  async getActiveCopyRoutesForLeader(leaderAccountId) {
    const state = await this.getMt4State();
    return Object.values(state.copyRoutesById || {}).filter((route) =>
      String(route.leaderAccountId) === String(leaderAccountId) && String(route.status || 'active') === 'active'
    );
  }

  async getMt4ConnectionForCopyRoute(route = {}) {
    const state = await this.getMt4State();
    const accountId = String(route.followerAccountId || '');
    const record = state.connectionsByAccountId?.[accountId] || null;
    if (!record) return null;
    const authorized = new Set([
      route.ownerUserId,
      ...(Array.isArray(route.authorizedOwnerUserIds) ? route.authorizedOwnerUserIds : []),
    ].map((value) => String(value || '')).filter(Boolean));
    const liveOwner = String(record.discordUserId || record.ownerUserId || '');
    if (authorized.size && !authorized.has(liveOwner)) return null;
    return this.hydrateMt4Account(state, record, String(route.ownerUserId || liveOwner), { shared: false });
  }

  async deleteCopyRoute(discordUserId, routeId) {
    const userId = String(discordUserId || '');
    let removed = null;
    await this.updateMt4State((state) => {
      const route = state.copyRoutesById?.[routeId];
      if (!route || String(route.ownerUserId) !== userId) return state;
      removed = route;
      delete state.copyRoutesById[routeId];
      return state;
    });
    return removed;
  }
  async renameMt4Account(discordUserId, accountId, nickname) {
    return this.updateMt4AccountSettings(discordUserId, accountId, { nickname });
  }

  async removeMt4Account(discordUserId, accountId) {
    const userId = String(discordUserId || '');
    let removed = null;
    await this.updateMt4State((state) => {
      const record = state.connectionsByAccountId?.[accountId];
      if (!record || String(record.discordUserId) !== userId) return state;
      removed = record;
      delete state.connectionsByAccountId[accountId];
      delete state.latestSnapshotsByAccountId?.[accountId];
      delete state.accountSettingsByAccountId?.[accountId];
      delete state.signalTrackingByAccountId?.[accountId];
      state.snapshotHistory = (state.snapshotHistory || []).filter((record) => String(record.accountId) !== String(accountId));
      for (const pairing of Object.values(state.pairingCodes || {})) {
        if (pairing.accountId === accountId && String(pairing.discordUserId) === userId) {
          pairing.status = 'removed';
          pairing.removedAt = new Date().toISOString();
        }
      }
      if (state.activeAccountByUserId?.[userId] === accountId) {
        delete state.activeAccountByUserId[userId];
        const next = Object.values(state.connectionsByAccountId || {}).find((item) => String(item.discordUserId) === userId);
        if (next?.accountId) {
          state.activeAccountByUserId[userId] = next.accountId;
          state.connections[userId] = next;
        } else {
          delete state.connections[userId];
          delete state.latestSnapshots[userId];
        }
      }
      return state;
    });
    return removed;
  }


  async getMt4Connection(discordUserId) {
    return this.getPrimaryMt4Connection(discordUserId);
  }

  async getLatestMt4Snapshot(discordUserId) {
    const primary = await this.getPrimaryMt4Connection(discordUserId);
    if (primary?.accountId) {
      const state = await this.getMt4State();
      return state.latestSnapshotsByAccountId?.[primary.accountId] || state.latestSnapshots[discordUserId] || null;
    }
    const state = await this.getMt4State();
    return state.latestSnapshots[discordUserId] || null;
  }

  async getLatestMt4SnapshotForAccount(discordUserId, accountId) {
    const state = await this.getMt4State();
    const snapshot = state.latestSnapshotsByAccountId?.[accountId] || null;
    if (!snapshot || String(snapshot.discordUserId) !== String(discordUserId)) return null;
    return snapshot;
  }

  async getMt4SnapshotHistory(discordUserId, limit = 50, accountId = null) {
    const state = await this.getMt4State();
    return state.snapshotHistory
      .filter((record) => record.discordUserId === discordUserId && (!accountId || record.accountId === accountId))
      .sort((left, right) => new Date(right.receivedAt) - new Date(left.receivedAt))
      .slice(0, limit);
  }

  async getCommerceState() {
    return normalizeCommerceState(await this.commerceStore.read());
  }

  async updateCommerceState(updater) {
    const next = await this.commerceStore.update((state) => updater(normalizeCommerceState(state)));
    return normalizeCommerceState(next);
  }

  async getAllBots() {
    const state = await this.getCommerceState();
    return Object.values(state.bots || {});
  }

  async getBot(botId) {
    const state = await this.getCommerceState();
    return state.bots?.[botId] || null;
  }

  async saveBot(bot) {
    await this.updateCommerceState((state) => {
      state.bots[bot.id] = bot;
      return state;
    });

    return bot;
  }

  async saveBots(bots) {
    await this.updateCommerceState((state) => {
      for (const bot of bots) {
        state.bots[bot.id] = bot;
      }

      return state;
    });

    return bots;
  }

  async getAllQuotes() {
    const state = await this.getCommerceState();
    return Object.values(state.quotes || {});
  }

  async getQuote(quoteId) {
    const state = await this.getCommerceState();
    return state.quotes?.[quoteId] || null;
  }

  async saveQuote(quote) {
    await this.updateCommerceState((state) => {
      state.quotes[quote.quoteId] = quote;
      return state;
    });

    return quote;
  }

  async getAllOrders() {
    const state = await this.getCommerceState();
    return Object.values(state.orders || {});
  }

  async getOrder(orderId) {
    const state = await this.getCommerceState();
    return state.orders?.[orderId] || null;
  }

  async findOrderByCheckoutSessionId(checkoutSessionId) {
    const orders = await this.getAllOrders();
    return orders.find((order) => order.checkoutSessionId === checkoutSessionId) || null;
  }

  async saveOrder(order) {
    await this.updateCommerceState((state) => {
      state.orders[order.orderId] = order;
      return state;
    });

    return order;
  }

  async getAllLicenses() {
    const state = await this.getCommerceState();
    return Object.values(state.licenses || {});
  }

  async getLicensesForUser(discordUserId) {
    const licenses = await this.getAllLicenses();
    return licenses
      .filter((license) => license.discordUserId === discordUserId)
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  }

  async getActiveLicensesForUser(discordUserId) {
    const licenses = await this.getLicensesForUser(discordUserId);
    return licenses.filter((license) =>
      ['active', 'pending-delivery'].includes(license.status),
    );
  }

  async findLicenseForUserBot(discordUserId, botId) {
    const licenses = await this.getLicensesForUser(discordUserId);
    return licenses.find((license) => license.botId === botId) || null;
  }

  async saveLicense(license) {
    await this.updateCommerceState((state) => {
      state.licenses[license.licenseId] = license;
      return state;
    });

    return license;
  }

  async reserveFreeClaimLicense({ discordUserId, botId, botName, quoteId = null }) {
    let result = {
      ok: false,
      existing: null,
      reservation: null,
    };

    await this.updateCommerceState((state) => {
      const existing = Object.values(state.licenses || {}).find(
        (license) =>
          license.discordUserId === discordUserId &&
          license.source === 'free-claim' &&
          ['active', 'pending-delivery'].includes(license.status),
      );

      if (existing) {
        result = {
          ok: false,
          existing,
          reservation: null,
        };
        return state;
      }

      const now = new Date().toISOString();
      const reservation = {
        licenseId: randomUUID(),
        discordUserId,
        botId,
        botName,
        source: 'free-claim',
        quoteId,
        orderId: null,
        status: 'pending-delivery',
        deliveredAt: null,
        deliveredVia: null,
        deliveryChannelId: null,
        createdAt: now,
        updatedAt: now,
      };

      state.licenses[reservation.licenseId] = reservation;
      result = {
        ok: true,
        existing: null,
        reservation,
      };
      return state;
    });

    return result;
  }

  async getWelcomeRecord(discordUserId) {
    const state = await this.getCommerceState();
    return state.welcomes?.[discordUserId] || null;
  }

  async saveWelcomeRecord(record) {
    await this.updateCommerceState((state) => {
      state.welcomes[record.discordUserId] = record;
      return state;
    });

    return record;
  }
}
