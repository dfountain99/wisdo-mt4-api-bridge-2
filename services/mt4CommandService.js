import { createHash, randomUUID } from 'node:crypto';

import { createPersistenceAdapter } from './persistenceAdapter.js';

function nowIso() { return new Date().toISOString(); }
function clone(value) {
  const source = value ?? {};
  return typeof globalThis.structuredClone === 'function' ? globalThis.structuredClone(source) : JSON.parse(JSON.stringify(source));
}
function addMinutes(minutes) { const d = new Date(); d.setMinutes(d.getMinutes() + minutes); return d.toISOString(); }
function cleanKey(value = '') { return String(value || '').trim().replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, 180); }
function shortHash(value = '') { return createHash('sha256').update(String(value)).digest('hex').slice(0, 24); }
function isExpired(record) { return record?.expiresAt && new Date(record.expiresAt).getTime() < Date.now(); }
function deliveryRetryReady(record) {
  if (record.status !== 'delivered') return false;
  const last = new Date(record.deliveredAt || record.createdAt || 0).getTime();
  return Date.now() - last > 15000;
}

// Reporter commands that can materially change live positions or account risk.
// These must never be queued naked from the website/API. The website should
// return a confirmation_required response first, then queue only the real
// reporter command after the user confirms.
const DANGEROUS_COMMANDS = new Set([
  'CLOSE_ALL_TRADES',
  'CLOSE_ALL_PROFITS',
  'CLOSE_ALL_WINNERS',
  'TRIM_PROFITS',
  'PARTIAL_CLOSE_WINNERS',
  'PARTIAL_CLOSE_BASKET',
  'CLOSE_ALL_LOSERS',
  'CLOSE_BY_TICKET',
  'CLOSE_BY_SYMBOL',
  'CLOSE_BY_MAGIC',
  'CLOSE_BASKET',
  'CLOSE_BY_BOT',
  'EMERGENCY_CLOSE_ALL',
  'EMERGENCY_STOP',
  'DISCONNECT_ACCOUNT',
  'REMOVE_ACCOUNT',
  'LOCK_PROFIT',
  'WALK_AWAY_MODE',
]);

const ACCOUNT_COMMANDS = new Set([
  ...DANGEROUS_COMMANDS,
  'PAUSE_BOT',
  'RESUME_BOT',
  'PAUSE_TRADING',
  'RESUME_TRADING',
  'PAUSE_COPIER',
  'RESUME_COPIER',
  'STOP_ENTRIES',
  'START_ENTRIES',
  'PROTECT_ACCOUNT',
  'HARVEST_PROFIT',
  'SET_SESSION_RULE',
  'SET_PAIR_RULE',
  'SET_EQUITY_FLOOR',
  'SET_BOT_MODE',
  'SET_RISK_MODE',
  'SET_GLOBALS',
  'CEM_SET_GLOBALS',
  'COPY_OPEN_TRADE',
  'COPY_CLOSE_TRADE',
  'COPY_SIGNAL_BASKET',
  'MARKET_ORDER',
  'SYNC_ACCOUNT',
]);

export class Mt4CommandService {
  constructor(config) {
    this.dataDir = config.dataDir || 'data/operator-desks';
    this.persistence = createPersistenceAdapter(config, {
      fileName: 'mt4-commands.json',
      defaultState: () => ({}),
    });
    this.commandHistoryLimit = Math.max(50, Math.min(5000, Number(process.env.WISDO_MT4_COMMAND_HISTORY_LIMIT || 250)));
    this.commandAuditLimit = Math.max(50, Math.min(2000, Number(process.env.WISDO_MT4_COMMAND_AUDIT_LIMIT || 250)));
    this.hotState = null;
    this.hotLoadPromise = null;
  }

  effectiveStatus(record) {
    if (['pending', 'delivered'].includes(String(record?.status || '')) && isExpired(record)) return 'expired';
    return String(record?.status || 'pending');
  }

