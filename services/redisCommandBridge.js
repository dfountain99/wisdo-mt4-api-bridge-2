import crypto from 'node:crypto';

function nowIso() { return new Date().toISOString(); }
function clean(value) { return String(value ?? '').trim(); }
function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}
function accountFrom(command = {}, fallback = '') {
  return clean(command.accountId || command.account_id || command.payload?.accountId || command.payload?.followerAccountId || fallback);
}
function ownerFrom(command = {}, fallback = '') {
  return clean(command.userId || command.discordUserId || command.ownerUserId || command.payload?.userId || fallback);
}
function json(value, fallback = {}) {
  try { return JSON.parse(String(value || '')); } catch { return fallback; }
}

const TERMINAL_STATES = new Set(['completed', 'failed', 'expired', 'cancelled', 'dead_letter']);
const TRANSITIONS = {
  queued: new Set(['claimed', 'delivered', 'completed', 'failed', 'expired', 'cancelled', 'dead_letter']),
  claimed: new Set(['delivered', 'queued', 'completed', 'failed', 'expired', 'cancelled', 'dead_letter']),
  delivered: new Set(['completed', 'failed', 'queued', 'expired', 'cancelled', 'dead_letter']),
  completed: new Set(), failed: new Set(), expired: new Set(), cancelled: new Set(), dead_letter: new Set(),
};

export class RedisCommandBridge {
  constructor({
    url = process.env.REDIS_URL || '', logger = console, prefix = 'wisdo', enabled = true,
    databaseUrl = process.env.DATABASE_URL || '', dbSsl = process.env.WISDO_DB_SSL || process.env.DB_SSL || false,
    healthTtlSeconds = 90, recoveryIntervalMs = 15000, visibilityTimeoutMs = 30000, maxDeliveryAttempts = 5,
  } = {}) {
    this.url = clean(url);
    this.logger = logger || console;
    this.prefix = clean(prefix) || 'wisdo';
    this.enabled = Boolean(enabled && this.url);
    this.databaseUrl = clean(databaseUrl);
    this.dbSsl = parseBoolean(dbSsl, false);
    this.client = null;
    this.dbPool = null;
    this.connected = false;
    this.startedAt = nowIso();
    this.healthTtlSeconds = Math.max(30, Number(healthTtlSeconds || 90));
    this.recoveryIntervalMs = Math.max(5000, Number(recoveryIntervalMs || 15000));
    this.visibilityTimeoutMs = Math.max(5000, Number(visibilityTimeoutMs || 30000));
    this.maxDeliveryAttempts = Math.max(1, Number(maxDeliveryAttempts || 5));
    this.healthTimer = null;
    this.recoveryTimer = null;
    this.metrics = {
      published: 0, idempotentReplays: 0, delivered: 0, completed: 0, failed: 0,
      retried: 0, deadLettered: 0, rejectedAcks: 0, errors: 0, lastEventAt: null,
    };
  }

  key(...parts) { return [this.prefix, ...parts.map(clean)].join(':'); }
  executionStream(account, owner) { return account ? this.key('stream', 'account', account) : this.key('stream', 'user', owner || 'unrouted'); }

