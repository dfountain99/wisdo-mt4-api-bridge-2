-- WISDO V23 Ambient Life OS
-- Cross-domain missions, household permissions, room zones, policy guardrails,
-- simulation and truth-ledger state.

CREATE TABLE IF NOT EXISTS wisdo_life_zones (
  zone_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  home_id TEXT NOT NULL,
  name TEXT NOT NULL,
  zone_type TEXT NOT NULL DEFAULT 'room',
  privacy_level INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_user_id,home_id,name)
);
CREATE INDEX IF NOT EXISTS idx_wisdo_life_zones_owner ON wisdo_life_zones(owner_user_id,home_id,name);

CREATE TABLE IF NOT EXISTS wisdo_household_members (
  member_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  home_id TEXT,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wisdo_household_members_owner ON wisdo_household_members(owner_user_id,home_id,status,role);

CREATE TABLE IF NOT EXISTS wisdo_life_policies (
  policy_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  home_id TEXT,
  name TEXT NOT NULL,
  effect TEXT NOT NULL,
  match JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wisdo_life_policies_owner ON wisdo_life_policies(owner_user_id,home_id,enabled);

CREATE TABLE IF NOT EXISTS wisdo_ambient_missions (
  mission_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  home_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_sources JSONB NOT NULL DEFAULT '["manual","voice"]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wisdo_ambient_missions_owner ON wisdo_ambient_missions(owner_user_id,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS wisdo_mission_runs (
  run_id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL,
  simulation JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_wisdo_mission_runs_owner ON wisdo_mission_runs(owner_user_id,created_at DESC,status);

CREATE TABLE IF NOT EXISTS wisdo_mission_truth_events (
  event_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wisdo_mission_truth_run ON wisdo_mission_truth_events(owner_user_id,run_id,created_at);

CREATE TABLE IF NOT EXISTS wisdo_life_context (
  owner_user_id TEXT NOT NULL,
  home_id TEXT,
  current_mode TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wisdo_life_context_owner_home ON wisdo_life_context(owner_user_id,COALESCE(home_id,''));

CREATE TABLE IF NOT EXISTS wisdo_local_routine_manifests (
  manifest_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  home_id TEXT,
  manifest JSONB NOT NULL,
  manifest_hash TEXT NOT NULL,
  signature TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wisdo_local_routine_manifests_owner ON wisdo_local_routine_manifests(owner_user_id,mission_id,created_at DESC);
