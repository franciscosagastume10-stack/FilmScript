-- One-time tokens, public sharing configuration, billing provider state and
-- credit ledgers are server-only. The service role is the only application
-- role granted access to these schemas.

create table private.project_invitations (
  id text primary key,
  project_id text not null references public.scripts(id) on delete cascade,
  invited_user_id text references public.profiles(id) on delete set null,
  invited_username extensions.citext,
  invited_email extensions.citext,
  token_hash text not null unique,
  project_role text not null,
  cinematic_role text,
  permission_snapshot jsonb not null,
  status text not null default 'pending',
  expires_at timestamptz,
  created_by_user_id text not null references public.profiles(id),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  revoked_at timestamptz,
  declined_at timestamptz,
  constraint project_invitations_target check (
    num_nonnulls(invited_user_id, invited_username, invited_email) >= 1
    or project_role = 'temporary_guest'
  ),
  constraint project_invitations_role check (project_role in (
    'co_owner', 'admin', 'editor', 'department_editor', 'commenter', 'viewer', 'temporary_guest'
  )),
  constraint project_invitations_permission_snapshot_object check (jsonb_typeof(permission_snapshot) = 'object')
);

create index project_invitations_target_idx
  on private.project_invitations(invited_user_id, invited_email, status);
create index project_invitations_project_idx
  on private.project_invitations(project_id, status, created_at desc);

create trigger project_invitations_set_updated_at
before update on private.project_invitations
for each row execute function private.set_updated_at();

create table private.project_guest_sessions (
  id text primary key,
  invitation_id text not null references private.project_invitations(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  last_seen_at timestamptz not null default statement_timestamp()
);

create index project_guest_sessions_invitation_idx
  on private.project_guest_sessions(invitation_id, revoked_at, expires_at);

create table private.shared_projects (
  id text primary key,
  project_id text not null references public.scripts(id) on delete cascade,
  created_by_user_id text not null references public.profiles(id),
  slug text not null unique,
  status text not null default 'active',
  access_mode text not null,
  password_hash text,
  password_salt text,
  allowed_emails jsonb not null default '[]'::jsonb,
  sections jsonb not null default '[]'::jsonb,
  cover jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  revoked_at timestamptz,
  constraint shared_projects_allowed_emails_array check (jsonb_typeof(allowed_emails) = 'array'),
  constraint shared_projects_sections_array check (jsonb_typeof(sections) = 'array'),
  constraint shared_projects_cover_object check (jsonb_typeof(cover) = 'object')
);

create index shared_projects_project_idx
  on private.shared_projects(project_id, status);

create trigger shared_projects_set_updated_at
before update on private.shared_projects
for each row execute function private.set_updated_at();

create table private.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default statement_timestamp()
);

comment on table private.app_settings is
  'Lossless landing area for schema-v18 app_settings; credit JSON is normalized into the ledger tables before cutover.';

create trigger app_settings_set_updated_at
before update on private.app_settings
for each row execute function private.set_updated_at();

create table billing.subscriptions (
  user_id text primary key references public.profiles(id) on delete cascade,
  plan text,
  status text,
  checkout_id text,
  provider_subscription_id text,
  billing_cycle_key text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  constraint subscriptions_period_order check (
    current_period_start is null
    or current_period_end is null
    or current_period_end >= current_period_start
  )
);

create index subscriptions_provider_idx
  on billing.subscriptions(provider_subscription_id)
  where provider_subscription_id is not null;

create trigger subscriptions_set_updated_at
before update on billing.subscriptions
for each row execute function private.set_updated_at();

create table billing.checkouts (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  email extensions.citext,
  plan text,
  product_id text,
  status text,
  created_at timestamptz not null default statement_timestamp()
);

create index checkouts_user_status_idx
  on billing.checkouts(user_id, status, created_at desc);

