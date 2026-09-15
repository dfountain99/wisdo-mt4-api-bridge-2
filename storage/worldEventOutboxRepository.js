import crypto from 'node:crypto';
import { getSharedPostgresPool } from '../services/persistenceAdapter.js';

function clean(value, max = 200) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function json(value) {
  try { return JSON.stringify(value ?? {}); } catch { return '{}'; }
}

export class WorldEventOutboxRepository {
  constructor({
    databaseUrl = process.env.DATABASE_URL || '',
    dbSsl = process.env.WISDO_DB_SSL || process.env.DB_SSL || false,
    logger = console,
  } = {}) {
    this.databaseUrl = clean(databaseUrl, 2048);
    this.dbSsl = ['1', 'true', 'yes', 'on'].includes(String(dbSsl || '').toLowerCase());
    this.logger = logger || console;
    this.pool = null;
    this.schemaReady = false;
  }

  async getPool() {
    if (!this.databaseUrl) throw new Error('DATABASE_URL is required for the World event outbox.');
    if (!this.pool) this.pool = await getSharedPostgresPool({ databaseUrl: this.databaseUrl, ssl: this.dbSsl });
    if (!this.schemaReady) await this.ensureSchema();
    return this.pool;
  }

  async ensureSchema() {
    if (this.schemaReady) return true;
    if (!this.pool) this.pool = await getSharedPostgresPool({ databaseUrl: this.databaseUrl, ssl: this.dbSsl });
    await this.pool.query(`
      create table if not exists wisdo_world_event_outbox (
        event_id text primary key,
        topic text not null,
        partition_key text,
        event_type text not null,
        payload jsonb not null default '{}'::jsonb,
        status text not null default 'pending',
        attempts integer not null default 0,
        available_at timestamptz not null default now(),
        locked_at timestamptz,
        locked_by text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        dispatched_at timestamptz,
        last_error text
      );
      create index if not exists wisdo_world_event_outbox_pending_idx
        on wisdo_world_event_outbox(status, available_at, created_at);
      create index if not exists wisdo_world_event_outbox_topic_idx
        on wisdo_world_event_outbox(topic, created_at desc);
    `);
    this.schemaReady = true;
    return true;
  }

  async enqueue(event = {}) {
    const pool = await this.getPool();
    const eventId = clean(event.eventId || event.id, 160) || crypto.randomUUID();
    const topic = clean(event.topic, 200);
    const eventType = clean(event.type || event.eventType, 160);
    const partitionKey = clean(event.partitionKey || event.instanceId || event.accountId || event.userId, 200) || null;
    if (!topic || !eventType) throw new Error('World event topic and type are required.');
    const payload = {
      ...event,
      eventId,
      topic,
      type: eventType,
      createdAt: event.createdAt || new Date().toISOString(),
    };
    const result = await pool.query(
      `insert into wisdo_world_event_outbox
       (event_id, topic, partition_key, event_type, payload, status, available_at, updated_at)
       values($1,$2,$3,$4,$5::jsonb,'pending',now(),now())
       on conflict(event_id) do nothing
       returning event_id`,
      [eventId, topic, partitionKey, eventType, json(payload)],
    );
    return { eventId, inserted: Boolean(result.rowCount), payload };
  }

  async claimBatch({ workerId, limit = 25, leaseSeconds = 30 } = {}) {
    const pool = await this.getPool();
    const safeWorker = clean(workerId, 160);
    if (!safeWorker) throw new Error('workerId is required to claim World events.');
    const safeLimit = Math.min(100, Math.max(1, Number(limit || 25)));
    const safeLease = Math.min(300, Math.max(5, Number(leaseSeconds || 30)));
    const result = await pool.query(
      `with candidates as (
         select event_id
         from wisdo_world_event_outbox
         where available_at <= now()
           and (
             status = 'pending'
             or (status = 'processing' and locked_at < now() - ($3::int * interval '1 second'))
           )
         order by created_at asc
         for update skip locked
         limit $2
       )
       update wisdo_world_event_outbox e
       set status='processing', locked_at=now(), locked_by=$1,
           attempts=e.attempts + 1, updated_at=now()
       from candidates c
       where e.event_id = c.event_id
       returning e.event_id, e.topic, e.partition_key, e.event_type, e.payload,
                 e.attempts, e.created_at`,
      [safeWorker, safeLimit, safeLease],
    );
    return result.rows || [];
  }

  async markDispatched(eventId) {
    const pool = await this.getPool();
    await pool.query(
      `update wisdo_world_event_outbox
       set status='dispatched', dispatched_at=now(), updated_at=now(),
           locked_at=null, locked_by=null, last_error=null
       where event_id=$1`,
      [clean(eventId, 160)],
    );
  }

  async markFailed(eventId, error, { retryDelayMs = 1000, maxAttempts = 12 } = {}) {
    const pool = await this.getPool();
    const message = clean(error?.message || error, 1000);
    const delayMs = Math.min(300000, Math.max(250, Number(retryDelayMs || 1000)));
    await pool.query(
      `update wisdo_world_event_outbox
       set status = case when attempts >= $3 then 'dead_letter' else 'pending' end,
           available_at = case when attempts >= $3 then available_at else now() + ($2::bigint * interval '1 millisecond') end,
           updated_at=now(), locked_at=null, locked_by=null, last_error=$4
       where event_id=$1`,
      [clean(eventId, 160), delayMs, Math.max(1, Number(maxAttempts || 12)), message],
    );
  }

  async health() {
    try {
      const pool = await this.getPool();
      const result = await pool.query(`select
        count(*) filter (where status='pending')::int as pending,
        count(*) filter (where status='processing')::int as processing,
        count(*) filter (where status='dead_letter')::int as dead_letter
        from wisdo_world_event_outbox`);
      return { ok: true, ...(result.rows?.[0] || {}) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }
}

export function createWorldEventOutboxRepository(options = {}) {
  return new WorldEventOutboxRepository(options);
}
