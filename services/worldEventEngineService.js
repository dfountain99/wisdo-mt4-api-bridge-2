import crypto from 'node:crypto';

export const WORLD_SIGNAL_REVIEW_WINDOW_SECONDS = 120;
export const WORLD_SIGNAL_VISIBILITY = Object.freeze({
  PRIVATE: 'PRIVATE',
  ACCOUNT_OWNER: 'ACCOUNT_OWNER',
  TEAM: 'TEAM',
  SUBSCRIBERS: 'SUBSCRIBERS',
  MEMBERS: 'MEMBERS',
  PUBLIC_WORLD: 'PUBLIC_WORLD',
});

const SIGNAL_TYPES = new Set(['PRIMARY_ENTRY', 'CONTINUATION', 'ADD_ON', 'RECOVERY', 'EXIT', 'CLOSE']);
const VISIBILITY = new Set(Object.values(WORLD_SIGNAL_VISIBILITY));
const safeText = (value, max = 120) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const safeNumber = (value, fallback = null) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const nowIso = () => new Date().toISOString();
const slug = (value = '') => safeText(value, 100).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'wisdo-bot';

function validIso(value, fallback = nowIso()) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function normalizeVisibility(value) {
  const normalized = safeText(value || WORLD_SIGNAL_VISIBILITY.ACCOUNT_OWNER, 32).toUpperCase();
  return VISIBILITY.has(normalized) ? normalized : WORLD_SIGNAL_VISIBILITY.ACCOUNT_OWNER;
}

function inferSignalType(signal = {}) {
  const explicit = safeText(signal.signalType, 32).toUpperCase().replace(/[-\s]+/g, '_');
  if (SIGNAL_TYPES.has(explicit)) return explicit;
  const text = `${signal.comment || ''} ${signal.strategyName || ''} ${signal.eaName || ''}`.toLowerCase();
  if (/recover/.test(text)) return 'RECOVERY';
  if (/add|sonic|ladder|pyramid|continuation/.test(text)) return 'ADD_ON';
  return 'PRIMARY_ENTRY';
}

function eventKey(signalId) {
  return `world-signal:${safeText(signalId, 180)}`;
}

function signalTradeTimestamp(signal = {}) {
  const createdAt = validIso(signal.createdAt || signal.updatedAt || nowIso());
  const candidate = validIso(signal.tradeTimestamp || signal.openTime || createdAt, createdAt);
  const parsed = Date.parse(candidate);
  const created = Date.parse(createdAt);
  // Reporter/terminal clocks are useful, but do not let a wildly future timestamp create a false countdown.
  if (parsed > Date.now() + 5 * 60_000) return createdAt;
  if (parsed < created - 7 * 24 * 60 * 60_000) return createdAt;
  return candidate;
}

