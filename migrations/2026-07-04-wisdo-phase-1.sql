-- Wisdo Database Migration Phase 1
-- Core durable state only. JSON fallback remains the default runtime path.

create table if not exists wisdo_kv_store (
  namespace text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists user_desks (
  id text primary key,
  user_id text not null unique,
  selected_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists trading_accounts (
  id text primary key,
  user_id text not null,
  label text,
  broker text,
  server text,
  account_number text,
  account_type text,
  role text,
  status text,
  connection_status text,
  is_live boolean not null default false,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_trading_accounts_user_id on trading_accounts(user_id);

create table if not exists account_snapshots (
  id text primary key,
  account_id text not null,
  user_id text not null,
  balance numeric,
  equity numeric,
  margin numeric,
  free_margin numeric,
  floating_pnl numeric,
  open_trades_json jsonb not null default '[]'::jsonb,
  closed_trades_json jsonb not null default '[]'::jsonb,
  health_json jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);

create index if not exists idx_account_snapshots_account_time on account_snapshots(account_id, captured_at desc);

create table if not exists bots (
  id text primary key,
  name text not null,
  slug text unique,
  creator_id text,
  description text,
  strategy_type text,
  risk_level text,
  price numeric,
  access_type text,
  status text,
  categories_json jsonb not null default '[]'::jsonb,
  required_education_json jsonb not null default '[]'::jsonb,
  force_update_required boolean not null default false,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bot_versions (
  id text primary key,
  bot_id text not null references bots(id) on delete cascade,
  version text not null,
  status text,
  changelog text,
  file_metadata_json jsonb not null default '{}'::jsonb,
  screenshots_json jsonb not null default '[]'::jsonb,
  video_json jsonb not null default '{}'::jsonb,
  backtest_json jsonb not null default '{}'::jsonb,
  live_examples_json jsonb not null default '[]'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_bot_versions_bot_id on bot_versions(bot_id);

create table if not exists bot_access (
  id text primary key,
  user_id text not null,
  bot_id text not null,
  access_type text,
  source text,
  status text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bot_access_user_bot on bot_access(user_id, bot_id);

create table if not exists bot_purchases (
  id text primary key,
  user_id text not null,
  bot_id text not null,
  amount numeric,
  currency text not null default 'usd',
  payment_ref text,
  status text,
  created_at timestamptz not null default now()
);

create index if not exists idx_bot_purchases_user_id on bot_purchases(user_id);

create table if not exists copy_requests (
  id text primary key,
  follower_id text not null,
  provider_id text not null,
  requested_settings_json jsonb not null default '{}'::jsonb,
  status text,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_copy_requests_follower_provider on copy_requests(follower_id, provider_id);

create table if not exists copy_relationships (
  id text primary key,
  follower_id text not null,
  provider_id text not null,
  status text,
  risk_settings_json jsonb not null default '{}'::jsonb,
  paper_mode boolean not null default false,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_copy_relationships_users on copy_relationships(follower_id, provider_id);

create table if not exists copy_trade_logs (
  id text primary key,
  relationship_id text,
  follower_id text,
  provider_id text,
  source_trade_json jsonb not null default '{}'::jsonb,
  copied_trade_json jsonb not null default '{}'::jsonb,
  risk_calculation_json jsonb not null default '{}'::jsonb,
  status text,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_copy_trade_logs_relationship on copy_trade_logs(relationship_id, created_at desc);

create table if not exists theme_preferences (
  id text primary key,
  user_id text not null unique,
  theme text,
  accent_color text,
  settings_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists notifications (
  id text primary key,
  user_id text not null,
  type text,
  title text,
  message text,
  data_json jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created on notifications(user_id, created_at desc);

create table if not exists lesson_progress (
  id text primary key,
  user_id text not null,
  lesson_id text not null,
  module_id text,
  bot_id text,
  status text,
  progress numeric,
  score numeric,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_lesson_progress_user on lesson_progress(user_id);

create table if not exists admin_audit_logs (
  id text primary key,
  admin_id text,
  action text not null,
  target_type text,
  target_id text,
  data_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_logs_created on admin_audit_logs(created_at desc);

create table if not exists mt4_commands (
  id text primary key,
  user_id text not null,
  account_id text,
  command_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  status text,
  confirmation_required boolean not null default false,
  confirmed_at timestamptz,
  result_json jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mt4_commands_user_account on mt4_commands(user_id, account_id, created_at desc);

create table if not exists affiliates (
  id text primary key,
  user_id text not null,
  display_name text,
  referral_code text not null unique,
  status text not null default 'pending',
  default_commission_percent numeric,
  payout_method text,
  payout_details_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_affiliates_user_id on affiliates(user_id);
create index if not exists idx_affiliates_referral_code on affiliates(referral_code);

create table if not exists affiliate_referrals (
  id text primary key,
  affiliate_id text not null,
  referred_user_id text,
  referred_email text,
  referral_code text,
  campaign_id text,
  status text not null default 'invited',
  activation_fee_amount numeric,
  currency text not null default 'usd',
  payment_ref text,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_affiliate_referrals_affiliate on affiliate_referrals(affiliate_id, created_at desc);
create index if not exists idx_affiliate_referrals_user on affiliate_referrals(referred_user_id);

create table if not exists affiliate_commissions (
  id text primary key,
  affiliate_id text not null,
  referral_id text,
  referred_user_id text,
  source_type text not null,
  source_id text,
  gross_amount numeric,
  commission_percent numeric,
  commission_amount numeric,
  currency text not null default 'usd',
  status text not null default 'pending',
  hold_until timestamptz,
  payout_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_affiliate_commissions_affiliate on affiliate_commissions(affiliate_id, status);
create index if not exists idx_affiliate_commissions_payout on affiliate_commissions(payout_id);

create table if not exists affiliate_payouts (
  id text primary key,
  affiliate_id text not null,
  amount numeric not null,
  currency text not null default 'usd',
  status text not null default 'pending',
  payout_method text,
  payout_reference text,
  included_commission_ids_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_affiliate_payouts_affiliate on affiliate_payouts(affiliate_id, created_at desc);

create table if not exists affiliate_campaigns (
  id text primary key,
  name text not null,
  description text,
  status text not null default 'active',
  activation_fee_amount numeric,
  commission_percent numeric,
  starts_at timestamptz,
  ends_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
