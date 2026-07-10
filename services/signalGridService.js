import { createHash, randomUUID } from 'node:crypto';

function nowIso() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(num(value) * factor) / factor;
}

function cleanSymbol(value = '') {
  return String(value || '').trim().toUpperCase();
}

function safeJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value && typeof value === 'object' ? value : fallback;
}

function renderHash(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}

export class SignalGridService {
  constructor({ config = {}, repository, logger = console } = {}) {
    this.config = config;
    this.repository = repository;
    this.logger = logger;
  }

  defaults() {
    return {
      percentMode: process.env.SIGNAL_GRID_PERCENT_MODE || this.config.signalGrid?.percentMode || 'balance',
      updateFrequencySeconds: Number(process.env.SIGNAL_GRID_REFRESH_SECONDS || this.config.signalGrid?.updateFrequencySeconds || 20),
      expirationMinutes: Number(process.env.SIGNAL_GRID_EXPIRATION_MINUTES || this.config.signalGrid?.expirationMinutes || 45),
      upperProfitPercent: Number(process.env.SIGNAL_GRID_UPPER_PROFIT_PERCENT || this.config.signalGrid?.upperProfitPercent || 3),
      protectedProfitPercent: Number(process.env.SIGNAL_GRID_PROTECTED_PERCENT || this.config.signalGrid?.protectedProfitPercent || 1.5),
      discordEnabled: String(process.env.SIGNAL_GRID_DISCORD_ENABLED || 'true').toLowerCase() !== 'false',
      websiteEnabled: String(process.env.SIGNAL_GRID_WEBSITE_ENABLED || 'true').toLowerCase() !== 'false',
      copyButtonsEnabled: String(process.env.SIGNAL_GRID_COPY_ENABLED || 'true').toLowerCase() !== 'false',
      premiumAccessRequirement: process.env.SIGNAL_GRID_PREMIUM_ROLE || 'CULTURE COIN MEMBER+',
    };
  }

  settings(state = {}) {
    return { ...this.defaults(), ...(state.signalGridSettings || {}) };
  }

  calculateBasketGrowth(basket = {}, mode = this.defaults().percentMode) {
    const pnl = num(basket.currentFloatingPnl ?? basket.floatingPnl);
    const risk = safeJson(basket.riskJson || basket.risk, {});
    const denominators = {
      balance: num(basket.startBalance, 0),
      equity: num(basket.startEquity, 0),
      allocated: num(risk.allocatedBalance || basket.allocatedBalance, 0),
      basket_risk: num(risk.basketRiskAmount || risk.riskUsd || basket.basketRiskAmount, 0),
    };
    const denominator = denominators[mode] || denominators.balance || denominators.equity || 0;
    return denominator > 0 ? round((pnl / denominator) * 100, 2) : 0;
  }

  getCellStatus(cell = {}) {
    const explicit = String(cell.status || '').toLowerCase();
    if (['offline', 'expired'].includes(explicit)) return explicit;
    const openTrades = num(cell.openTradeCount, 0);
    if (!openTrades || explicit === 'inactive') return 'inactive';
    const growth = num(cell.basketGrowthPercent, 0);
    const settings = this.defaults();
    if (explicit === 'protected' || cell.protected === true) return 'protected';
    if (growth >= settings.upperProfitPercent) return 'upper_profit';
    if (growth > 0) return 'active';
    if (growth < 0) return 'negative';
    return 'active';
  }

  statusTone(status = '') {
    return {
      inactive: 'grey',
      active: 'green',
      negative: 'red',
      profit: 'green',
      upper_profit: 'yellow',
      protected: 'blue',
      expired: 'black',
      offline: 'black',
    }[String(status || '').toLowerCase()] || 'grey';
  }

  statusEmoji(status = '') {
    return {
      inactive: '⬛',
      active: '🟩',
      negative: '🟥',
      profit: '🟩',
      upper_profit: '🟨',
      protected: '🟦',
      expired: '⚫',
      offline: '⚫',
    }[String(status || '').toLowerCase()] || '⬛';
  }

