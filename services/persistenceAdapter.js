import fs from 'node:fs/promises';
import path from 'node:path';

import { atomicWriteJson } from '../storage/atomicJsonFile.js';

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
      this.lastKnownGood = structuredClone(parsed);
      return parsed;
    } catch (primaryError) {
      try {
        const backup = await this.readJson(this.backupPath);
        this.lastKnownGood = structuredClone(backup);
        await atomicWriteJson(this.filePath, backup).catch(() => undefined);
        return backup;
      } catch (backupError) {
        if (this.lastKnownGood) return structuredClone(this.lastKnownGood);
        if (primaryError?.code === 'ENOENT' && backupError?.code === 'ENOENT') {
          const initial = this.defaultState();
          this.lastKnownGood = structuredClone(initial);
          return initial;
        }
        const error = new Error(`Persistent state could not be read from ${this.filePath}; refusing to replace it with an empty state.`);
        error.cause = primaryError;
        throw error;
      }
    }
  }

  async save(data) {
    const snapshot = structuredClone(data || {});
    const operation = this.writeChain.then(async () => {
      await fs.mkdir(this.dataDir, { recursive: true });
      await atomicWriteJson(this.filePath, snapshot);
      await atomicWriteJson(this.backupPath, snapshot);
      this.lastKnownGood = structuredClone(snapshot);
      return data;
    });
    this.writeChain = operation.catch(() => undefined);
    return operation;
  }
}

export class MemoryPersistenceAdapter {
  constructor(defaultState = () => ({})) {
    this.defaultState = defaultState;
    this.state = defaultState();
  }

  async load() {
    return structuredClone(this.state);
  }

  async save(data) {
    this.state = structuredClone(data);
    return data;
  }
}

export class DatabasePersistenceAdapterPlaceholder {
  async load() {
    throw new Error('Database persistence adapter is not configured yet.');
  }

  async save() {
    throw new Error('Database persistence adapter is not configured yet.');
  }
}

export class PostgresKeyValuePersistenceAdapter {
  constructor({ databaseUrl, namespace, ssl = false }) {
    if (!databaseUrl) {
      throw new Error('WISDO_PERSISTENCE_MODE=postgres requires DATABASE_URL.');
    }

    this.databaseUrl = databaseUrl;
    this.namespace = namespace;
    this.ssl = ssl;
    this.pool = null;
  }

  async getPool() {
    if (this.pool) return this.pool;

    let pg;
    try {
      pg = await import('pg');
    } catch {
      throw new Error('WISDO_PERSISTENCE_MODE=postgres requires the pg package. Run npm install pg before enabling postgres mode.');
    }

    this.pool = new pg.Pool({
      connectionString: this.databaseUrl,
      ssl: this.ssl ? { rejectUnauthorized: false } : false,
    });
    await this.pool.query(`
      create table if not exists wisdo_kv_store (
        namespace text primary key,
        state jsonb not null default '{}'::jsonb,
        updated_at timestamptz not null default now()
      )
    `);
    return this.pool;
  }

  async load() {
    const pool = await this.getPool();
    const result = await pool.query('select state from wisdo_kv_store where namespace = $1', [this.namespace]);
    return result.rows[0]?.state || {};
  }

  async save(data) {
    const pool = await this.getPool();
    await pool.query(
      `insert into wisdo_kv_store (namespace, state, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (namespace) do update set state = excluded.state, updated_at = now()`,
      [this.namespace, JSON.stringify(data || {})],
    );
    return data;
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
      ssl: Boolean(persistence.dbSsl ?? config.dbSsl),
    });
  }

  return new JsonFilePersistenceAdapter({
    dataDir,
    fileName: options.fileName,
    defaultState: options.defaultState,
  });
}
