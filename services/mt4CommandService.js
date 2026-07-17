import { randomUUID } from 'node:crypto';

import { createPersistenceAdapter } from './persistenceAdapter.js';

const commandMutationQueues = new Map();

async function runCommandMutation(key, task) {
  const previous = commandMutationQueues.get(key) || Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  commandMutationQueues.set(key, current);
  try {
    return await current;
  } finally {
    if (commandMutationQueues.get(key) === current) commandMutationQueues.delete(key);
  }
}

function nowIso() { return new Date().toISOString(); }
function addMinutes(minutes) { const d = new Date(); d.setMinutes(d.getMinutes() + minutes); return d.toISOString(); }
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
    this.mutationKey = this.persistence.filePath || `mt4-commands:${this.dataDir}`;
  }

  async mutate(mutator) {
    return runCommandMutation(this.mutationKey, async () => {
      const data = await this.load();
      const result = await mutator(data);
      await this.save(data);
      return result;
    });
  }

  async load() {
    try {
      const data = await this.persistence.load();
      return {
        commandsByUserId: data.commandsByUserId || {},
        commandsByAccountId: data.commandsByAccountId || {},
        commandQueue: Array.isArray(data.commandQueue) ? data.commandQueue : [],
        commandAuditLog: Array.isArray(data.commandAuditLog) ? data.commandAuditLog : [],
      };
    } catch {
      return { commandsByUserId: {}, commandsByAccountId: {}, commandQueue: [], commandAuditLog: [] };
    }
  }

  async save(data) {
    await this.persistence.save(data);
  }

  buildRecord(userId, accountId, command, payload = {}) {
    const createdAt = nowIso();
    const immediate = payload.immediate !== false;
    const priority = Number(payload.priority ?? (immediate ? 100 : 10));
    const ttlMinutes = Number(payload.ttlMinutes || payload.ttl || (immediate ? 2 : 15));
    return {
      id: payload.commandId ? `wisdo_${payload.commandId}` : `wisdo_${Date.now()}_${randomUUID().slice(0, 8)}`,
      userId,
      accountId: accountId || payload.accountId || null,
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

  addRecord(data, record) {
    data.commandsByUserId ||= {};
    data.commandsByAccountId ||= {};
    data.commandQueue ||= [];
    data.commandsByUserId[record.userId] ||= [];
    data.commandsByUserId[record.userId].push(record);
    data.commandQueue.push(record);
    data.commandQueue.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    if (record.accountId) {
      data.commandsByAccountId[record.accountId] ||= [];
      data.commandsByAccountId[record.accountId].push(record);
    }
    const dangerous = DANGEROUS_COMMANDS.has(String(record.command || '').toUpperCase()) || Boolean(record.validation?.dangerous);
    this.appendAudit(data, dangerous ? 'mt4_command.dangerous_requested' : 'mt4_command.queued', {
      commandId: record.id,
      userId: record.userId,
      accountId: record.accountId,
      command: record.command,
      confirmationRequired: dangerous,
      confirmed: record.payload?.confirmation === 'confirmed' || record.confirmation === 'confirmed',
    });
  }

  commandStores(data) {
    return [
      data.commandQueue || [],
      ...Object.values(data.commandsByUserId || {}),
      ...Object.values(data.commandsByAccountId || {}),
    ];
  }

  findCommandCopies(data, commandId) {
    const id = String(commandId || '');
    if (!id) return [];
    const seen = new Set();
    const copies = [];
    for (const store of this.commandStores(data)) {
      for (const command of store || []) {
        if (!command || command.id !== id || seen.has(command)) continue;
        seen.add(command);
        copies.push(command);
      }
    }
    return copies;
  }

  syncCommandCopies(data, commandId, patch = {}) {
    const copies = this.findCommandCopies(data, commandId);
    for (const command of copies) Object.assign(command, patch);
    return copies[0] || null;
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
      const deterministicId = payload?.commandId ? `wisdo_${payload.commandId}` : '';
      if (deterministicId) {
        const existing = (data.commandQueue || []).find((item) =>
          String(item?.id || '') === deterministicId &&
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
    return this.mutate(async (data) => {
      await this.expireStaleCommands(data);
      const accountId = scope?.accountId || null;
      const accountNumber = scope?.accountNumber ? String(scope.accountNumber) : null;
      const pairingCode = scope?.pairingCode ? String(scope.pairingCode) : null;
      const queue = (data.commandQueue || []).filter((command) => String(command.userId) === String(userId));
      const accountQueue = accountId ? (data.commandsByAccountId?.[accountId] || []) : [];
      const commands = [...accountQueue, ...queue, ...(data.commandsByUserId?.[userId] || [])];
      const seen = new Set();
      const unique = commands.filter((command) => {
        if (!command?.id || seen.has(command.id)) return false;
        seen.add(command.id);
        return true;
      }).sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      return unique.find((command) => this.commandMatches(command, { accountId, accountNumber, pairingCode })) || null;
    });
  }

  async getAllPendingCommands(userId) {
    return this.mutate(async (data) => {
      await this.expireStaleCommands(data);
      return (data.commandQueue || []).filter((command) => String(command.userId) === String(userId) && this.commandMatches(command));
    });
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
    return this.mutate(async (data) => {
      await this.expireStaleCommands(data);
      const command = commandId === null
        ? this.findCommand(data, null, userId, null)
        : this.findCommand(data, userId, commandId, accountId);
      return command || null;
    });
  }

  async listAccountCommands(userId, accountId, { limit = 50, status = null } = {}) {
    return this.mutate(async (data) => {
      await this.expireStaleCommands(data);
      const rows = [
        ...(data.commandsByAccountId?.[accountId] || []),
        ...(data.commandsByUserId?.[userId] || []),
      ];
      const seen = new Set();
      return rows
        .filter((command) => {
          if (!command?.id || seen.has(command.id)) return false;
          seen.add(command.id);
          if (String(command.userId) !== String(userId)) return false;
          if (accountId && command.accountId !== accountId) return false;
          if (status && command.status !== status) return false;
          return true;
        })
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, Number(limit || 50));
    });
  }

  async getQueueStatus(userId, accountId = null) {
    return this.mutate(async (data) => {
      await this.expireStaleCommands(data);
      const rows = (data.commandQueue || []).filter((command) => {
        if (String(command.userId) !== String(userId)) return false;
        if (accountId && command.accountId !== accountId) return false;
        return true;
      });
      return {
        total: rows.length,
        pending: rows.filter((c) => c.status === 'pending').length,
        delivered: rows.filter((c) => c.status === 'delivered').length,
        completed: rows.filter((c) => c.status === 'completed').length,
        failed: rows.filter((c) => c.status === 'failed').length,
        expired: rows.filter((c) => c.status === 'expired').length,
        recent: rows.slice(-10).reverse(),
      };
    });
  }

  appendAudit(data, action, details = {}) {
    data.commandAuditLog ||= [];
    data.commandAuditLog.unshift({
      auditId: `mt4_audit_${randomUUID()}`,
      action,
      details,
      createdAt: nowIso(),
    });
    data.commandAuditLog = data.commandAuditLog.slice(0, 1000);
  }
}
