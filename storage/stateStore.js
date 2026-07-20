import { MemoryPersistenceAdapter, PostgresKeyValuePersistenceAdapter } from '../services/persistenceAdapter.js';

function clone(value) { return JSON.parse(JSON.stringify(value ?? {})); }
function isEmptyObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;
}
function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

export class DatabaseStateStore {
  constructor({ namespace, fallbackFactory = () => ({}) }) {
    this.namespace = namespace;
    this.fallbackFactory = typeof fallbackFactory === 'function' ? fallbackFactory : () => clone(fallbackFactory || {});
    const databaseUrl = process.env.DATABASE_URL || '';
    const production = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
    if (!databaseUrl && production) {
      throw new Error(`WISDO live relay database store ${namespace} requires DATABASE_URL. File persistence is disabled.`);
    }
    this.adapter = databaseUrl
      ? new PostgresKeyValuePersistenceAdapter({
          databaseUrl,
          namespace,
          ssl: String(process.env.WISDO_DB_SSL || '').toLowerCase() === 'true',
          defaultState: this.fallbackFactory,
          // Live Reporter/account state is acknowledged from the hot mirror and then
          // flushed to PostgreSQL. No laptop or JSON files participate.
          bufferWrites: parseBoolean(process.env.WISDO_DB_BUFFER_LIVE_WRITES, true),
        })
      : new MemoryPersistenceAdapter(this.fallbackFactory);
  }
  fallback() { return clone(this.fallbackFactory()); }
  async ensure() {
    const current = await this.adapter.load();
    if (!isEmptyObject(current)) return current;
    const initial = this.fallback();
    await this.adapter.save(initial);
    return initial;
  }
  async read({ cloneResult = true } = {}) {
    const current = await this.adapter.load({ cloneResult });
    return isEmptyObject(current) ? this.fallback() : current;
  }
  async readHot() { return this.read({ cloneResult: false }); }
  async readSection(section, { cloneResult = true } = {}) {
    if (typeof this.adapter.loadSection === 'function') return this.adapter.loadSection(section, { cloneResult });
    const state = await this.read({ cloneResult: false });
    const value = state?.[section];
    return cloneResult ? clone(value) : value;
  }
  async writeSection(section, value) {
    if (typeof this.adapter.saveSection === 'function') return this.adapter.saveSection(section, value);
    return this.update((state) => ({ ...state, [String(section)]: value }));
  }
  async write(data) { return this.adapter.save(data, { cloneInput: true, cloneResult: false }); }
  async update(updater) {
    return this.adapter.atomicUpdate(async (current) => {
      const base = isEmptyObject(current) ? this.fallback() : current;
      const next = typeof updater === 'function' ? await updater(base) : base;
      return next === undefined || next === null ? base : next;
    }, { cloneResult: false });
  }
  async getAll() { return this.read(); }
  async setAll(data) { return this.write(data); }
  async close() { await this.adapter.close?.(); }
}

const sharedDatabaseStores = new Map();
export function createNamedDatabaseStateStore(namespace, fallbackFactory) {
  const name = String(namespace || 'wisdo_state').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  if (!process.env.DATABASE_URL) return new DatabaseStateStore({ namespace: name, fallbackFactory });
  if (!sharedDatabaseStores.has(name)) sharedDatabaseStores.set(name, new DatabaseStateStore({ namespace: name, fallbackFactory }));
  return sharedDatabaseStores.get(name);
}
export function createDatabaseStateStore(name, fallbackFactory) {
  const normalized = String(name || 'state').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  return createNamedDatabaseStateStore(`wisdo_live_${normalized}`, fallbackFactory);
}
