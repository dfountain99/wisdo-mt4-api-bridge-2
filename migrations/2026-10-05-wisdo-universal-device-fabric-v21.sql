-- WISDO V21 Universal Device Fabric
-- Additive ownership/approval gate for smart-home discovery.

ALTER TABLE IF EXISTS wisdo_components ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE IF EXISTS wisdo_components ADD COLUMN IF NOT EXISTS home_id TEXT;
ALTER TABLE IF EXISTS wisdo_components ADD COLUMN IF NOT EXISTS adapter_id TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE IF EXISTS wisdo_components ADD COLUMN IF NOT EXISTS protocols JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS wisdo_components ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS wisdo_components ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE IF EXISTS wisdo_components ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS wisdo_components ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Legacy Home Assistant rows are quarantined exactly once: after the column
-- appears they have no approval actor/timestamp. Later approvals/revocations
-- retain their lifecycle on repeat migration runs.
UPDATE wisdo_components
SET approval_status='pending'
WHERE approval_status='approved'
  AND approved_at IS NULL
  AND approved_by IS NULL
  AND metadata->>'provider'='home_assistant';

CREATE INDEX IF NOT EXISTS idx_wisdo_components_approval
  ON wisdo_components(owner_user_id,approval_status,home_id,component_type);
CREATE INDEX IF NOT EXISTS idx_wisdo_components_adapter
  ON wisdo_components(owner_user_id,adapter_id,status,last_seen_at DESC);

CREATE TABLE IF NOT EXISTS wisdo_homes (
  home_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_user_id,name)
);
CREATE INDEX IF NOT EXISTS idx_wisdo_homes_owner ON wisdo_homes(owner_user_id,status,name);

CREATE TABLE IF NOT EXISTS wisdo_adapter_bindings (
  binding_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  home_id TEXT,
  edge_device_id TEXT,
  adapter_id TEXT NOT NULL,
  source_instance_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_user_id,edge_device_id,adapter_id,source_instance_id)
);
CREATE INDEX IF NOT EXISTS idx_wisdo_adapter_bindings_owner
  ON wisdo_adapter_bindings(owner_user_id,status,adapter_id);
