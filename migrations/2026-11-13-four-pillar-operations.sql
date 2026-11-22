
-- WISDO Four-Pillar Operations: real device telemetry, camera events and supervised recovery.
-- Every mutable row is owner scoped. No synthetic accounts, video streams or execution receipts.
CREATE TABLE IF NOT EXISTS wisdo_os_nodes (
  owner_user_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  device_id TEXT NOT NULL REFERENCES wisdo_devices(device_id) ON DELETE CASCADE,
  node_name TEXT NOT NULL,
  node_role TEXT NOT NULL CHECK (node_role IN ('vps','desktop','edge','worker')),
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_user_id,node_id)
);
CREATE INDEX IF NOT EXISTS wisdo_os_nodes_device_idx ON wisdo_os_nodes(owner_user_id,device_id,last_seen_at DESC);

CREATE TABLE IF NOT EXISTS wisdo_sentinel_events (
  owner_user_id TEXT NOT NULL,
  component_id TEXT NOT NULL REFERENCES wisdo_components(component_id) ON DELETE RESTRICT,
  source_event_id TEXT NOT NULL,
  source_device_id TEXT NOT NULL REFERENCES wisdo_devices(device_id),
  event_type TEXT NOT NULL CHECK (event_type IN ('motion','person','vehicle','animal','package','sound','tamper','unknown')),
  confidence DOUBLE PRECISION,
  severity TEXT NOT NULL CHECK (severity IN ('info','attention','critical')),
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (owner_user_id,component_id,source_event_id)
);
CREATE INDEX IF NOT EXISTS wisdo_sentinel_events_recent_idx ON wisdo_sentinel_events(owner_user_id,received_at DESC);
CREATE INDEX IF NOT EXISTS wisdo_sentinel_events_camera_idx ON wisdo_sentinel_events(owner_user_id,component_id,occurred_at DESC);

CREATE TABLE IF NOT EXISTS wisdo_os_recoveries (
  recovery_id UUID PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  requested_by_device_id TEXT NOT NULL REFERENCES wisdo_devices(device_id),
  target_device_id TEXT NOT NULL REFERENCES wisdo_devices(device_id),
  action TEXT NOT NULL CHECK (action = 'restart_wisdo_worker'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','queued','failed','expired')),
  queued_command_id TEXT,
  error_message TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS wisdo_os_recoveries_owner_idx ON wisdo_os_recoveries(owner_user_id,created_at DESC);
