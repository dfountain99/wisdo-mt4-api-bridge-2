CREATE TABLE IF NOT EXISTS wisdo_presence_studio (
  owner_user_id text PRIMARY KEY,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  runtime jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS wisdo_presence_sources (
  source_id uuid PRIMARY KEY,
  owner_user_id text NOT NULL REFERENCES wisdo_presence_studio(owner_user_id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('phone','door','occupancy')),
  token_hash text NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz,
  state text,
  state_since timestamptz,
  last_event_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wisdo_presence_sources_owner ON wisdo_presence_sources(owner_user_id);
