function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function clone(value) {
  const source = value ?? {};
  return typeof globalThis.structuredClone === 'function' ? globalThis.structuredClone(source) : JSON.parse(JSON.stringify(source));
}
function stableJson(value) { return JSON.stringify(value ?? null); }
function integerEnv(name, fallback, minimum, maximum) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.trunc(parsed)));
}
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function timeoutError(label, ms) {
  const error = new Error(`${label} timed out after ${ms}ms`);
  error.code = 'WISDO_DB_TIMEOUT';
  return error;
}
async function withTimeout(promise, ms, label = 'PostgreSQL operation') {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(timeoutError(label, ms)), ms); timer.unref?.(); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}
function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function deepMerge(base, overlay) {
  if (!isPlainObject(base) || !isPlainObject(overlay)) return clone(overlay);
  const merged = clone(base);
  for (const [key, value] of Object.entries(overlay)) {
    merged[key] = isPlainObject(value) && isPlainObject(merged[key])
      ? deepMerge(merged[key], value)
      : clone(value);
  }
  return merged;
}

// v6.0.8 cloud recovery architecture:
// - one process-wide PostgreSQL pool
// - hot in-process mirrors for website reads and Reporter heartbeats
// - bounded query/lock timeouts and a circuit breaker
// - buffered live-relay writes that retry to PostgreSQL without using JSON files
// PostgreSQL remains durable truth; process memory is only a disposable acceleration layer.
const sharedPools = new Map();
const sharedNamespaceRuntime = new Map();

function poolKey(databaseUrl, ssl) { return `${String(databaseUrl)}::ssl=${ssl ? '1' : '0'}`; }
function namespaceKey(databaseUrl, ssl, namespace) { return `${poolKey(databaseUrl, ssl)}::${String(namespace)}`; }

function getNamespaceRuntime(databaseUrl, ssl, namespace) {
  const key = namespaceKey(databaseUrl, ssl, namespace);
  if (!sharedNamespaceRuntime.has(key)) {
    sharedNamespaceRuntime.set(key, {
      state: null,
      loadedAt: 0,
      source: 'cold',
      pendingLoad: null,
      revision: 0,
      legacyImportPromise: null,
      dirtySnapshot: null,
      flushTimer: null,
      flushPromise: null,
      lastPersistedAt: null,
      lastErrorAt: null,
      lastError: '',
    });
  }
  return sharedNamespaceRuntime.get(key);
}

function getPoolEntry(databaseUrl, ssl) {
  const key = poolKey(databaseUrl, ssl);
  if (!sharedPools.has(key)) {
    sharedPools.set(key, {
      pool: null,
      ready: null,
      databaseUrl,
      ssl,
      failures: 0,
      circuitOpenUntil: 0,
      lastOkAt: null,
      lastErrorAt: null,
      lastError: '',
    });
  }
  return sharedPools.get(key);
}

function markPoolOk(entry) {
  entry.failures = 0;
  entry.circuitOpenUntil = 0;
  entry.lastOkAt = new Date().toISOString();
  entry.lastError = '';
}
function markPoolError(entry, error) {
  entry.failures += 1;
  entry.lastErrorAt = new Date().toISOString();
  entry.lastError = String(error?.message || error || 'PostgreSQL error').slice(0, 500);
  const base = integerEnv('WISDO_DB_CIRCUIT_BREAKER_MS', 5000, 500, 60000);
  entry.circuitOpenUntil = Date.now() + Math.min(60000, base * Math.max(1, Math.min(entry.failures, 6)));
}