  async getGridState(filters = {}) {
    await this.expireOldSignals();
    const state = await this.repository.loadState();
    const settings = this.settings(state);
    const cells = Object.values(state.signalGridCellsById || {}).map((cell) => this.normalizeCell(cell, state, settings));
    const filtered = this.applyFilters(cells, filters);
    return {
      settings,
      cells: filtered,
      allCells: cells,
      sources: state.signalSourcesById || {},
      baskets: state.signalBasketsById || {},
      channels: state.signalGridChannelsById || {},
      updatedAt: nowIso(),
      renderHash: renderHash(filtered.map((cell) => this.hashableCell(cell))),
    };
  }

  async getWebsiteGrid(userId = '', filters = {}) {
    const grid = await this.getGridState(filters);
    return {
      ...grid,
      userId: String(userId || ''),
      copySubscriptions: Object.values((await this.repository.loadState()).copyBotSubscriptionsById || {}).filter((sub) => String(sub.userId) === String(userId)),
    };
  }

  async getDiscordGrid(channelId = '') {
    const grid = await this.getGridState({ channelId });
    return {
      ...grid,
      channelId: String(channelId || ''),
      sections: this.groupForDiscord(grid.cells),
    };
  }

  async getSignalDetail(userId = '', signalId = '') {
    const state = await this.repository.loadState();
    const cell = state.signalGridCellsById?.[String(signalId)] || Object.values(state.signalGridCellsById || {}).find((item) => item.basketId === signalId);
    if (!cell) return null;
    const normalized = this.normalizeCell(cell, state, this.settings(state));
    return {
      userId: String(userId || ''),
      signal: normalized,
      basket: state.signalBasketsById?.[normalized.basketId] || null,
      source: state.signalSourcesById?.[normalized.sourceId] || null,
      riskWarning: 'Risk-based copy only. Lot size is translated through your account risk settings; profits are never guaranteed.',
    };
  }

  async getBotSignalStatus(botId = '') {
    const grid = await this.getGridState({ bot: botId });
    return grid.cells;
  }

  async getActiveSignalsByBot(botId = '') {
    const cells = await this.getBotSignalStatus(botId);
    return cells.filter((cell) => !['inactive', 'expired', 'offline'].includes(cell.status));
  }