  isCriticalCommand(record = {}) {
    const command = String(record.command || '').toUpperCase();
    return Boolean(record.validation?.dangerous)
      || DANGEROUS_COMMANDS.has(command)
      || command.includes('CLOSE')
      || command.includes('EMERGENCY')
      || command === 'PROTECT_ACCOUNT'
      || command === 'LOCK_PROFIT';
  }

  deriveDedupeKey(userId, accountId, command, payload = {}) {
    if (payload.dedupeKey) return cleanKey(payload.dedupeKey);
    const action = String(command || '').toUpperCase();
    if (!['COPY_OPEN_TRADE', 'COPY_CLOSE_TRADE'].includes(action)) return '';
    const sourceTicket = payload.sourceTicket || payload.leaderTicket || payload.masterTicket || '';
    const routeId = payload.routeId || payload.copyRouteId || '';
    const signalId = payload.signalId || '';
    const leaderAccountId = payload.leaderAccountId || payload.masterAccountId || '';
    const followerAccountId = accountId || payload.accountId || '';
    const stableIdentity = [action, userId, followerAccountId, routeId, leaderAccountId, sourceTicket || signalId].map(cleanKey).join('|');
    if (!sourceTicket && !signalId) return '';
    return `copy:${shortHash(stableIdentity)}`;
  }

  activeQueueLimits() {
    return {
      global: Math.max(100, Math.min(5000, Number(process.env.WISDO_MT4_ACTIVE_COMMAND_LIMIT || 750))),
      perUser: Math.max(50, Math.min(2500, Number(process.env.WISDO_MT4_ACTIVE_PER_USER_LIMIT || 400))),
      perAccount: Math.max(25, Math.min(1000, Number(process.env.WISDO_MT4_ACTIVE_PER_ACCOUNT_LIMIT || 175))),
      critical: Math.max(25, Math.min(1000, Number(process.env.WISDO_MT4_CRITICAL_COMMAND_LIMIT || 250))),
      scan: Math.max(250, Math.min(20000, Number(process.env.WISDO_MT4_COMMAND_SCAN_LIMIT || 5000))),
    };
  }

  pruneCommandState(raw = {}) {
    const limits = this.activeQueueLimits();
    const primaryQueue = Array.isArray(raw.commandQueue) ? raw.commandQueue : [];
    const legacyStores = primaryQueue.length ? [] : [
      ...Object.values(raw.commandsByUserId || {}),
      ...Object.values(raw.commandsByAccountId || {}),
    ];
    const sources = [primaryQueue, ...legacyStores];
    const unique = new Map();
    let scanned = 0;
    for (const store of sources) {
      if (!Array.isArray(store)) continue;
      for (const command of store) {
        if (scanned >= limits.scan) break;
        scanned += 1;
        if (!command?.id) continue;
        const key = String(command.dedupeKey || command.id);
        const previous = unique.get(key);
        const currentTime = new Date(command.completedAt || command.failedAt || command.deliveredAt || command.createdAt || 0).getTime();
        const previousTime = previous ? new Date(previous.completedAt || previous.failedAt || previous.deliveredAt || previous.createdAt || 0).getTime() : -1;
        if (!previous || currentTime >= previousTime) unique.set(key, command);
      }
      if (scanned >= limits.scan) break;
    }

    const active = [];
    const history = [];
    for (const command of unique.values()) {
      command.dedupeKey ||= this.deriveDedupeKey(command.userId, command.accountId, command.command, command.payload || {});
      const status = this.effectiveStatus(command);
      if (status === 'expired' && command.status !== 'expired') {
        command.status = 'expired';
        command.expiredAt ||= nowIso();
      }
      if (['pending', 'delivered'].includes(status)) active.push(command);
      else history.push(command);
    }
    active.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    history.sort((a, b) => new Date(b.completedAt || b.failedAt || b.expiredAt || b.createdAt || 0) - new Date(a.completedAt || a.failedAt || a.expiredAt || a.createdAt || 0));

    const retainedActive = [];
    const byUser = new Map();
    const byAccount = new Map();
    let criticalCount = 0;
    let droppedActive = 0;
    for (const command of active) {
      const critical = this.isCriticalCommand(command);
      const userKey = String(command.userId || '');
      const accountKey = String(command.accountId || '');
      const userCount = byUser.get(userKey) || 0;
      const accountCount = accountKey ? (byAccount.get(accountKey) || 0) : 0;
      const overNormalLimit = retainedActive.length >= limits.global || userCount >= limits.perUser || (accountKey && accountCount >= limits.perAccount);
      const overCriticalLimit = critical && criticalCount >= limits.critical;
      if ((!critical && overNormalLimit) || overCriticalLimit) {
        droppedActive += 1;
        continue;
      }
      retainedActive.push(command);
      byUser.set(userKey, userCount + 1);
      if (accountKey) byAccount.set(accountKey, accountCount + 1);
      if (critical) criticalCount += 1;
    }

    const retainedHistory = history.slice(0, this.commandHistoryLimit);
    return {
      commandQueue: [...retainedActive, ...retainedHistory],
      commandAuditLog: (raw.commandAuditLog || []).slice(0, this.commandAuditLimit),
      schemaVersion: 2,
      queueCompaction: {
        scanned,
        retainedActive: retainedActive.length,
        retainedHistory: retainedHistory.length,
        droppedActive,
        compactedAt: nowIso(),
      },
    };
  }

