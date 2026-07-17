function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function clone(value) { return JSON.parse(JSON.stringify(value ?? {})); }

function stableJson(value) { return JSON.stringify(value ?? null); }
function integerEnv(name, fallback, minimum, maximum) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.trunc(parsed)));
}

// v6.0.7: one process-wide PostgreSQL pool and one cache/write queue per namespace.
// v6.0.6 created a pool for every store and reloaded every namespace on every read,
// which saturated small Render/PostgreSQL plans and caused MT4 WebRequest timeouts.
const sharedPools = new Map();
const sharedNamespaceRuntime = new Map();

function poolKey(databaseUrl, ssl) {
  return `${String(databaseUrl)}::ssl=${ssl ? '1' : '0'}`;
}

function namespaceKey(databaseUrl, ssl, namespace) {
  return `${poolKey(databaseUrl, ssl)}::${String(namespace)}`;
}

function getNamespaceRuntime(databaseUrl, ssl, namespace) {
  const key = namespaceKey(databaseUrl, ssl, namespace);
  if (!sharedNamespaceRuntime.has(key)) {
    sharedNamespaceRuntime.set(key, {
      state: null,
      loadedAt: 0,
      pendingLoad: null,
      writeChain: Promise.resolve(),
      legacyImportPromise: null,
    });
  }
  return sharedNamespaceRuntime.get(key);
}

async function getSharedPool(databaseUrl, ssl) {
  const key = poolKey(databaseUrl, ssl);
  if (!sharedPools.has(key)) {
    const pg = await import('pg').catch(() => null);
    if (!pg) throw new Error('Postgres persistence requires the pg package.');
    const pool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: ssl ? { rejectUnauthorized: false } : false,
      // One shared pool for the whole WISDO process. Keep this conservative for
      // Render starter databases; increasing it does not make serialized state faster.
      max: integerEnv('DB_POOL_MAX', 8, 2, 40),
      min: integerEnv('DB_POOL_MIN', 0, 0, 8),
      idleTimeoutMillis: integerEnv('DB_IDLE_TIMEOUT_MS', 30000, 1000, 300000),
      connectionTimeoutMillis: integerEnv('DB_CONNECT_TIMEOUT_MS', 10000, 1000, 60000),
      allowExitOnIdle: false,
    });
    const ready = (async () => {
      await pool.query(`
        create table if not exists wisdo_state_sections (
          namespace text not null,
          section text not null,
          state jsonb not null default '{}'::jsonb,
          revision bigint not null default 1,
          updated_at timestamptz not null default now(),
          primary key(namespace, section)
        )
      `);
      await pool.query('create index if not exists wisdo_state_sections_updated_idx on wisdo_state_sections(updated_at desc)');
      return pool;
    })();
    sharedPools.set(key, { pool, ready });
  }
  const entry = sharedPools.get(key);
  await entry.ready;
  return entry.pool;
}

export class MemoryPersistenceAdapter {
  constructor(defaultState = () => ({})) {
    this.defaultState = defaultState;
    this.state = defaultState();
    this.writeChain = Promise.resolve();
  }

  async load() { return clone(this.state); }
  async save(data) { this.state = clone(data); return clone(this.state); }

  async atomicUpdate(updater, { normalize = (value) => value } = {}) {
    const operation = this.writeChain.then(async () => {
      const current = normalize(clone(this.state));
      const next = normalize((await updater(current)) || current);
      this.state = clone(next);
      return clone(next);
    });
    this.writeChain = operation.catch(() => undefined);
    return operation;
  }
}

export class DatabasePersistenceAdapterPlaceholder {
  async load() { throw new Error('Database persistence adapter is not configured yet.'); }
  async save() { throw new Error('Database persistence adapter is not configured yet.'); }
}

export class PostgresKeyValuePersistenceAdapter {
  constructor({ databaseUrl, namespace, ssl = false }) {
    if (!databaseUrl) throw new Error('WISDO_PERSISTENCE_MODE=postgres requires DATABASE_URL.');
    this.databaseUrl = databaseUrl;
    this.namespace = String(namespace || 'wisdo');
    this.ssl = parseBoolean(ssl, false);
    this.runtime = getNamespaceRuntime(this.databaseUrl, this.ssl, this.namespace);
    this.cacheTtlMs = integerEnv('WISDO_DB_CACHE_TTL_MS', 2000, 0, 60000);
    this.maxStaleMs = integerEnv('WISDO_DB_CACHE_MAX_STALE_MS', 30000, 1000, 300000);
  }

  async getPool() {
    return getSharedPool(this.databaseUrl, this.ssl);
  }

  async importLegacyIfNeeded(pool) {
    if (!this.runtime.legacyImportPromise) {
      this.runtime.legacyImportPromise = (async () => {
        const existing = await pool.query('select 1 from wisdo_state_sections where namespace = $1 limit 1', [this.namespace]);
        if (existing.rowCount) return;
        const legacyTable = await pool.query(`select to_regclass('public.wisdo_kv_store') as table_name`);
        if (!legacyTable.rows[0]?.table_name) return;
        const legacy = await pool.query('select state from wisdo_kv_store where namespace = $1', [this.namespace]);
        const state = legacy.rows[0]?.state;
        if (!state || typeof state !== 'object' || Array.isArray(state)) return;
        const client = await pool.connect();
        try {
          await client.query('begin');
          await client.query('select pg_advisory_xact_lock(hashtext($1))', [this.namespace]);
          for (const [section, value] of Object.entries(state)) {
            await client.query(
              `insert into wisdo_state_sections(namespace, section, state, revision, updated_at)
               values($1,$2,$3::jsonb,1,now()) on conflict(namespace,section) do nothing`,
              [this.namespace, section, JSON.stringify(value)],
            );
          }
          await client.query('commit');
        } catch (error) {
          await client.query('rollback');
          throw error;
        } finally { client.release(); }
      })().catch((error) => {
        this.runtime.legacyImportPromise = null;
        throw error;
      });
    }
    return this.runtime.legacyImportPromise;
  }

