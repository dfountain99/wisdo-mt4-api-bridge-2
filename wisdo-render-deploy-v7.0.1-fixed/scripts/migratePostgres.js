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
  `);
  console.log('WISDO PostgreSQL v6 reliability migration complete.');
} finally { await pool.end(); }