  emptyState() {
    return { commandQueue: [], commandAuditLog: [], schemaVersion: 2, queueCompaction: null };
  }

  normalizeState(raw = {}) {
    return this.pruneCommandState(raw || {});
  }

  compactPersistenceState(data = {}) {
    return this.pruneCommandState(data || {});
  }

  async loadHot() {
    if (this.hotState) return this.hotState;
    if (this.hotLoadPromise) return this.hotLoadPromise;

    this.hotLoadPromise = (async () => {
      try {
        const peeked = this.persistence.peek?.();
        const raw = peeked || await this.persistence.load({ cloneResult: false });
        this.hotState = this.normalizeState(raw || {});
        return this.hotState;
      } catch {
        this.hotState = this.emptyState();
        return this.hotState;
      }
    })();

    try {
      return await this.hotLoadPromise;
    } finally {
      this.hotLoadPromise = null;
    }
  }

  async mutate(mutator) {
    let result;
    let nextHotState = null;
    const persisted = await this.persistence.atomicUpdate(async (raw) => {
      const data = this.normalizeState(raw || {});
      result = await mutator(data);
      nextHotState = this.pruneCommandState(data);
      return this.compactPersistenceState(nextHotState);
    }, { cloneResult: false });
    // Use the already-normalized working state when available. Falling back to
    // the compact persisted result supports custom/test adapters.
    this.hotState = nextHotState || this.normalizeState(persisted || {});
    return result;
  }

  async load({ cloneResult = true, includeIndexes = true } = {}) {
    const data = await this.loadHot();
    if (!cloneResult && !includeIndexes) return data;
    const commandQueue = cloneResult ? clone(data.commandQueue || []) : (data.commandQueue || []);
    const commandAuditLog = cloneResult ? clone(data.commandAuditLog || []) : (data.commandAuditLog || []);
    if (!includeIndexes) return { commandQueue, commandAuditLog };
    // Preserve the legacy public shape only for admin/status callers. Internal
    // copier-close recovery reads the canonical queue directly without duplicating it.
    const commandsByUserId = {};
    const commandsByAccountId = {};
    for (const record of commandQueue) {
      commandsByUserId[record.userId] ||= [];
      commandsByUserId[record.userId].push(record);
      if (record.accountId) {
        commandsByAccountId[record.accountId] ||= [];
        commandsByAccountId[record.accountId].push(record);
      }
    }
    return { commandQueue, commandsByUserId, commandsByAccountId, commandAuditLog };
  }