async function createPool(entry) {
  const pg = await import('pg').catch(() => null);
  if (!pg) throw new Error('Postgres persistence requires the pg package.');
  const statementTimeout = integerEnv('WISDO_DB_STATEMENT_TIMEOUT_MS', 4000, 500, 60000);
  const queryTimeout = integerEnv('WISDO_DB_QUERY_TIMEOUT_MS', 5000, 500, 60000);
  const pool = new pg.Pool({
    connectionString: entry.databaseUrl,
    ssl: entry.ssl ? { rejectUnauthorized: false } : false,
    max: integerEnv('DB_POOL_MAX', 4, 1, 20),
    min: integerEnv('DB_POOL_MIN', 0, 0, 4),
    idleTimeoutMillis: integerEnv('DB_IDLE_TIMEOUT_MS', 30000, 1000, 300000),
    connectionTimeoutMillis: integerEnv('DB_CONNECT_TIMEOUT_MS', 5000, 500, 30000),
    statement_timeout: statementTimeout,
    query_timeout: queryTimeout,
    keepAlive: true,
    allowExitOnIdle: false,
  });
  pool.on('error', (error) => markPoolError(entry, error));
  await withTimeout(pool.query(`
    create table if not exists wisdo_state_sections (
      namespace text not null,
      section text not null,
      state jsonb not null default '{}'::jsonb,
      revision bigint not null default 1,
      updated_at timestamptz not null default now(),
      primary key(namespace, section)
    )
  `), queryTimeout, 'WISDO state schema check');
  await withTimeout(
    pool.query('create index if not exists wisdo_state_sections_updated_idx on wisdo_state_sections(updated_at desc)'),
    queryTimeout,
    'WISDO state index check',
  );
  return pool;
}

async function getSharedPool(databaseUrl, ssl) {
  const entry = getPoolEntry(databaseUrl, ssl);
  if (entry.circuitOpenUntil > Date.now()) {
    const error = new Error(`PostgreSQL circuit is cooling down: ${entry.lastError || 'recent database failure'}`);
    error.code = 'WISDO_DB_CIRCUIT_OPEN';
    throw error;
  }
  if (!entry.pool && !entry.ready) {
    entry.ready = createPool(entry)
      .then((pool) => { entry.pool = pool; markPoolOk(entry); return pool; })
      .catch(async (error) => {
        markPoolError(entry, error);
        try { await entry.pool?.end?.(); } catch {}
        entry.pool = null;
        throw error;
      })
      .finally(() => { entry.ready = null; });
  }
  try {
    const pool = entry.pool || await entry.ready;
    markPoolOk(entry);
    return pool;
  } catch (error) {
    markPoolError(entry, error);
    throw error;
  }
}

export async function getSharedPostgresPool({ databaseUrl = process.env.DATABASE_URL || '', ssl = false } = {}) {
  if (!databaseUrl) return null;
  return getSharedPool(databaseUrl, parseBoolean(ssl, false));
}

export function getDatabaseRuntimeHealth() {
  const pools = [...sharedPools.values()];
  const namespaces = [...sharedNamespaceRuntime.entries()].map(([key, runtime]) => ({
    namespace: key.split('::').at(-1),
    cached: Boolean(runtime.state),
    source: runtime.source,
    loadedAt: runtime.loadedAt ? new Date(runtime.loadedAt).toISOString() : null,
    dirty: Boolean(runtime.dirtySnapshot),
    lastPersistedAt: runtime.lastPersistedAt,
    lastErrorAt: runtime.lastErrorAt,
    lastError: runtime.lastError || null,
  }));
  const configured = Boolean(process.env.DATABASE_URL);
  const circuitOpen = pools.some((entry) => entry.circuitOpenUntil > Date.now());
  const lastError = pools.map((entry) => entry.lastError).find(Boolean) || null;
  return {
    configured,
    mode: configured ? 'postgres-with-hot-cache' : 'memory-development',
    status: !configured ? 'development' : circuitOpen ? 'degraded' : lastError ? 'recovering' : 'healthy',
    poolCount: pools.filter((entry) => entry.pool).length,
    namespaceCount: namespaces.length,
    cachedNamespaces: namespaces.filter((row) => row.cached).length,
    dirtyNamespaces: namespaces.filter((row) => row.dirty).length,
    lastError,
    namespaces,
  };
}

