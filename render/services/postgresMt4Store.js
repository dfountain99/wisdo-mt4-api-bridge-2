import { getSharedPostgresPool } from './persistenceAdapter.js';

function asBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}
function intEnv(name, fallback, min, max) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}
function obj(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function arr(value) { return Array.isArray(value) ? value : []; }
function buildAccountId(accountNumber, brokerServer = '') {
  return `${String(accountNumber || '').trim()}:${String(brokerServer || '').trim() || 'server'}`.replace(/[^a-zA-Z0-9:_.-]/g, '_');
}

export class PostgresMt4Store {
  constructor({ databaseUrl = process.env.DATABASE_URL || '', ssl = process.env.WISDO_DB_SSL } = {}) {
    this.databaseUrl = databaseUrl;
    this.ssl = asBool(ssl, true);
    this.ready = null;
    this.historyPerAccount = intEnv('WISDO_MT4_HISTORY_ACCOUNT_LIMIT', 40, 5, 500);
    this.historyGlobal = intEnv('WISDO_MT4_HISTORY_GLOBAL_LIMIT', 200, 20, 5000);
  }

  get enabled() { return Boolean(this.databaseUrl); }
  async pool() {
    if (!this.enabled) return null;
    return getSharedPostgresPool({ databaseUrl: this.databaseUrl, ssl: this.ssl });
  }

  async initialize() {
    if (!this.enabled) return false;
    if (!this.ready) this.ready = this.#initialize();
    return this.ready;
  }

  async #initialize() {
    const pool = await this.pool();
    await pool.query(`
      create table if not exists wisdo_mt4_pairings (
        pairing_code text primary key,
        discord_user_id text not null,
        channel_id text,
        status text not null default 'pending',
        account_id text,
        account_number text,
        broker_server text,
        record jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        expires_at timestamptz,
        connected_at timestamptz,
        expired_at timestamptz,
        updated_at timestamptz not null default now()
      );
      create index if not exists wisdo_mt4_pairings_user_idx on wisdo_mt4_pairings(discord_user_id, created_at desc);
      create index if not exists wisdo_mt4_pairings_status_idx on wisdo_mt4_pairings(status, updated_at desc);

      create table if not exists wisdo_mt4_accounts (
        account_id text primary key,
        discord_user_id text not null,
        account_number text not null,
        broker_server text not null default '',
        status text not null default 'connected',
        connection jsonb not null default '{}'::jsonb,
        settings jsonb not null default '{}'::jsonb,
        latest_snapshot jsonb,
        connected_at timestamptz,
        last_sync_at timestamptz,
        updated_at timestamptz not null default now()
      );
      create index if not exists wisdo_mt4_accounts_user_idx on wisdo_mt4_accounts(discord_user_id, last_sync_at desc);
      create index if not exists wisdo_mt4_accounts_sync_idx on wisdo_mt4_accounts(last_sync_at desc);

      create table if not exists wisdo_mt4_active_accounts (
        discord_user_id text primary key,
        account_id text not null,
        updated_at timestamptz not null default now()
      );

      create table if not exists wisdo_mt4_signal_tracking (
        account_id text primary key,
        tracking jsonb not null default '{}'::jsonb,
        updated_at timestamptz not null default now()
      );

      create table if not exists wisdo_mt4_snapshot_history (
        id bigserial primary key,
        account_id text not null,
        discord_user_id text not null,
        received_at timestamptz not null default now(),
        record jsonb not null
      );
      create index if not exists wisdo_mt4_history_account_idx on wisdo_mt4_snapshot_history(account_id, received_at desc, id desc);
      create index if not exists wisdo_mt4_history_user_idx on wisdo_mt4_snapshot_history(discord_user_id, received_at desc, id desc);
    `);
    await this.importLegacyIfEmpty(pool);
    return true;
  }

  async legacySection(pool, section) {
    const result = await pool.query(
      'select state from wisdo_state_sections where namespace = $1 and section = $2 limit 1',
      ['wisdo_live_mt4', section],
    );
    return result.rows[0]?.state;
  }

  async importLegacyIfEmpty(pool) {
    const count = await pool.query('select (select count(*) from wisdo_mt4_accounts) as accounts, (select count(*) from wisdo_mt4_pairings) as pairings');
    if (Number(count.rows[0]?.accounts || 0) || Number(count.rows[0]?.pairings || 0)) return;
    const [pairingCodes, connectionsByAccountId, accountSettingsByAccountId, latestSnapshotsByAccountId, signalTrackingByAccountId, activeAccountByUserId, snapshotHistory] = await Promise.all([
      this.legacySection(pool, 'pairingCodes'),
      this.legacySection(pool, 'connectionsByAccountId'),
      this.legacySection(pool, 'accountSettingsByAccountId'),
      this.legacySection(pool, 'latestSnapshotsByAccountId'),
      this.legacySection(pool, 'signalTrackingByAccountId'),
      this.legacySection(pool, 'activeAccountByUserId'),
      this.legacySection(pool, 'snapshotHistory'),
    ]);
    await this.importState({ pairingCodes, connectionsByAccountId, accountSettingsByAccountId, latestSnapshotsByAccountId, signalTrackingByAccountId, activeAccountByUserId, snapshotHistory }, { pool, replace: false });
  }

  async getPairingCode(pairingCode) {
    await this.initialize();
    const pool = await this.pool();
    const result = await pool.query('select record from wisdo_mt4_pairings where pairing_code = $1 limit 1', [String(pairingCode || '')]);
    return result.rows[0]?.record || null;
  }

  async getLatestPairingForUser(discordUserId) {
    await this.initialize();
    const pool = await this.pool();
    const result = await pool.query('select record from wisdo_mt4_pairings where discord_user_id = $1 order by created_at desc limit 1', [String(discordUserId || '')]);
    return result.rows[0]?.record || null;
  }

  async getSnapshotContext(accountId, discordUserId = '') {
    await this.initialize();
    const pool = await this.pool();
    const result = await pool.query(`
      select a.connection, a.settings, a.latest_snapshot, t.tracking,
             aa.account_id as active_account_id
      from wisdo_mt4_accounts a
      left join wisdo_mt4_signal_tracking t on t.account_id = a.account_id
      left join wisdo_mt4_active_accounts aa on aa.discord_user_id = $2
      where a.account_id = $1
      limit 1
    `, [String(accountId || ''), String(discordUserId || '')]);
    const row = result.rows[0] || {};
    return {
      connection: row.connection || null,
      settings: obj(row.settings),
      latestSnapshot: row.latest_snapshot || null,
      tracking: row.tracking || null,
      activeAccountId: row.active_account_id || null,
    };
  }

  async persistSnapshot({ pairingRecord, connectionRecord, latestSnapshotRecord, settings, tracking, historyRecord = null, appendHistory = false }) {
    await this.initialize();
    const pool = await this.pool();
    const client = await pool.connect();
    const receivedAt = latestSnapshotRecord?.receivedAt || new Date().toISOString();
    try {
      await client.query('begin');
      const pairing = obj(pairingRecord);
      await client.query(`
        insert into wisdo_mt4_pairings(pairing_code, discord_user_id, channel_id, status, account_id, account_number, broker_server, record, created_at, expires_at, connected_at, expired_at, updated_at)
        values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,coalesce($9::timestamptz,now()),$10::timestamptz,$11::timestamptz,$12::timestamptz,now())
        on conflict(pairing_code) do update set
          discord_user_id=excluded.discord_user_id, channel_id=excluded.channel_id, status=excluded.status,
          account_id=excluded.account_id, account_number=excluded.account_number, broker_server=excluded.broker_server,
          record=excluded.record, expires_at=excluded.expires_at, connected_at=excluded.connected_at,
          expired_at=excluded.expired_at, updated_at=now()
      `, [pairing.pairingCode, pairing.discordUserId, pairing.channelId || null, pairing.status || 'connected', pairing.accountId || connectionRecord.accountId, pairing.accountNumber || connectionRecord.accountNumber, pairing.brokerServer || connectionRecord.brokerServer || '', JSON.stringify(pairing), pairing.createdAt || null, pairing.expiresAt || null, pairing.connectedAt || null, pairing.expiredAt || null]);

      await client.query(`
        insert into wisdo_mt4_accounts(account_id, discord_user_id, account_number, broker_server, status, connection, settings, latest_snapshot, connected_at, last_sync_at, updated_at)
        values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::timestamptz,$10::timestamptz,now())
        on conflict(account_id) do update set
          discord_user_id=excluded.discord_user_id, account_number=excluded.account_number, broker_server=excluded.broker_server,
          status=excluded.status, connection=excluded.connection, settings=excluded.settings,
          latest_snapshot=excluded.latest_snapshot, connected_at=coalesce(wisdo_mt4_accounts.connected_at, excluded.connected_at),
          last_sync_at=excluded.last_sync_at, updated_at=now()
      `, [connectionRecord.accountId, connectionRecord.discordUserId, String(connectionRecord.accountNumber), connectionRecord.brokerServer || '', connectionRecord.status || 'connected', JSON.stringify(connectionRecord), JSON.stringify(obj(settings)), JSON.stringify(latestSnapshotRecord), connectionRecord.connectedAt || receivedAt, connectionRecord.lastSyncAt || receivedAt]);

      if (tracking) {
        await client.query(`
          insert into wisdo_mt4_signal_tracking(account_id, tracking, updated_at)
          values($1,$2::jsonb,now())
          on conflict(account_id) do update set tracking=excluded.tracking, updated_at=now()
        `, [connectionRecord.accountId, JSON.stringify(tracking)]);
      }

      await client.query(`
        insert into wisdo_mt4_active_accounts(discord_user_id, account_id, updated_at)
        values($1,$2,now()) on conflict(discord_user_id) do nothing
      `, [connectionRecord.discordUserId, connectionRecord.accountId]);

      if (appendHistory && historyRecord) {
        await client.query('insert into wisdo_mt4_snapshot_history(account_id, discord_user_id, received_at, record) values($1,$2,$3::timestamptz,$4::jsonb)', [connectionRecord.accountId, connectionRecord.discordUserId, historyRecord.receivedAt || receivedAt, JSON.stringify(historyRecord)]);
        await client.query(`delete from wisdo_mt4_snapshot_history where account_id=$1 and id not in (select id from wisdo_mt4_snapshot_history where account_id=$1 order by received_at desc,id desc limit $2)`, [connectionRecord.accountId, this.historyPerAccount]);
        await client.query(`delete from wisdo_mt4_snapshot_history where id in (select id from wisdo_mt4_snapshot_history order by received_at desc,id desc offset $1)`, [this.historyGlobal]);
      }
      await client.query('commit');
      return latestSnapshotRecord;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  hydrateAccount(row, activeAccountId = null) {
    const connection = obj(row.connection);
    const settings = obj(row.settings);
    const latestSnapshot = row.latest_snapshot || null;
    const snap = latestSnapshot?.snapshot || {};
    return {
      ...connection,
      ...settings,
      accountId: row.account_id,
      discordUserId: row.discord_user_id,
      accountNumber: row.account_number,
      brokerServer: row.broker_server,
      latestSnapshot,
      server: row.broker_server || snap.brokerServer || '',
      type: snap.isDemo ? 'Demo' : 'Live',
      balance: Number(snap.balance || 0),
      equity: Number(snap.equity || 0),
      floatingPL: Number(snap.floatingPL || 0),
      dailyClosedPL: Number(snap.dailyClosedPL || 0),
      openTrades: Number(snap.openTradeCount || 0),
      terminalConnected: snap.terminalConnected !== false,
      expertEnabled: snap.expertEnabled !== false,
      lastSyncAt: latestSnapshot?.receivedAt || row.last_sync_at || connection.lastSyncAt || '',
      isPrimary: activeAccountId ? activeAccountId === row.account_id : false,
    };
  }


  async setActiveAccount(discordUserId, accountId) {
    await this.initialize();
    const pool = await this.pool();
    const owned = await pool.query('select connection from wisdo_mt4_accounts where account_id=$1 and discord_user_id=$2 limit 1', [String(accountId || ''), String(discordUserId || '')]);
    if (!owned.rowCount) return null;
    await pool.query('insert into wisdo_mt4_active_accounts(discord_user_id,account_id,updated_at) values($1,$2,now()) on conflict(discord_user_id) do update set account_id=excluded.account_id,updated_at=now()', [String(discordUserId || ''), String(accountId || '')]);
    return owned.rows[0].connection || null;
  }

  async updateAccountSettings(discordUserId, accountId, patch = {}) {
    await this.initialize();
    const pool = await this.pool();
    const current = await pool.query('select connection,settings,latest_snapshot,last_sync_at,broker_server,account_number,discord_user_id from wisdo_mt4_accounts where account_id=$1 and discord_user_id=$2 limit 1', [String(accountId || ''), String(discordUserId || '')]);
    if (!current.rowCount) return null;
    const row = current.rows[0];
    const previous = obj(row.settings);
    const next = { ...previous, ...obj(patch), updatedAt: new Date().toISOString() };
    const connection = { ...obj(row.connection) };
    if (next.nickname) { connection.nickname = next.nickname; connection.accountNickname = next.nickname; }
    if (next.accountRole) connection.accountRole = next.accountRole;
    if (next.copyPermission) connection.copyPermission = next.copyPermission;
    const result = await pool.query(`update wisdo_mt4_accounts set settings=$3::jsonb, connection=$4::jsonb, updated_at=now() where account_id=$1 and discord_user_id=$2 returning *`, [String(accountId || ''), String(discordUserId || ''), JSON.stringify(next), JSON.stringify(connection)]);
    return this.hydrateAccount(result.rows[0], null);
  }

  async getAccounts(discordUserId) {
    await this.initialize();
    const pool = await this.pool();
    const [accounts, active] = await Promise.all([
      pool.query('select * from wisdo_mt4_accounts where discord_user_id=$1 order by last_sync_at desc nulls last, updated_at desc', [String(discordUserId || '')]),
      pool.query('select account_id from wisdo_mt4_active_accounts where discord_user_id=$1 limit 1', [String(discordUserId || '')]),
    ]);
    const activeId = active.rows[0]?.account_id || null;
    const rows = accounts.rows.map((row) => this.hydrateAccount(row, activeId));
    if (rows.length && !rows.some((row) => row.isPrimary)) rows[0].isPrimary = true;
    return rows;
  }

  async getConnection(discordUserId, accountId = null) {
    const rows = await this.getAccounts(discordUserId);
    return accountId ? rows.find((row) => row.accountId === accountId) || null : rows.find((row) => row.isPrimary) || rows[0] || null;
  }

  async getLatestSnapshot(discordUserId, accountId = null) {
    const connection = await this.getConnection(discordUserId, accountId);
    return connection?.latestSnapshot || null;
  }

  async getSnapshotHistory(discordUserId, limit = 25, range = {}) {
    await this.initialize();
    const pool = await this.pool();
    const params = [String(discordUserId || ''), Math.max(1, Math.min(500, Number(limit || 25)))];
    let where = 'discord_user_id=$1';
    if (range?.accountId) { params.push(String(range.accountId)); where += ` and account_id=$${params.length}`; }
    if (range?.from) { params.push(range.from); where += ` and received_at >= $${params.length}::timestamptz`; }
    if (range?.to) { params.push(range.to); where += ` and received_at <= $${params.length}::timestamptz`; }
    const result = await pool.query(`select record from wisdo_mt4_snapshot_history where ${where} order by received_at desc,id desc limit $2`, params);
    return result.rows.map((row) => row.record);
  }

  async importState(state = {}, { pool = null, replace = true } = {}) {
    if (!this.enabled) return state;
    if (!pool) await this.initialize();
    const db = pool || await this.pool();
    const client = await db.connect();
    try {
      await client.query('begin');
      if (replace) {
        await client.query('delete from wisdo_mt4_pairings');
        await client.query('delete from wisdo_mt4_accounts');
        await client.query('delete from wisdo_mt4_active_accounts');
        await client.query('delete from wisdo_mt4_signal_tracking');
        await client.query('delete from wisdo_mt4_snapshot_history');
      }
      for (const [code, raw] of Object.entries(obj(state.pairingCodes))) {
        const record = { ...obj(raw), pairingCode: raw?.pairingCode || code };
        if (!record.discordUserId) continue;
        await client.query(`insert into wisdo_mt4_pairings(pairing_code,discord_user_id,channel_id,status,account_id,account_number,broker_server,record,created_at,expires_at,connected_at,expired_at,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,coalesce($9::timestamptz,now()),$10::timestamptz,$11::timestamptz,$12::timestamptz,now()) on conflict(pairing_code) do update set record=excluded.record,discord_user_id=excluded.discord_user_id,channel_id=excluded.channel_id,status=excluded.status,account_id=excluded.account_id,account_number=excluded.account_number,broker_server=excluded.broker_server,expires_at=excluded.expires_at,connected_at=excluded.connected_at,expired_at=excluded.expired_at,updated_at=now()`, [record.pairingCode, record.discordUserId, record.channelId || null, record.status || 'pending', record.accountId || null, record.accountNumber || null, record.brokerServer || '', JSON.stringify(record), record.createdAt || null, record.expiresAt || null, record.connectedAt || null, record.expiredAt || null]);
      }
      const connections = obj(state.connectionsByAccountId);
      for (const [id, raw] of Object.entries(connections)) {
        const connection = { ...obj(raw), accountId: raw?.accountId || id };
        if (!connection.discordUserId || !connection.accountNumber) continue;
        const latest = obj(state.latestSnapshotsByAccountId)[connection.accountId] || null;
        const settings = obj(state.accountSettingsByAccountId)[connection.accountId] || {};
        await client.query(`insert into wisdo_mt4_accounts(account_id,discord_user_id,account_number,broker_server,status,connection,settings,latest_snapshot,connected_at,last_sync_at,updated_at) values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::timestamptz,$10::timestamptz,now()) on conflict(account_id) do update set discord_user_id=excluded.discord_user_id,account_number=excluded.account_number,broker_server=excluded.broker_server,status=excluded.status,connection=excluded.connection,settings=excluded.settings,latest_snapshot=coalesce(excluded.latest_snapshot,wisdo_mt4_accounts.latest_snapshot),connected_at=coalesce(wisdo_mt4_accounts.connected_at,excluded.connected_at),last_sync_at=coalesce(excluded.last_sync_at,wisdo_mt4_accounts.last_sync_at),updated_at=now()`, [connection.accountId, connection.discordUserId, String(connection.accountNumber), connection.brokerServer || connection.server || '', connection.status || 'connected', JSON.stringify(connection), JSON.stringify(settings), latest ? JSON.stringify(latest) : null, connection.connectedAt || null, latest?.receivedAt || connection.lastSyncAt || null]);
      }
      for (const [userId, accountId] of Object.entries(obj(state.activeAccountByUserId))) {
        await client.query('insert into wisdo_mt4_active_accounts(discord_user_id,account_id,updated_at) values($1,$2,now()) on conflict(discord_user_id) do update set account_id=excluded.account_id,updated_at=now()', [userId, accountId]);
      }
      for (const [accountId, tracking] of Object.entries(obj(state.signalTrackingByAccountId))) {
        await client.query('insert into wisdo_mt4_signal_tracking(account_id,tracking,updated_at) values($1,$2::jsonb,now()) on conflict(account_id) do update set tracking=excluded.tracking,updated_at=now()', [accountId, JSON.stringify(tracking)]);
      }
      for (const record of arr(state.snapshotHistory).slice(0, this.historyGlobal)) {
        if (!record?.accountId || !record?.discordUserId) continue;
        await client.query('insert into wisdo_mt4_snapshot_history(account_id,discord_user_id,received_at,record) values($1,$2,$3::timestamptz,$4::jsonb)', [record.accountId, record.discordUserId, record.receivedAt || new Date().toISOString(), JSON.stringify(record)]);
      }
      await client.query('commit');
      return state;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  async exportState() {
    await this.initialize();
    const pool = await this.pool();
    const [pairings, accounts, active, tracking, history] = await Promise.all([
      pool.query('select pairing_code, record from wisdo_mt4_pairings'),
      pool.query('select * from wisdo_mt4_accounts'),
      pool.query('select discord_user_id, account_id from wisdo_mt4_active_accounts'),
      pool.query('select account_id, tracking from wisdo_mt4_signal_tracking'),
      pool.query('select record from wisdo_mt4_snapshot_history order by received_at desc,id desc limit $1', [this.historyGlobal]),
    ]);
    const state = {
      pairingCodes: Object.fromEntries(pairings.rows.map((row) => [row.pairing_code, row.record])),
      connections: {}, connectionsByAccountId: {}, activeAccountByUserId: {}, accountSettingsByAccountId: {},
      accountSharesById: {}, accountAccessRequestsById: {}, brokerLinkRequestsById: {}, copyRoutesById: {}, tradeLinksById: {}, copyLinksById: {},
      latestSnapshots: {}, latestSnapshotsByAccountId: {}, signalTrackingByAccountId: {}, snapshotHistory: history.rows.map((row) => row.record),
    };
    for (const row of accounts.rows) {
      state.connectionsByAccountId[row.account_id] = row.connection;
      state.accountSettingsByAccountId[row.account_id] = row.settings || {};
      if (row.latest_snapshot) state.latestSnapshotsByAccountId[row.account_id] = row.latest_snapshot;
    }
    for (const row of active.rows) state.activeAccountByUserId[row.discord_user_id] = row.account_id;
    for (const row of tracking.rows) state.signalTrackingByAccountId[row.account_id] = row.tracking;
    for (const [userId, accountId] of Object.entries(state.activeAccountByUserId)) {
      if (state.connectionsByAccountId[accountId]) state.connections[userId] = state.connectionsByAccountId[accountId];
      if (state.latestSnapshotsByAccountId[accountId]) state.latestSnapshots[userId] = state.latestSnapshotsByAccountId[accountId];
    }
    return state;
  }
}