  async updateSignalCell(payload = {}) {
    let saved;
    await this.repository.updateState((state) => {
      state.signalGridCellsById ||= {};
      state.signalSourcesById ||= {};
      state.signalBasketsById ||= {};
      const symbol = cleanSymbol(payload.symbol || payload.pair);
      const botId = String(payload.botId || payload.botName || payload.eaName || 'wisdo-bot').trim();
      const sourceId = String(payload.sourceId || `source_${botId}`).replace(/\s+/g, '_').toLowerCase();
      const cellId = String(payload.id || payload.signalId || `${sourceId}_${botId}_${symbol}`).replace(/[^a-zA-Z0-9_:-]/g, '_');
      const now = nowIso();

      state.signalSourcesById[sourceId] ||= {
        id: sourceId,
        sourceId,
        botId,
        providerId: String(payload.providerId || payload.leaderUserId || ''),
        name: String(payload.sourceName || payload.eaName || payload.botName || botId),
        type: String(payload.sourceType || 'bot'),
        status: 'active',
        metadataJson: payload.sourceMetadata || {},
        createdAt: now,
        updatedAt: now,
      };
      state.signalSourcesById[sourceId].updatedAt = now;

      const basketId = String(payload.basketId || `basket_${sourceId}_${botId}_${symbol}`).replace(/[^a-zA-Z0-9_:-]/g, '_');
      const basket = {
        ...(state.signalBasketsById[basketId] || {}),
        id: basketId,
        basketId,
        sourceId,
        botId,
        symbol,
        direction: String(payload.direction || payload.side || 'mixed').toLowerCase(),
        status: payload.basketStatus || payload.status || 'active',
        startBalance: num(payload.startBalance ?? payload.balance),
        startEquity: num(payload.startEquity ?? payload.equity),
        currentFloatingPnl: num(payload.currentFloatingPnl ?? payload.floatingPnl ?? payload.pnl),
        openTradesJson: payload.openTrades || payload.trades || [],
        closedTradesJson: payload.closedTrades || [],
        riskJson: payload.risk || payload.riskJson || {},
        createdAt: state.signalBasketsById[basketId]?.createdAt || now,
        updatedAt: now,
        closedAt: payload.closedAt || null,
      };
      basket.growthPercent = payload.basketGrowthPercent !== undefined
        ? round(payload.basketGrowthPercent, 2)
        : this.calculateBasketGrowth(basket, this.settings(state).percentMode);
      state.signalBasketsById[basketId] = basket;

      const next = {
        ...(state.signalGridCellsById[cellId] || {}),
        id: cellId,
        signalId: cellId,
        sourceId,
        botId,
        botName: String(payload.botName || payload.eaName || botId),
        providerId: String(payload.providerId || payload.leaderUserId || ''),
        symbol,
        direction: String(payload.direction || payload.side || basket.direction || 'mixed').toLowerCase(),
        status: String(payload.status || 'active'),
        basketId,
        basketGrowthPercent: basket.growthPercent,
        floatingPnl: basket.currentFloatingPnl,
        openTradeCount: num(payload.openTradeCount ?? payload.openTrades?.length ?? payload.tradeCount, 0),
        averageEntry: payload.averageEntry ?? payload.openPrice ?? null,
        session: String(payload.session || payload.marketSession || ''),
        volatilityState: String(payload.volatilityState || payload.volatility || 'normal'),
        riskMode: String(payload.riskMode || payload.copyRiskMode || 'risk_based'),
        copyRequirement: String(payload.copyRequirement || this.settings(state).premiumAccessRequirement),
        educationRequired: Boolean(payload.educationRequired),
        provider: String(payload.provider || payload.source || 'MT4 Reporter'),
        expiresAt: payload.expiresAt || new Date(Date.now() + this.settings(state).expirationMinutes * 60 * 1000).toISOString(),
        lastUpdateAt: payload.lastUpdateAt || now,
        metadataJson: payload.metadataJson || payload.metadata || {},
        createdAt: state.signalGridCellsById[cellId]?.createdAt || now,
        updatedAt: now,
      };
      next.status = this.getCellStatus(next);
      next.tone = this.statusTone(next.status);
      next.emoji = this.statusEmoji(next.status);
      state.signalGridCellsById[cellId] = next;
      this.audit(state, payload.actorUserId || 'system', 'signal_grid.cell_updated', 'SignalGridCell', cellId, { botId, symbol, status: next.status });
      saved = next;
      return state;
    });
    return saved;
  }

  async updateBasketState(payload = {}) {
    return this.updateSignalCell(payload);
  }

  async expireOldSignals() {
    const now = Date.now();
    let expired = 0;
    await this.repository.updateState((state) => {
      state.signalGridCellsById ||= {};
      for (const cell of Object.values(state.signalGridCellsById)) {
        if (cell.expiresAt && new Date(cell.expiresAt).getTime() < now && !['expired', 'offline'].includes(cell.status)) {
          cell.status = 'expired';
          cell.openTradeCount = 0;
          cell.updatedAt = nowIso();
          cell.tone = this.statusTone('expired');
          cell.emoji = this.statusEmoji('expired');
          expired += 1;
          this.audit(state, 'system', 'signal_grid.expired_signal_cleared', 'SignalGridCell', cell.id, { symbol: cell.symbol, botId: cell.botId });
        }
      }
      return state;
    });
    return { expired };
  }

