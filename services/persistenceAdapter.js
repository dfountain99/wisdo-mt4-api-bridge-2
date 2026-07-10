import fs from 'node:fs/promises';
import path from 'node:path';

import { atomicWriteJson } from '../storage/atomicJsonFile.js';

export class JsonFilePersistenceAdapter {
  constructor({ dataDir, fileName, defaultState = () => ({}) }) {
    this.dataDir = dataDir || 'data/operator-desks';
    this.filePath = path.join(this.dataDir, fileName);
    this.defaultState = defaultState;
  }

  async load() {
    try {
      return JSON.parse(await fs.readFile(this.filePath, 'utf8'));
    } catch {
      return this.defaultState();
    }
  }

  async save(data) {
    return atomicWriteJson(this.filePath, data);
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
