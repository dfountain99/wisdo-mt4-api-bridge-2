import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';

function clean(value, max = 200) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function safeJsonParse(value, fallback = null) {
  try { return JSON.parse(String(value || '')); } catch { return fallback; }
}

function normalizeEvent(event = {}) {
  const type = clean(event.type || event.eventType, 160);
  const topic = clean(event.topic, 200);
  if (!type || !topic) throw new Error('World realtime events require topic and type.');
  return {
    ...event,
    eventId: clean(event.eventId || event.id, 160) || crypto.randomUUID(),
    topic,
    type,
    createdAt: event.createdAt || new Date().toISOString(),
  };
}

export class WorldRealtimeFabric {
  constructor({
    redisUrl = process.env.REDIS_URL || '',
    redisEnabled = parseBoolean(process.env.REDIS_ENABLED, false),
    prefix = process.env.REDIS_PREFIX || 'wisdo',
    presenceTtlSeconds = process.env.WISDO_WORLD_PRESENCE_TTL_SECONDS || 45,
    requireRedis = parseBoolean(process.env.WISDO_WORLD_REQUIRE_REDIS, false),
    logger = console,
  } = {}) {
    this.redisUrl = clean(redisUrl, 2048);
    this.redisEnabled = Boolean(redisEnabled && this.redisUrl);
    this.requireRedis = Boolean(requireRedis);
    this.prefix = clean(prefix, 80) || 'wisdo';
    this.presenceTtlSeconds = Math.min(300, Math.max(15, Number(presenceTtlSeconds || 45)));
    this.logger = logger || console;
    this.publisher = null;
    this.subscriber = null;
    this.connected = false;
    this.localEmitter = new EventEmitter({ captureRejections: true });
    this.localPresence = new Map();
    this.channelHandlers = new Map();
    this.metrics = {
      published: 0,
      received: 0,
      presenceWrites: 0,
      errors: 0,
      lastEventAt: null,
    };
  }

  key(...parts) {
    return [this.prefix, 'world', ...parts.map((part) => clean(part, 220))].join(':');
  }

  eventChannel(topic) {
    return this.key('events', topic);
  }

  presenceKey(instanceId, userId) {
    return this.key('presence', instanceId, userId);
  }

  async connect() {
    if (this.connected) return true;
    if (!this.redisEnabled) {
      if (this.requireRedis) throw new Error('Redis is required for the World realtime fabric but REDIS_ENABLED/REDIS_URL is not configured.');
      return false;
    }
    try {
      const redis = await import('redis');
      const socket = {
        reconnectStrategy: (retries) => Math.min(250 * Math.max(1, retries), 5000),
        connectTimeout: 10000,
        keepAlive: 5000,
      };
      this.publisher = redis.createClient({ url: this.redisUrl, socket });
      this.subscriber = this.publisher.duplicate();
      const onError = (error) => {
        this.metrics.errors += 1;
        this.logger?.warn?.('World realtime Redis error.', { message: error.message });
      };
      this.publisher.on('error', onError);
      this.subscriber.on('error', onError);
      await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
      this.connected = true;
      return true;
    } catch (error) {
      this.metrics.errors += 1;
      this.connected = false;
      if (this.requireRedis) throw error;
      this.logger?.warn?.('World realtime fabric using single-process memory fallback.', { message: error.message });
      return false;
    }
  }

  async publish(event = {}) {
    const normalized = normalizeEvent(event);
    const payload = JSON.stringify(normalized);
    let redisPublished = false;
    if (this.redisEnabled) {
      try {
        if (!this.connected) await this.connect();
        if (this.connected) {
          await this.publisher.publish(this.eventChannel(normalized.topic), payload);
          redisPublished = true;
        }
      } catch (error) {
        this.metrics.errors += 1;
        if (this.requireRedis) throw error;
        this.logger?.warn?.('World realtime publish degraded to local delivery.', { message: error.message, topic: normalized.topic });
      }
    }
    // In Redis mode the local subscriber receives the same publication back through
    // Redis. Emit directly only in single-process fallback mode to avoid duplicates.
    const localPublished = !redisPublished;
    if (localPublished) this.localEmitter.emit(normalized.topic, normalized);
    this.metrics.published += 1;
    this.metrics.lastEventAt = normalized.createdAt;
    return { event: normalized, redisPublished, localPublished };
  }

