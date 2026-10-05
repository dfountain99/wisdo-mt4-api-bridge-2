CREATE TABLE IF NOT EXISTS wisdo_user_runtime_settings (
  owner_user_id TEXT PRIMARY KEY,
  presence JSONB NOT NULL DEFAULT '{}'::jsonb,
  workstation JSONB NOT NULL DEFAULT '{}'::jsonb,
  mt4 JSONB NOT NULL DEFAULT '{}'::jsonb,
  smart_home JSONB NOT NULL DEFAULT '{}'::jsonb,
  voice_notifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  authority JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wisdo_smart_home_scenes (
  scene_id UUID PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  room_id TEXT,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_user_id,name)
);
CREATE INDEX IF NOT EXISTS idx_wisdo_smart_home_scenes_owner ON wisdo_smart_home_scenes(owner_user_id,enabled,name);

CREATE TABLE IF NOT EXISTS wisdo_device_secrets (
  secret_id UUID PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  target_device_id TEXT NOT NULL REFERENCES wisdo_devices(device_id) ON DELETE CASCADE,
  secret_name TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wisdo_device_secrets_claim ON wisdo_device_secrets(target_device_id,status,expires_at);
