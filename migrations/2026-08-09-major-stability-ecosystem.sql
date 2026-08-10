BEGIN;

CREATE TABLE IF NOT EXISTS wisdo_mt4_accounts (
  account_id TEXT PRIMARY KEY,
  discord_user_id TEXT NOT NULL,
  account_number TEXT NOT NULL,
  broker_server TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'connected',
  connection JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  latest_snapshot JSONB,
  connected_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE wisdo_mt4_accounts ADD COLUMN IF NOT EXISTS stable_account_id UUID DEFAULT gen_random_uuid();
UPDATE wisdo_mt4_accounts SET stable_account_id=gen_random_uuid() WHERE stable_account_id IS NULL;
ALTER TABLE wisdo_mt4_accounts ALTER COLUMN stable_account_id SET DEFAULT gen_random_uuid();
ALTER TABLE wisdo_mt4_accounts ALTER COLUMN stable_account_id SET NOT NULL;
ALTER TABLE wisdo_mt4_accounts ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
ALTER TABLE wisdo_mt4_accounts ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE wisdo_mt4_accounts ADD COLUMN IF NOT EXISTS broker_name TEXT;
ALTER TABLE wisdo_mt4_accounts ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE wisdo_mt4_accounts ADD COLUMN IF NOT EXISTS reporter_instance_id TEXT;
ALTER TABLE wisdo_mt4_accounts ADD COLUMN IF NOT EXISTS terminal_id TEXT;
ALTER TABLE wisdo_mt4_accounts ADD COLUMN IF NOT EXISTS reporter_version TEXT;
ALTER TABLE wisdo_mt4_accounts ADD COLUMN IF NOT EXISTS terminal_version TEXT;
ALTER TABLE wisdo_mt4_accounts ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;
ALTER TABLE wisdo_mt4_accounts ADD COLUMN IF NOT EXISTS last_snapshot_at TIMESTAMPTZ;
ALTER TABLE wisdo_mt4_accounts ADD COLUMN IF NOT EXISTS last_command_poll_at TIMESTAMPTZ;
ALTER TABLE wisdo_mt4_accounts ADD COLUMN IF NOT EXISTS last_command_completed_at TIMESTAMPTZ;
ALTER TABLE wisdo_mt4_accounts ADD COLUMN IF NOT EXISTS health TEXT NOT NULL DEFAULT 'UNLINKED';
UPDATE wisdo_mt4_accounts SET owner_user_id=discord_user_id WHERE owner_user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_wisdo_mt4_stable_account ON wisdo_mt4_accounts(stable_account_id);
CREATE INDEX IF NOT EXISTS idx_wisdo_mt4_owner_health ON wisdo_mt4_accounts(owner_user_id,health,last_heartbeat_at DESC);
CREATE INDEX IF NOT EXISTS idx_wisdo_mt4_reporter_instance ON wisdo_mt4_accounts(reporter_instance_id,terminal_id);

CREATE TABLE IF NOT EXISTS wisdo_account_aliases (
  owner_user_id TEXT NOT NULL,
  stable_account_id UUID NOT NULL,
  alias TEXT NOT NULL,
  alias_normalized TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(owner_user_id,alias_normalized),
  FOREIGN KEY(stable_account_id) REFERENCES wisdo_mt4_accounts(stable_account_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_wisdo_account_alias_target ON wisdo_account_aliases(stable_account_id);

CREATE TABLE IF NOT EXISTS wisdo_user_trading_preferences (
  owner_user_id TEXT PRIMARY KEY,
  active_account_id UUID REFERENCES wisdo_mt4_accounts(stable_account_id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wisdo_reporter_health (
  stable_account_id UUID PRIMARY KEY REFERENCES wisdo_mt4_accounts(stable_account_id) ON DELETE CASCADE,
  reporter_instance_id TEXT,
  terminal_id TEXT,
  last_heartbeat_at TIMESTAMPTZ,
  last_snapshot_at TIMESTAMPTZ,
  last_command_poll_at TIMESTAMPTZ,
  last_command_completed_at TIMESTAMPTZ,
  average_sync_latency_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  health TEXT NOT NULL DEFAULT 'UNLINKED',
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wisdo_commands ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE wisdo_commands ADD COLUMN IF NOT EXISTS reporter_instance_id TEXT;
ALTER TABLE wisdo_commands ADD COLUMN IF NOT EXISTS lane_id TEXT;
ALTER TABLE wisdo_commands ADD COLUMN IF NOT EXISTS symbol TEXT;
ALTER TABLE wisdo_commands ADD COLUMN IF NOT EXISTS magic_number BIGINT;
ALTER TABLE wisdo_commands ADD COLUMN IF NOT EXISTS safety_level TEXT NOT NULL DEFAULT 'LOW';
ALTER TABLE wisdo_commands ADD COLUMN IF NOT EXISTS canonical_status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE wisdo_commands ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE wisdo_commands ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE wisdo_commands ADD COLUMN IF NOT EXISTS error_code TEXT;
ALTER TABLE wisdo_commands ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_wisdo_commands_owner_idempotency ON wisdo_commands(owner_user_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wisdo_commands_account_lifecycle ON wisdo_commands(owner_user_id,account_id,canonical_status,created_at DESC);

CREATE TABLE IF NOT EXISTS wisdo_discord_interactions (
  interaction_id TEXT PRIMARY KEY,
  command_name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  guild_id TEXT,
  account_id TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  acknowledged_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result TEXT,
  error_code TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_wisdo_interactions_latency ON wisdo_discord_interactions(command_name,started_at DESC);

CREATE TABLE IF NOT EXISTS wisdo_desks (
  desk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'PLANNED',
  desired_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  actual_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(guild_id,owner_user_id)
);

CREATE TABLE IF NOT EXISTS wisdo_copier_routes (
  route_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL,
  master_account_id UUID NOT NULL REFERENCES wisdo_mt4_accounts(stable_account_id),
  follower_account_id UUID NOT NULL REFERENCES wisdo_mt4_accounts(stable_account_id),
  symbol_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  lot_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  execution_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(master_account_id,follower_account_id)
);

CREATE TABLE IF NOT EXISTS wisdo_copier_events (
  copier_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES wisdo_copier_routes(route_id) ON DELETE CASCADE,
  source_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE(route_id,source_event_id,event_type)
);
CREATE INDEX IF NOT EXISTS idx_wisdo_copier_events_pending ON wisdo_copier_events(status,created_at);

CREATE TABLE IF NOT EXISTS wisdo_copied_trade_map (
  route_id UUID NOT NULL REFERENCES wisdo_copier_routes(route_id) ON DELETE CASCADE,
  source_ticket TEXT NOT NULL,
  follower_ticket TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  source_event_id TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  PRIMARY KEY(route_id,source_ticket)
);

CREATE TABLE IF NOT EXISTS wisdo_bot_lanes (
  lane_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id TEXT NOT NULL,
  stable_account_id UUID NOT NULL REFERENCES wisdo_mt4_accounts(stable_account_id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL,
  magic_number BIGINT,
  symbol TEXT,
  ea_name TEXT NOT NULL,
  version TEXT,
  chart_timeframe TEXT,
  status TEXT NOT NULL DEFAULT 'UNKNOWN',
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(stable_account_id,bot_id,magic_number,symbol)
);

CREATE TABLE IF NOT EXISTS wisdo_presence_profiles (
  owner_user_id TEXT PRIMARY KEY,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  last_daily_greeting_date DATE,
  last_greeting_type TEXT,
  last_greeting_at TIMESTAMPTZ,
  dismissed_notices JSONB NOT NULL DEFAULT '[]'::jsonb,
  onboarding_progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wisdo_payment_events (
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  owner_user_id TEXT,
  amount_cents BIGINT,
  currency TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(provider,provider_event_id)
);

CREATE TABLE IF NOT EXISTS wisdo_affiliate_ledger (
  entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id TEXT NOT NULL,
  sale_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  entry_type TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wisdo_affiliate_balance ON wisdo_affiliate_ledger(affiliate_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS wisdo_operational_metrics (
  metric_id BIGSERIAL PRIMARY KEY,
  metric_name TEXT NOT NULL,
  correlation_id TEXT,
  duration_ms DOUBLE PRECISION,
  value DOUBLE PRECISION,
  tags JSONB NOT NULL DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wisdo_metrics_name_time ON wisdo_operational_metrics(metric_name,recorded_at DESC);

COMMIT;
