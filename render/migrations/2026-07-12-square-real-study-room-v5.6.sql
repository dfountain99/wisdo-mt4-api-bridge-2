-- WISDO V5.6 Square checkout + real historical Study Room
-- Additive migration; legacy Stripe columns are retained only for backward-compatible data import.

alter table if exists public.subscriptions
  add column if not exists payment_provider text default 'square',
  add column if not exists square_customer_id text,
  add column if not exists square_subscription_id text,
  add column if not exists square_payment_link_id text,
  add column if not exists square_order_id text,
  add column if not exists square_plan_variation_id text;

create unique index if not exists subscriptions_square_subscription_idx
  on public.subscriptions(square_subscription_id)
  where square_subscription_id is not null;

alter table if exists public.affiliate_conversions
  add column if not exists payment_provider text default 'square',
  add column if not exists square_payment_id text,
  add column if not exists square_order_id text,
  add column if not exists square_customer_id text;

create table if not exists public.square_webhook_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz default now(),
  payload jsonb default '{}'::jsonb
);

create table if not exists public.study_room_market_examples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  session_id text not null,
  symbol text not null,
  provider_symbol text,
  interval text not null,
  source_name text not null,
  source_url text,
  range_start timestamptz not null,
  range_end timestamptz not null,
  candle_count integer not null check(candle_count >= 32),
  candles jsonb not null,
  annotations jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
