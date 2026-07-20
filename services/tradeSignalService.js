import { createDatabaseStateStore, createNamedDatabaseStateStore } from '../storage/stateStore.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { SignalCardService } from './signalCardService.js';

function normalizeSide(side) {
  const value = String(side || '').toLowerCase();
  if (value.includes('buy')) return 'BUY';
  if (value.includes('sell')) return 'SELL';
  return String(side || 'TRADE').toUpperCase();
}

function normalizeBotKey(value = '') {
  return String(value || 'wisdo-signal-bot').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'wisdo-signal-bot';
}

function safeNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function encodeAccountId(value) {
  return Buffer.from(String(value || ''), 'utf8').toString('base64url');
}

function decodeAccountId(value) {
  try { return Buffer.from(String(value || ''), 'base64url').toString('utf8'); }
  catch { return ''; }
}

function accountLabel(account) {
  const nick = String(account.nickname || account.accountNickname || account.accountNumber || 'Account');
  const type = account.type || (account.isDemo ? 'Demo' : 'Live');
  const server = account.brokerServer || account.server ? ` ${account.brokerServer || account.server}` : '';
  const shared = account.shared ? ' Shared' : '';
  return `${nick} ${type}${server}${shared}`.slice(0, 80);
}

function normalizeCopyRisk(risk = {}) {
  const next = risk && typeof risk === 'object' ? risk : {};
  const out = {
    enabled: next.enabled !== undefined ? Boolean(next.enabled) : true,
    mode: String(next.mode || 'fixed_lot'),
    fixedLot: Number(next.fixedLot ?? next.targetFixedLot ?? next.followerFixedLot ?? 0.01),
    multiplier: Number(next.multiplier ?? next.riskSetting ?? 1),
    riskSettingPercent: Number(next.riskSettingPercent ?? ((Number(next.multiplier ?? 1)) * 100)),
    riskPercent: Number(next.riskPercent ?? next.targetRiskPercent ?? next.followerRiskPercent ?? 1),
    masterRiskPercent: Number(next.masterRiskPercent ?? next.sourceRiskPercent ?? 1),
    targetRiskPercent: Number(next.targetRiskPercent ?? next.followerRiskPercent ?? next.riskPercent ?? 1),
    masterFixedLot: Number(next.masterFixedLot ?? next.sourceFixedLot ?? 0),
    targetFixedLot: Number(next.targetFixedLot ?? next.followerFixedLot ?? next.fixedLot ?? 0.01),
    maxLot: Number(next.maxLot ?? 0.05),
    maxOpenTrades: Number(next.maxOpenTrades ?? 5),
    maxDailyLossPercent: Number(next.maxDailyLossPercent ?? 0),
    maxDrawdownPercent: Number(next.maxDrawdownPercent ?? 0),
    allowedSymbols: Array.isArray(next.allowedSymbols) ? next.allowedSymbols.map((x) => String(x).toUpperCase()).filter(Boolean) : [],
    symbolMapping: next.symbolMapping && typeof next.symbolMapping === 'object' ? { ...next.symbolMapping } : {},
    blockedSymbols: Array.isArray(next.blockedSymbols) ? next.blockedSymbols.map((x) => String(x).toUpperCase()).filter(Boolean) : [],
    allowOnlyHighlighted: next.allowOnlyHighlighted !== undefined ? Boolean(next.allowOnlyHighlighted) : false,
    copyBuys: next.copyBuys !== undefined ? Boolean(next.copyBuys) : true,
    copySells: next.copySells !== undefined ? Boolean(next.copySells) : true,
    copySLTP: next.copySLTP !== undefined ? Boolean(next.copySLTP) : false,
    copyPendingOrders: next.copyPendingOrders !== undefined ? Boolean(next.copyPendingOrders) : false,
    reverseCopy: next.reverseCopy !== undefined ? Boolean(next.reverseCopy) : false,
    copierPaused: next.copierPaused !== undefined ? Boolean(next.copierPaused) : false,
    equityFloor: Number(next.equityFloor ?? 0),
  };
  if (!Number.isFinite(out.fixedLot) || out.fixedLot <= 0) out.fixedLot = 0.01;
  if (!Number.isFinite(out.targetFixedLot) || out.targetFixedLot <= 0) out.targetFixedLot = out.fixedLot;
  if (!Number.isFinite(out.multiplier) || out.multiplier <= 0) out.multiplier = 1;
  if (!Number.isFinite(out.riskSettingPercent) || out.riskSettingPercent <= 0) out.riskSettingPercent = out.multiplier * 100;
  if (!Number.isFinite(out.riskPercent) || out.riskPercent <= 0) out.riskPercent = 1;
  if (!Number.isFinite(out.maxLot) || out.maxLot <= 0) out.maxLot = 0.05;
  if (!Number.isFinite(out.maxOpenTrades) || out.maxOpenTrades <= 0) out.maxOpenTrades = 5;
  if (!['fixed_lot', 'multiplier', 'same_lot', 'equity_ratio', 'balance_ratio', 'risk_percent'].includes(out.mode)) out.mode = 'fixed_lot';
  return out;
}

function roundLot(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0.01;
  return Math.max(0.01, Math.round(n * 100) / 100);
}

function calculateCopyLots({ signal, account = {}, riskMode = 'fixed_001', risk = {} }) {
  const signalLot = roundLot(signal?.lots || 0.01);
  const settings = normalizeCopyRisk(risk);
  const cap = Number(settings.maxLot || 0.05);
  let lot = 0.01;

  if (riskMode === 'same_signal') lot = signalLot;
  else if (riskMode === 'fixed_002') lot = 0.02;
  else if (riskMode === 'fixed_005') lot = 0.05;
  else if (riskMode === 'my_risk' || riskMode === 'website_auto' || riskMode === 'culture_risk') {
    if (settings.mode === 'same_lot') {
      lot = signalLot;
    } else if (settings.mode === 'multiplier') {
      lot = signalLot * Number(settings.multiplier || 1);
    } else if (settings.mode === 'equity_ratio' || settings.mode === 'balance_ratio') {
      const useBalance = settings.mode === 'balance_ratio';
      const leaderBase = Number(useBalance ? signal?.balance : signal?.equity || 0);
      const followerBase = Number(useBalance ? (account?.latestSnapshot?.snapshot?.balance || account?.balance || 0) : (account?.latestSnapshot?.snapshot?.equity || account?.equity || 0));
      const ratio = leaderBase > 0 && followerBase > 0 ? followerBase / leaderBase : Number(settings.multiplier || 1);
      lot = signalLot * ratio * Number(settings.multiplier || 1);
    } else if (settings.mode === 'risk_percent') {
      const leaderRisk = Number(signal?.leaderRiskPercent || settings.masterRiskPercent || 0);
      const targetRisk = Number(settings.targetRiskPercent || settings.riskPercent || 1);
      lot = leaderRisk > 0 ? signalLot * (targetRisk / leaderRisk) : signalLot * Number(settings.multiplier || 1);
    } else {
      lot = Number(settings.fixedLot || settings.targetFixedLot || 0.01);
    }
  } else {
    lot = 0.01;
  }

  return Math.min(roundLot(lot), cap);
}

