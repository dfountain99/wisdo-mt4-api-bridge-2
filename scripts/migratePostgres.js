import 'dotenv/config';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const ssl = ['1','true','yes','on'].includes(String(process.env.WISDO_DB_SSL || process.env.DB_SSL || 'true').toLowerCase());
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: ssl ? { rejectUnauthorized: false } : false });
try {
  await pool.query(`
    create table if not exists wisdo_state_sections (
      namespace text not null, section text not null, state jsonb not null default '{}'::jsonb,
      revision bigint not null default 1, updated_at timestamptz not null default now(),
      primary key(namespace, section)
    );
    create index if not exists wisdo_state_sections_updated_idx on wisdo_state_sections(updated_at desc);

    create table if not exists wisdo_copier_commands (
      id text primary key, user_id text, account_id text, command text not null,
      status text not null default 'queued', payload jsonb not null default '{}'::jsonb,
      result jsonb, attempts integer not null default 0, receiver_id text,
      bridge_state text not null default 'stored', last_error text,
      queued_at timestamptz not null default now(), claimed_at timestamptz,
      delivered_at timestamptz, completed_at timestamptz, expires_at timestamptz,
      updated_at timestamptz not null default now()
    );
    alter table wisdo_copier_commands add column if not exists receiver_id text;
    alter table wisdo_copier_commands add column if not exists bridge_state text not null default 'stored';
    alter table wisdo_copier_commands add column if not exists last_error text;
    alter table wisdo_copier_commands add column if not exists claimed_at timestamptz;
    alter table wisdo_copier_commands add column if not exists expires_at timestamptz;
    create index if not exists wisdo_copier_commands_pending_idx on wisdo_copier_commands(status, queued_at);
    create index if not exists wisdo_copier_commands_account_idx on wisdo_copier_commands(account_id, queued_at desc);

    create table if not exists wisdo_receiver_heartbeats (
      account_id text primary key, user_id text, terminal text, receiver_id text,
      metadata jsonb not null default '{}'::jsonb, received_at timestamptz not null default now()
    );
    alter table wisdo_receiver_heartbeats add column if not exists receiver_id text;
    create index if not exists wisdo_receiver_heartbeats_received_idx on wisdo_receiver_heartbeats(received_at desc);

    create table if not exists wisdo_lane_timeline_events (
      id text primary key, lane_id text not null, account_id text, event_type text not null,
      payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
    );
    create index if not exists wisdo_lane_timeline_lane_idx on wisdo_lane_timeline_events(lane_id, created_at desc);

    create table if not exists wisdo_trade_passports (
      id text primary key, lane_id text not null, leader_order_id text,
      status text not null default 'open', passport jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(), finalized_at timestamptz
    );
    create index if not exists wisdo_trade_passports_lane_idx on wisdo_trade_passports(lane_id, created_at desc);


    create table if not exists wisdo_mt4_pairings (
      pairing_code text primary key, discord_user_id text not null, channel_id text,
      status text not null default 'pending', account_id text, account_number text, broker_server text,
      record jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
      expires_at timestamptz, connected_at timestamptz, expired_at timestamptz, updated_at timestamptz not null default now()
    );
    create index if not exists wisdo_mt4_pairings_user_idx on wisdo_mt4_pairings(discord_user_id, created_at desc);
    create index if not exists wisdo_mt4_pairings_status_idx on wisdo_mt4_pairings(status, updated_at desc);

    create table if not exists wisdo_mt4_accounts (
      account_id text primary key, discord_user_id text not null, account_number text not null,
      broker_server text not null default '', status text not null default 'connected',
      connection jsonb not null default '{}'::jsonb, settings jsonb not null default '{}'::jsonb,
      latest_snapshot jsonb, connected_at timestamptz, last_sync_at timestamptz, updated_at timestamptz not null default now()
    );
    create index if not exists wisdo_mt4_accounts_user_idx on wisdo_mt4_accounts(discord_user_id, last_sync_at desc);
    create index if not exists wisdo_mt4_accounts_sync_idx on wisdo_mt4_accounts(last_sync_at desc);

    create table if not exists wisdo_mt4_active_accounts (
      discord_user_id text primary key, account_id text not null, updated_at timestamptz not null default now()
    );

    create table if not exists wisdo_mt4_signal_tracking (
      account_id text primary key, tracking jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
    );

    create table if not exists wisdo_mt4_snapshot_history (
      id bigserial primary key, account_id text not null, discord_user_id text not null,
      received_at timestamptz not null default now(), record jsonb not null
    );
    create index if not exists wisdo_mt4_history_account_idx on wisdo_mt4_snapshot_history(account_id, received_at desc, id desc);
    create index if not exists wisdo_mt4_history_user_idx on wisdo_mt4_snapshot_history(discord_user_id, received_at desc, id desc);

    create table if not exists wisdo_mt4_commands (
      id text primary key, dedupe_key text not null default '', user_id text not null, account_id text,
      account_number text, pairing_code text, command text not null, payload jsonb not null default '{}'::jsonb,
      validation jsonb not null default '{}'::jsonb, requires_confirmation boolean not null default false,
      confirmed_at timestamptz, status text not null default 'pending', attempts integer not null default 0,
      priority integer not null default 0, immediate boolean not null default true, created_at timestamptz not null default now(),
      expires_at timestamptz, delivered_at timestamptz, completed_at timestamptz, failed_at timestamptz,
      expired_at timestamptz, result jsonb, error_message text, updated_at timestamptz not null default now()
    );
    create index if not exists wisdo_mt4_commands_poll_idx on wisdo_mt4_commands(user_id, account_id, status, priority desc, created_at);
    create index if not exists wisdo_mt4_commands_account_idx on wisdo_mt4_commands(account_id, created_at desc);
    create index if not exists wisdo_mt4_commands_expiry_idx on wisdo_mt4_commands(status, expires_at);
    create unique index if not exists wisdo_mt4_commands_active_dedupe_idx on wisdo_mt4_commands(dedupe_key) where dedupe_key <> '' and status in ('pending','delivered');

    create table if not exists wisdo_mt4_command_audit (
      id bigserial primary key, command_id text, action text not null,
      details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
    );
    create index if not exists wisdo_mt4_command_audit_created_idx on wisdo_mt4_command_audit(created_at desc);

    create table if not exists wisdo_trade_signals (
      signal_id text primary key, leader_user_id text, leader_account_id text, source_ticket text,
      symbol text, side text, status text not null default 'active', signal jsonb not null,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(), expires_at timestamptz
    );
    create index if not exists wisdo_trade_signals_leader_idx on wisdo_trade_signals(leader_account_id, updated_at desc);
    create index if not exists wisdo_trade_signals_status_idx on wisdo_trade_signals(status, updated_at desc);
    create unique index if not exists wisdo_trade_signals_ticket_idx on wisdo_trade_signals(leader_account_id, source_ticket) where source_ticket is not null and source_ticket <> '';
  `);
  

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wisdo_devices (
      device_id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      device_type TEXT NOT NULL CHECK (device_type IN ('pi-edge','desktop-agent')),
      device_name TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_seen_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wisdo_devices_owner_type ON wisdo_devices(owner_user_id, device_type, status);

    CREATE TABLE IF NOT EXISTS wisdo_bots (
      bot_id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      desktop_device_id TEXT NOT NULL REFERENCES wisdo_devices(device_id) ON DELETE CASCADE,
      bot_name TEXT NOT NULL,
      aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
      account_id TEXT,
      terminal_name TEXT,
      status TEXT NOT NULL DEFAULT 'online',
      capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_seen_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wisdo_bots_owner_status ON wisdo_bots(owner_user_id, status, last_seen_at DESC);
    CREATE INDEX IF NOT EXISTS idx_wisdo_bots_desktop ON wisdo_bots(desktop_device_id, status);

    CREATE TABLE IF NOT EXISTS wisdo_commands (
      command_id UUID PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      issued_by_device_id TEXT REFERENCES wisdo_devices(device_id),
      source TEXT NOT NULL,
      intent TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      desktop_device_id TEXT REFERENCES wisdo_devices(device_id),
      account_id TEXT,
      parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
      spoken_text TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      priority INTEGER NOT NULL DEFAULT 50,
      attempts INTEGER NOT NULL DEFAULT 0,
      leased_by_device_id TEXT REFERENCES wisdo_devices(device_id),
      lease_expires_at TIMESTAMPTZ,
      result JSONB NOT NULL DEFAULT '{}'::jsonb,
      result_message TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wisdo_commands_agent_queue ON wisdo_commands(desktop_device_id, status, priority DESC, created_at);
    CREATE INDEX IF NOT EXISTS idx_wisdo_commands_owner_created ON wisdo_commands(owner_user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS wisdo_command_audit (
      id BIGSERIAL PRIMARY KEY,
      command_id UUID NOT NULL REFERENCES wisdo_commands(command_id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      actor_id TEXT,
      detail JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wisdo_command_audit_command ON wisdo_command_audit(command_id, created_at);
  `);
console.log('WISDO PostgreSQL v8.0.1 command-bus and MT4 pairing migration complete.');
} finally { await pool.end(); }
