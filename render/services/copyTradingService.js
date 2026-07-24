import { randomUUID } from 'node:crypto';

import { createPersistenceAdapter } from './persistenceAdapter.js';

function nowIso() {
  return new Date().toISOString();
}

function integerEnv(name, fallback, minimum = 1, maximum = 100000) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
}

function emptyCopyState() {
  return {
    mastersByUserId: {},
    followersByUserId: {},
    copyCommandQueue: [],
    copyCommandHistory: [],
    signals: [],
    ticketMapByFollowerAccountId: {},
    copyRequestsById: {},
    copyRelationshipsById: {},
    copyTradeLogsById: {},
    riskProfilesByUserId: {},
    auditLogs: [],
  };
}

function commandCreatedAt(command = {}) {
  const value = Date.parse(command.createdAt || command.deliveredAt || command.completedAt || 0);
  return Number.isFinite(value) ? value : 0;
}

function isCriticalCopyCommand(command = {}) {
  const name = String(command.command || '').toUpperCase();
  return name.includes('CLOSE') || name.includes('EMERGENCY') || name.includes('PROTECT') || name.includes('LOCK');
}

function copyCommandDedupeKey(command = {}) {
  const payload = command.payload || {};
  const target = String(command.followerAccountId || payload.followerAccountId || command.followerAccountNumber || command.followerUserId || '');
  const source = String(payload.sourceTicket || payload.leaderTicket || payload.copyKey || payload.signalId || '');
  return [target, String(command.command || ''), source, String(payload.symbol || ''), String(payload.side || '')].join('|');
}

function compactCopyResult(result = {}) {
  if (!result || typeof result !== 'object') return {};
  return {
    success: result.success !== false,
    ticket: result.ticket ?? result.followerTicket ?? null,
    followerTicket: result.followerTicket ?? result.ticket ?? null,
    message: String(result.message || result.error || '').slice(0, 500),
    errorCode: result.errorCode ?? result.code ?? null,
    completedAt: result.completedAt || nowIso(),
  };
}

function compactCopyCommand(command = {}) {
  const payload = command.payload && typeof command.payload === 'object' ? command.payload : {};
  const riskDecision = command.riskDecision && typeof command.riskDecision === 'object'
    ? {
        allowed: command.riskDecision.allowed !== false,
        reason: String(command.riskDecision.reason || '').slice(0, 160),
        lots: Number(command.riskDecision.lots || 0),
      }
    : null;
  return {
    id: String(command.id || `copy_${Date.now()}_${randomUUID().slice(0, 8)}`),
    status: ['pending', 'delivered', 'completed', 'failed', 'skipped'].includes(command.status) ? command.status : 'pending',
    skipReason: command.skipReason ? String(command.skipReason).slice(0, 240) : null,
    riskDecision,
    followerUserId: String(command.followerUserId || ''),
    followerAccountId: command.followerAccountId ? String(command.followerAccountId) : null,
    followerAccountNumber: command.followerAccountNumber ? String(command.followerAccountNumber) : null,
    masterUserId: command.masterUserId ? String(command.masterUserId) : null,
    command: String(command.command || '').slice(0, 80),
    payload: {
      signalId: payload.signalId ? String(payload.signalId).slice(0, 160) : null,
      sourceTicket: payload.sourceTicket ? String(payload.sourceTicket).slice(0, 100) : null,
      leaderTicket: payload.leaderTicket ? String(payload.leaderTicket).slice(0, 100) : null,
      copyKey: payload.copyKey ? String(payload.copyKey).slice(0, 160) : null,
      followerTicket: payload.followerTicket ? String(payload.followerTicket).slice(0, 100) : null,
      symbol: String(payload.symbol || '').slice(0, 40),
      side: String(payload.side || '').slice(0, 20),
      lots: Number(payload.lots || 0),
      stopLoss: toNumberOrNull(payload.stopLoss),
      takeProfit: toNumberOrNull(payload.takeProfit),
      maxLot: toNumberOrNull(payload.maxLot),
      maxOpenTrades: Number(payload.maxOpenTrades || 0),
      riskMode: String(payload.riskMode || '').slice(0, 40),
      masterUserId: payload.masterUserId ? String(payload.masterUserId) : null,
      followerAccountId: payload.followerAccountId ? String(payload.followerAccountId) : null,
      paperMode: Boolean(payload.paperMode),
    },
    priority: Number(command.priority || (isCriticalCopyCommand(command) ? 300 : 150)),
    immediate: command.immediate !== false,
    dedupeKey: String(command.dedupeKey || copyCommandDedupeKey(command)).slice(0, 500),
    createdAt: command.createdAt || nowIso(),
    deliveredAt: command.deliveredAt || null,
    completedAt: command.completedAt || null,
    failedAt: command.failedAt || null,
    result: command.result ? compactCopyResult(command.result) : null,
  };
}

function boundedTicketMaps(value = {}) {
  const accountLimit = integerEnv('WISDO_COPY_TICKET_ACCOUNT_LIMIT', 250, 25, 2000);
  const perAccountLimit = integerEnv('WISDO_COPY_TICKET_PER_ACCOUNT_LIMIT', 500, 25, 5000);
  const accountRows = Object.entries(value && typeof value === 'object' ? value : {}).slice(-accountLimit);
  const result = {};
  for (const [accountId, ticketMap] of accountRows) {
    const rows = Object.entries(ticketMap && typeof ticketMap === 'object' ? ticketMap : {})
      .sort(([, a], [, b]) => Date.parse(b?.updatedAt || b?.closedAt || b?.openedAt || 0) - Date.parse(a?.updatedAt || a?.closedAt || a?.openedAt || 0))
      .slice(0, perAccountLimit);
    result[accountId] = Object.fromEntries(rows);
  }
  return result;
}