function riskAllowsSignal(signal, account = {}) {
  const risk = normalizeCopyRisk(account.copyRisk || {});
  if (risk.copierPaused || risk.enabled === false) return { ok: false, reason: 'Copier is paused or disabled.' };
  if (signal.side === 'BUY' && !risk.copyBuys) return { ok: false, reason: 'Buys are disabled for this copier.' };
  if (signal.side === 'SELL' && !risk.copySells) return { ok: false, reason: 'Sells are disabled for this copier.' };
  const sym = String(signal.symbol || '').toUpperCase();
  if (risk.blockedSymbols.includes(sym)) return { ok: false, reason: `${sym} is blocked.` };
  if (risk.allowOnlyHighlighted && !risk.allowedSymbols.includes(sym)) return { ok: false, reason: `${sym} is not highlighted for this lane.` };
  if (!risk.allowOnlyHighlighted && risk.allowedSymbols.length && !risk.allowedSymbols.includes(sym)) return { ok: false, reason: `${sym} is not in allowed symbols.` };
  const snap = account.latestSnapshot?.snapshot || {};
  if (risk.equityFloor > 0 && Number(snap.equity || 0) > 0 && Number(snap.equity || 0) < risk.equityFloor) return { ok: false, reason: 'Equity is below copier floor.' };
  if (risk.maxOpenTrades > 0 && Number(snap.openTradeCount || 0) >= risk.maxOpenTrades) return { ok: false, reason: 'Max open trades reached.' };
  return { ok: true, reason: 'allowed' };
}

function sanitizeSignalData(input = {}, limit = Math.max(100, Number(process.env.WISDO_SIGNAL_HISTORY_LIMIT || 500))) {
  const sourceById = input?.signalsById && typeof input.signalsById === 'object' ? input.signalsById : {};
  const ordered = Array.isArray(input?.signalIds) ? input.signalIds.map(String).filter(Boolean) : [];
  const fallback = Object.values(sourceById)
    .sort((left, right) => new Date(right?.updatedAt || right?.createdAt || 0) - new Date(left?.updatedAt || left?.createdAt || 0))
    .map((signal) => String(signal?.signalId || ''))
    .filter(Boolean);
  const ids = [...new Set([...ordered, ...fallback])].slice(0, limit);
  const signalsById = {};
  for (const signalId of ids) {
    const raw = sourceById[signalId];
    if (!raw) continue;
    signalsById[signalId] = {
      ...raw,
      takes: Array.isArray(raw.takes) ? raw.takes.slice(-100) : [],
      autoTakes: Array.isArray(raw.autoTakes) ? raw.autoTakes.slice(-100) : [],
      autoCloses: Array.isArray(raw.autoCloses) ? raw.autoCloses.slice(-100) : [],
      mutedBy: Array.isArray(raw.mutedBy) ? raw.mutedBy.slice(-500) : [],
    };
  }
  return { signalsById, signalIds: ids.filter((id) => signalsById[id]) };
}

export class TradeSignalService {
  constructor({ config, client, repository, mt4CommandService, copyTradingService, operatorDeskService, signalGridService = null, discordSignalGridService = null, logger }) {
    this.config = config;
    this.client = client;
    this.repository = repository;
    this.mt4CommandService = mt4CommandService;
    this.copyTradingService = copyTradingService;
    this.operatorDeskService = operatorDeskService;
    this.signalGridService = signalGridService;
    this.discordSignalGridService = discordSignalGridService;
    this.logger = logger;
    this.store = createDatabaseStateStore('trade_signals', () => ({ signalsById: {}, signalIds: [] }));
    this.productStateStore = createNamedDatabaseStateStore('wisdo_phase_1', () => ({}));
    this.ttlSeconds = Number(process.env.SIGNAL_BUTTON_TTL_SECONDS || 180);
    this.signalChannelId = process.env.SIGNAL_CHANNEL_ID || process.env.TRADE_SIGNAL_CHANNEL_ID || '';
    this.signalCardService = new SignalCardService();
    this.backgroundTasks = [];
    this.backgroundTaskCount = 0;
    this.backgroundTaskSequence = 0;
    const requestedConcurrency = Math.max(1, Math.min(8, Number(process.env.WISDO_SIGNAL_BACKGROUND_CONCURRENCY || 1)));
    const renderMemoryMb = Math.max(128, Number(process.env.WISDO_RENDER_MEMORY_LIMIT_MB || 512));
    this.backgroundConcurrency = renderMemoryMb <= 512 ? 1 : requestedConcurrency;
    this.backgroundTaskTimeoutMs = Math.max(1_000, Math.min(60_000, Number(process.env.WISDO_SIGNAL_TASK_TIMEOUT_MS || 15_000)));
    this.backgroundTaskMaxQueue = Math.max(10, Math.min(1000, Number(process.env.WISDO_SIGNAL_BACKGROUND_MAX_QUEUE || 150)));
    this.backgroundTaskDropped = 0;
  }

  async load() {
    return sanitizeSignalData(await this.store.read());
  }

  async save(data) {
    const sanitized = sanitizeSignalData(data);
    await this.store.write(sanitized);
    return sanitized;
  }

  enqueueBackgroundTask(label, task, meta = {}, priority = 0) {
    if (typeof task !== 'function') return false;
    this.backgroundTaskSequence += 1;
    if (this.backgroundTasks.length >= this.backgroundTaskMaxQueue) {
      const lowestIndex = this.backgroundTasks.reduce((best, item, index, rows) => {
        if (best < 0) return index;
        const current = rows[best];
        return item.priority < current.priority || (item.priority === current.priority && item.sequence < current.sequence) ? index : best;
      }, -1);
      const incomingPriority = Number(priority) || 0;
      if (lowestIndex >= 0 && this.backgroundTasks[lowestIndex].priority < incomingPriority) this.backgroundTasks.splice(lowestIndex, 1);
      else {
        this.backgroundTaskDropped += 1;
        this.logger?.warn?.('Deferred signal queue is full; lower-priority work was dropped.', { label, priority: incomingPriority, queueDepth: this.backgroundTasks.length });
        return false;
      }
    }
    this.backgroundTasks.push({ label, task, meta, priority: Number(priority) || 0, sequence: this.backgroundTaskSequence });
    this.backgroundTasks.sort((left, right) => right.priority - left.priority || left.sequence - right.sequence);
    this.drainBackgroundTasks();
    return true;
  }