export class MemoryPersistenceAdapter {
  constructor(defaultState = () => ({})) {
    this.defaultState = typeof defaultState === 'function' ? defaultState : () => clone(defaultState || {});
    this.state = this.defaultState();
    this.revision = 0;
  }
  peek() { return this.state; }
  async load() { return clone(this.state); }
  async save(data) { this.state = clone(data); this.revision += 1; return clone(this.state); }
  async atomicUpdate(updater, { normalize = (value) => value } = {}) {
    for (let attempt = 0; attempt < 256; attempt += 1) {
      const revision = this.revision;
      const current = normalize(clone(this.state));
      const candidate = updater(current);
      const resolved = candidate && typeof candidate.then === 'function' ? await candidate : candidate;
      const next = normalize(resolved || current);
      if (revision !== this.revision) continue;
      this.state = clone(next);
      this.revision += 1;
      return clone(this.state);
    }
    throw new Error('Memory state changed too frequently to complete the update.');
  }
}

export class DatabasePersistenceAdapterPlaceholder {
  async load() { throw new Error('Database persistence adapter is not configured yet.'); }
  async save() { throw new Error('Database persistence adapter is not configured yet.'); }
}

export class PostgresKeyValuePersistenceAdapter {
  constructor({ databaseUrl, namespace, ssl = false, defaultState = () => ({}), bufferWrites = false }) {
    if (!databaseUrl) throw new Error('WISDO_PERSISTENCE_MODE=postgres requires DATABASE_URL.');
    this.databaseUrl = databaseUrl;
    this.namespace = String(namespace || 'wisdo');
    this.ssl = parseBoolean(ssl, false);
    this.defaultState = typeof defaultState === 'function' ? defaultState : () => clone(defaultState || {});
    this.bufferWrites = parseBoolean(bufferWrites, false);
    this.allowDegradedReads = parseBoolean(process.env.WISDO_DB_FAIL_OPEN_READS, true);
    this.runtime = getNamespaceRuntime(this.databaseUrl, this.ssl, this.namespace);
    this.cacheTtlMs = integerEnv('WISDO_DB_CACHE_TTL_MS', 10000, 0, 300000);
    this.maxStaleMs = integerEnv('WISDO_DB_CACHE_MAX_STALE_MS', 300000, 1000, 3600000);
    this.writeDebounceMs = integerEnv('WISDO_DB_WRITE_DEBOUNCE_MS', 100, 10, 5000);
    this.retryMs = integerEnv('WISDO_DB_RETRY_MS', 1500, 250, 60000);
  }

  async getPool() { return getSharedPool(this.databaseUrl, this.ssl); }