  async save(data) {
    const normalized = this.normalizeState(data || {});
    const saved = await this.persistence.save(this.compactPersistenceState(normalized));
    this.hotState = normalized;
    return saved;
  }

  buildRecord(userId, accountId, command, payload = {}) {
    const createdAt = nowIso();
    const immediate = payload.immediate !== false;
    const priority = Number(payload.priority ?? (immediate ? 100 : 10));
    const ttlMinutes = Number(payload.ttlMinutes || payload.ttl || (immediate ? 2 : 15));
    const resolvedAccountId = accountId || payload.accountId || null;
    const dedupeKey = this.deriveDedupeKey(userId, resolvedAccountId, command, payload);
    const commandId = payload.commandId
      ? cleanKey(payload.commandId)
      : dedupeKey
        ? `dedupe_${shortHash(dedupeKey)}`
        : `${Date.now()}_${randomUUID().slice(0, 8)}`;
    return {
      id: `wisdo_${commandId}`,
      dedupeKey,
      userId,
      accountId: resolvedAccountId,
      accountNumber: payload.accountNumber || null,
      pairingCode: payload.pairingCode || null,
      command,
      payload,
      status: 'pending',
      attempts: 0,
      priority,
      immediate,
      createdAt,
      expiresAt: payload.expiresAt || addMinutes(ttlMinutes),
    };
  }

  ensureQueueCapacity(data, record) {
    const queue = Array.isArray(data.commandQueue) ? data.commandQueue : [];
    const limits = this.activeQueueLimits();
    const active = queue.filter((item) => ['pending', 'delivered'].includes(this.effectiveStatus(item)));
    const critical = this.isCriticalCommand(record);
    const userCount = active.filter((item) => String(item.userId || '') === String(record.userId || '')).length;
    const accountCount = record.accountId ? active.filter((item) => String(item.accountId || '') === String(record.accountId || '')).length : 0;
    const over = active.length >= limits.global || userCount >= limits.perUser || (record.accountId && accountCount >= limits.perAccount);
    if (!over || critical) return;
    const error = new Error('MT4 command queue is at capacity for this account. New entry commands are paused until the Reporter drains the queue.');
    error.code = 'WISDO_MT4_QUEUE_CAPACITY';
    error.queue = { active: active.length, userActive: userCount, accountActive: accountCount, limits };
    throw error;
  }

  addRecord(data, record, { sortQueue = true } = {}) {
    data.commandQueue ||= [];
    this.ensureQueueCapacity(data, record);
    data.commandQueue.push(record);
    if (sortQueue) data.commandQueue.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    const dangerous = DANGEROUS_COMMANDS.has(String(record.command || '').toUpperCase()) || Boolean(record.validation?.dangerous);
    this.appendAudit(data, dangerous ? 'mt4_command.dangerous_requested' : 'mt4_command.queued', {
      commandId: record.id,
      dedupeKey: record.dedupeKey || null,
      userId: record.userId,
      accountId: record.accountId,
      command: record.command,
      confirmationRequired: dangerous,
      confirmed: record.payload?.confirmation === 'confirmed' || record.confirmation === 'confirmed',
    });
  }

  commandStores(data) {
    return [data.commandQueue || []];
  }

  findCommandCopies(data, commandId) {
    const id = String(commandId || '');
    if (!id) return [];
    const copies = [];
    const stores = [
      data.commandQueue || [],
      ...Object.values(data.commandsByUserId || {}),
      ...Object.values(data.commandsByAccountId || {}),
    ];
    for (const store of stores) {
      if (!Array.isArray(store)) continue;
      for (const item of store) if (String(item?.id || '') === id) copies.push(item);
    }
    return copies;
  }

  syncCommandCopies(data, commandId, patch = {}) {
    const command = this.findCommandCopies(data, commandId)[0] || null;
    if (command) Object.assign(command, patch);
    return command;
  }

