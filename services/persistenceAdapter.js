function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function clone(value) {
  // Production state is JSON-shaped. Avoid structuredClone: Node routes it through
  // V8's message serializer/deserializer, which was the exact native OOM stack seen
  // on Render when large WISDO namespaces were copied during Reporter bursts.
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer?.(value)) return Buffer.from(value);

  const root = Array.isArray(value) ? [] : {};
  const seen = new WeakMap([[value, root]]);
  const stack = [[value, root]];
  while (stack.length) {
    const [source, target] = stack.pop();
    const entries = Array.isArray(source) ? source.entries() : Object.entries(source);
    for (const [key, item] of entries) {
      if (item === null || item === undefined || typeof item !== 'object') {
        target[key] = item;
        continue;
      }
      if (item instanceof Date) {
        target[key] = new Date(item.getTime());
        continue;
      }
      if (typeof Buffer !== 'undefined' && Buffer.isBuffer?.(item)) {
        target[key] = Buffer.from(item);
        continue;
      }
      if (seen.has(item)) {
        target[key] = seen.get(item);
        continue;
      }
      const child = Array.isArray(item) ? [] : {};
      seen.set(item, child);
      target[key] = child;
      stack.push([item, child]);
    }
  }
  return root;
}

function createTopLevelDraft(base = {}) {
  const source = isPlainObject(base) ? base : {};
  const target = { ...source };
  const owned = new Set();
  const touched = new Set();
  const ownSection = (key) => {
    if (!owned.has(key)) {
      const value = target[key];
      if (value && typeof value === 'object') target[key] = clone(value);
      owned.add(key);
    }
    touched.add(key);
    return target[key];
  };
  const proxy = new Proxy(target, {
    get(object, property, receiver) {
      if (typeof property === 'string' && Object.prototype.hasOwnProperty.call(object, property)) {
        const value = object[property];
        if (value && typeof value === 'object') return ownSection(property);
      }
      return Reflect.get(object, property, receiver);
    },
    set(object, property, value) {
      const key = String(property);
      touched.add(key);
      owned.add(key);
      object[property] = value;
      return true;
    },
    deleteProperty(object, property) {
      const key = String(property);
      touched.add(key);
      owned.add(key);
      return Reflect.deleteProperty(object, property);
    },
  });
  return { proxy, target, touched };
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
      dirtySections: new Map(),
      deletedSections: new Set(),
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
    dirty: Boolean(runtime.dirtySnapshot || runtime.dirtySections?.size || runtime.deletedSections?.size),
    dirtySectionCount: Number(runtime.dirtySections?.size || 0),
    deletedSectionCount: Number(runtime.deletedSections?.size || 0),
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
  async load({ cloneResult = true } = {}) { return cloneResult ? clone(this.state) : this.state; }
  async save(data, { cloneInput = true, cloneResult = true } = {}) {
    this.state = cloneInput ? clone(data) : data;
    this.revision += 1;
    return cloneResult ? clone(this.state) : this.state;
  }
  async flushNow({ cloneResult = true } = {}) { return cloneResult ? clone(this.state) : this.state; }
  async atomicUpdate(updater, { normalize = (value) => value, cloneResult = true } = {}) {
    for (let attempt = 0; attempt < 256; attempt += 1) {
      const revision = this.revision;
      const current = normalize(clone(this.state));
      const candidate = updater(current);
      const resolved = candidate && typeof candidate.then === 'function' ? await candidate : candidate;
      const next = normalize(resolved || current);
      if (revision !== this.revision) continue;
      this.state = clone(next);
      this.revision += 1;
      return cloneResult ? clone(this.state) : this.state;
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
      if (this.runtime.dirtySnapshot || this.runtime.dirtySections?.size || this.runtime.deletedSections?.size) {
        return this.runtime.state || state;
      }
      return this.setCache(state, 'postgres', { cloneState: false });
    })().catch((error) => { this.recordRuntimeError(error); throw error; })
      .finally(() => { this.runtime.pendingLoad = null; });
    return this.runtime.pendingLoad;
  }

  async load(options = {}) {
    const force = Boolean(options?.force);
    const cloneResult = options?.cloneResult !== false;
    const age = this.runtime.loadedAt ? Date.now() - this.runtime.loadedAt : Number.POSITIVE_INFINITY;
    if (!force && this.runtime.state && age <= this.cacheTtlMs) return cloneResult ? clone(this.runtime.state) : this.runtime.state;
    // Stale-while-revalidate keeps tabs responsive while PostgreSQL refreshes.
    if (!force && this.runtime.state && age <= this.maxStaleMs) {
      this.refreshFromDatabase().catch(() => undefined);
      return cloneResult ? clone(this.runtime.state) : this.runtime.state;
    }
    try {
      const refreshed = await this.refreshFromDatabase();
      return cloneResult ? clone(refreshed) : refreshed;
    } catch (error) {
      if (this.runtime.state) return cloneResult ? clone(this.runtime.state) : this.runtime.state;
      if (!this.allowDegradedReads) throw error;
      // No files are used. This disposable in-process fallback keeps HTML/API routes alive
      // while PostgreSQL recovers; a background refresh will hydrate durable records.
      const fallback = clone(this.defaultState());
      this.setCache(fallback, 'degraded-memory');
      setTimeout(() => this.refreshFromDatabase().catch(() => undefined), this.retryMs).unref?.();
      return cloneResult ? clone(fallback) : fallback;
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

  markDirtySections(previousState = {}, nextState = {}, touchedSections = null) {
    const runtime = this.runtime;
    runtime.dirtySections ||= new Map();
    runtime.deletedSections ||= new Set();
    const keys = touchedSections && touchedSections.size
      ? new Set(touchedSections)
      : new Set([...Object.keys(previousState || {}), ...Object.keys(nextState || {})]);
    for (const section of keys) {
      if (!Object.prototype.hasOwnProperty.call(nextState || {}, section)) {
        runtime.dirtySections.delete(section);
        runtime.deletedSections.add(section);
        continue;
      }
      runtime.deletedSections.delete(section);
      runtime.dirtySections.set(section, nextState[section]);
    }
  }

  async persistDirtySections(entries = [], deleted = []) {
    if (!entries.length && !deleted.length) return [];
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
      const changed = [];
      for (const [section, value] of entries) {
        // Serialize one section at a time. Never construct or deserialize the complete
        // ecosystem object during an MT4 heartbeat.
        const json = JSON.stringify(value ?? null);
        await client.query(
          `insert into wisdo_state_sections(namespace, section, state, revision, updated_at)
           values($1,$2,$3::jsonb,1,now())
           on conflict(namespace,section) do update
           set state=excluded.state, revision=wisdo_state_sections.revision+1, updated_at=now()`,
          [this.namespace, section, json],
        );
        changed.push(section);
      }
      if (deleted.length) {
        await client.query('delete from wisdo_state_sections where namespace = $1 and section = any($2::text[])', [this.namespace, deleted]);
        changed.push(...deleted);
      }
      await client.query('commit');
      this.runtime.lastPersistedAt = new Date().toISOString();
      this.runtime.lastError = '';
      return changed;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      this.recordRuntimeError(error);
      throw error;
    } finally { client.release(); }
  }

  async runLockedMutation(mutator, { cloneResult = true } = {}) {
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
      const next = await mutator(current);
      const finalState = next || current;
      const changedSections = await this.persistChangedSections(client, current, finalState);
      await client.query('commit');
      this.runtime.lastPersistedAt = new Date().toISOString();
      this.runtime.lastError = '';
      this.setCache(finalState, 'postgres', { cloneState: false });
      return { state: cloneResult ? clone(finalState) : finalState, changedSections };
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      this.recordRuntimeError(error);
      throw error;
    } finally { client.release(); }
  }

  scheduleFlush(delay = this.writeDebounceMs) {
    const hasDirty = Boolean(this.runtime.dirtySnapshot || this.runtime.dirtySections?.size || this.runtime.deletedSections?.size);
    if (this.runtime.flushTimer || this.runtime.flushPromise || !hasDirty) return;
    this.runtime.flushTimer = setTimeout(() => {
      this.runtime.flushTimer = null;
      this.flushBufferedWrites().catch(() => undefined);
    }, delay);
    this.runtime.flushTimer.unref?.();
  }

  async flushBufferedWrites({ strict = false, cloneResult = false } = {}) {
    if (this.runtime.flushPromise) {
      const result = await this.runtime.flushPromise;
      if (strict && (this.runtime.dirtySections?.size || this.runtime.deletedSections?.size) && this.runtime.lastError) {
        const error = new Error(this.runtime.lastError);
        error.code = 'WISDO_DURABLE_FLUSH_PENDING';
        throw error;
      }
      return cloneResult ? clone(result) : result;
    }

    // Migrate a legacy complete dirty snapshot into section references without cloning it.
    if (this.runtime.dirtySnapshot) {
      const snapshot = this.runtime.dirtySnapshot;
      this.runtime.dirtySnapshot = null;
      this.markDirtySections({}, snapshot);
    }
    this.runtime.dirtySections ||= new Map();
    this.runtime.deletedSections ||= new Set();
    if (!this.runtime.dirtySections.size && !this.runtime.deletedSections.size) {
      const current = this.runtime.state || this.defaultState();
      return cloneResult ? clone(current) : current;
    }

    const pendingEntries = [...this.runtime.dirtySections.entries()];
    const pendingDeletes = [...this.runtime.deletedSections.values()];
    for (const [section, value] of pendingEntries) {
      if (this.runtime.dirtySections.get(section) === value) this.runtime.dirtySections.delete(section);
    }
    for (const section of pendingDeletes) this.runtime.deletedSections.delete(section);

    this.runtime.flushPromise = (async () => {
      try {
        await this.persistDirtySections(pendingEntries, pendingDeletes);
        return this.runtime.state || Object.fromEntries(pendingEntries);
      } catch (error) {
        // Preserve newer section values. Restore only sections that were not replaced
        // while this PostgreSQL transaction was in flight.
        for (const [section, value] of pendingEntries) {
          if (!this.runtime.dirtySections.has(section) && !this.runtime.deletedSections.has(section)) {
            this.runtime.dirtySections.set(section, value);
          }
        }
        for (const section of pendingDeletes) {
          if (!this.runtime.dirtySections.has(section)) this.runtime.deletedSections.add(section);
        }
        this.scheduleFlush(this.retryMs);
        if (strict) throw error;
        return this.runtime.state || Object.fromEntries(pendingEntries);
      }
    })().finally(() => {
      this.runtime.flushPromise = null;
      if (this.runtime.dirtySections?.size || this.runtime.deletedSections?.size || this.runtime.dirtySnapshot) this.scheduleFlush();
    });
    const result = await this.runtime.flushPromise;
    return cloneResult ? clone(result) : result;
  }

  async flushNow({ cloneResult = false } = {}) {
    if (!this.bufferWrites) {
      const current = this.runtime.state || this.defaultState();
      return cloneResult ? clone(current) : current;
    }
    if (this.runtime.flushPromise) await this.runtime.flushPromise;
    let attempts = 0;
    while ((this.runtime.dirtySnapshot || this.runtime.dirtySections?.size || this.runtime.deletedSections?.size) && attempts < 8) {
      attempts += 1;
      await this.flushBufferedWrites({ strict: true, cloneResult: false });
    }
    if (this.runtime.dirtySnapshot || this.runtime.dirtySections?.size || this.runtime.deletedSections?.size) {
      const error = new Error(`Durable PostgreSQL section flush did not settle for ${this.namespace}.`);
      error.code = 'WISDO_DURABLE_FLUSH_UNSETTLED';
      throw error;
    }
    const current = this.runtime.state || this.defaultState();
    return cloneResult ? clone(current) : current;
  }

  async bufferedUpdate(updater, { normalize = (value) => value, cloneResult = true } = {}) {
    for (let attempt = 0; attempt < 256; attempt += 1) {
      const loaded = this.runtime.state || await this.load({ cloneResult: false });
      const revision = Number(this.runtime.revision || 0);
      const base = normalize(loaded);
      const draft = createTopLevelDraft(base);
      const candidate = updater(draft.proxy);
      const resolved = candidate && typeof candidate.then === 'function' ? await candidate : candidate;
      const rawNext = resolved === undefined || resolved === null || resolved === draft.proxy ? draft.target : resolved;
      const next = normalize(rawNext);
      if (revision !== Number(this.runtime.revision || 0)) continue;

      const touched = new Set(draft.touched);
      for (const key of new Set([...Object.keys(base || {}), ...Object.keys(next || {})])) {
        if (next?.[key] !== base?.[key]) touched.add(key);
      }
      this.setCache(next, this.runtime.source === 'postgres' ? 'hot-cache' : this.runtime.source, { cloneState: false });
      this.markDirtySections(base, next, touched);
      this.scheduleFlush();
      return cloneResult ? clone(next) : next;
    }
    const error = new Error(`Hot state changed too frequently: ${this.namespace}`);
    error.code = 'WISDO_HOT_STATE_CONTENTION';
    throw error;
  }

  async save(data, { cloneInput = true, cloneResult = true } = {}) {
    const snapshot = cloneInput ? clone(data) : data;
    if (this.bufferWrites) {
      const previous = this.runtime.state || {};
      // Replacing a complete authoritative snapshot does not require cloning the
      // discarded previous namespace. Dirty sections retain only the new references.
      this.setCache(snapshot, this.runtime.source === 'postgres' ? 'hot-cache' : this.runtime.source, { cloneState: false });
      // Complete-state callers may have mutated the shared hot object before save. Mark
      // every top-level section dirty, but retain only references—no full clone.
      this.markDirtySections(previous, snapshot);
      this.scheduleFlush();
      return cloneResult ? clone(snapshot) : snapshot;
    }
    return (await this.runLockedMutation(() => snapshot, { cloneResult })).state;
  }

  async saveSection(section, value) {
    const name = String(section || '').trim();
    if (!name) throw new Error('section is required');
    if (this.bufferWrites) {
      const current = this.runtime.state || await this.load({ cloneResult: false });
      const next = { ...current, [name]: clone(value) };
      this.setCache(next, this.runtime.source === 'postgres' ? 'hot-cache' : this.runtime.source, { cloneState: false });
      this.markDirtySections(current, next, new Set([name]));
      this.scheduleFlush();
      return next[name];
    }
    const result = await this.runLockedMutation((current) => ({ ...current, [name]: clone(value) }));
    return result.state[name];
  }

  async saveSections(state, sections = [], { cloneResult = false } = {}) {
    const names = [...new Set((Array.isArray(sections) ? sections : [sections]).map((value) => String(value || '').trim()).filter(Boolean))];
    if (!names.length) return cloneResult ? clone(this.runtime.state || state || {}) : (this.runtime.state || state || {});
    if (this.bufferWrites) {
      const current = this.runtime.state || await this.load({ cloneResult: false });
      const next = { ...current };
      for (const name of names) {
        if (Object.prototype.hasOwnProperty.call(state || {}, name)) next[name] = state[name];
        else delete next[name];
      }
      this.setCache(next, this.runtime.source === 'postgres' ? 'hot-cache' : this.runtime.source, { cloneState: false });
      this.markDirtySections(current, next, new Set(names));
      this.scheduleFlush();
      return cloneResult ? clone(next) : next;
    }
    const result = await this.runLockedMutation((current) => {
      const next = { ...current };
      for (const name of names) {
        if (Object.prototype.hasOwnProperty.call(state || {}, name)) next[name] = state[name];
        else delete next[name];
      }
      return next;
    }, { cloneResult });
    return result.state;
  }

  async loadSection(section, { cloneResult = true } = {}) {
    const name = String(section || '').trim();
    if (!name) return undefined;
    const state = await this.load({ cloneResult: false });
    const value = state?.[name];
    return cloneResult ? clone(value) : value;
  }

  async atomicUpdate(updater, { normalize = (value) => value, cloneResult = true } = {}) {
    if (this.bufferWrites) return this.bufferedUpdate(updater, { normalize, cloneResult });
    const result = await this.runLockedMutation(async (current) => {
      const normalized = normalize(current);
      return normalize((await updater(normalized)) || normalized);
    }, { cloneResult });
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