  getBackgroundStatus() {
    return {
      running: this.backgroundTaskCount,
      queued: this.backgroundTasks.length,
      concurrency: this.backgroundConcurrency,
      maxQueue: this.backgroundTaskMaxQueue,
      dropped: this.backgroundTaskDropped,
    };
  }

  async runBackgroundTask(item) {
    let timeoutId;
    timeoutId = setTimeout(() => {
      this.logger?.warn?.('Deferred signal task is still running; the worker slot remains reserved until it settles.', {
        task: item.label,
        ...item.meta,
        timeoutMs: this.backgroundTaskTimeoutMs,
      });
    }, this.backgroundTaskTimeoutMs);
    timeoutId.unref?.();
    try {
      return await Promise.resolve().then(() => item.task());
    } finally {
      clearTimeout(timeoutId);
    }
  }

  drainBackgroundTasks() {
    while (this.backgroundTaskCount < this.backgroundConcurrency && this.backgroundTasks.length) {
      const item = this.backgroundTasks.shift();
      this.backgroundTaskCount += 1;
      setImmediate(() => {
        this.runBackgroundTask(item)
          .catch((error) => this.logger?.warn?.('Deferred signal task failed.', { task: item.label, ...item.meta, message: error.message }))
          .finally(() => {
            this.backgroundTaskCount -= 1;
            this.drainBackgroundTasks();
          });
      });
    }
  }