function boundedObjectByDate(value, limit, dateFields = ['updatedAt', 'createdAt']) {
  const rows = Object.entries(value && typeof value === 'object' ? value : {});
  if (rows.length <= limit) return Object.fromEntries(rows);
  rows.sort((a, b) => {
    const read = (row) => {
      for (const field of dateFields) {
        const parsed = Date.parse(row?.[1]?.[field] || 0);
        if (Number.isFinite(parsed)) return parsed;
      }
      return 0;
    };
    return read(b) - read(a);
  });
  return Object.fromEntries(rows.slice(0, limit));
}

function pruneCopyQueue(commands = []) {
  const globalLimit = integerEnv('WISDO_COPY_COMMAND_ACTIVE_LIMIT', 250, 25, 5000);
  const perUserLimit = integerEnv('WISDO_COPY_COMMAND_PER_USER_LIMIT', 100, 10, 2000);
  const perAccountLimit = integerEnv('WISDO_COPY_COMMAND_PER_ACCOUNT_LIMIT', 75, 10, 2000);
  const criticalLimit = integerEnv('WISDO_COPY_COMMAND_CRITICAL_LIMIT', 100, 10, 1000);
  const unique = new Map();
  for (const raw of Array.isArray(commands) ? commands : []) {
    const command = compactCopyCommand(raw);
    if (!['pending', 'delivered'].includes(command.status)) continue;
    const key = command.id || command.dedupeKey;
    const previous = unique.get(key);
    if (!previous || commandCreatedAt(command) >= commandCreatedAt(previous)) unique.set(key, command);
  }
  const ordered = [...unique.values()].sort((a, b) => {
    const critical = Number(isCriticalCopyCommand(b)) - Number(isCriticalCopyCommand(a));
    if (critical) return critical;
    const priority = Number(b.priority || 0) - Number(a.priority || 0);
    return priority || commandCreatedAt(a) - commandCreatedAt(b);
  });
  const kept = [];
  const users = new Map();
  const accounts = new Map();
  let criticalCount = 0;
  for (const command of ordered) {
    const critical = isCriticalCopyCommand(command);
    const user = String(command.followerUserId || '');
    const account = String(command.followerAccountId || command.followerAccountNumber || '');
    if (critical) {
      if (criticalCount >= criticalLimit) continue;
      criticalCount += 1;
    } else {
      if (kept.length >= globalLimit) continue;
      if (user && (users.get(user) || 0) >= perUserLimit) continue;
      if (account && (accounts.get(account) || 0) >= perAccountLimit) continue;
    }
    kept.push(command);
    if (user) users.set(user, (users.get(user) || 0) + 1);
    if (account) accounts.set(account, (accounts.get(account) || 0) + 1);
  }
  return kept.slice(0, globalLimit + criticalLimit);
}

function normalizeCopyState(input = {}) {
  const data = input && typeof input === 'object' ? input : {};
  const legacy = [];
  for (const groups of [data.copyCommandsByUserId, data.copyCommandsByAccountId]) {
    for (const list of Object.values(groups && typeof groups === 'object' ? groups : {})) {
      if (Array.isArray(list)) legacy.push(...list);
    }
  }
  const queue = pruneCopyQueue([...(Array.isArray(data.copyCommandQueue) ? data.copyCommandQueue : []), ...legacy]);
  const historyLimit = integerEnv('WISDO_COPY_COMMAND_HISTORY_LIMIT', 100, 10, 1000);
  const history = [...(Array.isArray(data.copyCommandHistory) ? data.copyCommandHistory : [])]
    .map(compactCopyCommand)
    .filter((row) => ['completed', 'failed', 'skipped'].includes(row.status))
    .sort((a, b) => commandCreatedAt(b) - commandCreatedAt(a))
    .slice(0, historyLimit);
  const signalLimit = integerEnv('WISDO_COPY_SIGNAL_HISTORY_LIMIT', 300, 25, 2000);
  const auditLimit = integerEnv('WISDO_COPY_AUDIT_LIMIT', 300, 25, 2000);
  const logLimit = integerEnv('WISDO_COPY_TRADE_LOG_LIMIT', 300, 25, 2000);
  return {
    mastersByUserId: data.mastersByUserId && typeof data.mastersByUserId === 'object' ? data.mastersByUserId : {},
    followersByUserId: data.followersByUserId && typeof data.followersByUserId === 'object' ? data.followersByUserId : {},
    copyCommandQueue: queue,
    copyCommandHistory: history,
    signals: (Array.isArray(data.signals) ? data.signals : []).slice(0, signalLimit),
    ticketMapByFollowerAccountId: boundedTicketMaps(data.ticketMapByFollowerAccountId),
    copyRequestsById: boundedObjectByDate(data.copyRequestsById, integerEnv('WISDO_COPY_REQUEST_LIMIT', 750, 50, 5000)),
    copyRelationshipsById: boundedObjectByDate(data.copyRelationshipsById, integerEnv('WISDO_COPY_RELATIONSHIP_LIMIT', 1000, 50, 5000)),
    copyTradeLogsById: boundedObjectByDate(data.copyTradeLogsById, logLimit),
    riskProfilesByUserId: data.riskProfilesByUserId && typeof data.riskProfilesByUserId === 'object' ? data.riskProfilesByUserId : {},
    auditLogs: (Array.isArray(data.auditLogs) ? data.auditLogs : []).slice(0, auditLimit),
  };
}