  async getDbPool() {
    if (!this.databaseUrl) return null;
    if (this.dbPool) return this.dbPool;
    const pg = await import('pg');
    this.dbPool = new pg.Pool({
      connectionString: this.databaseUrl,
      ssl: this.dbSsl ? { rejectUnauthorized: false } : false,
      max: Math.max(2, Number(process.env.DB_POOL_MAX || 10)),
      idleTimeoutMillis: Math.max(1000, Number(process.env.DB_IDLE_TIMEOUT_MS || 30000)),
      connectionTimeoutMillis: Math.max(1000, Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000)),
    });
    await this.ensureDatabaseSchema();
    return this.dbPool;
  }

  async ensureDatabaseSchema() {
    if (!this.dbPool) return;
    await this.dbPool.query(`
      create table if not exists wisdo_copier_commands (
        id text primary key, user_id text, account_id text, command text not null,
        status text not null default 'queued', payload jsonb not null default '{}'::jsonb,
        result jsonb, attempts integer not null default 0, receiver_id text,
        bridge_state text not null default 'stored', last_error text,
        queued_at timestamptz not null default now(), claimed_at timestamptz,
        delivered_at timestamptz, completed_at timestamptz, expires_at timestamptz,
        updated_at timestamptz not null default now()
      );
      alter table wisdo_copier_commands add column if not exists receiver_id text;
      alter table wisdo_copier_commands add column if not exists bridge_state text not null default 'stored';
      alter table wisdo_copier_commands add column if not exists last_error text;
      alter table wisdo_copier_commands add column if not exists claimed_at timestamptz;
      alter table wisdo_copier_commands add column if not exists expires_at timestamptz;
      create index if not exists wisdo_copier_commands_pending_idx on wisdo_copier_commands(status, queued_at);
      create index if not exists wisdo_copier_commands_account_idx on wisdo_copier_commands(account_id, queued_at desc);
      create table if not exists wisdo_receiver_heartbeats (
        account_id text primary key, user_id text, terminal text, receiver_id text,
        metadata jsonb not null default '{}'::jsonb, received_at timestamptz not null default now()
      );
      alter table wisdo_receiver_heartbeats add column if not exists receiver_id text;
    `);
  }

  async persistCommand(envelope, bridgeState = 'published') {
    const pool = await this.getDbPool().catch((error) => {
      this.metrics.errors += 1;
      this.logger?.warn?.('PostgreSQL copier command persistence unavailable.', { message: error.message });
      return null;
    });
    if (!pool) return false;
    await pool.query(
      `insert into wisdo_copier_commands
       (id,user_id,account_id,command,status,payload,attempts,bridge_state,queued_at,expires_at,updated_at)
       values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,now())
       on conflict(id) do update set
       user_id=excluded.user_id, account_id=excluded.account_id, command=excluded.command,
       payload=excluded.payload, bridge_state=excluded.bridge_state, expires_at=excluded.expires_at, updated_at=now()`,
      [envelope.id, envelope.userId || null, envelope.accountId || null, clean(envelope.command) || 'UNKNOWN', envelope.status,
        JSON.stringify(envelope), Number(envelope.deliveryAttempts || 0), bridgeState, envelope.queuedAt, envelope.expiresAt || null],
    );
    return true;
  }

  async persistAcknowledgement(id, status, result, { receiverId = '', attempts = null, error = '' } = {}) {
    const pool = await this.getDbPool().catch(() => null);
    if (!pool) return false;
    const timestampColumn = status === 'claimed' ? 'claimed_at' : status === 'delivered' ? 'delivered_at' : TERMINAL_STATES.has(status) ? 'completed_at' : null;
    const timestampSql = timestampColumn ? `, ${timestampColumn}=now()` : '';
    await pool.query(
      `update wisdo_copier_commands set status=$2, result=$3::jsonb,
       receiver_id=coalesce(nullif($4,''),receiver_id), attempts=coalesce($5,attempts),
       bridge_state=$6, last_error=nullif($7,''), updated_at=now()${timestampSql} where id=$1`,
      [id, status, JSON.stringify(result || {}), clean(receiverId), attempts, TERMINAL_STATES.has(status) ? 'finalized' : status, clean(error)],
    );
    return true;
  }

  async persistHeartbeat({ userId = '', accountId = '', terminal = 'MT4', receiverId = '', meta = {} } = {}) {
    const pool = await this.getDbPool().catch(() => null);
    if (!pool) return false;
    await pool.query(
      `insert into wisdo_receiver_heartbeats(account_id,user_id,terminal,receiver_id,metadata,received_at)
       values($1,$2,$3,$4,$5::jsonb,now()) on conflict(account_id) do update set
       user_id=excluded.user_id,terminal=excluded.terminal,receiver_id=excluded.receiver_id,
       metadata=excluded.metadata,received_at=now()`,
      [clean(accountId), clean(userId) || null, clean(terminal) || 'MT4', clean(receiverId) || null, JSON.stringify(meta || {})],
    );
    return true;
  }

  async refreshApiHealth() {
    if (!this.enabled) return false;
    return this.safe((client) => client.set(this.key('health', 'api'), JSON.stringify({
      status: 'online', startedAt: this.startedAt, updatedAt: nowIso(), pid: process.pid,
    }), { EX: this.healthTtlSeconds }), false);
  }

  startWorkers() {
    if (!this.healthTimer) {
      this.healthTimer = setInterval(() => this.refreshApiHealth().catch(() => undefined), Math.max(10000, Math.floor(this.healthTtlSeconds * 500)));
      this.healthTimer.unref?.();
    }
    if (!this.recoveryTimer) {
      this.recoveryTimer = setInterval(() => this.recoverStaleCommands().catch(() => undefined), this.recoveryIntervalMs);
      this.recoveryTimer.unref?.();
    }
  }

  async connect() {
    if (!this.enabled || this.connected) return this.connected;
    try {
      const redis = await import('redis');
      this.client = redis.createClient({
        url: this.url,
        socket: { reconnectStrategy: (retries) => Math.min(250 * Math.max(1, retries), 5000), connectTimeout: 10000, keepAlive: 5000 },
      });
      this.client.on('error', (error) => {
        this.metrics.errors += 1;
        this.connected = false;
        this.logger?.warn?.('Redis copier bridge error.', { message: error.message });
      });
      this.client.on('ready', () => { this.connected = true; });
      await this.client.connect();
      this.connected = true;
      await this.refreshApiHealth();
      await this.getDbPool().catch(() => null);
      this.startWorkers();
      return true;
    } catch (error) {
      this.metrics.errors += 1;
      this.connected = false;
      this.logger?.warn?.('Redis copier bridge disabled after connection failure.', { message: error.message });
      return false;
    }
  }

  async safe(operation, fallback = null) {
    if (!this.enabled) return fallback;
    if (!this.connected && !(await this.connect())) return fallback;
    try { return await operation(this.client); }
    catch (error) {
      this.metrics.errors += 1;
      this.logger?.warn?.('Redis copier operation failed.', { message: error.message });
      return fallback;
    }
  }

  async existingEnvelope(commandId) {
    const record = await this.safe((client) => client.hGetAll(this.key('command', commandId)), {});
    if (!record || !Object.keys(record).length) return null;
    return json(record.payload, null);
  }

  async publish(command = {}, { userId = '', accountId = '' } = {}) {
    const commandId = clean(command.id || command.commandId) || `cmd_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
    const duplicate = await this.existingEnvelope(commandId);
    if (duplicate) {
      this.metrics.idempotentReplays += 1;
      return { ...duplicate, bridgeDelivery: { accepted: true, state: 'idempotent_replay', commandId } };
    }

    const owner = ownerFrom(command, userId);
    const account = accountFrom(command, accountId);
    const queuedAt = command.queuedAt || command.createdAt || nowIso();
    const ttl = Math.max(60, Number(command.payload?.ttlSeconds || command.ttlSeconds || 3600));
    const expiresAt = command.expiresAt || new Date(new Date(queuedAt).getTime() + ttl * 1000).toISOString();
    const envelope = {
      ...command, id: commandId, userId: owner, accountId: account, status: 'queued', queuedAt,
      expiresAt, bridgePublishedAt: nowIso(), deliveryAttempts: Number(command.deliveryAttempts || 0),
      executionRoute: account ? 'account_stream' : 'user_stream',
    };
    const payload = JSON.stringify(envelope);
    const stream = this.executionStream(account, owner);
    const redisAccepted = await this.safe(async (client) => {
      await client.hSet(this.key('command', commandId), {
        payload, status: 'queued', userId: owner, accountId: account, command: clean(command.command),
        queuedAt, expiresAt, deliveryAttempts: String(envelope.deliveryAttempts), updatedAt: nowIso(), stream,
      });
      await client.expire(this.key('command', commandId), ttl);
      await client.xAdd(stream, '*', { commandId, accountId: account, userId: owner, payload });
      await client.expire(stream, Math.max(ttl, 86400));
      await client.zAdd(this.key('commands', 'pending'), [{ score: Date.now(), value: commandId }]);
      if (account) await client.publish(this.key('channel', 'account', account), payload);
      if (owner) await client.publish(this.key('channel', 'user', owner), JSON.stringify({ type: 'command_queued', commandId, accountId: account, status: 'queued' }));
      return true;
    }, false);
    const postgresAccepted = await this.persistCommand(envelope, redisAccepted ? 'published' : 'redis_degraded').catch(() => false);
    this.metrics.published += 1;
    this.metrics.lastEventAt = nowIso();
    return {
      ...envelope,
      bridgeDelivery: {
        accepted: Boolean(redisAccepted || postgresAccepted),
        state: redisAccepted ? (postgresAccepted ? 'published_and_durable' : 'published_redis_only') : (postgresAccepted ? 'durable_degraded' : 'failed'),
        redis: Boolean(redisAccepted), postgres: Boolean(postgresAccepted), commandId, stream,
      },
    };
  }

  validTransition(current, next) {
    if (!current || current === next) return true;
    return Boolean(TRANSITIONS[current]?.has(next));
  }

  async acknowledge(commandId, status, result = {}, { userId = '', accountId = '', receiverId = '' } = {}) {
    const id = clean(commandId);
    if (!id) return false;
    const normalized = clean(status).toLowerCase() || 'completed';
    const existing = await this.safe((client) => client.hGetAll(this.key('command', id)), {});
    if (!existing || !Object.keys(existing).length) {
      this.metrics.rejectedAcks += 1;
      return false;
    }
    if (clean(userId) && clean(existing.userId) && clean(userId) !== clean(existing.userId)) {
      this.metrics.rejectedAcks += 1;
      return false;
    }
    if (clean(accountId) && clean(existing.accountId) && clean(accountId) !== clean(existing.accountId)) {
      this.metrics.rejectedAcks += 1;
      return false;
    }
    const current = clean(existing.status).toLowerCase() || 'queued';
    if (!this.validTransition(current, normalized)) {
      this.metrics.rejectedAcks += 1;
      return false;
    }
    const attempts = Number(existing.deliveryAttempts || 0);
    const record = {
      status: normalized, result: JSON.stringify(result || {}), userId: clean(existing.userId || userId),
      accountId: clean(existing.accountId || accountId), receiverId: clean(receiverId), updatedAt: nowIso(),
    };
    const completed = TERMINAL_STATES.has(normalized);
    const accepted = await this.safe(async (client) => {
      await client.hSet(this.key('command', id), record);
      await client.publish(this.key('channel', 'ack'), JSON.stringify({ commandId: id, ...record, result }));
      if (completed) await client.zRem(this.key('commands', 'pending'), id);
      else await client.zAdd(this.key('commands', 'pending'), [{ score: Date.now(), value: id }]);
      return true;
    }, false);
    await this.persistAcknowledgement(id, normalized, result, { receiverId, attempts, error: result?.message || '' }).catch(() => false);
    if (!accepted) return false;
    if (normalized === 'delivered') this.metrics.delivered += 1;
    else if (normalized === 'failed') this.metrics.failed += 1;
    else if (normalized === 'completed') this.metrics.completed += 1;
    else if (normalized === 'dead_letter') this.metrics.deadLettered += 1;
    this.metrics.lastEventAt = nowIso();
    return true;
  }

  async heartbeat({ userId = '', accountId = '', terminal = 'MT4', receiverId = '', meta = {} } = {}) {
    const account = clean(accountId);
    if (!account) return false;
    const body = JSON.stringify({ userId: clean(userId), accountId: account, terminal, receiverId: clean(receiverId), meta, receivedAt: nowIso() });
    const redisAccepted = await this.safe((client) => client.set(this.key('heartbeat', account), body, { EX: 45 }), false);
    const postgresAccepted = await this.persistHeartbeat({ userId, accountId: account, terminal, receiverId, meta }).catch(() => false);
    return Boolean(redisAccepted || postgresAccepted);
  }

  async recoverStaleCommands() {
    if (!this.enabled) return { recovered: 0, deadLettered: 0, expired: 0 };
    const cutoff = Date.now() - this.visibilityTimeoutMs;
    const ids = await this.safe((client) => client.zRangeByScore(this.key('commands', 'pending'), 0, cutoff), []);
    let recovered = 0; let deadLettered = 0; let expired = 0;
    for (const id of ids || []) {
      const record = await this.safe((client) => client.hGetAll(this.key('command', id)), {});
      if (!record || !Object.keys(record).length) {
        await this.safe((client) => client.zRem(this.key('commands', 'pending'), id), 0);
        continue;
      }
      const current = clean(record.status).toLowerCase() || 'queued';
      if (TERMINAL_STATES.has(current)) {
        await this.safe((client) => client.zRem(this.key('commands', 'pending'), id), 0);
        continue;
      }
      if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) {
        await this.acknowledge(id, 'expired', { message: 'Command TTL expired before confirmed execution.' }, { userId: record.userId, accountId: record.accountId });
        expired += 1;
        continue;
      }
      const attempts = Number(record.deliveryAttempts || 0) + 1;
      if (attempts > this.maxDeliveryAttempts) {
        await this.acknowledge(id, 'dead_letter', { message: 'Maximum delivery attempts exceeded.', attempts }, { userId: record.userId, accountId: record.accountId });
        deadLettered += 1;
        continue;
      }
      const envelope = { ...json(record.payload, {}), status: 'queued', deliveryAttempts: attempts, retriedAt: nowIso() };
      const payload = JSON.stringify(envelope);
      const stream = record.stream || this.executionStream(record.accountId, record.userId);
      await this.safe(async (client) => {
        await client.xAdd(stream, '*', { commandId: id, accountId: record.accountId || '', userId: record.userId || '', payload });
        await client.hSet(this.key('command', id), { payload, status: 'queued', deliveryAttempts: String(attempts), updatedAt: nowIso() });
        await client.zAdd(this.key('commands', 'pending'), [{ score: Date.now(), value: id }]);
        return true;
      }, false);
      await this.persistAcknowledgement(id, 'queued', { retry: true, attempts }, { attempts }).catch(() => false);
      recovered += 1;
      this.metrics.retried += 1;
    }
    return { recovered, deadLettered, expired };
  }

  async health() {
    const ping = await this.safe((client) => client.ping(), null);
    const pending = await this.safe((client) => client.zCard(this.key('commands', 'pending')), 0);
    let database = { enabled: Boolean(this.databaseUrl), connected: false };
    if (this.databaseUrl) {
      try {
        const pool = await this.getDbPool();
        const result = await pool.query(`select
          count(*) filter(where status in ('queued','claimed','delivered'))::int as pending,
          count(*) filter(where status='dead_letter')::int as dead_letter from wisdo_copier_commands`);
        database = { enabled: true, connected: true, pendingCommands: result.rows[0]?.pending || 0, deadLetterCommands: result.rows[0]?.dead_letter || 0 };
      } catch (error) { database = { enabled: true, connected: false, error: error.message }; }
    }
    return {
      enabled: this.enabled, connected: this.connected && ping === 'PONG', pendingCommands: Number(pending || 0),
      prefix: this.prefix, startedAt: this.startedAt, queueMode: 'redis_streams_single_authoritative_route',
      retryPolicy: { visibilityTimeoutMs: this.visibilityTimeoutMs, maxDeliveryAttempts: this.maxDeliveryAttempts },
      database, metrics: { ...this.metrics },
    };
  }

  decorate(service) {
    if (!service || service.__wisdoRedisDecorated) return service;
    const bridge = this;
    const wrapQueue = (methodName, accountScoped) => {
      const original = service[methodName]?.bind(service);
      if (!original) return;
      service[methodName] = async (...args) => {
        const command = await original(...args);
        const userId = args[0];
        const accountId = accountScoped ? args[1] : command?.accountId || command?.payload?.accountId || '';
        const envelope = await bridge.publish(command || {}, { userId, accountId });
        if (command && typeof command === 'object') command.bridgeDelivery = envelope.bridgeDelivery;
        return command;
      };
    };
    wrapQueue('queueCommand', false);
    wrapQueue('queueCommandForAccount', true);

    const wrapAck = (methodName, status) => {
      const original = service[methodName]?.bind(service);
      if (!original) return;
      service[methodName] = async (...args) => {
        const result = await original(...args);
        const userId = args[0];
        const commandId = args[1];
        const payload = status === 'failed' ? { message: args[2] } : (args[2] || {});
        const accountId = args[3] || result?.accountId || result?.payload?.accountId || '';
        await bridge.acknowledge(commandId, status, payload, { userId, accountId });
        return result;
      };
    };
    wrapAck('markCommandDelivered', 'delivered');
    wrapAck('markCommandCompleted', 'completed');
    wrapAck('markCommandFailed', 'failed');

    Object.defineProperty(service, '__wisdoRedisDecorated', { value: true });
    service.redisBridge = bridge;
    return service;
  }

  async close() {
    if (this.healthTimer) clearInterval(this.healthTimer);
    if (this.recoveryTimer) clearInterval(this.recoveryTimer);
    this.healthTimer = null;
    this.recoveryTimer = null;
    if (this.client) {
      await this.client.del?.(this.key('health', 'api')).catch?.(() => undefined);
      await this.client.quit?.().catch?.(() => undefined);
    }
    if (this.dbPool) await this.dbPool.end().catch(() => undefined);
    this.client = null;
    this.dbPool = null;
    this.connected = false;
  }
}

export function createRedisCommandBridge(config = {}, logger = console) {
  const redis = config.redis || {};
  const persistence = config.persistence || {};
  return new RedisCommandBridge({
    url: redis.url || config.redisUrl || process.env.REDIS_URL || '',
    prefix: redis.prefix || process.env.REDIS_PREFIX || 'wisdo',
    enabled: parseBoolean(redis.enabled ?? process.env.REDIS_ENABLED, true),
    databaseUrl: persistence.databaseUrl || config.databaseUrl || process.env.DATABASE_URL || '',
    dbSsl: persistence.dbSsl ?? config.dbSsl ?? process.env.WISDO_DB_SSL ?? process.env.DB_SSL,
    healthTtlSeconds: redis.healthTtlSeconds || process.env.REDIS_HEALTH_TTL_SECONDS || 90,
    recoveryIntervalMs: redis.recoveryIntervalMs || process.env.REDIS_RECOVERY_INTERVAL_MS || 15000,
    visibilityTimeoutMs: redis.visibilityTimeoutMs || process.env.REDIS_VISIBILITY_TIMEOUT_MS || 30000,
    maxDeliveryAttempts: redis.maxDeliveryAttempts || process.env.REDIS_MAX_DELIVERY_ATTEMPTS || 5,
    logger,
  });
}