  buildSignal(input = {}, index = 0) {
    const { leaderUserId, leaderAccountId, leaderAccountNumber, leaderServer, leaderChannelId, eaName, eaVersion, trade, snapshot } = input;
    if (!trade?.ticket || !trade?.symbol) return null;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlSeconds * 1000);
    const accountToken = String(leaderAccountId || leaderAccountNumber || 'account').replace(/[^a-z0-9]/gi, '').slice(-16) || 'account';
    const signalId = `sig_${now.getTime()}_${accountToken}_${String(trade.ticket)}_${index}`;
    return {
      signalId,
      leaderUserId: String(leaderUserId || ''),
      leaderAccountId: String(leaderAccountId || ''),
      leaderChannelId: String(leaderChannelId || ''),
      leaderAccountNumber: String(leaderAccountNumber || ''),
      leaderServer: String(leaderServer || ''),
      eaName: eaName || snapshot?.eaName || 'EA',
      eaVersion: eaVersion || snapshot?.eaVersion || '',
      sourceTicket: String(trade.ticket),
      symbol: String(trade.symbol || '').toUpperCase(),
      side: normalizeSide(trade.type),
      lots: safeNumber(trade.lots, 0.01),
      openPrice: safeNumber(trade.openPrice),
      stopLoss: safeNumber(trade.stopLoss),
      takeProfit: safeNumber(trade.takeProfit),
      balance: safeNumber(snapshot?.balance),
      equity: safeNumber(snapshot?.equity),
      dailyClosedPL: safeNumber(snapshot?.dailyClosedPL),
      leaderRiskPercent: safeNumber(trade.riskPercent),
      status: 'active',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      ttlSeconds: this.ttlSeconds,
      discordMessageId: null,
      discordChannelId: null,
      takes: [],
      autoTakes: [],
    };
  }

  async createSignalsBatch(inputs = []) {
    const signals = inputs.map((input, index) => this.buildSignal(input, index)).filter(Boolean);
    if (!signals.length) return [];

    const data = await this.load();
    for (const signal of signals) data.signalsById[signal.signalId] = signal;
    data.signalIds = [
      ...signals.map((signal) => signal.signalId),
      ...(data.signalIds || []).filter((id) => !signals.some((signal) => signal.signalId === id)),
    ].slice(0, 500);
    await this.save(data);

    // One copier batch and one presentation batch replace hundreds of per-trade
    // database/network tasks. This keeps the shared Render process responsive.
    this.enqueueBackgroundTask('auto-copy-open-batch', () => this.queueAutoCopyRoutesBatch(signals), {
      leaderAccountId: signals[0]?.leaderAccountId || '',
      signalCount: signals.length,
    }, 100);
    this.enqueueBackgroundTask('signal-presentation-batch', () => this.postSignalsBatch(signals), {
      leaderAccountId: signals[0]?.leaderAccountId || '',
      signalCount: signals.length,
    }, 10);
    return signals;
  }

  async createSignal(input = {}) {
    const signal = this.buildSignal(input, 0);
    if (!signal) return null;
    const data = await this.load();
    data.signalsById[signal.signalId] = signal;
    data.signalIds = [signal.signalId, ...(data.signalIds || []).filter((id) => id !== signal.signalId)].slice(0, 500);
    await this.save(data);

    // Direct/manual callers preserve the old execution-authority guarantee: when
    // createSignal resolves, the copier route has been queued. Discord rendering
    // remains deferred. MT4 heartbeat ingestion uses createSignalsBatch instead.
    await this.queueAutoCopyRoutes(signal).catch((error) => {
      this.logger?.warn?.('Auto copy route queue failed for signal.', { signalId: signal.signalId, message: error.message });
    });
    this.enqueueBackgroundTask('signal-presentation', () => this.postSignal(signal), { signalId: signal.signalId });
    return signal;
  }

  queueSignalClosuresBatch(events = []) {
    const rows = events.filter((row) => row?.sourceTicket);
    if (!rows.length) return { queued: 0 };
    this.enqueueBackgroundTask('auto-copy-close-batch', () => this.queueAutoCopyCloseRoutesBatch(rows), {
      leaderAccountId: rows[0]?.leaderAccountId || '',
      signalCount: rows.length,
    }, 200);
    return { queued: rows.length };
  }

  async resolveSignalChannelId(signal) {
    if (this.signalChannelId) return this.signalChannelId;
    try {
      const state = await this.productStateStore.read();
      const byLeader = state.discordChannelSettingsByUserId?.[String(signal?.leaderUserId || '')]?.tradingSignalsChannelId || '';
      const global = state.discordGlobalChannels?.tradingSignalsChannelId || '';
      return byLeader || global || signal.leaderChannelId || '';
    } catch {
      return signal.leaderChannelId || '';
    }
  }

  async postSignal(signal) {
    const targetChannelId = await this.resolveSignalChannelId(signal);
    if (this.signalGridService) {
      await this.signalGridService.updateSignalCell(this.signalGridPayload(signal));
      if (targetChannelId && this.discordSignalGridService) {
        this.discordSignalGridService.scheduleGridRefresh(targetChannelId);
      }
      return { ok: true, noSpam: true, channelId: targetChannelId || null };
    }

    if (!targetChannelId || !this.client?.channels) {
      this.logger?.warn?.('Trade signal could not post because no signal/desk channel is available.', { signalId: signal.signalId });
      return null;
    }
    const channel = await this.client.channels.fetch(targetChannelId).catch(() => null);
    if (!channel?.send) {
      this.logger?.warn?.('Trade signal channel not found or bot lacks access.', { signalId: signal.signalId, targetChannelId });
      return null;
    }

    const dataForCount = await this.load().catch(() => ({ signalsById: {} }));
    const current = dataForCount.signalsById?.[signal.signalId] || signal;
    const copiedBy = Array.isArray(current.takes) ? current.takes.length + (current.autoTakes?.length || 0) : Number(current.copiedBy || 0);
    const embed = this.signalCardService.buildSignalEmbed(current, { copiedBy });
    const row = this.signalCardService.buildSignalRows(current)[0];

    const message = await channel.send({ embeds: [embed], components: [row] });
    const data = await this.load();
    if (data.signalsById[signal.signalId]) {
      data.signalsById[signal.signalId].discordMessageId = message.id;
      data.signalsById[signal.signalId].discordChannelId = channel.id;
      await this.save(data);
    }
    return message;
  }

  signalGridPayload(signal) {
    return {
      id: signal.signalId,
      signalId: signal.signalId,
      sourceId: signal.leaderAccountId || signal.leaderUserId || 'mt4_reporter',
      botId: normalizeBotKey(signal.eaName || 'wisdo-signal-bot'),
      botName: signal.eaName || 'Wisdo Signal Bot',
      providerId: signal.leaderUserId,
      leaderUserId: signal.leaderUserId,
      symbol: signal.symbol,
      direction: signal.side,
      status: 'active',
      basketId: `basket_${signal.leaderAccountId || signal.leaderUserId}_${signal.symbol}_${signal.sourceTicket}`,
      floatingPnl: signal.floatingPnl || signal.dailyClosedPL || 0,
      balance: signal.balance,
      equity: signal.equity,
      startBalance: signal.balance,
      startEquity: signal.equity,
      openTradeCount: 1,
      averageEntry: signal.openPrice,
      riskMode: 'risk_based',
      expiresAt: signal.expiresAt,
      lastUpdateAt: signal.updatedAt || signal.createdAt,
      sourceName: signal.eaName || 'MT4 Reporter',
      sourceType: 'bridge',
      metadata: { signalId: signal.signalId, sourceTicket: signal.sourceTicket, lots: signal.lots, stopLoss: signal.stopLoss, takeProfit: signal.takeProfit, market: this.marketGroup(signal.symbol) },
    };
  }

  async postSignalsBatch(signals = []) {
    const rows = signals.filter(Boolean);
    if (!rows.length) return { posted: 0 };
    if (this.signalGridService?.updateSignalCellsBatch) {
      await this.signalGridService.updateSignalCellsBatch(rows.map((signal) => this.signalGridPayload(signal)));
      if (this.discordSignalGridService) {
        const channels = new Set();
        for (const signal of rows) {
          const channelId = await this.resolveSignalChannelId(signal);
          if (channelId) channels.add(channelId);
        }
        for (const channelId of channels) this.discordSignalGridService.scheduleGridRefresh(channelId);
      }
      return { posted: rows.length, mode: 'grid-batch' };
    }
    let posted = 0;
    for (const signal of rows) {
      await this.postSignal(signal).catch((error) => this.logger?.warn?.('Trade signal batch presentation failed.', { signalId: signal.signalId, message: error.message }));
      posted += 1;
    }
    return { posted, mode: 'individual-fallback' };
  }

  marketGroup(symbol = '') {
    const sym = String(symbol || '').toUpperCase();
    if (sym.includes('XAU') || sym.includes('XAG')) return 'Gold Bots';
    if (/(NAS|US30|SPX|GER|DAX)/.test(sym)) return 'Indices';
    return 'Forex Flow';
  }

  async getSignal(signalId) {
    const data = await this.load();
    return data.signalsById?.[signalId] || null;
  }

  isExpired(signal) {
    return !signal?.expiresAt || new Date(signal.expiresAt).getTime() < Date.now();
  }

  async getFollowerAccounts(userId, signal = null) {
    const accounts = this.repository.getAccessibleMt4Accounts
      ? await this.repository.getAccessibleMt4Accounts(userId)
      : this.repository.getMt4Accounts ? await this.repository.getMt4Accounts(userId) : [];
    return accounts.filter((account) => {
      if (signal?.leaderAccountId && account.accountId === signal.leaderAccountId && account.accountRole !== 'both') return false;
      if (account.shared && !['copy_allowed', 'control_allowed', 'admin'].includes(String(account.sharePermission || ''))) return false;
      return true;
    });
  }

  async replyWithRiskChoices(interaction, signal, account) {
    const encoded = encodeAccountId(account.accountId);
    const label = accountLabel(account);
    const risk = normalizeCopyRisk(account.copyRisk || {});
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`take_signal_risk:${signal.signalId}:${encoded}:my_risk`).setLabel('Culture Risk').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`take_signal_risk:${signal.signalId}:${encoded}:same_signal`).setLabel('Match Lot').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`take_signal_risk:${signal.signalId}:${encoded}:fixed_001`).setLabel('Fixed 0.01').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`take_signal_risk:${signal.signalId}:${encoded}:fixed_002`).setLabel('Fixed 0.02').setStyle(ButtonStyle.Secondary),
    );
    return interaction.reply({
      content: [
        `Follower account: **${label}**`,
        `Culture Risk Dial: **${risk.mode}** · fixed **${risk.fixedLot.toFixed(2)}** · max **${risk.maxLot.toFixed(2)}** · max trades **${risk.maxOpenTrades}** · SL/TP **${risk.copySLTP ? 'on' : 'off'}**`,
        'Choose how WISDO should size this copied trade.',
      ].join('\n'),
      components: [row],
      ephemeral: true,
    });
  }

  async queueSignalForAccount(interaction, signal, account, riskMode) {
    const userId = interaction.user.id;
    const allowed = riskAllowsSignal(signal, account);
    if (!allowed.ok) return interaction.reply({ content: `⛔ Website risk blocked this copy: ${allowed.reason}`, ephemeral: true });

    const risk = normalizeCopyRisk(account.copyRisk || {});
    const lots = roundLot(calculateCopyLots({ signal, account, riskMode, risk }));
    const side = risk.reverseCopy ? (signal.side === 'BUY' ? 'sell' : 'buy') : signal.side.toLowerCase();
    const payload = {
      accountId: account.accountId,
      accountNumber: account.accountNumber,
      pairingCode: account.pairingCode,
      signalId: signal.signalId,
      source: 'discord_take_signal_button',
      leaderUserId: signal.leaderUserId,
      leaderAccountId: signal.leaderAccountId,
      leaderAccountNumber: signal.leaderAccountNumber,
      sourceTicket: signal.sourceTicket,
      symbol: signal.symbol,
      side,
      direction: side,
      lots,
      lot: lots,
      volume: lots,
      requestedLots: signal.lots,
      openPrice: signal.openPrice,
      stopLoss: risk.copySLTP ? signal.stopLoss : 0,
      takeProfit: risk.copySLTP ? signal.takeProfit : 0,
      sl: risk.copySLTP ? signal.stopLoss : 0,
      tp: risk.copySLTP ? signal.takeProfit : 0,
      maxOpenTrades: risk.maxOpenTrades,
      maxLot: risk.maxLot,
      riskMode,
      copyRisk: risk,
    };

    const command = this.mt4CommandService.queueCommandForAccount
      ? await this.mt4CommandService.queueCommandForAccount(userId, account.accountId, 'COPY_OPEN_TRADE', payload)
      : await this.mt4CommandService.queueCommand(userId, 'COPY_OPEN_TRADE', payload);

    const data = await this.load();
    if (data.signalsById[signal.signalId]) {
      data.signalsById[signal.signalId].takes ||= [];
      data.signalsById[signal.signalId].takes.push({
        userId,
        accountId: account.accountId,
        accountNumber: account.accountNumber,
        riskMode,
        lots,
        commandId: command.id,
        takenAt: new Date().toISOString(),
      });
      await this.save(data);
    }
    await this.updateSignalMessage(signal.signalId).catch(() => null);

    return interaction.reply({
      content: `✅ Trade queued for **${account.nickname || account.accountNumber}**.\nCommand ID: \`${command.id}\`\nSymbol: **${signal.symbol}**\nDirection: **${side.toUpperCase()}**\nRisk dial: **${riskMode}**\nLot sent: **${lots.toFixed(2)}**`,
      ephemeral: true,
    });
  }

  async queueAutoCopyRoutesBatch(signals = []) {
    const rows = signals.filter((signal) => signal?.leaderAccountId && signal?.signalId);
    if (!rows.length || !this.repository.getActiveCopyRoutesForLeader || !this.mt4CommandService?.queueCommandForAccount) return [];
    const groups = new Map();
    for (const signal of rows) {
      const key = String(signal.leaderAccountId);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(signal);
    }

    const commandInputs = [];
    const commandMeta = [];
    for (const [leaderAccountId, groupSignals] of groups) {
      const routes = await this.repository.getActiveCopyRoutesForLeader(leaderAccountId);
      for (const route of routes) {
        const account = this.repository.getMt4ConnectionForCopyRoute
          ? await this.repository.getMt4ConnectionForCopyRoute(route)
          : await this.repository.getMt4ConnectionByAccountId(route.ownerUserId, route.followerAccountId);
        if (!account) {
          this.logger?.warn?.('Auto copy route skipped because the live follower connection is unavailable or not authorized.', { routeId: route.routeId, followerAccountId: route.followerAccountId });
          continue;
        }
        const accountWithRisk = { ...account, copyRisk: route.risk || account.copyRisk || {} };
        for (const signal of groupSignals) {
          const allowed = riskAllowsSignal(signal, accountWithRisk);
          if (!allowed.ok) continue;
          const risk = normalizeCopyRisk(accountWithRisk.copyRisk || {});
          const lots = roundLot(calculateCopyLots({ signal, account: accountWithRisk, riskMode: 'website_auto', risk }));
          const side = risk.reverseCopy ? (signal.side === 'BUY' ? 'sell' : 'buy') : signal.side.toLowerCase();
          const leaderSymbol = String(signal.symbol || '').toUpperCase();
          const followerSymbol = String(risk.symbolMapping?.[leaderSymbol] || leaderSymbol).toUpperCase();
          const payload = {
            accountId: account.accountId, accountNumber: account.accountNumber, pairingCode: account.pairingCode,
            signalId: signal.signalId, routeId: route.routeId, source: 'website_auto_copy_route',
            leaderUserId: signal.leaderUserId, leaderAccountId: signal.leaderAccountId, leaderAccountNumber: signal.leaderAccountNumber,
            sourceTicket: signal.sourceTicket, leaderTicket: signal.sourceTicket, masterTicket: signal.sourceTicket,
            leaderSymbol, masterSymbol: leaderSymbol, followerSymbol, symbol: followerSymbol, side, direction: side,
            lots, lot: lots, volume: lots, stopLoss: risk.copySLTP ? signal.stopLoss : 0,
            takeProfit: risk.copySLTP ? signal.takeProfit : 0, sl: risk.copySLTP ? signal.stopLoss : 0,
            tp: risk.copySLTP ? signal.takeProfit : 0, maxOpenTrades: risk.maxOpenTrades, maxLot: risk.maxLot,
            riskMode: 'website_auto', copyRisk: risk,
          };
          commandInputs.push({ userId: route.ownerUserId, accountId: account.accountId, command: 'COPY_OPEN_TRADE', payload });
          commandMeta.push({ signal, route, account, leaderSymbol, followerSymbol, lots });
        }
      }
    }
    if (!commandInputs.length) return [];

    const commands = this.mt4CommandService.queueCommandsForAccountsBatch
      ? await this.mt4CommandService.queueCommandsForAccountsBatch(commandInputs)
      : await Promise.all(commandInputs.map((input) => this.mt4CommandService.queueCommandForAccount(input.userId, input.accountId, input.command, input.payload)));
    const queued = commands.map((command, index) => {
      const meta = commandMeta[index];
      return {
        signalId: meta.signal.signalId, routeId: meta.route.routeId, ownerUserId: meta.route.ownerUserId,
        accountId: meta.account.accountId, commandId: command.id, sourceTicket: meta.signal.sourceTicket,
        leaderAccountId: meta.signal.leaderAccountId, leaderSymbol: meta.leaderSymbol,
        followerSymbol: meta.followerSymbol, lots: meta.lots,
      };
    });

    const data = await this.load();
    const queuedAt = new Date().toISOString();
    for (const item of queued) {
      const saved = data.signalsById?.[item.signalId];
      if (!saved) continue;
      saved.autoTakes ||= [];
      if (!saved.autoTakes.some((row) => row.routeId === item.routeId && row.accountId === item.accountId && String(row.sourceTicket) === String(item.sourceTicket))) {
        saved.autoTakes.push({ ...item, queuedAt });
      }
    }
    await this.save(data);
    return queued;
  }

  async queueAutoCopyRoutes(signal) {
    if (!this.repository.getActiveCopyRoutesForLeader || !this.mt4CommandService?.queueCommandForAccount) return [];
    const routes = await this.repository.getActiveCopyRoutesForLeader(signal.leaderAccountId);
    const queued = [];
    for (const route of routes) {
      const account = this.repository.getMt4ConnectionForCopyRoute
        ? await this.repository.getMt4ConnectionForCopyRoute(route)
        : await this.repository.getMt4ConnectionByAccountId(route.ownerUserId, route.followerAccountId);
      if (!account) {
        this.logger?.warn?.('Auto copy route skipped because the live follower connection is unavailable or not authorized.', {
          routeId: route.routeId,
          followerAccountId: route.followerAccountId,
        });
        continue;
      }
      const accountWithRisk = { ...account, copyRisk: route.risk || account.copyRisk || {} };
      const allowed = riskAllowsSignal(signal, accountWithRisk);
      if (!allowed.ok) {
        this.logger?.info?.('Auto copy route blocked by risk.', { routeId: route.routeId, signalId: signal.signalId, reason: allowed.reason });
        continue;
      }
      const risk = normalizeCopyRisk(accountWithRisk.copyRisk || {});
      const lots = roundLot(calculateCopyLots({ signal, account: accountWithRisk, riskMode: 'website_auto', risk }));
      const side = risk.reverseCopy ? (signal.side === 'BUY' ? 'sell' : 'buy') : signal.side.toLowerCase();
      const leaderSymbol = String(signal.symbol || '').toUpperCase();
      const followerSymbol = String(risk.symbolMapping?.[leaderSymbol] || leaderSymbol).toUpperCase();
      const payload = {
        accountId: account.accountId,
        accountNumber: account.accountNumber,
        pairingCode: account.pairingCode,
        signalId: signal.signalId,
        routeId: route.routeId,
        source: 'website_auto_copy_route',
        leaderUserId: signal.leaderUserId,
        leaderAccountId: signal.leaderAccountId,
        leaderAccountNumber: signal.leaderAccountNumber,
        sourceTicket: signal.sourceTicket,
        leaderTicket: signal.sourceTicket,
        masterTicket: signal.sourceTicket,
        leaderSymbol,
        masterSymbol: leaderSymbol,
        followerSymbol,
        symbol: followerSymbol,
        side,
        direction: side,
        lots,
        lot: lots,
        volume: lots,
        stopLoss: risk.copySLTP ? signal.stopLoss : 0,
        takeProfit: risk.copySLTP ? signal.takeProfit : 0,
        sl: risk.copySLTP ? signal.stopLoss : 0,
        tp: risk.copySLTP ? signal.takeProfit : 0,
        maxOpenTrades: risk.maxOpenTrades,
        maxLot: risk.maxLot,
        riskMode: 'website_auto',
        copyRisk: risk,
      };
      const command = await this.mt4CommandService.queueCommandForAccount(route.ownerUserId, account.accountId, 'COPY_OPEN_TRADE', payload);
      queued.push({
        routeId: route.routeId,
        ownerUserId: route.ownerUserId,
        accountId: account.accountId,
        commandId: command.id,
        sourceTicket: signal.sourceTicket,
        leaderAccountId: signal.leaderAccountId,
        leaderSymbol,
        followerSymbol,
        lots,
      });
    }
    if (queued.length) {
      const data = await this.load();
      const saved = data.signalsById?.[signal.signalId];
      if (saved) {
        saved.autoTakes ||= [];
        saved.autoTakes.push(...queued.map((item) => ({ ...item, queuedAt: new Date().toISOString() })));
        await this.save(data);
        await this.updateSignalMessage(signal.signalId).catch(() => null);
      }
    }
    return queued;
  }

  async queueAutoCopyCloseRoutesBatch(events = []) {
    const rows = events.filter((event) => event?.sourceTicket);
    if (!rows.length) return [];
    const data = await this.load();
    const commandInputs = [];
    const commandMeta = [];
    const copyMasterInputs = [];
    const commandState = this.mt4CommandService?.load
      ? await this.mt4CommandService.load({ cloneResult: false, includeIndexes: false }).catch(() => null)
      : null;

    for (const event of rows) {
      const signal = data.signalsById?.[event.signalId] || null;
      const stableSourceTicket = String(event.sourceTicket || signal?.sourceTicket || '');
      const stableLeaderAccountId = String(event.leaderAccountId || signal?.leaderAccountId || '');
      let takes = Array.isArray(signal?.autoTakes) ? signal.autoTakes : [];
      if (!takes.length && stableLeaderAccountId && this.repository.getActiveCopyRoutesForLeader) {
        const routes = await this.repository.getActiveCopyRoutesForLeader(stableLeaderAccountId);
        takes = routes.map((route) => ({ routeId: route.routeId, ownerUserId: route.ownerUserId, accountId: route.followerAccountId, sourceTicket: stableSourceTicket }));
      }
      const alreadyQueued = new Set((signal?.autoCloses || []).map((item) => `${item.routeId}:${item.accountId}:${item.sourceTicket}`));
      for (const take of takes) {
        const routeKey = `${take.routeId}:${take.accountId}:${stableSourceTicket}`;
        if (alreadyQueued.has(routeKey)) continue;
        let openCommand = null;
        if (take.commandId && commandState && this.mt4CommandService.findCommand) {
          openCommand = this.mt4CommandService.findCommand(commandState, take.ownerUserId, take.commandId, take.accountId);
        } else if (take.commandId && this.mt4CommandService.getCommandStatus) {
          openCommand = await this.mt4CommandService.getCommandStatus(take.ownerUserId, take.commandId, take.accountId).catch(() => null);
        }
        const followerTicket = String(openCommand?.result?.ticket ?? openCommand?.result?.followerTicket ?? openCommand?.payload?.followerTicket ?? take.followerTicket ?? '');
        const followerSymbol = String(openCommand?.payload?.followerSymbol || openCommand?.payload?.symbol || take.followerSymbol || event.symbol || signal?.symbol || '').toUpperCase();
        const ownerUserId = String(take.ownerUserId || openCommand?.userId || '');
        if (!ownerUserId || !take.accountId) continue;
        const payload = {
          accountId: take.accountId, signalId: event.signalId || signal?.signalId || '', routeId: take.routeId,
          source: 'website_auto_copy_route_close', sourceTicket: stableSourceTicket, leaderTicket: stableSourceTicket,
          masterTicket: stableSourceTicket, followerTicket: followerTicket || undefined, leaderAccountId: stableLeaderAccountId,
          followerAccountId: take.accountId, leaderSymbol: String(signal?.symbol || event.symbol || '').toUpperCase(),
          masterSymbol: String(signal?.symbol || event.symbol || '').toUpperCase(), followerSymbol, symbol: followerSymbol,
          side: event.side || signal?.side || '', confirmation: 'confirmed', closeAuthority: true,
          commandId: `copy-close-${take.routeId}-${stableSourceTicket}`, immediate: true, priority: 10000, ttlMinutes: 2,
        };
        commandInputs.push({ userId: ownerUserId, accountId: take.accountId, command: 'COPY_CLOSE_TRADE', payload });
        commandMeta.push({ signalId: event.signalId, routeId: take.routeId, ownerUserId, accountId: take.accountId, sourceTicket: stableSourceTicket, followerTicket: followerTicket || null, followerSymbol });
      }
      if (this.copyTradingService) copyMasterInputs.push(event);
    }

    const commands = commandInputs.length
      ? (this.mt4CommandService.queueCommandsForAccountsBatch
        ? await this.mt4CommandService.queueCommandsForAccountsBatch(commandInputs)
        : await Promise.all(commandInputs.map((input) => this.mt4CommandService.queueCommandForAccount(input.userId, input.accountId, input.command, input.payload))))
      : [];
    const queued = commands.map((command, index) => ({ ...commandMeta[index], commandId: command.id }));
    const queuedAt = new Date().toISOString();
    for (const item of queued) {
      const saved = data.signalsById?.[item.signalId];
      if (!saved) continue;
      saved.autoCloses ||= [];
      saved.autoCloses.push({ ...item, queuedAt });
      saved.status = 'closing';
      saved.updatedAt = queuedAt;
    }
    if (queued.length) await this.save(data);

    if (copyMasterInputs.length && this.copyTradingService?.queueMasterSignalsBatch) {
      await this.copyTradingService.queueMasterSignalsBatch(copyMasterInputs.map((event) => ({
        masterUserId: event.leaderUserId, masterAccountNumber: event.leaderAccountNumber,
        sourceTicket: event.sourceTicket, symbol: event.symbol, side: event.side,
        lots: 0.01, action: 'close', signalId: event.signalId,
      })));
    } else {
      for (const event of copyMasterInputs) {
        await this.copyTradingService.queueMasterSignal({
          masterUserId: event.leaderUserId, masterAccountNumber: event.leaderAccountNumber,
          sourceTicket: event.sourceTicket, symbol: event.symbol, side: event.side,
          lots: 0.01, action: 'close', signalId: event.signalId,
        }).catch((error) => this.logger?.warn?.('Legacy copy close batch failed.', { signalId: event.signalId, message: error.message }));
      }
    }
    return queued;
  }

  async queueAutoCopyCloseRoutes({ signalId, leaderAccountId, sourceTicket, symbol = '', side = '' } = {}) {
    if (!this.mt4CommandService?.queueCommandForAccount) return [];
    const data = await this.load();
    const signal = data.signalsById?.[signalId] || null;
    const stableSourceTicket = String(sourceTicket || signal?.sourceTicket || '');
    const stableLeaderAccountId = String(leaderAccountId || signal?.leaderAccountId || '');
    let takes = Array.isArray(signal?.autoTakes) ? signal.autoTakes : [];

    // Recovery for signals created before autoTakes were persisted.
    if (!takes.length && stableLeaderAccountId && this.repository.getActiveCopyRoutesForLeader) {
      const routes = await this.repository.getActiveCopyRoutesForLeader(stableLeaderAccountId);
      takes = routes.map((route) => ({
        routeId: route.routeId,
        ownerUserId: route.ownerUserId,
        accountId: route.followerAccountId,
        sourceTicket: stableSourceTicket,
      }));
    }

    const alreadyQueued = new Set((signal?.autoCloses || []).map((item) => `${item.routeId}:${item.accountId}:${item.sourceTicket}`));
    const queued = [];
    for (const take of takes) {
      const routeKey = `${take.routeId}:${take.accountId}:${stableSourceTicket}`;
      if (alreadyQueued.has(routeKey)) continue;
      let openCommand = null;
      if (take.commandId && this.mt4CommandService.getCommandStatus) {
        openCommand = await this.mt4CommandService.getCommandStatus(take.ownerUserId, take.commandId, take.accountId).catch(() => null);
      }
      const followerTicket = String(
        openCommand?.result?.ticket ??
        openCommand?.result?.followerTicket ??
        openCommand?.payload?.followerTicket ??
        take.followerTicket ??
        '',
      );
      const followerSymbol = String(
        openCommand?.payload?.followerSymbol ||
        openCommand?.payload?.symbol ||
        take.followerSymbol ||
        symbol ||
        signal?.symbol ||
        '',
      ).toUpperCase();
      const ownerUserId = String(take.ownerUserId || openCommand?.userId || '');
      if (!ownerUserId || !take.accountId) {
        this.logger?.warn?.('Auto-copy close skipped because route ownership is missing.', { signalId, routeId: take.routeId, accountId: take.accountId });
        continue;
      }
      const payload = {
        accountId: take.accountId,
        signalId: signalId || signal?.signalId || '',
        routeId: take.routeId,
        source: 'website_auto_copy_route_close',
        sourceTicket: stableSourceTicket,
        leaderTicket: stableSourceTicket,
        masterTicket: stableSourceTicket,
        followerTicket: followerTicket || undefined,
        leaderAccountId: stableLeaderAccountId,
        followerAccountId: take.accountId,
        leaderSymbol: String(signal?.symbol || symbol || '').toUpperCase(),
        masterSymbol: String(signal?.symbol || symbol || '').toUpperCase(),
        followerSymbol,
        symbol: followerSymbol,
        side: side || signal?.side || '',
        confirmation: 'confirmed',
        closeAuthority: true,
        commandId: `copy-close-${take.routeId}-${stableSourceTicket}`,
        immediate: true,
        priority: 10000,
        ttlMinutes: 2,
      };
      const command = await this.mt4CommandService.queueCommandForAccount(ownerUserId, take.accountId, 'COPY_CLOSE_TRADE', payload);
      queued.push({ routeId: take.routeId, ownerUserId, accountId: take.accountId, commandId: command.id, sourceTicket: stableSourceTicket, followerTicket: followerTicket || null, followerSymbol });
    }

    if (signal && queued.length) {
      const latest = await this.load();
      const saved = latest.signalsById?.[signal.signalId];
      if (saved) {
        saved.autoCloses ||= [];
        saved.autoCloses.push(...queued.map((item) => ({ ...item, queuedAt: new Date().toISOString() })));
        saved.status = 'closing';
        saved.updatedAt = new Date().toISOString();
        await this.save(latest);
      }
    }
    return queued;
  }

  async updateSignalMessage(signalId, patch = {}) {
    const data = await this.load();
    const signal = data.signalsById?.[signalId];
    if (!signal) return null;
    const previous = { ...signal };
    Object.assign(signal, patch, { updatedAt: new Date().toISOString() });
    const copiedBy = (Array.isArray(signal.takes) ? signal.takes.length : 0) + (Array.isArray(signal.autoTakes) ? signal.autoTakes.length : 0);
    const shouldUpdate = this.signalCardService.shouldPostUpdate(previous, { ...signal, copiedBy });
    await this.save(data);
    if (!shouldUpdate || !signal.discordChannelId || !signal.discordMessageId) return signal;
    const channel = await this.client?.channels?.fetch(signal.discordChannelId).catch(() => null);
    const message = channel?.messages ? await channel.messages.fetch(signal.discordMessageId).catch(() => null) : null;
    if (message?.edit) {
      await message.edit({ embeds: [this.signalCardService.buildSignalEmbed(signal, { copiedBy })], components: this.signalCardService.buildSignalRows(signal) }).catch(() => null);
    }
    return signal;
  }

  async handleButton(interaction) {
    const parts = String(interaction.customId || '').split(':');
    const [action, signalId] = parts;
    const signal = await this.getSignal(signalId);

    if (!signal) {
      return interaction.reply({ content: '⚠️ Signal not found.', ephemeral: true });
    }

    if (action === 'signal_info' || action === 'signal_wisdo') {
      return interaction.reply({
        content: `Signal **${signal.side} ${signal.symbol}** from **${signal.eaName}** expires <t:${Math.floor(new Date(signal.expiresAt).getTime() / 1000)}:R>. Use **Culture Risk** after setting the CEM Culture Relay Engine if you want TraderConnect-style control.`,
        ephemeral: true,
      });
    }

    if (this.isExpired(signal) && !['signal_close_copy', 'signal_info', 'signal_mute'].includes(action)) {
      return interaction.reply({ content: '⏳ This trade signal expired. Wait for the next fresh signal.', ephemeral: true });
    }

    const userId = interaction.user.id;

    if (action === 'take_signal') {
      const accounts = await this.getFollowerAccounts(userId, signal);
      if (accounts.length === 0) {
        return interaction.reply({ content: '🔌 Connect a follower MT4 account first with `/connect-mt4 role:follower` or the Trade Link page before taking signals.', ephemeral: true });
      }
      if (accounts.length === 1) {
        return this.replyWithRiskChoices(interaction, signal, accounts[0]);
      }
      const rows = [];
      let row = new ActionRowBuilder();
      accounts.slice(0, 10).forEach((account, index) => {
        if (index > 0 && index % 5 === 0) { rows.push(row); row = new ActionRowBuilder(); }
        row.addComponents(new ButtonBuilder()
          .setCustomId(`take_signal_account:${signal.signalId}:${encodeAccountId(account.accountId)}`)
          .setLabel(accountLabel(account).slice(0, 80))
          .setStyle(account.isPrimary ? ButtonStyle.Primary : ButtonStyle.Secondary));
      });
      rows.push(row);
      return interaction.reply({
        content: 'You have multiple active desk accounts. Choose the follower account that should copy this trade:',
        components: rows,
        ephemeral: true,
      });
    }

    if (action === 'take_signal_account') {
      const accountId = decodeAccountId(parts[2]);
      const account = this.repository.getMt4ConnectionByAccountId
        ? await this.repository.getMt4ConnectionByAccountId(userId, accountId)
        : null;
      if (!account) return interaction.reply({ content: '⚠️ That account was not found under your desk access.', ephemeral: true });
      return this.replyWithRiskChoices(interaction, signal, account);
    }

    if (action === 'take_signal_risk') {
      const accountId = decodeAccountId(parts[2]);
      const riskMode = parts[3] || 'fixed_001';
      const account = this.repository.getMt4ConnectionByAccountId
        ? await this.repository.getMt4ConnectionByAccountId(userId, accountId)
        : null;
      if (!account) return interaction.reply({ content: '⚠️ That account was not found under your desk access.', ephemeral: true });
      return this.queueSignalForAccount(interaction, signal, account, riskMode);
    }

    if (action === 'signal_future') {
      return interaction.reply({
        content: '✅ Open **CEM Culture Relay Engine** on the website to create a permanent Culture Lane: Culture Lead → Mirror Receiver → Culture Risk. Once active, future signals auto-queue without another click.',
        ephemeral: true,
      });
    }

    if (action === 'signal_close_copy') {
      const accounts = await this.getFollowerAccounts(userId, signal);
      const account = accounts.find((item) => item.isPrimary) || accounts[0] || null;
      if (!account) return interaction.reply({ content: '⚠️ Connect your follower MT4 account first before closing a copied trade.', ephemeral: true });
      const command = this.mt4CommandService.queueCommandForAccount
        ? await this.mt4CommandService.queueCommandForAccount(userId, account.accountId, 'COPY_CLOSE_TRADE', { accountId: account.accountId, signalId: signal.signalId, sourceTicket: signal.sourceTicket, symbol: signal.symbol, source: 'signal_close_copy_button' })
        : await this.mt4CommandService.queueCommand(userId, 'COPY_CLOSE_TRADE', { signalId: signal.signalId, sourceTicket: signal.sourceTicket, symbol: signal.symbol });
      return interaction.reply({ content: `🛑 Close-copy command queued for **${account.nickname || account.accountNumber}**.\nCommand ID: \`${command.id}\``, ephemeral: true });
    }

    if (action === 'signal_mute') {
      const data = await this.load();
      data.signalsById[signal.signalId] ||= signal;
      data.signalsById[signal.signalId].mutedBy ||= [];
      if (!data.signalsById[signal.signalId].mutedBy.includes(userId)) data.signalsById[signal.signalId].mutedBy.push(userId);
      await this.save(data);
      return interaction.reply({ content: '🔕 Signal updates muted for you. The dashboard was not changed.', ephemeral: true });
    }

    return null;
  }
}