create table billing.subscription_switch_previews (
  token_hash text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  subscription_id text not null,
  from_plan text not null,
  to_plan text not null,
  mode text not null,
  request jsonb not null,
  preview jsonb not null,
  idempotency_key text not null unique,
  status text not null,
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  completed_at timestamptz,
  provider_result jsonb,
  error_code text,
  constraint subscription_switch_request_object check (jsonb_typeof(request) = 'object'),
  constraint subscription_switch_preview_object check (jsonb_typeof(preview) = 'object'),
  constraint subscription_switch_expiration check (expires_at > created_at)
);

create index subscription_switch_previews_user_idx
  on billing.subscription_switch_previews(user_id, expires_at desc);

create table billing.processed_events (
  id text primary key,
  processed_at timestamptz not null default statement_timestamp()
);

create table private.credit_accounts (
  user_id text primary key references public.profiles(id) on delete cascade,
  legacy_snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default statement_timestamp(),
  constraint credit_accounts_legacy_snapshot_object check (jsonb_typeof(legacy_snapshot) = 'object')
);

create trigger credit_accounts_set_updated_at
before update on private.credit_accounts
for each row execute function private.set_updated_at();

create table private.credit_windows (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  feature text not null,
  period_key text not null,
  plan text,
  allowance numeric(14, 6) not null,
  used numeric(14, 6) not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint credit_windows_allowance_nonnegative check (allowance >= 0),
  constraint credit_windows_used_nonnegative check (used >= 0),
  constraint credit_windows_period_order check (starts_at is null or ends_at is null or ends_at >= starts_at),
  unique(user_id, feature, period_key)
);

create index credit_windows_user_feature_idx
  on private.credit_windows(user_id, feature, ends_at desc);

create trigger credit_windows_set_updated_at
before update on private.credit_windows
for each row execute function private.set_updated_at();

create table private.credit_reservations (
  id text primary key,
  window_id text not null references private.credit_windows(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  feature text not null,
  amount numeric(14, 6) not null,
  state text not null default 'reserved',
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz,
  settled_at timestamptz,
  released_at timestamptz,
  constraint credit_reservations_amount_positive check (amount > 0),
  constraint credit_reservations_state check (state in ('reserved', 'settled', 'released', 'expired')),
  constraint credit_reservations_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index credit_reservations_window_state_idx
  on private.credit_reservations(window_id, state, created_at);

create table private.credit_ledger (
  id text primary key,
  window_id text references private.credit_windows(id) on delete set null,
  user_id text not null references public.profiles(id) on delete cascade,
  reservation_id text references private.credit_reservations(id) on delete set null,
  feature text not null,
  entry_type text not null,
  amount numeric(14, 6) not null,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  constraint credit_ledger_amount_nonzero check (amount <> 0),
  constraint credit_ledger_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index credit_ledger_user_feature_idx
  on private.credit_ledger(user_id, feature, created_at desc);

create table private.feature_allowances (
  user_id text not null references public.profiles(id) on delete cascade,
  feature text not null,
  period_key text not null,
  limit_count integer not null,
  used_count integer not null default 0,
  reserved_count integer not null default 0,
  updated_at timestamptz not null default statement_timestamp(),
  primary key(user_id, feature, period_key),
  constraint feature_allowances_limit_nonnegative check (limit_count >= 0),
  constraint feature_allowances_used_nonnegative check (used_count >= 0),
  constraint feature_allowances_reserved_nonnegative check (reserved_count >= 0)
);

create trigger feature_allowances_set_updated_at
before update on private.feature_allowances
for each row execute function private.set_updated_at();

comment on table private.credit_ledger is
  'Append-only idempotent credit evidence. Application code must settle or release a reservation in one database transaction.';

-- Deliberately absent: SQLite sessions, oauth_states and auth_handoffs.
-- Supabase Auth replaces them and every account signs in again once at cutover;
-- copying bearer/session tokens into Postgres would preserve unsafe authority.