  validateCommand(commandOrUserId, maybeAccountId = null, maybeCommand = null, maybePayload = {}) {
    const candidate = typeof commandOrUserId === 'object'
      ? commandOrUserId
      : { userId: commandOrUserId, accountId: maybeAccountId, command: maybeCommand, payload: maybePayload };
    const command = String(candidate.command || '').trim().toUpperCase();
    const payload = candidate.payload || {};
    const accountId = candidate.accountId || payload.accountId || null;
    const errors = [];
    const warnings = [];

    if (!candidate.userId) errors.push('userId_required');
    if (!command) errors.push('command_required');
    if (ACCOUNT_COMMANDS.has(command) && !accountId) errors.push('accountId_required');
    if (DANGEROUS_COMMANDS.has(command)) {
      warnings.push('dangerous_command');
      if (payload.confirmation !== 'confirmed' && candidate.confirmation !== 'confirmed') {
        errors.push('confirmation_required');
      }
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      command,
      accountId,
      dangerous: DANGEROUS_COMMANDS.has(command),
      voiceSafe: !DANGEROUS_COMMANDS.has(command),
    };
  }

  createCommand(userId, accountId = null, command = null, payload = {}) {
    const input = typeof userId === 'object'
      ? userId
      : { userId, accountId, command, payload };
    const validation = this.validateCommand(input);
    if (!validation.ok) {
      const error = new Error(`Invalid MT4 command: ${validation.errors.join(', ')}`);
      error.validation = validation;
      throw error;
    }

    return {
      ...this.buildRecord(input.userId, validation.accountId, validation.command, input.payload || {}),
      validation,
      requiresConfirmation: validation.dangerous,
      confirmationRequired: validation.dangerous,
      confirmedAt: validation.dangerous && (input.payload?.confirmation === 'confirmed' || input.confirmation === 'confirmed') ? nowIso() : null,
      voiceSafe: validation.voiceSafe,
    };
  }

  async queueCommandForAccount(userId, accountId, command, payload = {}) {
    const validation = this.validateCommand(userId, accountId, command, payload);
    if (!validation.ok) {
      const error = new Error(`Invalid MT4 command: ${validation.errors.join(', ')}`);
      error.validation = validation;
      throw error;
    }
    return this.mutate(async (data) => {
      const dedupeKey = this.deriveDedupeKey(userId, validation.accountId, validation.command, payload);
      const deterministicId = payload?.commandId ? `wisdo_${cleanKey(payload.commandId)}` : (dedupeKey ? `wisdo_dedupe_${shortHash(dedupeKey)}` : '');
      if (deterministicId || dedupeKey) {
        const existing = (data.commandQueue || []).find((item) =>
          (String(item?.id || '') === deterministicId || (dedupeKey && String(item?.dedupeKey || '') === dedupeKey)) &&
          String(item?.accountId || '') === String(validation.accountId || '') &&
          String(item?.command || '').toUpperCase() === String(validation.command || '').toUpperCase() &&
          !['failed', 'expired', 'cancelled'].includes(String(item?.status || '').toLowerCase())
        );
        if (existing) return existing;
      }
      const record = {
        ...this.buildRecord(userId, validation.accountId, validation.command, payload),
        validation,
        requiresConfirmation: validation.dangerous,
        confirmationRequired: validation.dangerous,
        confirmedAt: validation.dangerous && (payload?.confirmation === 'confirmed') ? nowIso() : null,
      };
      this.addRecord(data, record);
      return record;
    });
  }

