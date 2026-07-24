import { randomUUID } from 'node:crypto';
import { canUseCopier } from '../config/discordRoleMap.js';

function nowIso() {
  return new Date().toISOString();
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function roundLot(value) {
  const n = num(value, 0.01);
  return Math.max(0.01, Math.round(n * 100) / 100);
}

function normalizeRisk(risk = {}) {
  return {
    mode: String(risk.mode || risk.riskMode || 'fixed_lot'),
    fixedLot: num(risk.fixedLot ?? risk.targetFixedLot, 0.01),
    multiplier: num(risk.multiplier, 1),
    riskPercent: num(risk.riskPercent ?? risk.targetRiskPercent, 1),
    maxLot: num(risk.maxLot, 0.05),
    copySLTP: Boolean(risk.copySLTP),
    paperMode: Boolean(risk.paperMode),
  };
}

export class SignalCopyService {
  constructor({ repository, signalGridService, mt4SyncService = null, mt4CommandService = null, roleSyncService = null, logger = console } = {}) {
    this.repository = repository;
    this.signalGridService = signalGridService;
    this.mt4SyncService = mt4SyncService;
    this.mt4CommandService = mt4CommandService;
    this.roleSyncService = roleSyncService;
    this.logger = logger;
  }

  async validateSignalCopyAccess(userId = '', botId = '', signalId = '', accountId = '') {
    const reasons = [];
    const access = this.roleSyncService ? await this.roleSyncService.getAccessForUser(userId) : { wisdoRoles: [] };
    if (!canUseCopier(access)) reasons.push('CULTURE COIN MEMBER+ or copier_eligible role is required.');

    const detail = await this.signalGridService.getSignalDetail(userId, signalId);
    if (!detail?.signal) reasons.push('Signal was not found.');
    if (detail?.signal && ['inactive', 'expired', 'offline'].includes(detail.signal.status)) reasons.push('Signal is inactive, expired, or offline.');

    const accounts = await this.getAccounts(userId);
    const account = accountId
      ? accounts.find((item) => String(item.accountId) === String(accountId))
      : accounts.find((item) => item.selected || item.default) || accounts[0];
    if (!accounts.length) reasons.push('Connect an MT4 account before copying.');
    if (!account) reasons.push('Select a follower account before copying.');

    const state = await this.repository.loadState().catch(() => ({}));
    const profile = state.copyRiskProfilesByUserId?.[String(userId)] || state.riskProfilesByUserId?.[String(userId)] || {};
    const risk = normalizeRisk({ ...(profile || {}), ...(account?.copyRisk || {}) });
    if (!risk.mode) reasons.push('Complete risk settings before copying.');
    if (detail?.signal?.educationRequired) reasons.push('Required bot education must be completed before live copy.');

    return {
      ok: reasons.length === 0,
      reasons,
      access,
      signal: detail?.signal || null,
      basket: detail?.basket || null,
      account: account || null,
      risk,
    };
  }

  async previewCopySignal(userId = '', accountId = '', signalId = '', riskSettings = {}) {
    const validation = await this.validateSignalCopyAccess(userId, '', signalId, accountId);
    const risk = normalizeRisk({ ...validation.risk, ...(riskSettings || {}) });
    const signalLot = roundLot(validation.signal?.metadataJson?.lots || validation.signal?.metadataJson?.sourceLots || 0.01);
    const projectedLot = this.projectLot({ signalLot, risk, account: validation.account, signal: validation.signal });
    const preview = {
      ok: true,
      allowed: validation.ok,
      blockedReasons: validation.reasons,
      userId: String(userId || ''),
      accountId: validation.account?.accountId || accountId || '',
      signalId,
      botId: validation.signal?.botId || '',
      symbol: validation.signal?.symbol || '',
      direction: validation.signal?.direction || '',
      basketGrowthPercent: validation.signal?.basketGrowthPercent || 0,
      floatingPnl: validation.signal?.floatingPnl || 0,
      projectedLot,
      risk,
      paperModeAvailable: true,
      message: validation.ok
        ? 'Preview ready. Live copy still uses confirmation and risk controls.'
        : 'Copy is blocked until the listed requirements are satisfied.',
      riskWarning: 'Projected lot is calculated from your risk profile. Wisdo never blindly copies source lot size.',
    };
    await this.logSignalCopyAction({ userId, action: 'signal_copy.previewed', signalId, botId: preview.botId, symbol: preview.symbol, result: validation.ok ? 'allowed' : 'blocked', reason: validation.reasons.join('; ') });
    return preview;
  }

  async copySignalBasket(userId = '', accountId = '', signalId = '', riskSettings = {}) {
    const preview = await this.previewCopySignal(userId, accountId, signalId, riskSettings);
    const paperMode = Boolean(riskSettings.paperMode || preview.risk.paperMode);
    if (!preview.allowed) {
      await this.logSignalCopyAction({ userId, action: 'signal_copy.blocked', signalId, botId: preview.botId, symbol: preview.symbol, result: 'blocked', reason: preview.blockedReasons.join('; ') });
      return { ok: false, blocked: true, preview, error: preview.blockedReasons[0] || 'Copy blocked.' };
    }

    const command = {
      id: `sigcopy_${Date.now()}_${randomUUID().slice(0, 8)}`,
      userId: String(userId || ''),
      accountId: String(accountId || preview.accountId || ''),
      signalId,
      botId: preview.botId,
      symbol: preview.symbol,
      direction: preview.direction,
      projectedLot: preview.projectedLot,
      paperMode,
      source: 'wisdo_signal_grid',
      status: paperMode ? 'paper_recorded' : 'queued',
      createdAt: nowIso(),
    };

    if (!paperMode && this.mt4CommandService?.queueCommandForAccount) {
      command.mt4Command = await this.mt4CommandService.queueCommandForAccount(userId, command.accountId, 'COPY_SIGNAL_BASKET', command);
    }

    await this.logSignalCopyAction({ userId, action: paperMode ? 'signal_copy.paper_basket' : 'signal_copy.basket_queued', signalId, botId: preview.botId, symbol: preview.symbol, result: 'ok', metadata: command });
    return { ok: true, command, preview };
  }

  async subscribeToBotSignals(userId = '', accountId = '', botId = '', riskSettings = {}) {
    const access = this.roleSyncService ? await this.roleSyncService.getAccessForUser(userId) : { wisdoRoles: [] };
    if (!canUseCopier(access)) throw new Error('CULTURE COIN MEMBER+ or copier_eligible role is required.');
    const accounts = await this.getAccounts(userId);
    const account = accountId ? accounts.find((item) => String(item.accountId) === String(accountId)) : accounts[0];
    if (!account) throw new Error('Connect and select an MT4 account before subscribing to bot signals.');
    let subscription;
    await this.repository.updateState((state) => {
      state.copyBotSubscriptionsById ||= {};
      const subId = `copybot_${String(userId)}_${String(botId)}`.replace(/[^a-zA-Z0-9_:-]/g, '_');
      subscription = {
        id: subId,
        subscriptionId: subId,
        userId: String(userId || ''),
        botId: String(botId || ''),
        sourceId: String(riskSettings.sourceId || ''),
        accountId: String(account?.accountId || accountId || ''),
        status: 'active',
        riskSettingsJson: normalizeRisk(riskSettings),
        paperMode: Boolean(riskSettings.paperMode),
        createdAt: state.copyBotSubscriptionsById[subId]?.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
      state.copyBotSubscriptionsById[subId] = subscription;
      this.addAudit(state, userId, 'signal_grid.bot_subscribed', 'CopyBotSubscription', subId, subscription);
      return state;
    });
    await this.logSignalCopyAction({ userId, action: 'signal_copy.bot_subscribed', botId, result: 'ok' });
    return subscription;
  }

  async unsubscribeFromBotSignals(userId = '', botId = '') {
    let subscription = null;
    await this.repository.updateState((state) => {
      const sub = Object.values(state.copyBotSubscriptionsById || {}).find((item) => String(item.userId) === String(userId) && String(item.botId) === String(botId));
      if (sub) {
        sub.status = 'cancelled';
        sub.updatedAt = nowIso();
        subscription = sub;
        this.addAudit(state, userId, 'signal_grid.bot_unsubscribed', 'CopyBotSubscription', sub.id || sub.subscriptionId, { botId });
      }
      return state;
    });
    await this.logSignalCopyAction({ userId, action: 'signal_copy.bot_unsubscribed', botId, result: subscription ? 'ok' : 'not_found' });
    return subscription;
  }

  async listUserCopies(userId = '') {
    const state = await this.repository.loadState();
    return Object.values(state.copyBotSubscriptionsById || {}).filter((sub) => String(sub.userId) === String(userId));
  }

  async logSignalCopyAction(event = {}) {
    if (this.signalGridService?.logInteraction) {
      return this.signalGridService.logInteraction(event);
    }
    return null;
  }

  projectLot({ signalLot = 0.01, risk = {}, account = {}, signal = {} } = {}) {
    const settings = normalizeRisk(risk);
    let lot = settings.fixedLot;
    if (settings.mode === 'same_lot') lot = signalLot;
    if (settings.mode === 'multiplier') lot = signalLot * settings.multiplier;
    if (settings.mode === 'risk_percent') {
      const equity = num(account?.latestSnapshot?.snapshot?.equity || account?.equity, 1000);
      const symbolFactor = String(signal?.symbol || '').includes('XAU') ? 1000 : 10000;
      lot = (equity * (settings.riskPercent / 100)) / symbolFactor;
    }
    return Math.min(roundLot(lot), settings.maxLot);
  }

  async getAccounts(userId = '') {
    if (this.mt4SyncService?.repository?.getAccessibleMt4Accounts) {
      return this.mt4SyncService.repository.getAccessibleMt4Accounts(userId);
    }
    return [];
  }

  addAudit(state, actorUserId, action, targetType, targetId, data = {}) {
    if (typeof this.repository.addAuditToState === 'function') {
      return this.repository.addAuditToState(state, { adminId: actorUserId, action, targetType, targetId, data });
    }
    return null;
  }
}