function normalizeSignal(signal = {}) {
  const signalId = safeText(signal.signalId || signal.id, 180);
  if (!signalId) return null;
  const tradeTimestamp = signalTradeTimestamp(signal);
  const expiresAt = new Date(Date.parse(tradeTimestamp) + WORLD_SIGNAL_REVIEW_WINDOW_SECONDS * 1000).toISOString();
  const botName = safeText(signal.botName || signal.eaName || signal.sourceName || 'WISDO Bot', 100) || 'WISDO Bot';
  const direction = safeText(signal.direction || signal.side, 12).toUpperCase();
  if (!['BUY', 'SELL'].includes(direction)) return null;
  const symbol = safeText(signal.symbol, 32).toUpperCase();
  if (!symbol) return null;
  const signalType = inferSignalType(signal);
  const campaignId = safeText(signal.campaignId || signal.basketId || `${signal.leaderAccountId || 'account'}:${botName}:${symbol}:${direction}`, 180);
  return {
    eventId: eventKey(signalId),
    eventType: 'bot.signal.created',
    signalId,
    serverTimestamp: nowIso(),
    tradeTimestamp,
    expiresAt,
    decisionWindowSeconds: WORLD_SIGNAL_REVIEW_WINDOW_SECONDS,
    botId: slug(signal.botId || botName),
    botName,
    strategyId: safeText(signal.strategyId || signal.magicNumber || '', 100),
    strategyName: safeText(signal.strategyName || signal.comment || signal.eaName || botName, 100),
    leaderUserId: safeText(signal.leaderUserId || signal.ownerUserId, 100),
    accountScope: safeText(signal.leaderAccountId || signal.accountId, 160),
    symbol,
    direction,
    entryPrice: safeNumber(signal.openPrice ?? signal.entryPrice),
    lotSize: safeNumber(signal.lots ?? signal.lotSize),
    stopLoss: safeNumber(signal.stopLoss),
    takeProfit: safeNumber(signal.takeProfit),
    magicNumber: safeNumber(signal.magicNumber, null),
    signalType,
    visibility: normalizeVisibility(signal.worldVisibility || signal.visibility),
    audienceUserIds: Array.isArray(signal.audienceUserIds) ? [...new Set(signal.audienceUserIds.map((value) => safeText(value, 100)).filter(Boolean))].slice(0, 500) : [],
    requiredEntitlement: safeText(signal.requiredEntitlement, 100),
    tradeId: safeText(signal.tradeId || signal.sourceTicket || signal.signalId, 180),
    sourceTicket: safeText(signal.sourceTicket, 80),
    campaignId,
    presentationKey: `${slug(botName)}:${symbol}:${direction}:${campaignId}`,
    tradeStatus: String(signal.status || 'active').toLowerCase() === 'closed' ? 'closed' : 'active',
    presentationStatus: Date.parse(expiresAt) <= Date.now() ? 'expired' : 'active',
    closedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function ensureState(raw = {}) {
  raw.worldSignalEventsById ||= {};
  raw.worldSignalEventIds ||= [];
  return raw;
}

function viewerAllowed(event, viewer = {}) {
  const userId = safeText(viewer.userId || viewer.id, 100);
  const owner = Boolean(userId && userId === String(event.leaderUserId || ''));
  if (owner) return { allowed: true, owner: true };
  switch (event.visibility) {
    case WORLD_SIGNAL_VISIBILITY.PUBLIC_WORLD:
      return { allowed: true, owner: false };
    case WORLD_SIGNAL_VISIBILITY.MEMBERS:
      return { allowed: Boolean(userId), owner: false };
    case WORLD_SIGNAL_VISIBILITY.SUBSCRIBERS:
      return { allowed: Boolean(userId && viewer.isSubscriber), owner: false };
    case WORLD_SIGNAL_VISIBILITY.TEAM:
      return { allowed: Boolean(userId && event.audienceUserIds?.includes(userId)), owner: false };
    case WORLD_SIGNAL_VISIBILITY.PRIVATE:
    case WORLD_SIGNAL_VISIBILITY.ACCOUNT_OWNER:
    default:
      return { allowed: false, owner: false };
  }
}

function projectedEvent(event, viewer = {}) {
  const access = viewerAllowed(event, viewer);
  if (!access.allowed) return null;
  const common = {
    eventId: event.eventId,
    eventType: event.eventType,
    signalId: event.signalId,
    serverTimestamp: nowIso(),
    tradeTimestamp: event.tradeTimestamp,
    expiresAt: event.expiresAt,
    decisionWindowSeconds: event.decisionWindowSeconds,
    botId: event.botId,
    botName: event.botName,
    strategyName: event.strategyName,
    symbol: event.symbol,
    direction: event.direction,
    entryPrice: event.entryPrice,
    signalType: event.signalType,
    visibility: event.visibility,
    tradeId: event.tradeId,
    campaignId: event.campaignId,
    presentationKey: event.presentationKey,
    tradeStatus: event.tradeStatus,
    presentationStatus: event.presentationStatus,
    closedAt: event.closedAt,
    updatedAt: event.updatedAt,
    botAction: true,
    personalAccountActionImplied: false,
  };
  if (!access.owner) return common;
  return {
    ...common,
    strategyId: event.strategyId,
    accountScope: event.accountScope,
    lotSize: event.lotSize,
    stopLoss: event.stopLoss,
    takeProfit: event.takeProfit,
    magicNumber: event.magicNumber,
    sourceTicket: event.sourceTicket,
  };
}

export class WorldEventEngineService {
  constructor({ repository, logger = console, maxEvents = 1000, now = () => Date.now() } = {}) {
    if (!repository?.loadState || !repository?.updateState) throw new TypeError('WorldEventEngineService requires a repository.');
    this.repository = repository;
    this.logger = logger;
    this.maxEvents = Math.max(100, Math.min(5000, Number(maxEvents) || 1000));
    this.now = now;
    this.subscribers = new Set();
    this.expiryTimers = new Map();
    this.started = false;
    this.tradeSignalSource = null;
  }

  serverNowIso() {
    return new Date(this.now()).toISOString();
  }

  remainingSeconds(event, atMs = this.now()) {
    return Math.max(0, Math.ceil((Date.parse(event?.expiresAt || 0) - Number(atMs || 0)) / 1000));
  }

  async start({ tradeSignalService = null } = {}) {
    if (tradeSignalService) this.attachTradeSignalSource(tradeSignalService);
    if (this.started) return this;
    this.started = true;
    const state = ensureState(await this.repository.loadState());
    for (const id of state.worldSignalEventIds.slice(0, this.maxEvents)) {
      const event = state.worldSignalEventsById[id];
      if (!event) continue;
      if (event.presentationStatus === 'active') this.scheduleExpiry(event);
    }
    if (tradeSignalService?.load) {
      const data = await tradeSignalService.load().catch(() => null);
      const ids = Array.isArray(data?.signalIds) ? data.signalIds.slice(0, 500) : [];
      const recent = ids.map((id) => data.signalsById?.[id]).filter(Boolean).filter((signal) => {
        const at = Date.parse(signal.createdAt || signal.updatedAt || 0);
        return Number.isFinite(at) && this.now() - at <= 24 * 60 * 60_000;
      });
      await this.ingestCreatedBatch(recent, { broadcast: false });
    }
    return this;
  }

  stop() {
    for (const timer of this.expiryTimers.values()) clearTimeout(timer);
    this.expiryTimers.clear();
    this.subscribers.clear();
    this.started = false;
  }

  attachTradeSignalSource(source) {
    if (!source || source.__wisdoWorldEventBridgeInstalled) return false;
    Object.defineProperty(source, '__wisdoWorldEventBridgeInstalled', { value: true, configurable: true });
    this.tradeSignalSource = source;

    if (typeof source.createSignalsBatch === 'function') {
      const original = source.createSignalsBatch.bind(source);
      source.createSignalsBatch = async (...args) => {
        const signals = await original(...args);
        await this.ingestCreatedBatch(signals).catch((error) => this.logger?.warn?.('World signal batch ingestion failed.', { message: error.message }));
        return signals;
      };
    }
    if (typeof source.createSignal === 'function') {
      const original = source.createSignal.bind(source);
      source.createSignal = async (...args) => {
        const signal = await original(...args);
        if (signal) await this.ingestCreated(signal).catch((error) => this.logger?.warn?.('World signal ingestion failed.', { signalId: signal.signalId, message: error.message }));
        return signal;
      };
    }
    if (typeof source.queueSignalClosuresBatch === 'function') {
      const original = source.queueSignalClosuresBatch.bind(source);
      source.queueSignalClosuresBatch = (events = [], ...args) => {
        this.ingestClosedBatch(events).catch((error) => this.logger?.warn?.('World signal close ingestion failed.', { message: error.message }));
        return original(events, ...args);
      };
    }
    return true;
  }

  scheduleExpiry(event) {
    clearTimeout(this.expiryTimers.get(event.eventId));
    const delay = Math.max(0, Date.parse(event.expiresAt) - this.now());
    if (delay <= 0) {
      this.expireEvent(event.eventId).catch(() => undefined);
      return;
    }
    const timer = setTimeout(() => this.expireEvent(event.eventId).catch((error) => this.logger?.warn?.('World signal expiration failed.', { eventId: event.eventId, message: error.message })), Math.min(delay, 2_147_000_000));
    timer.unref?.();
    this.expiryTimers.set(event.eventId, timer);
  }

  subscribe(viewer, listener) {
    if (typeof listener !== 'function') return () => {};
    const row = { viewer: { ...viewer }, listener };
    this.subscribers.add(row);
    return () => this.subscribers.delete(row);
  }

  publish(type, detail, { eventId = crypto.randomUUID(), userId = null, projector = null } = {}) {
    const envelope = { type, eventId, serverTimestamp: this.serverNowIso() };
    for (const subscriber of this.subscribers) {
      if (userId && String(subscriber.viewer?.userId || '') !== String(userId)) continue;
      const projected = projector ? projector(subscriber.viewer) : detail;
      if (projected == null) continue;
      try { subscriber.listener({ ...envelope, detail: projected }); }
      catch (error) { this.logger?.warn?.('World realtime subscriber failed.', { type, message: error.message }); }
    }
    return envelope;
  }

  publishToUser(userId, type, detail, eventId = crypto.randomUUID()) {
    return this.publish(type, detail, { eventId, userId });
  }

  async ingestCreated(signal, { broadcast = true } = {}) {
    const normalized = normalizeSignal(signal);
    if (!normalized) return null;
    let saved = null;
    let created = false;
    await this.repository.updateState((raw) => {
      const state = ensureState(raw);
      const existing = state.worldSignalEventsById[normalized.eventId];
      if (existing) {
        saved = existing;
        return state;
      }
      state.worldSignalEventsById[normalized.eventId] = normalized;
      state.worldSignalEventIds = [normalized.eventId, ...state.worldSignalEventIds.filter((id) => id !== normalized.eventId)].slice(0, this.maxEvents);
      const keep = new Set(state.worldSignalEventIds);
      for (const id of Object.keys(state.worldSignalEventsById)) if (!keep.has(id)) delete state.worldSignalEventsById[id];
      saved = normalized;
      created = true;
      return state;
    });
    if (saved?.presentationStatus === 'active') this.scheduleExpiry(saved);
    if (created && broadcast) {
      this.publish('bot.signal.created', null, {
        eventId: saved.eventId,
        projector: (viewer) => projectedEvent(saved, viewer),
      });
    }
    return saved;
  }

  async ingestCreatedBatch(signals = [], options = {}) {
    const rows = [];
    for (const signal of Array.isArray(signals) ? signals : []) {
      const event = await this.ingestCreated(signal, options);
      if (event) rows.push(event);
    }
    return rows;
  }

  async ingestClosed(close = {}) {
    const signalId = safeText(close.signalId, 180);
    if (!signalId) return null;
    const id = eventKey(signalId);
    let updated = null;
    await this.repository.updateState((raw) => {
      const state = ensureState(raw);
      const event = state.worldSignalEventsById[id];
      if (!event) return state;
      if (event.tradeStatus === 'closed') {
        updated = event;
        return state;
      }
      event.tradeStatus = 'closed';
      event.presentationStatus = 'closed';
      event.eventType = 'bot.signal.updated';
      event.closedAt = this.serverNowIso();
      event.updatedAt = this.serverNowIso();
      updated = { ...event };
      return state;
    });
    if (!updated) return null;
    clearTimeout(this.expiryTimers.get(id));
    this.expiryTimers.delete(id);
    this.publish('bot.signal.updated', null, {
      eventId: `${id}:closed`,
      projector: (viewer) => projectedEvent(updated, viewer),
    });
    return updated;
  }

  async ingestClosedBatch(events = []) {
    const rows = [];
    for (const event of Array.isArray(events) ? events : []) {
      const updated = await this.ingestClosed(event);
      if (updated) rows.push(updated);
    }
    return rows;
  }

  async expireEvent(eventId) {
    let expired = null;
    await this.repository.updateState((raw) => {
      const state = ensureState(raw);
      const event = state.worldSignalEventsById[eventId];
      if (!event || event.presentationStatus !== 'active') return state;
      if (this.remainingSeconds(event) > 0) return state;
      event.presentationStatus = 'expired';
      event.eventType = 'bot.signal.expired';
      event.updatedAt = this.serverNowIso();
      expired = { ...event };
      return state;
    });
    this.expiryTimers.delete(eventId);
    if (expired) {
      this.publish('bot.signal.expired', null, {
        eventId: `${eventId}:expired`,
        projector: (viewer) => projectedEvent(expired, viewer),
      });
    }
    return expired;
  }

  async listForViewer(viewer, { activeOnly = false, limit = 100 } = {}) {
    const state = ensureState(await this.repository.loadState());
    const now = this.now();
    const result = [];
    const ids = state.worldSignalEventIds.slice(0, Math.max(1, Math.min(500, Number(limit) || 100)));
    for (const id of ids) {
      const event = state.worldSignalEventsById[id];
      if (!event) continue;
      if (event.presentationStatus === 'active' && Date.parse(event.expiresAt) <= now) {
        event.presentationStatus = 'expired';
      }
      if (activeOnly && !(event.presentationStatus === 'active' && event.tradeStatus === 'active' && Date.parse(event.expiresAt) > now)) continue;
      const projected = projectedEvent(event, viewer);
      if (projected) result.push(projected);
    }
    return result;
  }

  buildPresentationGroups(events = []) {
    const groups = new Map();
    for (const event of events) {
      const key = event.presentationKey || `${event.botId}:${event.symbol}:${event.direction}`;
      const group = groups.get(key) || { ...event, aggregateCount: 0, signalIds: [], tradeIds: [], signalTypes: [] };
      group.aggregateCount += 1;
      group.signalIds.push(event.signalId);
      group.tradeIds.push(event.tradeId);
      group.signalTypes.push(event.signalType);
      if (Date.parse(event.tradeTimestamp) > Date.parse(group.tradeTimestamp)) Object.assign(group, event);
      groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => Date.parse(b.tradeTimestamp) - Date.parse(a.tradeTimestamp));
  }

  async activeForViewer(viewer, options = {}) {
    const events = await this.listForViewer(viewer, { ...options, activeOnly: true });
    return {
      serverTimestamp: this.serverNowIso(),
      decisionWindowSeconds: WORLD_SIGNAL_REVIEW_WINDOW_SECONDS,
      events,
      presentation: this.buildPresentationGroups(events),
    };
  }

  async archiveForViewer(viewer, options = {}) {
    const events = await this.listForViewer(viewer, { ...options, activeOnly: false });
    return { serverTimestamp: this.serverNowIso(), events };
  }

  async getForViewer(eventId, viewer) {
    const state = ensureState(await this.repository.loadState());
    const event = state.worldSignalEventsById[safeText(eventId, 220)] || null;
    return event ? projectedEvent(event, viewer) : null;
  }
}