  async configureChannel({ guildId = '', channelId = '', settings = {}, actorUserId = 'system' } = {}) {
    let channel;
    await this.repository.updateState((state) => {
      state.signalGridChannelsById ||= {};
      state.signalGridSettings = { ...this.settings(state), ...(settings || {}) };
      const channelKey = String(channelId || state.signalGridSettings.channelId || '').trim();
      if (!channelKey) throw new Error('channelId is required.');
      channel = {
        ...(state.signalGridChannelsById[channelKey] || {}),
        id: channelKey,
        guildId: String(guildId || state.signalGridChannelsById[channelKey]?.guildId || ''),
        channelId: channelKey,
        pinnedMessageId: state.signalGridChannelsById[channelKey]?.pinnedMessageId || '',
        status: 'active',
        lastRenderHash: state.signalGridChannelsById[channelKey]?.lastRenderHash || '',
        lastRenderedAt: state.signalGridChannelsById[channelKey]?.lastRenderedAt || null,
        settingsJson: { ...state.signalGridChannelsById[channelKey]?.settingsJson, ...(settings || {}) },
        createdAt: state.signalGridChannelsById[channelKey]?.createdAt || nowIso(),
        updatedAt: nowIso(),
      };
      state.signalGridChannelsById[channelKey] = channel;
      this.audit(state, actorUserId, 'signal_grid.channel_configured', 'SignalGridChannel', channelKey, { guildId, channelId: channelKey, settings });
      return state;
    });
    return channel;
  }

  async updateChannelRender(channelId = '', patch = {}) {
    let saved;
    await this.repository.updateState((state) => {
      state.signalGridChannelsById ||= {};
      const key = String(channelId || '').trim();
      state.signalGridChannelsById[key] ||= {
        id: key,
        channelId: key,
        guildId: '',
        status: 'active',
        settingsJson: {},
        createdAt: nowIso(),
      };
      Object.assign(state.signalGridChannelsById[key], patch, { updatedAt: nowIso() });
      saved = state.signalGridChannelsById[key];
      return state;
    });
    return saved;
  }

  async logInteraction(event = {}) {
    let log;
    await this.repository.updateState((state) => {
      state.signalGridInteractionLogsById ||= {};
      const logId = event.id || id('siglog');
      log = {
        id: logId,
        logId,
        userId: String(event.userId || ''),
        discordUserId: String(event.discordUserId || event.userId || ''),
        action: String(event.action || ''),
        botId: String(event.botId || ''),
        symbol: cleanSymbol(event.symbol || ''),
        basketId: String(event.basketId || ''),
        result: String(event.result || 'ok'),
        reason: String(event.reason || ''),
        metadataJson: event.metadataJson || event.metadata || {},
        createdAt: nowIso(),
      };
      state.signalGridInteractionLogsById[logId] = log;
      return state;
    });
    return log;
  }

  normalizeCell(cell = {}, state = {}, settings = this.defaults()) {
    const status = this.getCellStatus(cell);
    const source = state.signalSourcesById?.[cell.sourceId] || {};
    return {
      ...cell,
      botName: cell.botName || source.name || cell.botId,
      status,
      tone: this.statusTone(status),
      emoji: this.statusEmoji(status),
      basketGrowthPercent: round(cell.basketGrowthPercent, 2),
      floatingPnl: round(cell.floatingPnl, 2),
      copyRequirement: cell.copyRequirement || settings.premiumAccessRequirement,
      lastUpdateAt: cell.lastUpdateAt || cell.updatedAt || cell.createdAt,
    };
  }

