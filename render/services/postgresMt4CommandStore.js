import { getSharedPostgresPool } from './persistenceAdapter.js';

function asBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}
function rowRecord(row = {}) {
  if (!row.id) return null;
  return {
    id: row.id,
    dedupeKey: row.dedupe_key || '',
    userId: row.user_id || '',
    accountId: row.account_id || null,
    accountNumber: row.account_number || null,
    pairingCode: row.pairing_code || null,
    command: row.command,
    payload: row.payload || {},
    validation: row.validation || {},
    requiresConfirmation: Boolean(row.requires_confirmation),
    confirmationRequired: Boolean(row.requires_confirmation),
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null,
    status: row.status,
    attempts: Number(row.attempts || 0),
    priority: Number(row.priority || 0),
    immediate: Boolean(row.immediate),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    failedAt: row.failed_at ? new Date(row.failed_at).toISOString() : null,
    expiredAt: row.expired_at ? new Date(row.expired_at).toISOString() : null,
    result: row.result || null,
    errorMessage: row.error_message || null,
  };
}

export class PostgresMt4CommandStore {
  constructor({ databaseUrl = process.env.DATABASE_URL || '', ssl = process.env.WISDO_DB_SSL } = {}) {
    this.databaseUrl = databaseUrl;
    this.ssl = asBool(ssl, true);
    this.ready = null;
  }
  get enabled() { return Boolean(this.databaseUrl); }
  async pool() { return getSharedPostgresPool({ databaseUrl: this.databaseUrl, ssl: this.ssl }); }
  async initialize() {
    if (!this.enabled) return false;
    if (!this.ready) this.ready = this.#initialize();
    return this.ready;
  }
  async #initialize() {
    const pool = await this.pool();
    await pool.query(`
      create table if not exists wisdo_mt4_commands (
        id text primary key,
        dedupe_key text not null default '',
        user_id text not null,
        account_id text,
        account_number text,
        pairing_code text,
        command text not null,
        payload jsonb not null default '{}'::jsonb,
        validation jsonb not null default '{}'::jsonb,
        requires_confirmation boolean not null default false,
        confirmed_at timestamptz,
        status text not null default 'pending',
        attempts integer not null default 0,
        priority integer not null default 0,
        immediate boolean not null default true,
        created_at timestamptz not null default now(),
        expires_at timestamptz,
        delivered_at timestamptz,
        completed_at timestamptz,
        failed_at timestamptz,
        expired_at timestamptz,
        result jsonb,
        error_message text,
        updated_at timestamptz not null default now()
      );
      create index if not exists wisdo_mt4_commands_poll_idx on wisdo_mt4_commands(user_id, account_id, status, priority desc, created_at);
      create index if not exists wisdo_mt4_commands_account_idx on wisdo_mt4_commands(account_id, created_at desc);
      create index if not exists wisdo_mt4_commands_expiry_idx on wisdo_mt4_commands(status, expires_at);
      create unique index if not exists wisdo_mt4_commands_active_dedupe_idx on wisdo_mt4_commands(dedupe_key) where dedupe_key <> '' and status in ('pending','delivered');
      create table if not exists wisdo_mt4_command_audit (
        id bigserial primary key,
        command_id text,
        action text not null,
        details jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );
      create index if not exists wisdo_mt4_command_audit_created_idx on wisdo_mt4_command_audit(created_at desc);
    `);
    return true;
  }

  async expireStale() {
    await this.initialize();
    const pool = await this.pool();
    await pool.query(`update wisdo_mt4_commands set status='expired', expired_at=now(), updated_at=now() where status in ('pending','delivered') and expires_at is not null and expires_at < now()`);
  }

  async counts() {
    await this.initialize();
    const pool = await this.pool();
    const result = await pool.query(`select count(*) filter(where status in ('pending','delivered') and (expires_at is null or expires_at >= now()))::int as active from wisdo_mt4_commands`);
    return Number(result.rows[0]?.active || 0);
  }

  async enqueue(records = [], limits = {}) {
    if (!records.length) return [];
    await this.initialize();
    const pool = await this.pool();
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`update wisdo_mt4_commands set status='expired', expired_at=now(), updated_at=now() where status in ('pending','delivered') and expires_at is not null and expires_at < now()`);
      const activeRows = await client.query(`select user_id, account_id, count(*)::int as total from wisdo_mt4_commands where status in ('pending','delivered') group by grouping sets ((user_id,account_id),(user_id),())`);
      let globalCount = 0;
      const userCount = new Map();
      const accountCount = new Map();
      for (const row of activeRows.rows) {
        if (row.user_id === null && row.account_id === null) globalCount = Number(row.total || 0);
        else if (row.account_id === null) userCount.set(String(row.user_id), Number(row.total || 0));
        else accountCount.set(String(row.account_id), Number(row.total || 0));
      }
      const accepted = [];
      for (const record of records) {
        const critical = Boolean(record.validation?.dangerous) || /CLOSE|EMERGENCY|PROTECT|LOCK_PROFIT/i.test(String(record.command || ''));
        const uc = userCount.get(String(record.userId || '')) || 0;
        const ac = record.accountId ? (accountCount.get(String(record.accountId)) || 0) : 0;
        const over = globalCount >= Number(limits.global || 750) || uc >= Number(limits.perUser || 400) || (record.accountId && ac >= Number(limits.perAccount || 175));
        if (over && !critical) continue;
        accepted.push(record);
        globalCount += 1;
        userCount.set(String(record.userId || ''), uc + 1);
        if (record.accountId) accountCount.set(String(record.accountId), ac + 1);
      }
      for (const record of accepted) {
        await client.query(`
          insert into wisdo_mt4_commands(id,dedupe_key,user_id,account_id,account_number,pairing_code,command,payload,validation,requires_confirmation,confirmed_at,status,attempts,priority,immediate,created_at,expires_at,updated_at)
          values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11::timestamptz,$12,$13,$14,$15,$16::timestamptz,$17::timestamptz,now())
          on conflict do nothing
        `, [record.id, record.dedupeKey || '', record.userId, record.accountId || null, record.accountNumber || null, record.pairingCode || null, record.command, JSON.stringify(record.payload || {}), JSON.stringify(record.validation || {}), Boolean(record.requiresConfirmation || record.confirmationRequired), record.confirmedAt || null, record.status || 'pending', Number(record.attempts || 0), Number(record.priority || 0), record.immediate !== false, record.createdAt || new Date().toISOString(), record.expiresAt || null]);
      }
      await client.query('commit');
      const ids = accepted.map((r) => r.id);
      if (!ids.length) return [];
      const dedupeKeys = accepted.map((r) => String(r.dedupeKey || '')).filter(Boolean);
      const result = await pool.query(
        'select * from wisdo_mt4_commands where id = any($1::text[]) or ($2::text[] <> array[]::text[] and dedupe_key = any($2::text[])) order by priority desc, created_at',
        [ids, dedupeKeys],
      );
      const byId = new Map(result.rows.map((row) => [row.id, rowRecord(row)]));
      const byDedupe = new Map(result.rows.filter((row) => row.dedupe_key).map((row) => [row.dedupe_key, rowRecord(row)]));
      return accepted.map((record) => byId.get(record.id) || byDedupe.get(record.dedupeKey) || null).filter(Boolean);
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      if (error?.code === '23505') {
        const keys = records.map((r) => r.dedupeKey).filter(Boolean);
        if (keys.length) {
          const result = await pool.query('select * from wisdo_mt4_commands where dedupe_key = any($1::text[]) order by created_at desc', [keys]);
          return result.rows.map(rowRecord);
        }
      }
      throw error;
    } finally { client.release(); }
  }

  async pending(userIds = [], scope = {}) {
    await this.initialize();
    const ids = [...new Set(userIds.map(String).filter(Boolean))];
    if (!ids.length) return null;
    const pool = await this.pool();
    const params = [ids];
    let where = `user_id = any($1::text[]) and status in ('pending','delivered') and (expires_at is null or expires_at >= now()) and (status='pending' or delivered_at is null or delivered_at < now() - interval '15 seconds')`;
    for (const [column, value] of [['account_id', scope.accountId], ['account_number', scope.accountNumber], ['pairing_code', scope.pairingCode]]) {
      if (!value) continue;
      params.push(String(value));
      where += ` and (${column} is null or ${column}=$${params.length})`;
    }
    const result = await pool.query(`select * from wisdo_mt4_commands where ${where} order by priority desc, created_at asc limit 1`, params);
    return rowRecord(result.rows[0]);
  }

  async mark(commandId, patch = {}) {
    await this.initialize();
    const pool = await this.pool();
    const sets = [];
    const values = [String(commandId || '')];
    const mapping = {
      status: 'status', attempts: 'attempts', deliveredAt: 'delivered_at', completedAt: 'completed_at',
      failedAt: 'failed_at', expiredAt: 'expired_at', result: 'result', errorMessage: 'error_message',
    };
    for (const [key, column] of Object.entries(mapping)) {
      if (!(key in patch)) continue;
      values.push(['result'].includes(key) ? JSON.stringify(patch[key] ?? null) : patch[key]);
      sets.push(`${column}=$${values.length}${key === 'result' ? '::jsonb' : key.endsWith('At') ? '::timestamptz' : ''}`);
    }
    if (!sets.length) return this.getById(commandId);
    const result = await pool.query(`update wisdo_mt4_commands set ${sets.join(',')}, updated_at=now() where id=$1 returning *`, values);
    return rowRecord(result.rows[0]);
  }

  async getById(commandId) {
    await this.initialize();
    const pool = await this.pool();
    const result = await pool.query('select * from wisdo_mt4_commands where id=$1 limit 1', [String(commandId || '')]);
    return rowRecord(result.rows[0]);
  }

  async list({ userId = null, accountId = null, status = null, limit = 250 } = {}) {
    await this.initialize();
    const pool = await this.pool();
    const params = [];
    const clauses = [];
    for (const [column, value] of [['user_id', userId], ['account_id', accountId], ['status', status]]) {
      if (!value) continue;
      params.push(String(value)); clauses.push(`${column}=$${params.length}`);
    }
    params.push(Math.max(1, Math.min(5000, Number(limit || 250))));
    const result = await pool.query(`select * from wisdo_mt4_commands ${clauses.length ? `where ${clauses.join(' and ')}` : ''} order by created_at desc limit $${params.length}`, params);
    return result.rows.map(rowRecord);
  }

  async metrics() {
    await this.initialize();
    const pool = await this.pool();
    const result = await pool.query(`select count(*)::int total, count(*) filter(where status='pending')::int pending, count(*) filter(where status='delivered')::int delivered, count(*) filter(where status='completed')::int completed, count(*) filter(where status='failed')::int failed, count(*) filter(where status='expired')::int expired from wisdo_mt4_commands`);
    const row = result.rows[0] || {};
    return { total: Number(row.total || 0), active: Number(row.pending || 0) + Number(row.delivered || 0), pending: Number(row.pending || 0), delivered: Number(row.delivered || 0), completed: Number(row.completed || 0), failed: Number(row.failed || 0), expired: Number(row.expired || 0) };
  }

  async prune(historyLimit = 250, auditLimit = 250) {
    await this.initialize();
    const pool = await this.pool();
    await pool.query(`delete from wisdo_mt4_commands where status not in ('pending','delivered') and id in (select id from wisdo_mt4_commands where status not in ('pending','delivered') order by coalesce(completed_at,failed_at,expired_at,created_at) desc offset $1)`, [historyLimit]);
    await pool.query(`delete from wisdo_mt4_command_audit where id in (select id from wisdo_mt4_command_audit order by created_at desc offset $1)`, [auditLimit]);
  }
}