  async queueCommandsForAccountsBatch(inputs = []) {
    const prepared = inputs.map((input = {}) => {
      const userId = input.userId;
      const accountId = input.accountId || input.payload?.accountId || null;
      const command = input.command;
      const payload = input.payload || {};
      const validation = this.validateCommand(userId, accountId, command, payload);
      if (!validation.ok) {
        const error = new Error(`Invalid MT4 command: ${validation.errors.join(', ')}`);
        error.validation = validation;
        throw error;
      }
      return { userId, accountId: validation.accountId, command: validation.command, payload, validation };
    });
    if (!prepared.length) return [];

    return this.mutate(async (data) => {
      const results = [];
      for (const input of prepared) {
        const dedupeKey = this.deriveDedupeKey(input.userId, input.accountId, input.command, input.payload);
        const deterministicId = input.payload?.commandId ? `wisdo_${cleanKey(input.payload.commandId)}` : (dedupeKey ? `wisdo_dedupe_${shortHash(dedupeKey)}` : '');
        const existing = (deterministicId || dedupeKey)
          ? (data.commandQueue || []).find((item) =>
            (String(item?.id || '') === deterministicId || (dedupeKey && String(item?.dedupeKey || '') === dedupeKey)) &&
            String(item?.accountId || '') === String(input.accountId || '') &&
            String(item?.command || '').toUpperCase() === String(input.command || '').toUpperCase() &&
            !['failed', 'expired', 'cancelled'].includes(this.effectiveStatus(item)))
          : null;
        if (existing) {
          results.push(existing);
          continue;
        }
        const record = {
          ...this.buildRecord(input.userId, input.accountId, input.command, input.payload),
          validation: input.validation,
          requiresConfirmation: input.validation.dangerous,
          confirmationRequired: input.validation.dangerous,
          confirmedAt: input.validation.dangerous && input.payload?.confirmation === 'confirmed' ? nowIso() : null,
        };
        this.addRecord(data, record, { sortQueue: false });
        results.push(record);
      }
      data.commandQueue.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      return results;
    });
  }

  async queueCommand(userId, command = null, payload = {}) {
    if (typeof userId === 'object' && userId?.command) {
      return this.mutate(async (data) => {
        const record = {
          ...userId,
          id: userId.id || `wisdo_${Date.now()}_${randomUUID().slice(0, 8)}`,
          status: userId.status || 'pending',
          attempts: Number(userId.attempts || 0),
          createdAt: userId.createdAt || nowIso(),
          expiresAt: userId.expiresAt || addMinutes(Number(userId.ttlMinutes || userId.ttl || 15)),
        };
        this.addRecord(data, record);
        return record;
      });
    }

    if (payload?.accountId) return this.queueCommandForAccount(userId, payload.accountId, command, payload);
    const validation = this.validateCommand(userId, null, command, payload);
    if (!validation.ok) {
      const error = new Error(`Invalid MT4 command: ${validation.errors.join(', ')}`);
      error.validation = validation;
      throw error;
    }
    return this.mutate(async (data) => {
      const record = {
        ...this.buildRecord(userId, null, validation.command, payload),
        validation,
        requiresConfirmation: validation.dangerous,
        confirmationRequired: validation.dangerous,
        confirmedAt: validation.dangerous && (payload?.confirmation === 'confirmed') ? nowIso() : null,
      };
      this.addRecord(data, record);
      return record;
    });
  }

  commandMatches(command, { accountId = null, accountNumber = null, pairingCode = null } = {}) {
    if (!['pending', 'delivered'].includes(command.status)) return false;
    if (isExpired(command)) return false;
    if (command.status === 'delivered' && !deliveryRetryReady(command)) return false;
    if (accountId && command.accountId && command.accountId !== accountId) return false;
    if (accountNumber && command.accountNumber && String(command.accountNumber) !== String(accountNumber)) return false;
    if (pairingCode && command.pairingCode && String(command.pairingCode) !== String(pairingCode)) return false;
    return true;
  }

  async expireStaleCommands(data = null) {
    if (!data) {
      return this.mutate(async (owned) => this.expireStaleCommands(owned));
    }
    const owned = data;
    const expiredAt = nowIso();
    const expiredIds = new Set();
    for (const store of this.commandStores(owned)) {
      for (const command of store || []) {
        if (['pending', 'delivered'].includes(command.status) && isExpired(command)) {
          expiredIds.add(command.id);
        }
      }
    }
    for (const commandId of expiredIds) {
      this.syncCommandCopies(owned, commandId, { status: 'expired', expiredAt });
    }
    return owned;
  }

