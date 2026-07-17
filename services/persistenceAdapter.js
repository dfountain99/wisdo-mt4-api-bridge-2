import fs from 'node:fs/promises';
import path from 'node:path';

import { atomicWriteJson } from '../storage/atomicJsonFile.js';

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function clone(value) { return structuredClone(value ?? {}); }
function stableJson(value) { return JSON.stringify(value ?? null); }

export class JsonFilePersistenceAdapter {
  constructor({ dataDir, fileName, defaultState = () => ({}) }) {
    this.dataDir = dataDir || 'data/operator-desks';
    this.filePath = path.join(this.dataDir, fileName);
    this.backupPath = `${this.filePath}.bak`;
    this.defaultState = defaultState;
    this.lastKnownGood = null;
    this.writeChain = Promise.resolve();
  }

  async readJson(filePath) {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  }

  async load() {
    try {
      const parsed = await this.readJson(this.filePath);
      this.lastKnownGood = clone(parsed);
      return parsed;
    } catch (primaryError) {
      try {
        const backup = await this.readJson(this.backupPath);
        this.lastKnownGood = clone(backup);
        await atomicWriteJson(this.filePath, backup).catch(() => undefined);
        return backup;
      } catch (backupError) {
        if (this.lastKnownGood) return clone(this.lastKnownGood);
        if (primaryError?.code === 'ENOENT' && backupError?.code === 'ENOENT') {
          const initial = this.defaultState();
          this.lastKnownGood = clone(initial);
          return initial;
        }
        const error = new Error(`Persistent state could not be read from ${this.filePath}; refusing to replace it with an empty state.`);
        error.cause = primaryError;
        throw error;
      }
    }
  }

  async save(data) {
    const snapshot = clone(data);
    const operation = this.writeChain.then(async () => {
      await fs.mkdir(this.dataDir, { recursive: true });
      await atomicWriteJson(this.filePath, snapshot);
      await atomicWriteJson(this.backupPath, snapshot);
      this.lastKnownGood = clone(snapshot);
      return data;
    });
    this.writeChain = operation.catch(() => undefined);
    return operation;
  }

  async atomicUpdate(updater, { normalize = (value) => value } = {}) {
    const operation = this.writeChain.then(async () => {
      const current = normalize(await this.load());
      const next = normalize((await updater(current)) || current);
      await fs.mkdir(this.dataDir, { recursive: true });
      await atomicWriteJson(this.filePath, next);
      await atomicWriteJson(this.backupPath, next);
      this.lastKnownGood = clone(next);
      return next;
    });
    this.writeChain = operation.catch(() => undefined);
    return operation;
  }
}

export class MemoryPersistenceAdapter {
  constructor(defaultState = () => ({})) {
    this.defaultState = defaultState;
    this.state = defaultState();
    this.writeChain = Promise.resolve();
  }

  async load() { return clone(this.state); }
  async save(data) { this.state = clone(data); return data; }

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
    this.namespace = namespace;
    this.ssl = parseBoolean(ssl, false);
    this.pool = null;
    this.writeChain = Promise.resolve();
    this.lastKnownGood = null;
  }

  async getPool() {
    if (this.pool) return this.pool;
    let pg;
    try { pg = await import('pg'); }
    catch { throw new Error('Postgres persistence requires the pg package.'); }
    this.pool = new pg.Pool({
      connectionString: this.databaseUrl,
      ssl: this.ssl ? { rejectUnauthorized: false } : false,
      max: Math.max(2, Number(process.env.DB_POOL_MAX || 10)),
      idleTimeoutMillis: Math.max(1000, Number(process.env.DB_IDLE_TIMEOUT_MS || 30000)),
      connectionTimeoutMillis: Math.max(1000, Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000)),
      allowExitOnIdle: false,
    });
    await this.pool.query(`
      create table if not exists wisdo_state_sections (
        namespace text not null,
        section text not null,
        state jsonb not null default '{}'::jsonb,
        revision bigint not null default 1,
        updated_at timestamptz not null default now(),
        primary key(namespace, section)
      )
    `);
    await this.pool.query('create index if not exists wisdo_state_sections_updated_idx on wisdo_state_sections(updated_at desc)');
    return this.pool;
  }

  async importLegacyIfNeeded(pool) {
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

  async load() {
    const pool = await this.getPool();
    try {
      await this.importLegacyIfNeeded(pool);
      const state = this.rowsToState(await this.loadRows(pool));
      this.lastKnownGood = clone(state);
      return state;
    } catch (error) {
      if (this.lastKnownGood) return clone(this.lastKnownGood);
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
      const current = this.rowsToState(await this.loadRows(client));
      const next = await mutator(clone(current));
      const changedSections = await this.persistChangedSections(client, current, next || current);
      await client.query('commit');
      this.lastKnownGood = clone(next || current);
      return { state: next || current, changedSections };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally { client.release(); }
  }

  async save(data) {
    const snapshot = clone(data);
    const operation = this.writeChain.then(async () => {
      const result = await this.runLockedMutation(() => snapshot);
      return result.state;
    });
    this.writeChain = operation.catch(() => undefined);
    return operation;
  }

  async saveSection(section, value) {
    const name = String(section || '').trim();
    if (!name) throw new Error('section is required');
    const operation = this.writeChain.then(async () => {
      const result = await this.runLockedMutation((current) => ({ ...current, [name]: clone(value) }));
      return result.state[name];
    });
    this.writeChain = operation.catch(() => undefined);
    return operation;
  }

  async atomicUpdate(updater, { normalize = (value) => value } = {}) {
    const operation = this.writeChain.then(async () => {
      const result = await this.runLockedMutation(async (current) => {
        const normalized = normalize(current);
        return normalize((await updater(normalized)) || normalized);
      });
      return result.state;
    });
    this.writeChain = operation.catch(() => undefined);
    return operation;
  }

  async close() {
    if (this.pool) await this.pool.end();
    this.pool = null;
  }
}

export function createPersistenceAdapter(config = {}, options = {}) {
  if (config.persistenceAdapter) return config.persistenceAdapter;
  const persistence = config.persistence || {};
  const mode = String(config.persistenceMode || persistence.mode || 'json').toLowerCase();
  const dataDir = config.dataDir || persistence.storagePath;

  if (mode === 'memory') return new MemoryPersistenceAdapter(options.defaultState);
  if (mode === 'database') return new DatabasePersistenceAdapterPlaceholder();
  if (mode === 'postgres') {
    return new PostgresKeyValuePersistenceAdapter({
      databaseUrl: persistence.databaseUrl || config.databaseUrl || process.env.DATABASE_URL,
      namespace: options.namespace || options.fileName || 'wisdo',
      ssl: parseBoolean(persistence.dbSsl ?? config.dbSsl, false),
    });
  }

  return new JsonFilePersistenceAdapter({ dataDir, fileName: options.fileName, defaultState: options.defaultState });
}