  async importLegacyIfNeeded(pool) {
    if (!this.runtime.legacyImportPromise) {
      this.runtime.legacyImportPromise = (async () => {
        const existing = await pool.query('select 1 from wisdo_state_sections where namespace = $1 limit 1', [this.namespace]);
        if (existing.rowCount) return;
        const legacyTable = await pool.query(`select to_regclass('public.wisdo_kv_store') as table_name`);
        if (!legacyTable.rows[0]?.table_name) return;
        const legacy = await pool.query('select state from wisdo_kv_store where namespace = $1', [this.namespace]);
        const state = legacy.rows[0]?.state;
        if (!isPlainObject(state)) return;
        const client = await pool.connect();
        try {
          await client.query('begin');
          const lock = await client.query('select pg_try_advisory_xact_lock(hashtext($1)) as acquired', [this.namespace]);
          if (!lock.rows[0]?.acquired) throw Object.assign(new Error(`Database namespace busy: ${this.namespace}`), { code: 'WISDO_DB_BUSY' });
          for (const [section, value] of Object.entries(state)) {
            await client.query(
              `insert into wisdo_state_sections(namespace, section, state, revision, updated_at)
               values($1,$2,$3::jsonb,1,now()) on conflict(namespace,section) do nothing`,
              [this.namespace, section, JSON.stringify(value)],
            );
          }
          await client.query('commit');
        } catch (error) {
          await client.query('rollback').catch(() => undefined);
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
  rowsToState(rows = []) { return Object.fromEntries(rows.map((row) => [row.section, row.state])); }
  setCache(state, source = 'postgres', { cloneState = true } = {}) {
    this.runtime.state = cloneState ? clone(state) : state;
    this.runtime.loadedAt = Date.now();
    this.runtime.source = source;
    this.runtime.revision = Number(this.runtime.revision || 0) + 1;
    return this.runtime.state;
  }
  peek() { return this.runtime.state; }
  recordRuntimeError(error) {
    this.runtime.lastErrorAt = new Date().toISOString();
    this.runtime.lastError = String(error?.message || error || 'PostgreSQL error').slice(0, 500);
  }

  async refreshFromDatabase() {
    if (this.runtime.pendingLoad) return this.runtime.pendingLoad;
    this.runtime.pendingLoad = (async () => {
      const pool = await this.getPool();
      await this.importLegacyIfNeeded(pool);
      const state = this.rowsToState(await this.loadRows(pool));
      // Never replace newer hot state with an older database snapshot while a flush is pending.
      if (this.runtime.dirtySnapshot) return clone(this.runtime.state || state);
      return this.setCache(state, 'postgres');
    })().catch((error) => { this.recordRuntimeError(error); throw error; })
      .finally(() => { this.runtime.pendingLoad = null; });
    return this.runtime.pendingLoad;
  }

  async load(options = {}) {
    const force = Boolean(options?.force);
    const age = this.runtime.loadedAt ? Date.now() - this.runtime.loadedAt : Number.POSITIVE_INFINITY;
    if (!force && this.runtime.state && age <= this.cacheTtlMs) return clone(this.runtime.state);
    // Stale-while-revalidate keeps tabs responsive while PostgreSQL refreshes.
    if (!force && this.runtime.state && age <= this.maxStaleMs) {
      this.refreshFromDatabase().catch(() => undefined);
      return clone(this.runtime.state);
    }
    try {
      return await this.refreshFromDatabase();
    } catch (error) {
      if (this.runtime.state) return clone(this.runtime.state);
      if (!this.allowDegradedReads) throw error;
      // No files are used. This disposable in-process fallback keeps HTML/API routes alive
      // while PostgreSQL recovers; a background refresh will hydrate durable records.
      const fallback = clone(this.defaultState());
      this.setCache(fallback, 'degraded-memory');
      setTimeout(() => this.refreshFromDatabase().catch(() => undefined), this.retryMs).unref?.();
      return clone(fallback);
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
      const lock = await client.query('select pg_try_advisory_xact_lock(hashtext($1)) as acquired', [this.namespace]);
      if (!lock.rows[0]?.acquired) {
        const error = new Error(`Database namespace busy: ${this.namespace}`);
        error.code = 'WISDO_DB_BUSY';
        throw error;
      }
      const current = this.rowsToState(await this.loadRows(client));
      const next = await mutator(clone(current));
      const finalState = next || current;
      const changedSections = await this.persistChangedSections(client, current, finalState);
      await client.query('commit');
      this.runtime.lastPersistedAt = new Date().toISOString();
      this.runtime.lastError = '';
      this.setCache(finalState, 'postgres');
      return { state: clone(finalState), changedSections };
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      this.recordRuntimeError(error);
      throw error;
    } finally { client.release(); }
  }

  scheduleFlush(delay = this.writeDebounceMs) {
    if (this.runtime.flushTimer || this.runtime.flushPromise || !this.runtime.dirtySnapshot) return;
    this.runtime.flushTimer = setTimeout(() => {
      this.runtime.flushTimer = null;
      this.flushBufferedWrites().catch(() => undefined);
    }, delay);
    this.runtime.flushTimer.unref?.();
  }

  async flushBufferedWrites() {
    if (this.runtime.flushPromise) return this.runtime.flushPromise;
    const pending = this.runtime.dirtySnapshot;
    if (!pending) return null;
    this.runtime.dirtySnapshot = null;
    this.runtime.flushPromise = (async () => {
      try {
        // A buffered snapshot is authoritative, including deletions. Do not deep-merge it
        // into an older database image or removed accounts/routes can reappear.
        const result = await this.runLockedMutation(() => pending);
        return result.state;
      } catch (error) {
        // Keep the newest complete snapshot. A later mutation may already contain more
        // recent state than the failed pending snapshot.
        this.runtime.dirtySnapshot = clone(this.runtime.state || this.runtime.dirtySnapshot || pending);
        this.scheduleFlush(this.retryMs);
        return clone(this.runtime.state || pending);
      }
    })().finally(() => {
      this.runtime.flushPromise = null;
      if (this.runtime.dirtySnapshot) this.scheduleFlush();
    });
    return this.runtime.flushPromise;
  }

  async bufferedUpdate(updater, { normalize = (value) => value } = {}) {
    for (let attempt = 0; attempt < 256; attempt += 1) {
      const loaded = this.runtime.state || await this.load();
      const revision = Number(this.runtime.revision || 0);
      // One working copy is enough. The previous implementation cloned the same
      // namespace four to six times per heartbeat, creating large transient heaps.
      const working = normalize(clone(loaded));
      const candidate = updater(working);
      const resolved = candidate && typeof candidate.then === 'function' ? await candidate : candidate;
      const next = normalize(resolved || working);
      if (revision !== Number(this.runtime.revision || 0)) continue;
      this.setCache(next, this.runtime.source === 'postgres' ? 'hot-cache' : this.runtime.source, { cloneState: false });
      // Dirty snapshot intentionally shares the immutable next-state reference.
      // Future updates clone before mutation, so the flush cannot be changed in place.
      this.runtime.dirtySnapshot = next;
      this.scheduleFlush();
      return clone(next);
    }
    const error = new Error(`Hot state changed too frequently: ${this.namespace}`);
    error.code = 'WISDO_HOT_STATE_CONTENTION';
    throw error;
  }

  async save(data) {
    const snapshot = clone(data);
    if (this.bufferWrites) return this.bufferedUpdate(() => snapshot);
    return (await this.runLockedMutation(() => snapshot)).state;
  }
  async saveSection(section, value) {
    const name = String(section || '').trim();
    if (!name) throw new Error('section is required');
    if (this.bufferWrites) {
      const state = await this.bufferedUpdate((current) => ({ ...current, [name]: clone(value) }));
      return state[name];
    }
    const result = await this.runLockedMutation((current) => ({ ...current, [name]: clone(value) }));
    return result.state[name];
  }
  async atomicUpdate(updater, { normalize = (value) => value } = {}) {
    if (this.bufferWrites) return this.bufferedUpdate(updater, { normalize });
    const result = await this.runLockedMutation(async (current) => {
      const normalized = normalize(current);
      return normalize((await updater(normalized)) || normalized);
    });
    return result.state;
  }
  async close() {}
}

export function createPersistenceAdapter(config = {}, options = {}) {
  if (config.persistenceAdapter) return config.persistenceAdapter;
  const persistence = config.persistence || {};
  const databaseUrl = persistence.databaseUrl || config.databaseUrl || process.env.DATABASE_URL;
  const requestedMode = String(config.persistenceMode || persistence.mode || (databaseUrl ? 'postgres' : 'memory')).toLowerCase();
  const production = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (!databaseUrl && !production) return new MemoryPersistenceAdapter(options.defaultState);
  if (!databaseUrl) throw new Error('WISDO database-only persistence requires DATABASE_URL. JSON file persistence is disabled.');
  if (!['postgres', 'database', 'json', 'file'].includes(requestedMode)) {
    throw new Error(`Unsupported WISDO persistence mode: ${requestedMode}. Use postgres.`);
  }
  return new PostgresKeyValuePersistenceAdapter({
    databaseUrl,
    namespace: options.namespace || options.fileName || 'wisdo',
    ssl: parseBoolean(persistence.dbSsl ?? config.dbSsl ?? process.env.WISDO_DB_SSL, false),
    defaultState: options.defaultState,
    // Production requests update a disposable hot mirror immediately and flush the
    // complete authoritative snapshot to PostgreSQL in the background. No files are used.
    bufferWrites: parseBoolean(options.bufferWrites ?? persistence.bufferWrites ?? process.env.WISDO_DB_BUFFER_LIVE_WRITES, production),
  });
}