  applyFilters(cells = [], filters = {}) {
    const activeOnly = String(filters.activeOnly || filters.active || '').toLowerCase() === 'true' || filters.activeOnly === true;
    const query = String(filters.q || filters.search || '').trim().toLowerCase();
    return cells.filter((cell) => {
      if (activeOnly && ['inactive', 'expired', 'offline'].includes(cell.status)) return false;
      if (filters.bot && !String(cell.botId || cell.botName).toLowerCase().includes(String(filters.bot).toLowerCase())) return false;
      if (filters.symbol && cleanSymbol(cell.symbol) !== cleanSymbol(filters.symbol)) return false;
      if (filters.market && !String(cell.metadataJson?.market || cell.market || '').toLowerCase().includes(String(filters.market).toLowerCase())) return false;
      if (filters.session && String(cell.session || '').toLowerCase() !== String(filters.session).toLowerCase()) return false;
      if (filters.risk && String(cell.riskMode || '').toLowerCase() !== String(filters.risk).toLowerCase()) return false;
      if (query) {
        const haystack = `${cell.botName} ${cell.botId} ${cell.symbol} ${cell.direction} ${cell.status} ${cell.provider}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    }).sort((a, b) => {
      const aActive = ['inactive', 'expired', 'offline'].includes(a.status) ? 1 : 0;
      const bActive = ['inactive', 'expired', 'offline'].includes(b.status) ? 1 : 0;
      return aActive - bActive || String(a.botName).localeCompare(String(b.botName)) || String(a.symbol).localeCompare(String(b.symbol));
    });
  }

  groupForDiscord(cells = []) {
    const groups = new Map();
    for (const cell of cells.slice(0, 25)) {
      const market = cell.metadataJson?.market || (String(cell.symbol).includes('XAU') || String(cell.symbol).includes('XAG') ? 'Gold Bots' : String(cell.symbol).match(/NAS|US30|SPX|GER/) ? 'Indices' : 'Forex Flow');
      if (!groups.has(market)) groups.set(market, []);
      groups.get(market).push(cell);
    }
    return [...groups.entries()].map(([name, rows]) => ({ name, rows }));
  }

  hashableCell(cell = {}) {
    return {
      id: cell.id,
      botId: cell.botId,
      symbol: cell.symbol,
      status: cell.status,
      growth: cell.basketGrowthPercent,
      pnl: cell.floatingPnl,
      trades: cell.openTradeCount,
      updated: cell.lastUpdateAt,
    };
  }

  audit(state, actorUserId, action, targetType, targetId, metadata = {}) {
    if (typeof this.repository.addAuditToState === 'function') {
      return this.repository.addAuditToState(state, { adminId: actorUserId, action, targetType, targetId, data: metadata });
    }
    state.adminAuditLogsById ||= {};
    const auditId = id('audit');
    state.adminAuditLogsById[auditId] = { auditLogId: auditId, actorUserId, action, targetType, targetId, metadata, createdAt: nowIso() };
    return state.adminAuditLogsById[auditId];
  }

  async seedDemoGrid() {
    const state = await this.repository.loadState();
    if (Object.keys(state.signalGridCellsById || {}).length) return { skipped: true };
    const samples = [
      { botId: 'reaper', botName: 'Reaper', symbol: 'XAUUSD', direction: 'buy', floatingPnl: 240, balance: 5000, openTradeCount: 5, session: 'New York', volatilityState: 'high', metadata: { market: 'Gold Bots' } },
      { botId: 'reaper', botName: 'Reaper', symbol: 'XAGUSD', direction: 'mixed', floatingPnl: 0, balance: 5000, openTradeCount: 0, status: 'inactive', session: 'London', volatilityState: 'normal', metadata: { market: 'Gold Bots' } },
      { botId: 'flowbot', botName: 'FlowBot', symbol: 'GBPJPY', direction: 'sell', floatingPnl: -42, balance: 6000, openTradeCount: 3, session: 'London', volatilityState: 'fast', metadata: { market: 'Forex Flow' } },
      { botId: 'pulse', botName: 'Pulse', symbol: 'NAS100', direction: 'buy', floatingPnl: 310, balance: 6000, openTradeCount: 4, session: 'New York', volatilityState: 'breakout', metadata: { market: 'Indices' } },
    ];
    for (const sample of samples) await this.updateSignalCell(sample);
    return { seeded: samples.length };
  }
}