function groupCopyCommands(queue = [], field) {
  const grouped = {};
  for (const command of queue) {
    const key = String(command?.[field] || '');
    if (!key) continue;
    grouped[key] ||= [];
    grouped[key].push(command);
  }
  return grouped;
}

export class CopyTradingService {
  constructor(config) {
    this.dataDir = config.dataDir || 'data/operator-desks';
    this.persistence = createPersistenceAdapter(config, {
      fileName: 'copy-trading.json',
      defaultState: emptyCopyState,
    });
    this.hotState = null;
    this.hotLoadPromise = null;
  }

  async loadHot() {
    if (this.hotState) return this.hotState;
    if (this.hotLoadPromise) return this.hotLoadPromise;
    this.hotLoadPromise = (async () => {
      try {
        const raw = await this.persistence.load({ cloneResult: false });
        const normalized = normalizeCopyState(raw);
        const needsMigration = Boolean(raw?.copyCommandsByUserId || raw?.copyCommandsByAccountId || !Array.isArray(raw?.copyCommandQueue));
        this.hotState = normalized;
        if (needsMigration) {
          this.hotState = await this.persistence.save(normalized, { cloneInput: false, cloneResult: false });
        }
        return this.hotState;
      } catch {
        this.hotState = emptyCopyState();
        return this.hotState;
      }
    })().finally(() => { this.hotLoadPromise = null; });
    return this.hotLoadPromise;
  }

  async load() {
    const hot = await this.loadHot();
    const copy = JSON.parse(JSON.stringify(hot));
    copy.copyCommandsByUserId = groupCopyCommands(copy.copyCommandQueue, 'followerUserId');
    copy.copyCommandsByAccountId = groupCopyCommands(copy.copyCommandQueue, 'followerAccountId');
    return copy;
  }

  async save(data) {
    const normalized = normalizeCopyState(data);
    this.hotState = await this.persistence.save(normalized, { cloneInput: false, cloneResult: false });
    return this.hotState;
  }

  async mutate(updater) {
    const next = await this.persistence.atomicUpdate((current) => {
      const state = normalizeCopyState(current);
      const result = updater(state);
      return normalizeCopyState(result || state);
    }, { normalize: normalizeCopyState, cloneResult: false });
    this.hotState = next;
    return next;
  }