  async getPendingCommand(userId, scope = {}) {
    const data = await this.loadHot();
    const accountId = scope?.accountId || null;
    const accountNumber = scope?.accountNumber ? String(scope.accountNumber) : null;
    const pairingCode = scope?.pairingCode ? String(scope.pairingCode) : null;
    return (data.commandQueue || []).find((command) =>
      String(command.userId) === String(userId) && this.commandMatches(command, { accountId, accountNumber, pairingCode })
    ) || null;
  }

  async getAllPendingCommands(userId) {
    const data = await this.loadHot();
    return (data.commandQueue || []).filter((command) => String(command.userId) === String(userId) && this.commandMatches(command));
  }

  async getPendingCommandForAnyUser(userIds = [], scope = {}) {
    const ids = new Set((userIds || []).map((value) => String(value || '').trim()).filter(Boolean));
    if (!ids.size) return { userId: '', command: null };
    const data = await this.loadHot();
    const command = (data.commandQueue || []).find((row) => ids.has(String(row?.userId || '')) && this.commandMatches(row, scope)) || null;
    return { userId: command?.userId || '', command };
  }

  findCommand(data, userId, commandId, accountId = null) {
    const id = String(commandId || '');
    if (!id) return null;
    const copies = this.findCommandCopies(data, id);
    if (!copies.length) return null;
    const scoped = copies.filter((item) => {
      if (accountId && item.accountId && item.accountId !== accountId) return false;
      if (userId && item.userId && String(item.userId) !== String(userId)) return false;
      return true;
    });
    const rank = { completed: 5, failed: 5, expired: 4, delivered: 3, pending: 2 };
    return (scoped.length ? scoped : copies).sort((a, b) => Number(rank[b.status] || 0) - Number(rank[a.status] || 0) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null;
  }

  async markCommandDelivered(userId, commandId, accountId = null) {
    return this.mutate(async (data) => {
      const command = this.findCommand(data, userId, commandId, accountId);
      if (command) {
        this.syncCommandCopies(data, command.id, {
          status: 'delivered',
          deliveredAt: nowIso(),
          attempts: Number(command.attempts || 0) + 1,
        });
      }
      return command ? this.findCommand(data, userId, commandId, accountId) : null;
    });
  }

  async markCommandDeliveredForAnyUser(userIds = [], commandId, accountId = null) {
    const ids = new Set((userIds || []).map((value) => String(value || '').trim()).filter(Boolean));
    return this.mutate(async (data) => {
      const command = this.findCommand(data, null, commandId, accountId);
      if (!command || (ids.size && !ids.has(String(command.userId || '')))) return { userId: '', command: null };
      this.syncCommandCopies(data, command.id, {
        status: 'delivered',
        deliveredAt: nowIso(),
        attempts: Number(command.attempts || 0) + 1,
      });
      return { userId: String(command.userId || ''), command: this.findCommand(data, command.userId, command.id, accountId) };
    });
  }

  async markCommandCompleteForAnyUser(userIds = [], commandId, result = {}, accountId = null) {
    const ids = new Set((userIds || []).map((value) => String(value || '').trim()).filter(Boolean));
    return this.mutate(async (data) => {
      const command = this.findCommand(data, null, commandId, accountId);
      if (!command || (ids.size && !ids.has(String(command.userId || '')))) return { userId: '', command: null };
      const success = result?.success !== false;
      this.syncCommandCopies(data, command.id, success
        ? { status: 'completed', completedAt: nowIso(), result }
        : { status: 'failed', failedAt: nowIso(), errorMessage: result?.message || 'MT4 command failed', result: { ...result, success: false } });
      return { userId: String(command.userId || ''), command: this.findCommand(data, command.userId, command.id, accountId) };
    });
  }

  async markCommandCompleted(userId, commandId, result = {}, accountId = null) {
    return this.mutate(async (data) => {
      const command = this.findCommand(data, userId, commandId, accountId);
      if (command) {
        this.syncCommandCopies(data, command.id, {
          status: 'completed',
          completedAt: nowIso(),
          result,
        });
      }
      return command ? this.findCommand(data, userId, commandId, accountId) : null;
    });
  }

  async markCommandFailed(userId, commandId, errorMessage, accountId = null) {
    return this.mutate(async (data) => {
      const command = this.findCommand(data, userId, commandId, accountId);
      if (command) {
        this.syncCommandCopies(data, command.id, {
          status: 'failed',
          failedAt: nowIso(),
          errorMessage,
          result: { success: false, message: String(errorMessage || 'MT4 command failed') },
        });
      }
      return command ? this.findCommand(data, userId, commandId, accountId) : null;
    });
  }

  async getCommandStatus(userId, commandId = null, accountId = null) {
    const data = await this.loadHot();
    const command = commandId === null
      ? this.findCommand(data, null, userId, null)
      : this.findCommand(data, userId, commandId, accountId);
    if (!command) return null;
    const status = this.effectiveStatus(command);
    return status === command.status ? command : { ...command, status, expiredAt: command.expiredAt || nowIso() };
  }

  async listAccountCommands(userId, accountId, { limit = 50, status = null } = {}) {
    const data = await this.loadHot();
    const rows = data.commandQueue || [];
    const seen = new Set();
    return rows
      .filter((command) => {
        if (!command?.id || seen.has(command.id)) return false;
        seen.add(command.id);
        if (String(command.userId) !== String(userId)) return false;
        if (accountId && command.accountId !== accountId) return false;
        if (status && this.effectiveStatus(command) !== status) return false;
        return true;
      })
      .map((command) => this.effectiveStatus(command) === command.status ? command : { ...command, status: 'expired' })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, Number(limit || 50));
  }

