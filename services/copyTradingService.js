import { randomUUID } from 'node:crypto';

import { createPersistenceAdapter } from './persistenceAdapter.js';

function nowIso() {
  return new Date().toISOString();
}

export class CopyTradingService {
  constructor(config) {
    this.dataDir = config.dataDir || 'data/operator-desks';
    this.persistence = createPersistenceAdapter(config, {
      fileName: 'copy-trading.json',
      defaultState: () => ({}),
    });
  }

  async load() {
    try {
      const data = await this.persistence.load();

      return {
        mastersByUserId: data.mastersByUserId || {},
        followersByUserId: data.followersByUserId || {},
        copyCommandsByUserId: data.copyCommandsByUserId || {},
        copyCommandsByAccountId: data.copyCommandsByAccountId || {},
        signals: data.signals || [],
        ticketMapByFollowerAccountId: data.ticketMapByFollowerAccountId || {},
        copyRequestsById: data.copyRequestsById || {},
        copyRelationshipsById: data.copyRelationshipsById || {},
        copyTradeLogsById: data.copyTradeLogsById || {},
        riskProfilesByUserId: data.riskProfilesByUserId || {},
        auditLogs: Array.isArray(data.auditLogs) ? data.auditLogs : [],
      };
    } catch {
      return {
        mastersByUserId: {},
        followersByUserId: {},
        copyCommandsByUserId: {},
        copyCommandsByAccountId: {},
        signals: [],
        ticketMapByFollowerAccountId: {},
        copyRequestsById: {},
        copyRelationshipsById: {},
        copyTradeLogsById: {},
        riskProfilesByUserId: {},
        auditLogs: [],
      };
    }
  }