  async subscribe(topic, handler) {
    const normalizedTopic = clean(topic, 200);
    if (!normalizedTopic || typeof handler !== 'function') throw new TypeError('World realtime subscribe requires topic and handler.');
    this.localEmitter.on(normalizedTopic, handler);
    const existing = this.channelHandlers.get(normalizedTopic) || { handlers: new Set(), subscribed: false };
    existing.handlers.add(handler);
    this.channelHandlers.set(normalizedTopic, existing);

    if (this.redisEnabled && !existing.subscribed) {
      try {
        if (!this.connected) await this.connect();
        if (this.connected) {
          await this.subscriber.subscribe(this.eventChannel(normalizedTopic), (message) => {
            const parsed = safeJsonParse(message);
            if (!parsed) return;
            this.metrics.received += 1;
            for (const fn of this.channelHandlers.get(normalizedTopic)?.handlers || []) {
              Promise.resolve(fn(parsed)).catch((error) => {
                this.metrics.errors += 1;
                this.logger?.warn?.('World realtime subscriber handler failed.', { topic: normalizedTopic, message: error.message });
              });
            }
          });
          existing.subscribed = true;
        }
      } catch (error) {
        this.metrics.errors += 1;
        if (this.requireRedis) throw error;
        this.logger?.warn?.('World realtime subscribe is local-only.', { topic: normalizedTopic, message: error.message });
      }
    }

    return async () => {
      this.localEmitter.off(normalizedTopic, handler);
      const state = this.channelHandlers.get(normalizedTopic);
      state?.handlers?.delete(handler);
      if (state?.subscribed && state.handlers.size === 0 && this.connected) {
        await this.subscriber.unsubscribe(this.eventChannel(normalizedTopic)).catch(() => undefined);
        state.subscribed = false;
      }
      if (state && state.handlers.size === 0) this.channelHandlers.delete(normalizedTopic);
    };
  }

  async setPresence({ instanceId, userId, state = {} } = {}) {
    const instance = clean(instanceId, 160);
    const user = clean(userId, 160);
    if (!instance || !user) throw new Error('instanceId and userId are required for World presence.');
    const presence = {
      userId: user,
      instanceId: instance,
      ...state,
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.presenceTtlSeconds * 1000).toISOString(),
    };
    const localKey = `${instance}:${user}`;
    this.localPresence.set(localKey, presence);
    this.metrics.presenceWrites += 1;
    if (this.redisEnabled) {
      try {
        if (!this.connected) await this.connect();
        if (this.connected) await this.publisher.set(this.presenceKey(instance, user), JSON.stringify(presence), { EX: this.presenceTtlSeconds });
      } catch (error) {
        this.metrics.errors += 1;
        if (this.requireRedis) throw error;
      }
    }
    return presence;
  }

  async listPresence(instanceId) {
    const instance = clean(instanceId, 160);
    if (!instance) return [];
    if (this.redisEnabled) {
      try {
        if (!this.connected) await this.connect();
        if (this.connected) {
          const rows = [];
          let cursor = '0';
          do {
            const result = await this.publisher.scan(cursor, { MATCH: this.presenceKey(instance, '*'), COUNT: 100 });
            cursor = String(result.cursor);
            const keys = result.keys || [];
            if (keys.length) {
              const values = await this.publisher.mGet(keys);
              for (const value of values) {
                const parsed = safeJsonParse(value);
                if (parsed) rows.push(parsed);
              }
            }
          } while (cursor !== '0' && rows.length < 1000);
          return rows.slice(0, 1000);
        }
      } catch (error) {
        this.metrics.errors += 1;
        if (this.requireRedis) throw error;
      }
    }
    const now = Date.now();
    const rows = [];
    for (const [key, value] of this.localPresence.entries()) {
      if (!key.startsWith(`${instance}:`)) continue;
      if (Date.parse(value.expiresAt || '') <= now) {
        this.localPresence.delete(key);
        continue;
      }
      rows.push(value);
    }
    return rows;
  }

  async removePresence(instanceId, userId) {
    const instance = clean(instanceId, 160);
    const user = clean(userId, 160);
    this.localPresence.delete(`${instance}:${user}`);
    if (this.redisEnabled && this.connected) {
      await this.publisher.del(this.presenceKey(instance, user)).catch(() => undefined);
    }
  }

  async health() {
    const base = {
      ok: true,
      mode: this.connected ? 'redis' : 'memory',
      redisConfigured: this.redisEnabled,
      redisRequired: this.requireRedis,
      connected: this.connected,
      metrics: { ...this.metrics },
    };
    if (this.requireRedis && !this.connected) return { ...base, ok: false };
    return base;
  }

  async close() {
    for (const topic of this.channelHandlers.keys()) {
      if (this.connected) await this.subscriber.unsubscribe(this.eventChannel(topic)).catch(() => undefined);
    }
    this.channelHandlers.clear();
    this.localEmitter.removeAllListeners();
    await Promise.allSettled([
      this.subscriber?.quit?.(),
      this.publisher?.quit?.(),
    ]);
    this.connected = false;
  }
}

export function createWorldRealtimeFabric(options = {}) {
  return new WorldRealtimeFabric(options);
}