  async loadRows(executor) {
    const result = await executor.query(
      'select section, state, revision from wisdo_state_sections where namespace = $1 order by section',
      [this.namespace],
    );
    return result.rows;
  }

  rowsToState(rows = []) {
    return Object.fromEntries(rows.map((row) => [row.section, row.state]));
  }

  setCache(state) {
    this.runtime.state = clone(state);
    this.runtime.loadedAt = Date.now();
    return clone(this.runtime.state);
  }

  async refreshFromDatabase() {
    if (this.runtime.pendingLoad) return this.runtime.pendingLoad;
    this.runtime.pendingLoad = (async () => {
      const pool = await this.getPool();
      await this.importLegacyIfNeeded(pool);
      const state = this.rowsToState(await this.loadRows(pool));
      return this.setCache(state);
    })().finally(() => { this.runtime.pendingLoad = null; });
    return this.runtime.pendingLoad;
  }

  async load(options = {}) {
    const force = Boolean(options?.force);
    const age = this.runtime.loadedAt ? Date.now() - this.runtime.loadedAt : Number.POSITIVE_INFINITY;
    if (!force && this.runtime.state && age <= this.cacheTtlMs) return clone(this.runtime.state);

    // Stale-while-revalidate keeps dashboard tabs and Reporter pairing reads responsive.
    // All writes in this process update this same shared cache, so normal WISDO changes
    // remain immediately visible while a background refresh checks PostgreSQL.
    if (!force && this.runtime.state && age <= this.maxStaleMs) {
      this.refreshFromDatabase().catch(() => undefined);
      return clone(this.runtime.state);
    }

    try {
      return await this.refreshFromDatabase();
    } catch (error) {
      if (this.runtime.state) return clone(this.runtime.state);
      throw error;
    }
  }

  async persistChangedSections(client, currentState, nextState) {
    const changed = [];
    for (const [section, value] of Object.entries(nextState || {})) {
      if (stableJson(currentState?.[section]) === stableJson(value)) continue;
      await client.query(
        `insert into wisdo_state_sections(namespace, section, state, revision, updated_at)
         values($1,$2,$3::jsonb,1,now())
         on conflict(namespace,section) do update
         set state=excluded.state, revision=wisdo_state_sections.revision+1, updated_at=now()`,
        [this.namespace, section, JSON.stringify(value)],
      );
      changed.push(section);
    }
    return changed;
  }

  async runLockedMutation(mutator) {
    const pool = await this.getPool();
    await this.importLegacyIfNeeded(pool);
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock(hashtext($1))', [this.namespace]);
      // Always read inside the lock for zero-downtime deploy overlap safety. Reads are
      // cached; writes remain authoritative and cannot overwrite another instance.
      const current = this.rowsToState(await this.loadRows(client));
      const next = await mutator(clone(current));
      const finalState = next || current;
      const changedSections = await this.persistChangedSections(client, current, finalState);
      await client.query('commit');
      this.setCache(finalState);
      return { state: clone(finalState), changedSections };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally { client.release(); }
  }

  async save(data) {
    const snapshot = clone(data);
    const operation = this.runtime.writeChain.then(async () => {
      const result = await this.runLockedMutation(() => snapshot);
      return result.state;
    });
    this.runtime.writeChain = operation.catch(() => undefined);
    return operation;
  }

  async saveSection(section, value) {
    const name = String(section || '').trim();
    if (!name) throw new Error('section is required');
    const operation = this.runtime.writeChain.then(async () => {
      const result = await this.runLockedMutation((current) => ({ ...current, [name]: clone(value) }));
      return result.state[name];
    });
    this.runtime.writeChain = operation.catch(() => undefined);
    return operation;
  }

  async atomicUpdate(updater, { normalize = (value) => value } = {}) {
    const operation = this.runtime.writeChain.then(async () => {
      const result = await this.runLockedMutation(async (current) => {
        const normalized = normalize(current);
        return normalize((await updater(normalized)) || normalized);
      });
      return result.state;
    });
    this.runtime.writeChain = operation.catch(() => undefined);
    return operation;
  }

  async close() {
    // Pools are shared process-wide and are intentionally kept open until process exit.
    // Closing one service store must not terminate every other namespace's connections.
  }
}

export function createPersistenceAdapter(config = {}, options = {}) {
  if (config.persistenceAdapter) return config.persistenceAdapter;
  const persistence = config.persistence || {};
  const databaseUrl = persistence.databaseUrl || config.databaseUrl || process.env.DATABASE_URL;
  const requestedMode = String(config.persistenceMode || persistence.mode || (databaseUrl ? 'postgres' : 'memory')).toLowerCase();
  const production = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

  // Development and tests use volatile memory only; production never writes JSON files.
  if (!databaseUrl && !production) return new MemoryPersistenceAdapter(options.defaultState);
  if (!databaseUrl) {
    throw new Error('WISDO database-only persistence requires DATABASE_URL. JSON file persistence is disabled.');
  }
  if (!['postgres', 'database', 'json', 'file'].includes(requestedMode)) {
    throw new Error(`Unsupported WISDO persistence mode: ${requestedMode}. Use postgres.`);
  }
  return new PostgresKeyValuePersistenceAdapter({
    databaseUrl,
    namespace: options.namespace || options.fileName || 'wisdo',
    ssl: parseBoolean(persistence.dbSsl ?? config.dbSsl ?? process.env.WISDO_DB_SSL, false),
  });
}