  async save(data) {
    await this.persistence.save(data);
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

  async queueMasterSignal({
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
  }) {
    const data = await this.load();

    const master = data.mastersByUserId[masterUserId];

    if (!master || master.status !== 'active') {
      throw new Error('Master is not active.');
    }

    const signal = {
      signalId: signalId || `sig_${Date.now()}`,
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
    data.signals = data.signals.slice(0, 1000);

    const followers = [];

    for (const followerList of Object.values(data.followersByUserId)) {
      for (const follower of followerList) {
        if (
          follower.masterUserId === masterUserId &&
          follower.status === 'active' &&
          follower.paused !== true
        ) {
          followers.push(follower);
        }
      }
    }

    for (const follower of followers) {
      if (!symbolAllowed(signal.symbol, follower.symbolFilter)) {
        this.appendAudit(data, 'copy_trade.skipped', {
          masterUserId,
          followerUserId: follower.followerUserId,
          reason: 'symbol_filter',
          symbol: signal.symbol,
        });
        continue;
      }

      const command = this.buildCopyCommandForFollower(signal, follower);

      if (command.status === 'skipped') {
        const logId = `copy_log_${randomUUID()}`;
        data.copyTradeLogsById[logId] = {
          logId,
          status: 'skipped',
          commandId: command.id,
          masterUserId,
          followerUserId: follower.followerUserId,
          leaderTicket: signal.sourceTicket,
          symbol: signal.symbol,
          side: signal.side,
          lots: command.payload?.lots || 0,
          reason: command.skipReason,
          riskDecision: command.riskDecision,
          paperMode: Boolean(follower.paperMode),
          createdAt: nowIso(),
        };
        continue;
      }

      data.copyCommandsByUserId[follower.followerUserId] ||= [];
      data.copyCommandsByUserId[follower.followerUserId].push(command);
      if (follower.followerAccountId) {
        data.copyCommandsByAccountId ||= {};
        data.copyCommandsByAccountId[follower.followerAccountId] ||= [];
        data.copyCommandsByAccountId[follower.followerAccountId].push(command);
      }
    }

    await this.save(data);

    return {
      signal,
      followerCount: followers.length,
    };
  }

  buildCopyCommandForFollower(signal, follower) {
    const riskDecision = calculateCopyRiskDecision(signal, follower);
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
      createdAt: new Date().toISOString(),
    };
  }

  async getPendingCopyCommand(followerUserId, accountId = null) {
    const data = await this.load();
    const commands = accountId
      ? (data.copyCommandsByAccountId?.[accountId] || [])
      : (data.copyCommandsByUserId[followerUserId] || []);

    return commands.find((command) => command.status === 'pending') || null;
  }

  async markCopyCommandDelivered(followerUserId, commandId, accountId = null) {
    const data = await this.load();
    const commands = accountId ? (data.copyCommandsByAccountId?.[accountId] || []) : (data.copyCommandsByUserId[followerUserId] || []);
    let command = commands.find((item) => item.id === commandId);
    if (!command) command = (data.copyCommandsByUserId[followerUserId] || []).find((item) => item.id === commandId);

    if (command) {
      command.status = 'delivered';
      command.deliveredAt = new Date().toISOString();
    }

    await this.save(data);

    return command || null;
  }

  async markCopyCommandCompleted(followerUserId, commandId, result = {}, accountId = null) {
    const data = await this.load();
    const commands = accountId ? (data.copyCommandsByAccountId?.[accountId] || []) : (data.copyCommandsByUserId[followerUserId] || []);
    let command = commands.find((item) => item.id === commandId);
    if (!command) command = (data.copyCommandsByUserId[followerUserId] || []).find((item) => item.id === commandId);

    if (command) {
      command.status = 'completed';
      command.completedAt = new Date().toISOString();
      command.result = result;

      const followerAccountId = accountId || command.followerAccountId || command.payload?.followerAccountId || null;
      const sourceTicket = command.payload?.sourceTicket || command.payload?.leaderTicket || null;
      const followerTicket = result?.ticket || result?.followerTicket || null;
      if (followerAccountId && sourceTicket) {
        data.ticketMapByFollowerAccountId ||= {};
        data.ticketMapByFollowerAccountId[followerAccountId] ||= {};
        const key = String(sourceTicket);
        const previous = data.ticketMapByFollowerAccountId[followerAccountId][key] || {};
        data.ticketMapByFollowerAccountId[followerAccountId][key] = {
          ...previous,
          leaderTicket: key,
          followerTicket: followerTicket ? String(followerTicket) : previous.followerTicket || null,
          followerAccountId,
          followerUserId,
          masterUserId: command.masterUserId || command.payload?.masterUserId || previous.masterUserId || null,
          symbol: command.payload?.symbol || previous.symbol || '',
          side: command.payload?.side || previous.side || '',
          status: command.command === 'COPY_CLOSE_TRADE' ? 'closed' : 'mirrored',
          signalId: command.payload?.signalId || previous.signalId || null,
          lastCommandId: command.id,
          updatedAt: new Date().toISOString(),
          openedAt: previous.openedAt || (command.command === 'COPY_OPEN_TRADE' ? new Date().toISOString() : null),
          closedAt: command.command === 'COPY_CLOSE_TRADE' ? new Date().toISOString() : previous.closedAt || null,
        };
      }
    }

    await this.save(data);

    return command || null;
  }

  async getTicketMap(followerAccountId) {
    const data = await this.load();
    return data.ticketMapByFollowerAccountId?.[followerAccountId] || {};
  }

  async getCopyStatus(discordUserId) {
    const data = await this.load();

    return {
      master: data.mastersByUserId[discordUserId] || null,
      following: (data.followersByUserId[discordUserId] || []).filter(
        (item) => item.status === 'active',
      ),
      pendingCommands: (data.copyCommandsByUserId[discordUserId] || []).filter(
        (item) => item.status === 'pending',
      ),
      relationships: await this.getCopyRelationships(discordUserId),
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
    data.auditLogs = data.auditLogs.slice(0, 1000);
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
