import { getSharedPostgresPool } from './persistenceAdapter.js';

function asBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

export class PostgresTradeSignalStore {
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
      create table if not exists wisdo_trade_signals (
        signal_id text primary key,
        leader_user_id text,
        leader_account_id text,
        source_ticket text,
        symbol text,
        side text,
        status text not null default 'active',
        signal jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        expires_at timestamptz
      );
      create index if not exists wisdo_trade_signals_leader_idx on wisdo_trade_signals(leader_account_id, updated_at desc);
      create index if not exists wisdo_trade_signals_status_idx on wisdo_trade_signals(status, updated_at desc);
      create unique index if not exists wisdo_trade_signals_ticket_idx on wisdo_trade_signals(leader_account_id, source_ticket) where source_ticket is not null and source_ticket <> '';
    `);
    return true;
  }
  async upsertMany(signals = []) {
    if (!signals.length) return [];
    await this.initialize();
    const pool = await this.pool();
    const client = await pool.connect();
    try {
      await client.query('begin');
      for (const signal of signals) {
        await client.query(`
          insert into wisdo_trade_signals(signal_id,leader_user_id,leader_account_id,source_ticket,symbol,side,status,signal,created_at,updated_at,expires_at)
          values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,coalesce($9::timestamptz,now()),coalesce($10::timestamptz,now()),$11::timestamptz)
          on conflict(signal_id) do update set leader_user_id=excluded.leader_user_id,leader_account_id=excluded.leader_account_id,
            source_ticket=excluded.source_ticket,symbol=excluded.symbol,side=excluded.side,status=excluded.status,
            signal=excluded.signal,updated_at=excluded.updated_at,expires_at=excluded.expires_at
        `, [signal.signalId, signal.leaderUserId || null, signal.leaderAccountId || null, signal.sourceTicket ? String(signal.sourceTicket) : null, signal.symbol || null, signal.side || null, signal.status || 'active', JSON.stringify(signal), signal.createdAt || null, signal.updatedAt || signal.createdAt || null, signal.expiresAt || null]);
      }
      await client.query('commit');
      return signals;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }
  async list(limit = 500) {
    await this.initialize();
    const pool = await this.pool();
    const result = await pool.query('select signal from wisdo_trade_signals order by updated_at desc, created_at desc limit $1', [Math.max(1, Math.min(5000, Number(limit || 500)))]);
    return result.rows.map((row) => row.signal);
  }
  async get(signalId) {
    await this.initialize();
    const pool = await this.pool();
    const result = await pool.query('select signal from wisdo_trade_signals where signal_id=$1 limit 1', [String(signalId || '')]);
    return result.rows[0]?.signal || null;
  }
  async prune(limit = 500) {
    await this.initialize();
    const pool = await this.pool();
    await pool.query(`delete from wisdo_trade_signals where signal_id in (select signal_id from wisdo_trade_signals order by updated_at desc,created_at desc offset $1)`, [Math.max(50, Math.min(5000, Number(limit || 500)))]);
  }
}