  async getQueueStatus(userId, accountId = null) {
    const data = await this.loadHot();
    const rows = (data.commandQueue || []).filter((command) => {
      if (String(command.userId) !== String(userId)) return false;
      if (accountId && command.accountId !== accountId) return false;
      return true;
    }).map((command) => ({ ...command, status: this.effectiveStatus(command) }));
    return {
      total: rows.length,
      pending: rows.filter((c) => c.status === 'pending').length,
      delivered: rows.filter((c) => c.status === 'delivered').length,
      completed: rows.filter((c) => c.status === 'completed').length,
      failed: rows.filter((c) => c.status === 'failed').length,
      expired: rows.filter((c) => c.status === 'expired').length,
      recent: rows.slice(-10).reverse(),
    };
  }

  async getQueueMetrics() {
    const data = await this.loadHot();
    let active = 0;
    let pending = 0;
    let delivered = 0;
    let completed = 0;
    let failed = 0;
    let expired = 0;
    for (const command of data.commandQueue || []) {
      const status = this.effectiveStatus(command);
      if (status === 'pending') { active += 1; pending += 1; }
      else if (status === 'delivered') { active += 1; delivered += 1; }
      else if (status === 'completed') completed += 1;
      else if (status === 'failed') failed += 1;
      else if (status === 'expired') expired += 1;
    }
    return {
      total: (data.commandQueue || []).length,
      active,
      pending,
      delivered,
      completed,
      failed,
      expired,
      history: Math.max(0, (data.commandQueue || []).length - active),
      historyLimit: this.commandHistoryLimit,
      audit: (data.commandAuditLog || []).length,
      schemaVersion: 2,
      compaction: data.queueCompaction || null,
    };
  }

  appendAudit(data, action, details = {}) {
    data.commandAuditLog ||= [];
    data.commandAuditLog.unshift({
      auditId: `mt4_audit_${randomUUID()}`,
      action,
      details,
      createdAt: nowIso(),
    });
    data.commandAuditLog = data.commandAuditLog.slice(0, this.commandAuditLimit);
  }
}
