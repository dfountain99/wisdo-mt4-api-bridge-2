BEGIN;

CREATE TABLE IF NOT EXISTS wisdo_voice_devices (
  device_id TEXT PRIMARY KEY REFERENCES wisdo_devices(device_id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL,
  room_id TEXT,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  listening BOOLEAN NOT NULL DEFAULT FALSE,
  response_format TEXT NOT NULL DEFAULT 'audio_reference',
  last_heartbeat_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wisdo_voice_devices_owner ON wisdo_voice_devices(owner_user_id, last_heartbeat_at DESC);
ALTER TABLE wisdo_voice_devices ADD COLUMN IF NOT EXISTS led_state TEXT NOT NULL DEFAULT 'idle';
ALTER TABLE wisdo_voice_devices ADD COLUMN IF NOT EXISTS current_delivery_id UUID;

CREATE TABLE IF NOT EXISTS wisdo_conversation_sessions (
  session_id UUID PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  device_id TEXT REFERENCES wisdo_devices(device_id),
  discord_user_id TEXT,
  channel TEXT NOT NULL DEFAULT 'device',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed','cancelled','expired')),
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  pending_clarification JSONB,
  active_plan_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wisdo_sessions_owner_status ON wisdo_conversation_sessions(owner_user_id, status, last_interaction_at DESC);
CREATE INDEX IF NOT EXISTS idx_wisdo_sessions_device ON wisdo_conversation_sessions(device_id, status, expires_at);

CREATE TABLE IF NOT EXISTS wisdo_conversation_messages (
  message_id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES wisdo_conversation_sessions(session_id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  intent JSONB,
  response_state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wisdo_messages_session ON wisdo_conversation_messages(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS wisdo_daily_plans (
  plan_id UUID PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Today''s Plan',
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','AWAITING_INFORMATION','AWAITING_CONFIRMATION','ACTIVE','PAUSED','COMPLETED','CANCELLED','FAILED')),
  account_ids TEXT[] NOT NULL DEFAULT '{}',
  bot_ids TEXT[] NOT NULL DEFAULT '{}',
  copier_lanes TEXT[] NOT NULL DEFAULT '{}',
  symbols TEXT[] NOT NULL DEFAULT '{}',
  timeframes TEXT[] NOT NULL DEFAULT '{}',
  directions TEXT[] NOT NULL DEFAULT '{}',
  risk JSONB NOT NULL DEFAULT '{}'::jsonb,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  targets JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_actions TEXT[] NOT NULL DEFAULT '{}',
  reset_policy TEXT NOT NULL DEFAULT 'NEXT_TRADING_DAY',
  raw_conversation JSONB NOT NULL DEFAULT '[]'::jsonb,
  confirmation_required BOOLEAN NOT NULL DEFAULT TRUE,
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_user_id, name, version)
);
CREATE INDEX IF NOT EXISTS idx_wisdo_plans_owner_status ON wisdo_daily_plans(owner_user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_wisdo_plans_accounts ON wisdo_daily_plans USING GIN(account_ids);
ALTER TABLE wisdo_daily_plans ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York';
ALTER TABLE wisdo_daily_plans ADD COLUMN IF NOT EXISTS trading_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}';
ALTER TABLE wisdo_daily_plans ADD COLUMN IF NOT EXISTS automatic_reset BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE wisdo_daily_plans ADD COLUMN IF NOT EXISTS reset_at_local TIME NOT NULL DEFAULT '00:00';
ALTER TABLE wisdo_daily_plans ADD COLUMN IF NOT EXISTS parent_plan_id UUID REFERENCES wisdo_daily_plans(plan_id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS wisdo_plan_templates (
  template_id UUID PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  trading_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  automatic_reset BOOLEAN NOT NULL DEFAULT FALSE,
  plan_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_user_id,name)
);
CREATE INDEX IF NOT EXISTS idx_wisdo_plan_templates_owner ON wisdo_plan_templates(owner_user_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS wisdo_plan_versions (
  version_id UUID PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES wisdo_daily_plans(plan_id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plan_id,version)
);
CREATE INDEX IF NOT EXISTS idx_wisdo_plan_versions_plan ON wisdo_plan_versions(plan_id,version DESC);

ALTER TABLE wisdo_conversation_sessions DROP CONSTRAINT IF EXISTS fk_wisdo_sessions_plan;
ALTER TABLE wisdo_conversation_sessions ADD CONSTRAINT fk_wisdo_sessions_plan FOREIGN KEY(active_plan_id) REFERENCES wisdo_daily_plans(plan_id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS wisdo_plan_rules (
  rule_id UUID PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES wisdo_daily_plans(plan_id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING',
  supported BOOLEAN NOT NULL DEFAULT FALSE,
  command_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wisdo_plan_rules_active ON wisdo_plan_rules(owner_user_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_wisdo_plan_rules_plan ON wisdo_plan_rules(plan_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wisdo_plan_rules_unique_type ON wisdo_plan_rules(plan_id, rule_type);

CREATE TABLE IF NOT EXISTS wisdo_plan_targets (
  target_id UUID PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES wisdo_daily_plans(plan_id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  threshold NUMERIC NOT NULL,
  current_value NUMERIC,
  status TEXT NOT NULL DEFAULT 'ARMED',
  action_names TEXT[] NOT NULL DEFAULT '{}',
  triggered_at TIMESTAMPTZ,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wisdo_plan_targets_check ON wisdo_plan_targets(status, checked_at, owner_user_id);

CREATE TABLE IF NOT EXISTS wisdo_plan_execution_events (
  event_id UUID PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES wisdo_daily_plans(plan_id) ON DELETE CASCADE,
  rule_id UUID REFERENCES wisdo_plan_rules(rule_id) ON DELETE SET NULL,
  command_id TEXT,
  owner_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wisdo_plan_events ON wisdo_plan_execution_events(plan_id, created_at DESC);

CREATE TABLE IF NOT EXISTS wisdo_pending_confirmations (
  confirmation_id UUID PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  session_id UUID NOT NULL REFERENCES wisdo_conversation_sessions(session_id) ON DELETE CASCADE,
  device_id TEXT,
  action_type TEXT NOT NULL,
  action_hash TEXT NOT NULL,
  account_ids TEXT[] NOT NULL DEFAULT '{}',
  bot_id TEXT,
  plan_id UUID REFERENCES wisdo_daily_plans(plan_id) ON DELETE CASCADE,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  safety_level TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','EXPIRED','CANCELLED','CONSUMED')),
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wisdo_confirmations_pending ON wisdo_pending_confirmations(owner_user_id, session_id, status, expires_at);

CREATE TABLE IF NOT EXISTS wisdo_command_receipts (
  receipt_id UUID PRIMARY KEY,
  command_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  account_id TEXT,
  plan_id UUID REFERENCES wisdo_daily_plans(plan_id) ON DELETE SET NULL,
  lifecycle_status TEXT NOT NULL CHECK (lifecycle_status IN ('PENDING','DELIVERED','ACKNOWLEDGED','COMPLETED','FAILED','EXPIRED','CANCELLED')),
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  failure_reason TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(command_id, lifecycle_status, received_at)
);
CREATE INDEX IF NOT EXISTS idx_wisdo_receipts_command ON wisdo_command_receipts(command_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_wisdo_receipts_owner ON wisdo_command_receipts(owner_user_id, lifecycle_status, received_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wisdo_receipts_terminal_dedupe
  ON wisdo_command_receipts(command_id, lifecycle_status)
  WHERE lifecycle_status IN ('PENDING','COMPLETED','FAILED');

CREATE TABLE IF NOT EXISTS wisdo_voice_utterances (
  utterance_id UUID PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  device_id TEXT NOT NULL REFERENCES wisdo_devices(device_id) ON DELETE CASCADE,
  room_id TEXT,
  session_id UUID REFERENCES wisdo_conversation_sessions(session_id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RECEIVED','PROCESSING','COMPLETED','FAILED','CANCELLED')),
  content_type TEXT NOT NULL,
  audio_size_bytes INTEGER NOT NULL CHECK (audio_size_bytes >= 0),
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  transcript TEXT,
  transcription_confidence NUMERIC,
  response JSONB,
  error_code TEXT,
  error_message TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(device_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_wisdo_utterances_owner_created ON wisdo_voice_utterances(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wisdo_utterances_expiry ON wisdo_voice_utterances(expires_at, status);

CREATE TABLE IF NOT EXISTS wisdo_speech_deliveries (
  delivery_id UUID PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  device_id TEXT NOT NULL REFERENCES wisdo_devices(device_id) ON DELETE CASCADE,
  session_id UUID REFERENCES wisdo_conversation_sessions(session_id) ON DELETE SET NULL,
  utterance_id UUID REFERENCES wisdo_voice_utterances(utterance_id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  status TEXT NOT NULL CHECK (status IN ('QUEUED','OFFERED','DELIVERED','PLAYING','PLAYED','FAILED','CANCELLED','EXPIRED')),
  response_text TEXT NOT NULL,
  content_type TEXT NOT NULL,
  audio_data BYTEA,
  audio_size_bytes INTEGER NOT NULL CHECK (audio_size_bytes >= 0),
  attempts INTEGER NOT NULL DEFAULT 0,
  offer_expires_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  delivered_at TIMESTAMPTZ,
  playback_started_at TIMESTAMPTZ,
  played_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(device_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_wisdo_speech_delivery_poll ON wisdo_speech_deliveries(device_id, status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_wisdo_speech_delivery_expiry ON wisdo_speech_deliveries(expires_at, status);
ALTER TABLE wisdo_voice_devices DROP CONSTRAINT IF EXISTS fk_wisdo_voice_current_delivery;
ALTER TABLE wisdo_voice_devices ADD CONSTRAINT fk_wisdo_voice_current_delivery FOREIGN KEY(current_delivery_id) REFERENCES wisdo_speech_deliveries(delivery_id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS wisdo_conditional_rule_state (
  rule_id UUID PRIMARY KEY REFERENCES wisdo_plan_rules(rule_id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'ARMED',
  last_value NUMERIC,
  last_checked_at TIMESTAMPTZ,
  last_triggered_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wisdo_conditions_check ON wisdo_conditional_rule_state(state, last_checked_at, account_id);

CREATE TABLE IF NOT EXISTS wisdo_education_progress (
  owner_user_id TEXT PRIMARY KEY,
  current_course TEXT,
  current_lesson TEXT,
  completed_lessons TEXT[] NOT NULL DEFAULT '{}',
  quiz_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_recommended_lesson TEXT,
  last_activity_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wisdo_notification_deduplication (
  owner_user_id TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(owner_user_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_wisdo_notification_expiry ON wisdo_notification_deduplication(expires_at);

CREATE TABLE IF NOT EXISTS wisdo_conversation_audit (
  audit_id BIGSERIAL PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  session_id UUID,
  actor_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  correlation_id TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wisdo_conversation_audit_owner ON wisdo_conversation_audit(owner_user_id, created_at DESC);

COMMIT;
