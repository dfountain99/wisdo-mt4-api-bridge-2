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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wisdo_capabilities (
      capability_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, provider_type TEXT NOT NULL, provider_id TEXT NOT NULL,
      capability_key TEXT NOT NULL, kind TEXT NOT NULL, risk_level TEXT NOT NULL DEFAULT 'low', requires_confirmation BOOLEAN NOT NULL DEFAULT FALSE,
      parameters JSONB NOT NULL DEFAULT '{}'::jsonb, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(owner_user_id,provider_type,provider_id,capability_key)
    );
    CREATE INDEX IF NOT EXISTS idx_wisdo_capabilities_owner ON wisdo_capabilities(owner_user_id,status,capability_key);

    CREATE TABLE IF NOT EXISTS wisdo_runtime_instances (
      instance_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, bot_family TEXT NOT NULL, device_id TEXT, terminal_id TEXT, account_id TEXT,
      broker TEXT, symbol TEXT NOT NULL, timeframe TEXT, magic_number BIGINT, chart_id TEXT, culture_lane_id TEXT, campaign_id TEXT,
      capabilities JSONB NOT NULL DEFAULT '[]'::jsonb, status TEXT NOT NULL DEFAULT 'online', last_seen_at TIMESTAMPTZ,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wisdo_instances_scope ON wisdo_runtime_instances(owner_user_id,bot_family,account_id,symbol,status);

    CREATE TABLE IF NOT EXISTS wisdo_behaviors (
      behavior_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, name TEXT NOT NULL, purpose TEXT, scope_level TEXT NOT NULL,
      scope JSONB NOT NULL DEFAULT '{}'::jsonb, definition JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'draft', current_version INTEGER NOT NULL DEFAULT 1,
      source_type TEXT NOT NULL DEFAULT 'voice', source_text TEXT, risk_level TEXT NOT NULL DEFAULT 'low', approval_required BOOLEAN NOT NULL DEFAULT FALSE,
      approved_by TEXT, approved_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wisdo_behaviors_scope ON wisdo_behaviors(owner_user_id,status,scope_level);

    CREATE TABLE IF NOT EXISTS wisdo_behavior_versions (
      id BIGSERIAL PRIMARY KEY, behavior_id TEXT NOT NULL REFERENCES wisdo_behaviors(behavior_id) ON DELETE CASCADE, version INTEGER NOT NULL,
      definition JSONB NOT NULL, change_summary TEXT, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(behavior_id,version)
    );

    CREATE TABLE IF NOT EXISTS wisdo_behavior_deployments (
      deployment_id TEXT PRIMARY KEY, behavior_id TEXT NOT NULL REFERENCES wisdo_behaviors(behavior_id), behavior_version INTEGER NOT NULL,
      owner_user_id TEXT NOT NULL, target_instances JSONB NOT NULL DEFAULT '[]'::jsonb, mode TEXT NOT NULL DEFAULT 'shadow', state TEXT NOT NULL DEFAULT 'pending',
      effective_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, result JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wisdo_promises (
      promise_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, name TEXT NOT NULL, condition_definition JSONB NOT NULL,
      action_definition JSONB NOT NULL, cancel_definition JSONB NOT NULL DEFAULT '{}'::jsonb, state TEXT NOT NULL DEFAULT 'armed',
      expires_at TIMESTAMPTZ, fulfilled_at TIMESTAMPTZ, canceled_at TIMESTAMPTZ, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wisdo_promises_state ON wisdo_promises(owner_user_id,state,expires_at);

    CREATE TABLE IF NOT EXISTS wisdo_experiences (
      experience_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, name TEXT NOT NULL, definition JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', current_version INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wisdo_voice_genomes (
      voice_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, name TEXT NOT NULL, source_type TEXT NOT NULL,
      identity JSONB NOT NULL DEFAULT '{}'::jsonb, vocal_character JSONB NOT NULL DEFAULT '{}'::jsonb, delivery JSONB NOT NULL DEFAULT '{}'::jsonb,
      consent JSONB NOT NULL DEFAULT '{}'::jsonb, assignments JSONB NOT NULL DEFAULT '[]'::jsonb, status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wisdo_conversation_context (
      context_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, session_id TEXT NOT NULL, reference_state JSONB NOT NULL DEFAULT '{}'::jsonb,
      current_mission JSONB NOT NULL DEFAULT '{}'::jsonb, pending_clarification JSONB NOT NULL DEFAULT '{}'::jsonb,
      expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(owner_user_id,session_id)
    );

    CREATE TABLE IF NOT EXISTS wisdo_trade_history (
      trade_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, account_id TEXT, bot_family TEXT, instance_id TEXT, symbol TEXT NOT NULL,
      timeframe TEXT, profit DOUBLE PRECISION NOT NULL DEFAULT 0, opened_at TIMESTAMPTZ, closed_at TIMESTAMPTZ NOT NULL,
      passport JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wisdo_trade_history_analysis ON wisdo_trade_history(owner_user_id,closed_at DESC,symbol,account_id,bot_family);

    CREATE TABLE IF NOT EXISTS wisdo_simulations (
      simulation_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, behavior_id TEXT, input_definition JSONB NOT NULL,
      result JSONB NOT NULL DEFAULT '{}'::jsonb, status TEXT NOT NULL DEFAULT 'queued', started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wisdo_broker_symbols (
      owner_user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      broker TEXT NOT NULL,
      broker_symbol TEXT NOT NULL,
      canonical_symbol TEXT NOT NULL,
      asset_class TEXT NOT NULL DEFAULT 'unknown',
      base_asset TEXT,
      quote_asset TEXT,
      trade_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      visible BOOLEAN NOT NULL DEFAULT TRUE,
      market_open BOOLEAN,
      min_lot DOUBLE PRECISION,
      max_lot DOUBLE PRECISION,
      lot_step DOUBLE PRECISION,
      digits INTEGER,
      point_size DOUBLE PRECISION,
      stop_level DOUBLE PRECISION,
      spread DOUBLE PRECISION,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(owner_user_id, account_id, broker_symbol)
    );
    CREATE INDEX IF NOT EXISTS idx_wisdo_broker_symbols_canonical ON wisdo_broker_symbols(owner_user_id, canonical_symbol, account_id);
    CREATE INDEX IF NOT EXISTS idx_wisdo_broker_symbols_compatibility ON wisdo_broker_symbols(owner_user_id, account_id, trade_enabled, visible, asset_class);

    CREATE TABLE IF NOT EXISTS wisdo_symbol_aliases (
      owner_user_id TEXT NOT NULL,
      alias TEXT NOT NULL,
      canonical_symbol TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'user',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(owner_user_id, alias)
    );

    CREATE TABLE IF NOT EXISTS wisdo_symbol_groups (
      group_id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      selector JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(owner_user_id, name)
    );

    CREATE TABLE IF NOT EXISTS wisdo_voice_versions (
      id BIGSERIAL PRIMARY KEY, voice_id TEXT NOT NULL REFERENCES wisdo_voice_genomes(voice_id) ON DELETE CASCADE, version INTEGER NOT NULL,
      definition JSONB NOT NULL, change_summary TEXT, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(voice_id,version)
    );

    CREATE TABLE IF NOT EXISTS wisdo_voice_assignments (
      assignment_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, voice_id TEXT NOT NULL REFERENCES wisdo_voice_genomes(voice_id) ON DELETE CASCADE,
      scope_type TEXT NOT NULL DEFAULT 'user_default', scope_id TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 100, status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wisdo_voice_assignments_active ON wisdo_voice_assignments(owner_user_id,scope_type,scope_id,status,priority DESC);

    CREATE TABLE IF NOT EXISTS wisdo_voice_events (
      event_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, voice_id TEXT, event_type TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );



    CREATE TABLE IF NOT EXISTS wisdo_components (
      component_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, device_id TEXT,
      component_type TEXT NOT NULL, name TEXT NOT NULL, aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
      capabilities JSONB NOT NULL DEFAULT '{}'::jsonb, state JSONB NOT NULL DEFAULT '{}'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb, status TEXT NOT NULL DEFAULT 'online',
      last_seen_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wisdo_components_owner_type ON wisdo_components(owner_user_id,component_type,status,last_seen_at DESC);

    CREATE TABLE IF NOT EXISTS wisdo_control_executions (
      execution_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, issued_by_device_id TEXT,
      component_id TEXT NOT NULL REFERENCES wisdo_components(component_id) ON DELETE CASCADE,
      action TEXT NOT NULL, parameters JSONB NOT NULL DEFAULT '{}'::jsonb, risk_level INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'queued', result JSONB, error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      leased_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wisdo_control_queue ON wisdo_control_executions(component_id,status,created_at);

    CREATE TABLE IF NOT EXISTS wisdo_browser_events (
      event_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, issued_by_device_id TEXT,
      target_session_id TEXT, action TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'pending', expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), delivered_at TIMESTAMPTZ, acknowledged_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_wisdo_browser_events_pending ON wisdo_browser_events(owner_user_id,status,expires_at,created_at);

    CREATE TABLE IF NOT EXISTS wisdo_missions (
      mission_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, name TEXT NOT NULL, purpose TEXT,
      status TEXT NOT NULL DEFAULT 'active', priority INTEGER NOT NULL DEFAULT 50,
      state JSONB NOT NULL DEFAULT '{}'::jsonb, success_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), completed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS wisdo_event_ledger (
      event_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT,
      event_type TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'info', payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      correlation_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wisdo_event_ledger_owner_time ON wisdo_event_ledger(owner_user_id,created_at DESC);

    CREATE TABLE IF NOT EXISTS wisdo_intent_requests (
      request_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, issued_by_device_id TEXT, correlation_id TEXT NOT NULL,
      utterance TEXT NOT NULL, parsed_intent JSONB NOT NULL DEFAULT '{}'::jsonb, context JSONB NOT NULL DEFAULT '{}'::jsonb,
      risk_level INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'received', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wisdo_intents_owner_time ON wisdo_intent_requests(owner_user_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_wisdo_intents_correlation ON wisdo_intent_requests(owner_user_id,correlation_id);

    CREATE TABLE IF NOT EXISTS wisdo_action_plans (
      plan_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, request_id TEXT REFERENCES wisdo_intent_requests(request_id) ON DELETE CASCADE,
      correlation_id TEXT NOT NULL, plan_definition JSONB NOT NULL DEFAULT '{}'::jsonb, safety_checks JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'draft', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wisdo_action_plans_correlation ON wisdo_action_plans(owner_user_id,correlation_id,status);

    CREATE TABLE IF NOT EXISTS wisdo_kernel_memory (
      memory_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, memory_type TEXT NOT NULL, content TEXT NOT NULL,
      importance INTEGER NOT NULL DEFAULT 50, confidence INTEGER NOT NULL DEFAULT 80, source TEXT NOT NULL DEFAULT 'user',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wisdo_kernel_memory_owner ON wisdo_kernel_memory(owner_user_id,importance DESC,updated_at DESC);

    CREATE TABLE IF NOT EXISTS wisdo_live_workspaces (
      workspace_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, name TEXT NOT NULL, mode TEXT NOT NULL DEFAULT 'adaptive',
      layout JSONB NOT NULL DEFAULT '{}'::jsonb, filters JSONB NOT NULL DEFAULT '{}'::jsonb, active_context JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wisdo_live_workspaces_owner ON wisdo_live_workspaces(owner_user_id,status,updated_at DESC);

    CREATE TABLE IF NOT EXISTS wisdo_life_graph_nodes (
      node_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, node_type TEXT NOT NULL, name TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS wisdo_life_graph_edges (
      edge_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, from_node_id TEXT NOT NULL REFERENCES wisdo_life_graph_nodes(node_id) ON DELETE CASCADE,
      to_node_id TEXT NOT NULL REFERENCES wisdo_life_graph_nodes(node_id) ON DELETE CASCADE, relation_type TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

console.log('WISDO PostgreSQL v3.1 Phase 2–8 production migration complete.');
} finally { await pool.end(); }