  async registerMaster({
    discordUserId,
    accountNumber,
    displayName,
    allowedSymbols = [],
  }) {
    const data = await this.load();

    const record = {
      discordUserId,
      accountNumber: String(accountNumber || '').trim(),
      displayName: displayName || `Master ${accountNumber}`,
      allowedSymbols: normalizeSymbolList(allowedSymbols),
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    data.mastersByUserId[discordUserId] = record;

    await this.save(data);

    return record;
  }

  async removeMaster(discordUserId) {
    const data = await this.load();

    if (data.mastersByUserId[discordUserId]) {
      data.mastersByUserId[discordUserId].status = 'inactive';
      data.mastersByUserId[discordUserId].updatedAt = new Date().toISOString();
    }

    await this.save(data);

    return data.mastersByUserId[discordUserId] || null;
  }

  async getMaster(discordUserId) {
    const data = await this.load();
    return data.mastersByUserId[discordUserId] || null;
  }

  async listMasters() {
    const data = await this.load();

    return Object.values(data.mastersByUserId)
      .filter((master) => master.status === 'active')
      .sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)));
  }

  async followMaster({
    followerUserId,
    masterUserId,
    followerAccountNumber,
    followerAccountId = null,
    riskMode = 'fixed_lot',
    fixedLot = 0.01,
    multiplier = 1,
    maxLot = 0.05,
    maxOpenTrades = 3,
    copySLTP = true,
    symbolFilter = [],
  }) {
    const data = await this.load();

    const master = data.mastersByUserId[masterUserId];

    if (!master || master.status !== 'active') {
      throw new Error('Master account is not active or does not exist.');
    }

    data.followersByUserId[followerUserId] ||= [];

    const existingIndex = data.followersByUserId[followerUserId].findIndex(
      (item) => item.masterUserId === masterUserId,
    );

    const record = {
      followerUserId,
      masterUserId,
      followerAccountNumber: String(followerAccountNumber || '').trim(),
      followerAccountId: followerAccountId ? String(followerAccountId) : null,
      status: 'active',
      paused: false,
      riskMode,
      fixedLot: Number(fixedLot),
      multiplier: Number(multiplier),
      maxLot: Number(maxLot),
      maxOpenTrades: Number(maxOpenTrades),
      copySLTP: Boolean(copySLTP),
      symbolFilter: normalizeSymbolList(symbolFilter),
      createdAt: existingIndex >= 0
        ? data.followersByUserId[followerUserId][existingIndex].createdAt
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      data.followersByUserId[followerUserId][existingIndex] = record;
    } else {
      data.followersByUserId[followerUserId].push(record);
    }

    await this.save(data);

    return record;
  }

  async createCopyRequest(input = {}, providerId = null, requestedSettings = {}) {
    const payload = typeof input === 'object'
      ? input
      : {
          followerUserId: input,
          masterUserId: providerId,
          risk: requestedSettings,
          ...requestedSettings,
        };
    const {
    followerUserId,
    masterUserId,
    leaderAccountId = null,
    followerAccountId = null,
    followerAccountNumber = null,
    risk = {},
    paperMode = false,
    note = '',
    } = payload;
    const data = await this.load();
    const requestId = `copy_req_${randomUUID()}`;
    const now = nowIso();
    const request = {
      requestId,
      followerUserId: String(followerUserId || ''),
      masterUserId: String(masterUserId || ''),
      leaderAccountId: leaderAccountId ? String(leaderAccountId) : null,
      followerAccountId: followerAccountId ? String(followerAccountId) : null,
      followerAccountNumber: followerAccountNumber ? String(followerAccountNumber) : null,
      risk: normalizeCopyRisk(risk),
      paperMode: Boolean(paperMode),
      note: String(note || '').slice(0, 500),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    data.copyRequestsById[requestId] = request;
    this.appendAudit(data, 'copy_request.created', request);
    await this.save(data);
    return request;
  }

  async approveCopyRequest(providerIdOrRequestId, requestIdOrApprovedBy = null) {
    const requestId = requestIdOrApprovedBy && String(providerIdOrRequestId).startsWith('copy_req_')
      ? providerIdOrRequestId
      : requestIdOrApprovedBy || providerIdOrRequestId;
    const approvedByUserId = requestIdOrApprovedBy && !String(providerIdOrRequestId).startsWith('copy_req_')
      ? providerIdOrRequestId
      : requestIdOrApprovedBy;
    const data = await this.load();
    const request = data.copyRequestsById?.[requestId];
    if (!request || request.status !== 'pending') return null;

    const now = nowIso();
    const relationshipId = `copy_rel_${randomUUID()}`;
    request.status = 'approved';
    request.approvedByUserId = approvedByUserId ? String(approvedByUserId) : null;
    request.updatedAt = now;
    request.approvedAt = now;

    const relationship = {
      relationshipId,
      requestId,
      followerUserId: request.followerUserId,
      masterUserId: request.masterUserId,
      leaderAccountId: request.leaderAccountId,
      followerAccountId: request.followerAccountId,
      followerAccountNumber: request.followerAccountNumber,
      risk: normalizeCopyRisk(request.risk),
      paperMode: Boolean(request.paperMode),
      status: 'active',
      paused: false,
      createdAt: now,
      updatedAt: now,
    };

    data.copyRelationshipsById[relationshipId] = relationship;
    data.riskProfilesByUserId[request.followerUserId] ||= {};
    data.riskProfilesByUserId[request.followerUserId][relationshipId] = relationship.risk;
    this.appendAudit(data, 'copy_request.approved', { requestId, relationshipId, approvedByUserId });
    await this.save(data);
    return relationship;
  }

  async denyCopyRequest(providerIdOrRequestId, requestIdOrDeniedBy = null, reason = '') {
    const requestId = requestIdOrDeniedBy && String(providerIdOrRequestId).startsWith('copy_req_')
      ? providerIdOrRequestId
      : requestIdOrDeniedBy || providerIdOrRequestId;
    const deniedByUserId = requestIdOrDeniedBy && !String(providerIdOrRequestId).startsWith('copy_req_')
      ? providerIdOrRequestId
      : requestIdOrDeniedBy;
    const data = await this.load();
    const request = data.copyRequestsById?.[requestId];
    if (!request || request.status !== 'pending') return null;

    request.status = 'denied';
    request.deniedByUserId = deniedByUserId ? String(deniedByUserId) : null;
    request.denialReason = String(reason || '').slice(0, 500);
    request.updatedAt = nowIso();
    request.deniedAt = request.updatedAt;
    this.appendAudit(data, 'copy_request.denied', { requestId, deniedByUserId, reason: request.denialReason });
    await this.save(data);
    return request;
  }

  async getCopyRelationships(userId = null) {
    const data = await this.load();
    return Object.values(data.copyRelationshipsById || {})
      .filter((relationship) => {
        if (!userId) return true;
        return [relationship.followerUserId, relationship.masterUserId].includes(String(userId));
      })
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }

  async pauseCopyRelationship(userIdOrRelationshipId, relationshipIdOrReason = '', reason = '') {
    const relationshipId = String(userIdOrRelationshipId).startsWith('copy_rel_')
      ? userIdOrRelationshipId
      : relationshipIdOrReason;
    const pauseReason = String(userIdOrRelationshipId).startsWith('copy_rel_') ? relationshipIdOrReason : reason;
    return this.setCopyRelationshipPaused(relationshipId, true, pauseReason);
  }

  async resumeCopyRelationship(userIdOrRelationshipId, relationshipId = null) {
    const targetRelationshipId = String(userIdOrRelationshipId).startsWith('copy_rel_')
      ? userIdOrRelationshipId
      : relationshipId;
    return this.setCopyRelationshipPaused(targetRelationshipId, false, '');
  }

  async setCopyRelationshipPaused(relationshipId, paused, reason = '') {
    const data = await this.load();
    const relationship = data.copyRelationshipsById?.[relationshipId];
    if (!relationship) return null;

    relationship.paused = Boolean(paused);
    relationship.status = paused ? 'paused' : 'active';
    relationship.pauseReason = paused ? String(reason || '').slice(0, 500) : '';
    relationship.updatedAt = nowIso();
    this.appendAudit(data, paused ? 'copy_relationship.paused' : 'copy_relationship.resumed', { relationshipId, reason });
    await this.save(data);
    return relationship;
  }

  async logCopiedTrade(event = {}) {
    return this.logCopyTrade('copied', event);
  }

  async logSkippedTrade(event = {}) {
    return this.logCopyTrade('skipped', event);
  }

  async logCopyTrade(status, event = {}) {
    const data = await this.load();
    const logId = `copy_log_${randomUUID()}`;
    const log = {
      logId,
      status,
      relationshipId: event.relationshipId || null,
      commandId: event.commandId || null,
      masterUserId: event.masterUserId || null,
      followerUserId: event.followerUserId || null,
      leaderTicket: event.leaderTicket || event.sourceTicket || null,
      followerTicket: event.followerTicket || event.ticket || null,
      symbol: event.symbol || '',
      side: event.side || '',
      lots: Number(event.lots || 0),
      reason: event.reason || event.skipReason || '',
      riskDecision: event.riskDecision || null,
      paperMode: Boolean(event.paperMode),
      createdAt: nowIso(),
    };

    data.copyTradeLogsById[logId] = log;
    this.appendAudit(data, status === 'copied' ? 'copy_trade.copied' : 'copy_trade.skipped', log);
    await this.save(data);
    return log;
  }

  async unfollowMaster({ followerUserId, masterUserId }) {
    const data = await this.load();

    const followers = data.followersByUserId[followerUserId] || [];
    const record = followers.find((item) => item.masterUserId === masterUserId);

    if (record) {
      record.status = 'inactive';
      record.paused = true;
      record.updatedAt = new Date().toISOString();
    }

    await this.save(data);

    return record || null;
  }

  async getFollowerSettings(followerUserId) {
    const data = await this.load();

    return (data.followersByUserId[followerUserId] || [])
      .filter((item) => item.status === 'active');
  }

  async getFollowersForMaster(masterUserId) {
    const data = await this.load();
    const results = [];

    for (const followers of Object.values(data.followersByUserId)) {
      for (const follower of followers) {
        if (follower.masterUserId === masterUserId && follower.status === 'active') {
          results.push(follower);
        }
      }
    }

    return results;
  }

  async pauseCopy(followerUserId, masterUserId = null) {
    const data = await this.load();
    const followers = data.followersByUserId[followerUserId] || [];

    const updated = [];

    for (const follower of followers) {
      if (masterUserId && follower.masterUserId !== masterUserId) {
        continue;
      }

      follower.paused = true;
      follower.updatedAt = new Date().toISOString();
      updated.push(follower);
    }

    await this.save(data);

    return updated;
  }

  async resumeCopy(followerUserId, masterUserId = null) {
    const data = await this.load();
    const followers = data.followersByUserId[followerUserId] || [];

    const updated = [];

    for (const follower of followers) {
      if (masterUserId && follower.masterUserId !== masterUserId) {
        continue;
      }

      follower.paused = false;
      follower.updatedAt = new Date().toISOString();
      updated.push(follower);
    }

    await this.save(data);

    return updated;
  }

  async updateFollowerSettings({
    followerUserId,
    masterUserId,
    settings = {},
  }) {
    const data = await this.load();
    const followers = data.followersByUserId[followerUserId] || [];
    const record = followers.find((item) => item.masterUserId === masterUserId);

    if (!record) {
      throw new Error('Follower settings were not found.');
    }

    if (settings.riskMode !== undefined) record.riskMode = settings.riskMode;
    if (settings.fixedLot !== undefined) record.fixedLot = Number(settings.fixedLot);
    if (settings.multiplier !== undefined) record.multiplier = Number(settings.multiplier);
    if (settings.maxLot !== undefined) record.maxLot = Number(settings.maxLot);
    if (settings.maxOpenTrades !== undefined) record.maxOpenTrades = Number(settings.maxOpenTrades);
    if (settings.copySLTP !== undefined) record.copySLTP = Boolean(settings.copySLTP);
    if (settings.symbolFilter !== undefined) record.symbolFilter = normalizeSymbolList(settings.symbolFilter);

    record.updatedAt = new Date().toISOString();

    await this.save(data);

    return record;
  }

  applyMasterSignal(data, {
    masterUserId,
    masterAccountNumber,
    sourceTicket,
    symbol,
    side,
    lots,
    openPrice = null,
    stopLoss = null,
    takeProfit = null,
    action = 'open',
    signalId = null,
  } = {}) {
    const master = data.mastersByUserId[masterUserId];
    if (!master || master.status !== 'active') throw new Error('Master is not active.');

    const signal = {
      signalId: signalId || `sig_${Date.now()}_${randomUUID().slice(0, 6)}`,
      masterUserId,
      masterAccountNumber: String(masterAccountNumber || master.accountNumber || '').trim(),
      sourceTicket: sourceTicket ? String(sourceTicket) : null,
      symbol: String(symbol || '').trim().toUpperCase(),
      side: normalizeSide(side),
      lots: Number(lots),
      openPrice: toNumberOrNull(openPrice),
      stopLoss: toNumberOrNull(stopLoss),
      takeProfit: toNumberOrNull(takeProfit),
      action,
      createdAt: new Date().toISOString(),
    };

    data.signals.unshift(signal);
    const followers = [];
    for (const followerList of Object.values(data.followersByUserId)) {
      for (const follower of followerList) {
        if (follower.masterUserId === masterUserId && follower.status === 'active' && (signal.action === 'close' || follower.paused !== true)) followers.push(follower);
      }
    }

    for (const follower of followers) {
      const isClose = signal.action === 'close';
      if (!isClose && !symbolAllowed(signal.symbol, follower.symbolFilter)) {
        this.appendAudit(data, 'copy_trade.skipped', { masterUserId, followerUserId: follower.followerUserId, reason: 'symbol_filter', symbol: signal.symbol });
        continue;
      }
      const command = this.buildCopyCommandForFollower(signal, follower);
      if (isClose) {
        const followerAccountId = follower.followerAccountId || null;
        const stableTicket = signal.sourceTicket ? String(signal.sourceTicket) : '';
        const binding = followerAccountId && stableTicket ? data.ticketMapByFollowerAccountId?.[followerAccountId]?.[stableTicket] : null;
        command.payload.followerTicket = binding?.followerTicket || null;
        command.payload.copyKey = stableTicket || signal.signalId;
        command.payload.leaderTicket = stableTicket || null;
        command.payload.sourceTicket = stableTicket || null;
        if (binding?.symbol) command.payload.symbol = binding.symbol;
        command.priority = 300;
        command.immediate = true;
      }
      if (command.status === 'skipped') {
        const logId = `copy_log_${randomUUID()}`;
        data.copyTradeLogsById[logId] = {
          logId, status: 'skipped', commandId: command.id, masterUserId,
          followerUserId: follower.followerUserId, leaderTicket: signal.sourceTicket,
          symbol: signal.symbol, side: signal.side, lots: command.payload?.lots || 0,
          reason: command.skipReason, riskDecision: command.riskDecision,
          paperMode: Boolean(follower.paperMode), createdAt: nowIso(),
        };
        continue;
      }
      data.copyCommandQueue ||= [];
      const compact = compactCopyCommand(command);
      const duplicate = data.copyCommandQueue.find((item) =>
        ['pending', 'delivered'].includes(item.status) && item.dedupeKey === compact.dedupeKey,
      );
      if (!duplicate) data.copyCommandQueue.push(compact);
    }
    return { signal, followerCount: followers.length };
  }

  async queueMasterSignalsBatch(inputs = []) {
    const rows = Array.isArray(inputs) ? inputs.filter(Boolean) : [];
    if (!rows.length) return [];
    const results = [];
    await this.mutate((data) => {
      for (const input of rows) {
        try {
          results.push({ ok: true, result: this.applyMasterSignal(data, input) });
        } catch (error) {
          results.push({ ok: false, error: error.message });
        }
      }
      return data;
    });
    return results;
  }

  async queueMasterSignal(input = {}) {
    const [row] = await this.queueMasterSignalsBatch([input]);
    if (!row?.ok) throw new Error(row?.error || 'Master signal could not be queued.');
    return row.result;
  }

  buildCopyCommandForFollower(signal, follower) {
    const isClose = signal.action === 'close';
    const riskDecision = isClose
      ? { allowed: true, reason: 'close_authority', lots: 0, risk: normalizeCopyRisk({ ...follower, ...(follower.risk || {}) }) }
      : calculateCopyRiskDecision(signal, follower);
    const lots = riskDecision.lots;

    return {
      id: `copy_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      status: riskDecision.allowed ? 'pending' : 'skipped',
      skipReason: riskDecision.allowed ? null : riskDecision.reason,
      riskDecision,
      followerUserId: follower.followerUserId,
      followerAccountId: follower.followerAccountId || null,
      followerAccountNumber: follower.followerAccountNumber || null,
      masterUserId: follower.masterUserId,
      command: signal.action === 'close' ? 'COPY_CLOSE_TRADE' : 'COPY_OPEN_TRADE',
      payload: {
        signalId: signal.signalId,
        sourceTicket: signal.sourceTicket,
        leaderTicket: signal.sourceTicket,
        copyKey: signal.sourceTicket || signal.signalId,
        followerTicket: null,
        symbol: signal.symbol,
        side: signal.side,
        lots,
        stopLoss: follower.copySLTP ? signal.stopLoss : null,
        takeProfit: follower.copySLTP ? signal.takeProfit : null,
        maxLot: follower.maxLot,
        maxOpenTrades: follower.maxOpenTrades,
        riskMode: follower.riskMode,
        leaderTicket: signal.sourceTicket,
        masterUserId: follower.masterUserId,
        followerAccountId: follower.followerAccountId || null,
        paperMode: Boolean(follower.paperMode),
      },
      priority: isClose ? 300 : 150,
      immediate: true,
      createdAt: new Date().toISOString(),
    };
  }

  async getPendingCopyCommand(followerUserId, accountId = null) {
    const data = await this.loadHot();
    const user = String(followerUserId || '');
    const account = String(accountId || '');
    const scanLimit = integerEnv('WISDO_COPY_COMMAND_SCAN_LIMIT', 2000, 100, 10000);
    return (data.copyCommandQueue || []).slice(0, scanLimit).find((command) => {
      if (command.status !== 'pending') return false;
      if (account) return String(command.followerAccountId || '') === account;
      return String(command.followerUserId || '') === user;
    }) || null;
  }

  async markCopyCommandDelivered(followerUserId, commandId, accountId = null) {
    let delivered = null;
    await this.mutate((data) => {
      const command = (data.copyCommandQueue || []).find((item) => item.id === commandId && (
        !accountId || String(item.followerAccountId || '') === String(accountId)
      ));
      if (command && command.status === 'pending') {
        command.status = 'delivered';
        command.deliveredAt = nowIso();
        delivered = compactCopyCommand(command);
      }
      return data;
    });
    return delivered;
  }

  async markCopyCommandCompleted(followerUserId, commandId, result = {}, accountId = null) {
    let completed = null;
    await this.mutate((data) => {
      const index = (data.copyCommandQueue || []).findIndex((item) => item.id === commandId && (
        !accountId || String(item.followerAccountId || '') === String(accountId)
      ));
      if (index < 0) return data;
      const command = data.copyCommandQueue[index];
      const succeeded = result?.success !== false;
      command.status = succeeded ? 'completed' : 'failed';
      if (succeeded) command.completedAt = nowIso();
      else command.failedAt = nowIso();
      command.result = compactCopyResult(result);

      const followerAccountId = accountId || command.followerAccountId || command.payload?.followerAccountId || null;
      const sourceTicket = command.payload?.sourceTicket || command.payload?.leaderTicket || null;
      const followerTicket = result?.ticket || result?.followerTicket || null;
      if (succeeded && followerAccountId && sourceTicket) {
        data.ticketMapByFollowerAccountId ||= {};
        data.ticketMapByFollowerAccountId[followerAccountId] ||= {};
        const key = String(sourceTicket);
        const previous = data.ticketMapByFollowerAccountId[followerAccountId][key] || {};
        data.ticketMapByFollowerAccountId[followerAccountId][key] = {
          ...previous,
          leaderTicket: key,
          followerTicket: followerTicket ? String(followerTicket) : previous.followerTicket || null,
          followerAccountId,
          followerUserId: String(followerUserId || command.followerUserId || ''),
          masterUserId: command.masterUserId || command.payload?.masterUserId || previous.masterUserId || null,
          symbol: command.payload?.symbol || previous.symbol || '',
          side: command.payload?.side || previous.side || '',
          status: command.command === 'COPY_CLOSE_TRADE' ? 'closed' : 'mirrored',
          signalId: command.payload?.signalId || previous.signalId || null,
          lastCommandId: command.id,
          updatedAt: nowIso(),
          openedAt: previous.openedAt || (command.command === 'COPY_OPEN_TRADE' ? nowIso() : null),
          closedAt: command.command === 'COPY_CLOSE_TRADE' ? nowIso() : previous.closedAt || null,
        };
      }
      completed = compactCopyCommand(command);
      data.copyCommandQueue.splice(index, 1);
      data.copyCommandHistory ||= [];
      data.copyCommandHistory.unshift(completed);
      return data;
    });
    return completed;
  }

  async getTicketMap(followerAccountId) {
    const data = await this.load();
    return data.ticketMapByFollowerAccountId?.[followerAccountId] || {};
  }

  async getQueueMetrics() {
    const data = await this.loadHot();
    const queue = Array.isArray(data.copyCommandQueue) ? data.copyCommandQueue : [];
    return {
      total: queue.length,
      pending: queue.filter((row) => row.status === 'pending').length,
      delivered: queue.filter((row) => row.status === 'delivered').length,
      critical: queue.filter(isCriticalCopyCommand).length,
      history: Array.isArray(data.copyCommandHistory) ? data.copyCommandHistory.length : 0,
      signals: Array.isArray(data.signals) ? data.signals.length : 0,
      ticketAccounts: Object.keys(data.ticketMapByFollowerAccountId || {}).length,
    };
  }

  async getCopyStatus(discordUserId) {
    const data = await this.load();

    return {
      master: data.mastersByUserId[discordUserId] || null,
      following: (data.followersByUserId[discordUserId] || []).filter(
        (item) => item.status === 'active',
      ),
      pendingCommands: (data.copyCommandQueue || []).filter(
        (item) => item.status === 'pending' && String(item.followerUserId || '') === String(discordUserId),
      ),
      relationships: Object.values(data.copyRelationshipsById || {}).filter((relationship) =>
        [relationship.followerUserId, relationship.masterUserId].includes(String(discordUserId)),
      ),
      requests: Object.values(data.copyRequestsById || {}).filter((item) =>
        [item.followerUserId, item.masterUserId].includes(String(discordUserId)),
      ),
      ticketMaps: data.ticketMapByFollowerAccountId || {},
    };
  }

  appendAudit(data, action, details = {}) {
    data.auditLogs ||= [];
    data.auditLogs.unshift({
      auditId: `copy_audit_${randomUUID()}`,
      action,
      details,
      createdAt: nowIso(),
    });
    data.auditLogs = data.auditLogs.slice(0, integerEnv('WISDO_COPY_AUDIT_LIMIT', 300, 25, 2000));
  }
}

function normalizeSymbolList(values) {
  if (!Array.isArray(values)) {
    if (!values) return [];

    return String(values)
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);
  }

  return [...new Set(
    values
      .map((value) => String(value).trim().toUpperCase())
      .filter(Boolean),
  )];
}

function symbolAllowed(symbol, allowedSymbols) {
  const normalized = String(symbol || '').trim().toUpperCase();

  if (!allowedSymbols || allowedSymbols.length === 0) {
    return true;
  }

  return allowedSymbols.includes(normalized);
}

function normalizeSide(side) {
  const normalized = String(side || '').trim().toLowerCase();

  if (normalized.includes('buy')) return 'buy';
  if (normalized.includes('sell')) return 'sell';

  return normalized || 'unknown';
}

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function calculateFollowerLots(signal, follower) {
  let lots = 0.01;

  if (follower.riskMode === 'multiplier') {
    lots = Number(signal.lots || 0.01) * Number(follower.multiplier || 1);
  } else {
    lots = Number(follower.fixedLot || 0.01);
  }

  const maxLot = Number(follower.maxLot || 0.05);

  if (lots > maxLot) {
    lots = maxLot;
  }

  if (lots <= 0) {
    lots = 0.01;
  }

  return Number(lots.toFixed(2));
}

function normalizeCopyRisk(input = {}) {
  const maxLot = Number(input.maxLot ?? input.max_lot ?? 0.05);
  const fixedLot = Number(input.fixedLot ?? input.fixed_lot ?? 0.01);
  return {
    riskMode: String(input.riskMode || input.mode || 'fixed_lot'),
    fixedLot: Number.isFinite(fixedLot) && fixedLot > 0 ? fixedLot : 0.01,
    multiplier: Math.max(Number(input.multiplier ?? 1), 0),
    riskPercent: Math.max(Number(input.riskPercent ?? input.risk_percent ?? 1), 0),
    riskUsd: Math.max(Number(input.riskUsd ?? input.risk_usd ?? 0), 0),
    minLot: Math.max(Number(input.minLot ?? 0.01), 0.01),
    maxLot: Number.isFinite(maxLot) && maxLot > 0 ? maxLot : 0.05,
    lotStep: Math.max(Number(input.lotStep ?? 0.01), 0.01),
    maxOpenTrades: Math.max(Number(input.maxOpenTrades ?? 3), 1),
    maxSpread: Math.max(Number(input.maxSpread ?? 0), 0),
    maxSlippage: Math.max(Number(input.maxSlippage ?? 0), 0),
    maxDailyLossPercent: Math.max(Number(input.maxDailyLossPercent ?? 0), 0),
    maxFloatingDrawdownPercent: Math.max(Number(input.maxFloatingDrawdownPercent ?? 0), 0),
    maxExposureLots: Math.max(Number(input.maxExposureLots ?? 0), 0),
    paperMode: Boolean(input.paperMode),
  };
}

function roundToStep(value, step = 0.01) {
  const rounded = Math.floor(Number(value || 0) / step) * step;
  return Number(Math.max(rounded, step).toFixed(2));
}

function calculateCopyRiskDecision(signal, follower) {
  const risk = normalizeCopyRisk({ ...follower, ...(follower.risk || {}) });
  const openTrades = Number(follower.openTrades || 0);
  const currentExposureLots = Number(follower.currentExposureLots || 0);
  const spread = Number(signal.spread || 0);
  const dailyLossPercent = Number(follower.dailyLossPercent || 0);
  const floatingDrawdownPercent = Number(follower.floatingDrawdownPercent || 0);

  if (openTrades >= risk.maxOpenTrades) return { allowed: false, reason: 'max_open_trades', lots: 0, risk };
  if (risk.maxSpread > 0 && spread > risk.maxSpread) return { allowed: false, reason: 'spread_limit', lots: 0, risk };
  if (risk.maxDailyLossPercent > 0 && dailyLossPercent >= risk.maxDailyLossPercent) return { allowed: false, reason: 'daily_loss_limit', lots: 0, risk };
  if (risk.maxFloatingDrawdownPercent > 0 && floatingDrawdownPercent >= risk.maxFloatingDrawdownPercent) return { allowed: false, reason: 'drawdown_limit', lots: 0, risk };

  let lots = calculateFollowerLots(signal, {
    ...follower,
    riskMode: risk.riskMode,
    fixedLot: risk.fixedLot,
    multiplier: risk.multiplier,
    maxLot: risk.maxLot,
  });

  if (risk.riskMode === 'risk_percent') {
    const equity = Number(follower.equity || follower.accountEquity || 0);
    const stopDistancePips = Math.max(Number(signal.stopDistancePips || follower.stopDistancePips || 50), 1);
    const pipValuePerLot = Math.max(Number(follower.pipValuePerLot || 10), 0.01);
    lots = (equity * (risk.riskPercent / 100)) / (stopDistancePips * pipValuePerLot);
  } else if (risk.riskMode === 'fixed_usd') {
    const stopDistancePips = Math.max(Number(signal.stopDistancePips || follower.stopDistancePips || 50), 1);
    const pipValuePerLot = Math.max(Number(follower.pipValuePerLot || 10), 0.01);
    lots = risk.riskUsd / (stopDistancePips * pipValuePerLot);
  }

  lots = Math.min(Math.max(roundToStep(lots, risk.lotStep), risk.minLot), risk.maxLot);

  if (risk.maxExposureLots > 0 && currentExposureLots + lots > risk.maxExposureLots) {
    return { allowed: false, reason: 'exposure_limit', lots: 0, risk };
  }

  return { allowed: true, reason: 'allowed', lots, risk, paperMode: risk.paperMode || Boolean(follower.paperMode) };
}
