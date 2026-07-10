-- WISDO Major Product Pass V5
-- Source: wisdo-member-app-product-pass(1).zip
-- Target: Supabase/PostgreSQL. Run after reviewing existing enum/table names.

create extension if not exists pgcrypto;
create extension if not exists pg_net;

DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('user','premium','admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.trading_platform AS ENUM ('mt4','mt5','ctrader','matchtrader','tradelocker','dxtrade','ninjatrader','tradovate','projectx','rithmic'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.account_role AS ENUM ('master','slave'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.account_status AS ENUM ('connected','disconnected','error','paused'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.risk_type AS ENUM ('fixed_lot','multiplier','equity_ratio','balance_ratio'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.trade_status AS ENUM ('open','closed','cancelled','error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.trade_side AS ENUM ('buy','sell'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.plan_type AS ENUM ('standard','premium','futures'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.billing_cycle AS ENUM ('monthly','quarterly','semiannual','annual'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','cancelled','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.alert_type AS ENUM ('trade_opened','trade_closed','drawdown','equity_protection','news','system','copier','billing'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  country text,
  timezone text default 'UTC',
  discord_user_id text,
  affiliate_code text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null default 'user',
  created_at timestamptz default now(),
  unique(user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;

create table if not exists public.trading_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  platform public.trading_platform not null,
  broker text,
  account_number text not null,
  server text,
  role public.account_role not null,
  status public.account_status default 'disconnected',
  nickname text,
  balance numeric(18,2) default 0,
  equity numeric(18,2) default 0,
  margin numeric(18,2) default 0,
  free_margin numeric(18,2) default 0,
  currency text default 'USD',
  is_premium boolean default false,
  encrypted_credentials text,
  reporter_pairing_code_hash text,
  reporter_last_seen_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, platform, account_number, server)
);
create index if not exists trading_accounts_user_status_idx on public.trading_accounts(user_id,status);
create index if not exists trading_accounts_reporter_seen_idx on public.trading_accounts(reporter_last_seen_at desc);

create table if not exists public.account_shares (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.trading_accounts(id) on delete cascade not null,
  owner_user_id uuid references auth.users(id) on delete cascade not null,
  target_user_id uuid references auth.users(id) on delete cascade not null,
  permission text not null check(permission in ('view','signal_only','copy_allowed','control_allowed','admin')),
  status text not null default 'active' check(status in ('pending','active','revoked','rejected')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(account_id,target_user_id)
);

create table if not exists public.copier_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  master_id uuid references public.trading_accounts(id) on delete cascade not null,
  slave_id uuid references public.trading_accounts(id) on delete cascade not null,
  risk_type public.risk_type not null default 'multiplier',
  risk_value numeric(10,4) not null default 1,
  min_lot numeric(10,4) default 0.01,
  max_lot numeric(10,4) default 100,
  max_open_trades integer,
  equity_protection_pct numeric(6,2),
  max_daily_loss numeric(18,2),
  max_spread_points integer,
  allowed_symbols text[] default '{}',
  symbol_mapping jsonb default '{}',
  trading_hours_start time,
  trading_hours_end time,
  timezone text default 'UTC',
  is_active boolean default true,
  reverse_signals boolean default false,
  copy_sl_tp boolean default true,
  copy_pending_orders boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check(master_id <> slave_id)
);
create index if not exists copier_rules_master_active_idx on public.copier_rules(master_id,is_active);
create index if not exists copier_rules_slave_active_idx on public.copier_rules(slave_id,is_active);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  account_id uuid references public.trading_accounts(id) on delete cascade not null,
  copier_rule_id uuid references public.copier_rules(id) on delete set null,
  source_trade_id uuid references public.trades(id) on delete set null,
  external_ticket text,
  leader_ticket text,
  symbol text not null,
  leader_symbol text,
  follower_symbol text,
  side public.trade_side not null,
  lot_size numeric(10,4) not null,
  open_price numeric(18,8),
  close_price numeric(18,8),
  stop_loss numeric(18,8),
  take_profit numeric(18,8),
  commission numeric(18,2) default 0,
  swap numeric(18,2) default 0,
  pnl numeric(18,2),
  status public.trade_status default 'open',
  opened_at timestamptz default now(),
  closed_at timestamptz,
  copy_latency_ms integer,
  raw_payload jsonb default '{}'
);
create index if not exists trades_user_opened_idx on public.trades(user_id,opened_at desc);
create index if not exists trades_account_status_idx on public.trades(account_id,status);
create index if not exists trades_external_ticket_idx on public.trades(account_id,external_ticket);

create table if not exists public.mt4_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  account_id uuid references public.trading_accounts(id) on delete cascade not null,
  command text not null,
  payload jsonb default '{}',
  priority integer default 10,
  status text default 'pending' check(status in ('pending','delivered','completed','failed','expired')),
  attempts integer default 0,
  confirmation_required boolean default false,
  confirmed_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  result jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists mt4_commands_poll_idx on public.mt4_commands(account_id,status,priority desc,created_at);

create table if not exists public.account_snapshots (
  id bigint generated always as identity primary key,
  account_id uuid references public.trading_accounts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  balance numeric(18,2), equity numeric(18,2), margin numeric(18,2), free_margin numeric(18,2),
  floating_pnl numeric(18,2), daily_closed_pnl numeric(18,2), open_trade_count integer default 0,
  payload jsonb default '{}', received_at timestamptz default now()
);
create index if not exists account_snapshots_account_time_idx on public.account_snapshots(account_id,received_at desc);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plan public.plan_type not null,
  billing_cycle public.billing_cycle not null,
  account_quantity integer default 1 check(account_quantity between 1 and 100),
  addon_analyzer boolean default false,
  addon_dedicated_env boolean default false,
  dedicated_env_extra_accounts integer default 0,
  status public.subscription_status default 'trialing',
  price_cents integer not null,
  currency text default 'USD',
  stripe_customer_id text,
  stripe_subscription_id text unique,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type public.alert_type not null,
  title text not null,
  body text,
  severity text default 'info',
  metadata jsonb default '{}',
  read_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists alerts_user_unread_idx on public.alerts(user_id,read_at,created_at desc);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);

create table if not exists public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text check(type in ('broker','prop')),
  logo_url text,
  max_drawdown_pct numeric(6,2),
  daily_drawdown_pct numeric(6,2),
  profit_split_pct numeric(6,2),
  refund_policy text,
  min_trading_days integer,
  supported_platforms public.trading_platform[] default '{}',
  rating numeric(3,2),
  data_source text,
  verified_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.affiliate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  code text unique not null,
  commission_percent numeric(6,2) default 30,
  rank text default 'starter',
  status text default 'active',
  available_cents bigint default 0,
  pending_cents bigint default 0,
  paid_cents bigint default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists public.affiliate_conversions (
  id uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid references auth.users(id) on delete cascade not null,
  referred_user_id uuid references auth.users(id) on delete set null,
  source text,
  activation_amount_cents integer default 0,
  commission_amount_cents integer default 0,
  status text default 'pending' check(status in ('pending','held','payable','paid','clawed_back')),
  hold_until timestamptz,
  stripe_payment_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.academy_tracks (
  id uuid primary key default gen_random_uuid(), slug text unique not null, title text not null,
  description text, required_role public.app_role default 'user', sort_order integer default 0,
  published boolean default false, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.academy_lessons (
  id uuid primary key default gen_random_uuid(), track_id uuid references public.academy_tracks(id) on delete cascade not null,
  slug text not null, title text not null, lesson_type text default 'interactive', content jsonb default '{}',
  quiz jsonb default '{}', sort_order integer default 0, published boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now(), unique(track_id,slug)
);
create table if not exists public.academy_progress (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null,
  lesson_id uuid references public.academy_lessons(id) on delete cascade not null, status text default 'not_started',
  progress numeric(6,2) default 0, score numeric(6,2), attempts integer default 0, completed_at timestamptz,
  updated_at timestamptz default now(), unique(user_id,lesson_id)
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
  subject text not null, body text not null, status text default 'open', priority text default 'normal',
  assigned_to uuid references auth.users(id) on delete set null, metadata jsonb default '{}',
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null, target_type text, target_id text, ip inet, user_agent text,
  metadata jsonb default '{}', created_at timestamptz default now()
);
create index if not exists audit_logs_action_time_idx on public.audit_logs(action,created_at desc);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name,affiliate_code)
  values(new.id,new.email,new.raw_user_meta_data->>'full_name','WISDO-' || upper(right(replace(new.id::text,'-',''),6)))
  on conflict(id) do nothing;
  insert into public.user_roles(user_id,role) values(new.id,'user') on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.trading_accounts enable row level security;
alter table public.account_shares enable row level security;
alter table public.copier_rules enable row level security;
alter table public.trades enable row level security;
alter table public.mt4_commands enable row level security;
alter table public.account_snapshots enable row level security;
alter table public.subscriptions enable row level security;
alter table public.alerts enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.firms enable row level security;
alter table public.affiliate_profiles enable row level security;
alter table public.affiliate_conversions enable row level security;
alter table public.academy_tracks enable row level security;
alter table public.academy_lessons enable row level security;
alter table public.academy_progress enable row level security;
alter table public.support_tickets enable row level security;
alter table public.audit_logs enable row level security;

DO $$ BEGIN CREATE POLICY profiles_own_select ON public.profiles FOR SELECT TO authenticated USING(auth.uid()=id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY profiles_own_update ON public.profiles FOR UPDATE TO authenticated USING(auth.uid()=id) WITH CHECK(auth.uid()=id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY roles_own_read ON public.user_roles FOR SELECT TO authenticated USING(auth.uid()=user_id OR public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY accounts_own_all ON public.trading_accounts FOR ALL TO authenticated USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY shares_owner_or_target ON public.account_shares FOR SELECT TO authenticated USING(auth.uid()=owner_user_id OR auth.uid()=target_user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY shares_owner_write ON public.account_shares FOR ALL TO authenticated USING(auth.uid()=owner_user_id) WITH CHECK(auth.uid()=owner_user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY copier_own_all ON public.copier_rules FOR ALL TO authenticated USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY trades_own_read ON public.trades FOR SELECT TO authenticated USING(auth.uid()=user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY commands_own_read ON public.mt4_commands FOR SELECT TO authenticated USING(auth.uid()=user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY snapshots_own_read ON public.account_snapshots FOR SELECT TO authenticated USING(auth.uid()=user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY subscriptions_own_read ON public.subscriptions FOR SELECT TO authenticated USING(auth.uid()=user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY alerts_own_all ON public.alerts FOR ALL TO authenticated USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY push_own_all ON public.push_subscriptions FOR ALL TO authenticated USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY firms_public_read ON public.firms FOR SELECT TO anon,authenticated USING(true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY firms_admin_write ON public.firms FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY affiliate_own_read ON public.affiliate_profiles FOR SELECT TO authenticated USING(auth.uid()=user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY conversions_own_read ON public.affiliate_conversions FOR SELECT TO authenticated USING(auth.uid()=affiliate_user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY academy_tracks_public ON public.academy_tracks FOR SELECT TO authenticated USING(published OR public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY academy_lessons_public ON public.academy_lessons FOR SELECT TO authenticated USING(published OR public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY academy_progress_own ON public.academy_progress FOR ALL TO authenticated USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY tickets_own_read ON public.support_tickets FOR SELECT TO authenticated USING(auth.uid()=user_id OR public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY tickets_own_insert ON public.support_tickets FOR INSERT TO authenticated WITH CHECK(auth.uid()=user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY audit_admin_read ON public.audit_logs FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Realtime tables. Ignore duplicate publication membership when rerunning.
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.trades; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.trading_accounts; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mt4_commands; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
