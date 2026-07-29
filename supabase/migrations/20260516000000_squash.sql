-- ════════════════════════════════════════════════════════════════════
-- Nova Launchpad · Squashed Baseline Schema
-- Replaces 31 incremental migrations with a single idempotent file.
-- Safe to run on production (all statements are CREATE IF NOT EXISTS /
-- CREATE OR REPLACE / DO $$ IF NOT EXISTS $$).
-- ════════════════════════════════════════════════════════════════════

-- ── 0. Extensions ────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── 1. Enums ─────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('user', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'org_role') then
    create type public.org_role as enum ('owner', 'admin', 'member');
  end if;
  if not exists (select 1 from pg_type where typname = 'business_stage') then
    create type public.business_stage as enum ('Idea', 'Validate', 'Launch', 'Operate', 'Scale');
  end if;
  if not exists (select 1 from pg_type where typname = 'plan_tier') then
    create type public.plan_tier as enum ('starter', 'launch', 'operate', 'scale');
  end if;
  if not exists (select 1 from pg_type where typname = 'tool_run_status') then
    create type public.tool_run_status as enum ('running', 'succeeded', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'lead_stage') then
    create type public.lead_stage as enum ('New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost');
  end if;
end $$;

-- ── 2. Core Functions (needed before tables that use them) ────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ── 3. Core Tables ────────────────────────────────────────────────────

-- profiles
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  email            text,
  full_name        text,
  avatar_url       text,
  onboarding_complete boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- user_roles
create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- organizations
create table if not exists public.organizations (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  business_type   text,
  niche           text,
  location        text,
  target_customer text,
  offer           text,
  goal            text,
  stage           public.business_stage not null default 'Idea',
  website_url     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.organizations enable row level security;
drop trigger if exists trg_orgs_updated on public.organizations;
create trigger trg_orgs_updated
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- organization_members
create table if not exists public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            public.org_role not null default 'member',
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);
alter table public.organization_members enable row level security;
create index if not exists idx_org_members_user on public.organization_members(user_id);
create index if not exists idx_org_members_org  on public.organization_members(organization_id);

-- is_org_member helpers — defined here so organization_members table already exists
-- (SQL-language functions resolve table references at creation time)
create or replace function public.is_org_member(_org_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = _org_id and user_id = _user_id
  )
$$;

create or replace function public.is_org_owner(_org_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = _org_id and user_id = _user_id and role in ('owner', 'admin')
  )
$$;

create or replace function public.is_org_admin(_org_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = _org_id and user_id = _user_id and role in ('owner', 'admin')
  )
$$;

-- subscriptions
create table if not exists public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null unique references public.organizations(id) on delete cascade,
  plan                  public.plan_tier not null default 'starter',
  status                text not null default 'active',
  stripe_customer_id    text,
  stripe_subscription_id text,
  current_period_end    timestamptz,
  cancel_at_period_end  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;
drop trigger if exists trg_subs_updated on public.subscriptions;
create trigger trg_subs_updated
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- onboarding_responses
create table if not exists public.onboarding_responses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  question_key    text,
  answer          text,
  offer           text,
  stage           text,
  biggest_blocker text,
  completed       boolean not null default false,
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);
alter table public.onboarding_responses enable row level security;
alter table public.onboarding_responses
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists offer           text,
  add column if not exists stage           text,
  add column if not exists biggest_blocker text,
  add column if not exists completed       boolean not null default false,
  add column if not exists completed_at    timestamptz;
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'onboarding_responses_organization_id_key'
  ) then
    alter table public.onboarding_responses
      add constraint onboarding_responses_organization_id_key unique (organization_id);
  end if;
end $$;

-- ── 4. Billing & Entitlements ─────────────────────────────────────────

-- plan_tier_limits (single source of truth for plan gating)
create table if not exists public.plan_tier_limits (
  plan                     text primary key,
  price_usd                integer not null default 0,
  monthly_generation_limit integer,
  allowed_tools            text[] not null default '{}',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
alter table public.plan_tier_limits enable row level security;

-- stripe_webhook_events (idempotency for Stripe)
create table if not exists public.stripe_webhook_events (
  id           text primary key,
  type         text not null,
  processed_at timestamptz not null default now()
);
alter table public.stripe_webhook_events enable row level security;
create index if not exists idx_stripe_webhook_events_processed_at
  on public.stripe_webhook_events(processed_at);

-- ── 5. Launchpad / AI Generation ─────────────────────────────────────

-- tool_runs
create table if not exists public.tool_runs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  tool_key        text not null,
  status          public.tool_run_status not null default 'running',
  input           jsonb not null default '{}'::jsonb,
  output          jsonb,
  error           text,
  metadata        jsonb not null default '{}'::jsonb,
  feedback        text check (feedback in ('up', 'down')),
  feedback_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.tool_runs enable row level security;
alter table public.tool_runs
  add column if not exists feedback    text check (feedback in ('up', 'down')),
  add column if not exists feedback_at timestamptz;
create index if not exists idx_tool_runs_org_created on public.tool_runs(organization_id, created_at desc);
drop trigger if exists trg_runs_updated on public.tool_runs;
create trigger trg_runs_updated
  before update on public.tool_runs
  for each row execute function public.set_updated_at();

-- generated_assets
create table if not exists public.generated_assets (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  tool_run_id     uuid references public.tool_runs(id) on delete set null,
  category        text not null,
  kind            text,
  title           text not null,
  content         jsonb not null default '{}'::jsonb,
  storage_path    text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
alter table public.generated_assets enable row level security;
create index if not exists idx_generated_assets_org_created on public.generated_assets(organization_id, created_at desc);

-- credit_ledger
create table if not exists public.credit_ledger (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  tool           text not null,
  cost           integer not null,
  meta           jsonb default '{}'::jsonb,
  reservation_id uuid default uuid_generate_v4(),
  status         text not null default 'confirmed'
                 check (status in ('reserved', 'confirmed', 'refunded')),
  created_at     timestamptz not null default now()
);
alter table public.credit_ledger
  add column if not exists reservation_id uuid default uuid_generate_v4(),
  add column if not exists status         text not null default 'confirmed'
    check (status in ('reserved', 'confirmed', 'refunded'));
create index if not exists idx_credit_ledger_user        on public.credit_ledger(user_id, created_at desc);
create index if not exists idx_credit_ledger_reservation on public.credit_ledger(reservation_id);
create index if not exists idx_credit_ledger_status      on public.credit_ledger(user_id, status);

-- failed_jobs
create table if not exists public.failed_jobs (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid references auth.users(id) on delete cascade,
  session_id     uuid,
  tool_slug      text not null,
  payload        jsonb not null default '{}',
  reservation_id uuid,
  error_message  text,
  retry_count    int not null default 0,
  next_retry_at  timestamptz not null default now() + interval '2 minutes',
  status         text not null default 'pending'
                 check (status in ('pending', 'retrying', 'resolved', 'dead')),
  resolved_at    timestamptz,
  created_at     timestamptz not null default now()
);
alter table public.failed_jobs enable row level security;
create index if not exists idx_failed_jobs_retry on public.failed_jobs(status, next_retry_at)
  where status in ('pending', 'retrying');
create index if not exists idx_failed_jobs_user on public.failed_jobs(user_id, created_at desc);

-- ── 6. CRM & Ops ─────────────────────────────────────────────────────

-- leads
create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  name            text not null,
  email           text,
  phone           text,
  company         text,
  stage           public.lead_stage not null default 'New',
  source          text,
  notes           text,
  value           numeric,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.leads enable row level security;
create index if not exists idx_leads_org on public.leads(organization_id);

-- automation_settings
create table if not exists public.automation_settings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key             text not null,
  label           text,
  enabled         boolean not null default false,
  config          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, key)
);
alter table public.automation_settings enable row level security;
alter table public.automation_settings
  add column if not exists label text;
create index if not exists automation_settings_org_idx on public.automation_settings(organization_id);
drop trigger if exists trg_autom_updated on public.automation_settings;
create trigger trg_autom_updated
  before update on public.automation_settings
  for each row execute function public.set_updated_at();

-- usage_tracking
create table if not exists public.usage_tracking (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tool_key        text not null,
  period          text not null,
  count           integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, tool_key, period)
);
alter table public.usage_tracking enable row level security;
create index if not exists usage_tracking_org_idx on public.usage_tracking(organization_id, period);

-- website_analyses (merged schema from two migration versions)
create table if not exists public.website_analyses (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  url             text not null,
  status          text not null default 'pending',
  result          jsonb,
  error           text,
  snapshot_path   text,
  issues          jsonb not null default '[]'::jsonb,
  opportunities   jsonb not null default '[]'::jsonb,
  ux_notes        text,
  seo_notes       text,
  suggested_changes jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.website_analyses enable row level security;
alter table public.website_analyses
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists status          text not null default 'pending',
  add column if not exists result          jsonb,
  add column if not exists error           text,
  add column if not exists updated_at      timestamptz not null default now();
create index if not exists website_analyses_org_idx on public.website_analyses(organization_id);

-- user_integrations (encrypted credentials store)
create table if not exists public.user_integrations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  integration_key text not null,
  value_encrypted bytea,
  value_last4     text,
  status          text not null default 'connected',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, integration_key)
);
alter table public.user_integrations enable row level security;
-- drop legacy plaintext column if still present on older deployments
alter table public.user_integrations drop column if exists value;
alter table public.user_integrations
  add column if not exists value_encrypted bytea,
  add column if not exists value_last4     text;
create index if not exists user_integrations_user_idx on public.user_integrations(user_id);
drop trigger if exists ui_set_updated_at on public.user_integrations;
create trigger ui_set_updated_at
  before update on public.user_integrations
  for each row execute function public.set_updated_at();

-- ── 7. Nova AI ────────────────────────────────────────────────────────

-- ai_operator_configs
create table if not exists public.ai_operator_configs (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  operator_name        text,
  operator_tone        text,
  primary_niche        text,
  recommended_tools    jsonb default '[]'::jsonb,
  gtm_strategy_summary text,
  brand_voice_keywords jsonb default '[]'::jsonb,
  top_3_pain_points    jsonb default '[]'::jsonb,
  source_intake_id     uuid,
  llm_model            text default 'claude-sonnet-4-6',
  llm_prompt_version   text,
  raw_llm_response     jsonb,
  status               text not null default 'draft'
                       check (status in ('draft', 'active', 'archived')),
  strategy_complete    boolean not null default false,
  profile_complete     boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id)
);
alter table public.ai_operator_configs enable row level security;
alter table public.ai_operator_configs
  add column if not exists strategy_complete boolean not null default false,
  add column if not exists profile_complete  boolean not null default false;
create index if not exists ai_operator_configs_user_id_idx on public.ai_operator_configs(user_id);
create index if not exists ai_operator_configs_status_idx  on public.ai_operator_configs(status);
drop trigger if exists trg_ai_operator_configs_touch on public.ai_operator_configs;
create trigger trg_ai_operator_configs_touch
  before update on public.ai_operator_configs
  for each row execute function public.touch_updated_at();

-- operator_memory
create table if not exists public.operator_memory (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null,
  session_id  text,
  memory_type text not null default 'fact',
  content     text not null,
  tags        text[] default '{}',
  pruned      boolean default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_operator_memory_user    on public.operator_memory(user_id, created_at desc);
create index if not exists idx_operator_memory_pruned  on public.operator_memory(pruned);
create index if not exists idx_operator_memory_session on public.operator_memory(session_id);

-- operator_sessions
create table if not exists public.operator_sessions (
  id                 uuid primary key default uuid_generate_v4(),
  session_id         text unique not null,
  user_id            uuid,
  message            text,
  type               text,
  last_confidence    numeric,
  top_intents        jsonb,
  clarification_text text,
  clarification_sent boolean default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_operator_sessions_user on public.operator_sessions(user_id);

-- tool_outputs
create table if not exists public.tool_outputs (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null,
  session_id       text,
  tool_id          text not null,
  output_type      text not null default 'text',
  raw_output       text,
  formatted_output text,
  read             boolean default false,
  created_at       timestamptz not null default now()
);
create index if not exists idx_tool_outputs_user    on public.tool_outputs(user_id, created_at desc);
create index if not exists idx_tool_outputs_session on public.tool_outputs(session_id);
create index if not exists idx_tool_outputs_tool    on public.tool_outputs(tool_id);

-- notifications
create table if not exists public.notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null,
  session_id text,
  type       text default 'tool_output',
  tool_id    text,
  message    text,
  read       boolean default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user   on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_unread on public.notifications(user_id, read) where read = false;

-- support_tickets
create table if not exists public.support_tickets (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null,
  session_id    text,
  issue_summary text not null,
  status        text not null default 'open',
  created_at    timestamptz not null default now()
);
create index if not exists idx_support_tickets_user   on public.support_tickets(user_id, created_at desc);
create index if not exists idx_support_tickets_status on public.support_tickets(status);

-- health_checks
create table if not exists public.health_checks (
  id               uuid primary key default uuid_generate_v4(),
  endpoint_name    text not null,
  status           text not null,
  status_code      int,
  response_time_ms int,
  checked_at       timestamptz not null default now()
);
create index if not exists idx_health_checks_endpoint on public.health_checks(endpoint_name, checked_at desc);
create index if not exists idx_health_checks_status   on public.health_checks(status);

-- n8n_error_log
create table if not exists public.n8n_error_log (
  id            uuid primary key default uuid_generate_v4(),
  workflow_name text not null,
  error_message text,
  error_node    text,
  execution_id  text,
  occurred_at   timestamptz not null default now()
);
create index if not exists idx_n8n_error_log_wf   on public.n8n_error_log(workflow_name);
create index if not exists idx_n8n_error_log_time on public.n8n_error_log(occurred_at desc);

-- ai_dashboards
create table if not exists public.ai_dashboards (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  business        text not null default '',
  niche           text,
  stage           text,
  goal            text,
  current_revenue text,
  target_customer text,
  biggest_blocker text,
  payload         jsonb not null,
  model           text,
  prompt_version  text default 'v1',
  generated_at    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
alter table public.ai_dashboards enable row level security;
create index if not exists ai_dashboards_org_created on public.ai_dashboards(organization_id, created_at desc);

-- ── 8. Subagent Infrastructure ────────────────────────────────────────

-- user_ai_config
create table if not exists public.user_ai_config (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  brand_voice   jsonb default '{}'::jsonb,
  niche         text,
  tone          text,
  writing_style text,
  icp           jsonb default '{}'::jsonb,
  value_props   jsonb default '[]'::jsonb,
  company_name  text,
  logo_url      text,
  primary_color text,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists idx_user_ai_config_niche on public.user_ai_config(niche);

-- content_outputs
create table if not exists public.content_outputs (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_content_outputs_user_type on public.content_outputs(user_id, type, created_at desc);

-- automation_drafts
create table if not exists public.automation_drafts (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  description   text not null,
  workflow_json jsonb not null,
  status        text not null default 'draft'
                check (status in ('draft', 'published', 'archived', 'rejected')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_automation_drafts_user   on public.automation_drafts(user_id, created_at desc);
create index if not exists idx_automation_drafts_status on public.automation_drafts(status);

-- client_reports
create table if not exists public.client_reports (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  client_id        text,
  period_start     date,
  period_end       date,
  period_label     text,
  markdown_payload text,
  pdf_url          text,
  kpi_snapshot     jsonb default '{}'::jsonb,
  status           text not null default 'draft'
                   check (status in ('draft', 'sent', 'archived')),
  created_at       timestamptz not null default now()
);
create index if not exists idx_client_reports_period on public.client_reports(period_start, period_end);
create index if not exists idx_client_reports_user   on public.client_reports(user_id, created_at desc);

-- client_kpi_metrics
create table if not exists public.client_kpi_metrics (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  client_id    text,
  metric_key   text not null,
  metric_value numeric not null default 0,
  metric_date  date not null default current_date,
  source       text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_client_kpi_user_client on public.client_kpi_metrics(user_id, client_id, metric_date desc);
create index if not exists idx_client_kpi_metric      on public.client_kpi_metrics(metric_key, metric_date desc);

-- operator_prompts
create table if not exists public.operator_prompts (
  id                 uuid primary key default uuid_generate_v4(),
  component          text not null unique,
  system_prompt      text not null,
  version            text not null default 'v1',
  is_known_component boolean default true,
  updated_at         timestamptz not null default now(),
  created_at         timestamptz not null default now()
);
create index if not exists idx_operator_prompts_component on public.operator_prompts(component);

-- ── 9. Views ─────────────────────────────────────────────────────────

-- users: compatibility view for subagents (plan_tier as price string)
create or replace view public.users
with (security_invoker = true) as
select
  p.id                              as user_id,
  p.email,
  case s.plan::text
    when 'starter' then '0'
    when 'launch'  then '49'
    when 'operate' then '149'
    when 'scale'   then '299'
    else '0'
  end                               as plan_tier,
  coalesce(s.plan::text, 'starter') as plan_tier_enum,
  s.organization_id,
  p.created_at
from public.profiles p
left join public.subscriptions s
       on s.organization_id in (
         select organization_id from public.organization_members where user_id = p.id
       );

-- user_credit_balance: monthly credits per user (confirmed debits only)
create or replace view public.user_credit_balance
with (security_invoker = true) as
select
  p.id                                                        as user_id,
  coalesce(ptl.monthly_generation_limit, 999999) * 5         as starting_credits,
  coalesce(sum(cl.cost), 0)                                   as credits_used,
  coalesce(ptl.monthly_generation_limit, 999999) * 5
    - coalesce(sum(cl.cost), 0)                               as credits_remaining
from public.profiles p
left join public.subscriptions sub
       on sub.organization_id in (
         select organization_id from public.organization_members where user_id = p.id
       )
left join public.plan_tier_limits ptl on ptl.plan = sub.plan::text
left join public.credit_ledger cl
       on cl.user_id = p.id
      and cl.created_at >= date_trunc('month', now())
      and cl.status = 'confirmed'
group by p.id, ptl.monthly_generation_limit;

-- user_integrations_masked: safe client-readable view (no raw encrypted bytes)
create or replace view public.user_integrations_masked
with (security_invoker = true) as
select
  id,
  user_id,
  integration_key,
  status,
  value_last4,
  (value_encrypted is not null) as is_connected,
  created_at,
  updated_at
from public.user_integrations;

-- ai_operator_config: singular alias used by n8n workflows
create or replace view public.ai_operator_config
with (security_invoker = true) as
select * from public.ai_operator_configs;

-- ── 10. More Functions ────────────────────────────────────────────────

-- Auto-create profile + role on new user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  insert into public.user_roles (user_id, role)
    values (new.id, 'user');
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- get_user_plan: returns current plan for an org
create or replace function public.get_user_plan(_org_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select plan::text from public.subscriptions
      where organization_id = _org_id and status in ('active', 'trialing')
      limit 1),
    'starter'
  )
$$;

-- get_org_entitlements: plan limits for an org (uses plan_tier_limits)
create or replace function public.get_org_entitlements(_org_id uuid)
returns table (
  plan                     text,
  price_usd                integer,
  monthly_generation_limit integer,
  allowed_tools            text[]
)
language sql stable security definer set search_path = public as $$
  select ptl.plan, ptl.price_usd, ptl.monthly_generation_limit, ptl.allowed_tools
  from public.plan_tier_limits ptl
  join public.subscriptions s
    on s.plan::text = ptl.plan
   and s.organization_id = _org_id
   and s.status in ('active', 'trialing')
  limit 1;
$$;

-- set_user_integration: encrypted upsert for integration credentials
create or replace function public.set_user_integration(
  p_user_id        uuid,
  p_integration_key text,
  p_value          text,
  p_encryption_key text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_integrations (user_id, integration_key, value_encrypted, value_last4, status, updated_at)
    values (
      p_user_id,
      p_integration_key,
      pgp_sym_encrypt(p_value, p_encryption_key),
      right(p_value, 4),
      'connected',
      now()
    )
  on conflict (user_id, integration_key) do update set
    value_encrypted = excluded.value_encrypted,
    value_last4     = excluded.value_last4,
    status          = 'connected',
    updated_at      = now();
end $$;

-- get_user_integration_secret: decrypt and return raw value (service-role only)
create or replace function public.get_user_integration_secret(
  p_user_id         uuid,
  p_integration_key text,
  p_encryption_key  text
)
returns text language plpgsql security definer set search_path = public as $$
declare v_encrypted bytea;
begin
  select value_encrypted into v_encrypted
  from public.user_integrations
  where user_id = p_user_id and integration_key = p_integration_key;
  if v_encrypted is null then return null; end if;
  return pgp_sym_decrypt(v_encrypted, p_encryption_key);
end $$;

-- ── 11. RLS Policies (all guarded with IF NOT EXISTS) ─────────────────
do $$ begin

  -- profiles
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='own_profile_select') then
    create policy "own_profile_select" on public.profiles for select
      using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));
  end if;
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='own_profile_update') then
    create policy "own_profile_update" on public.profiles for update using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='own_profile_insert') then
    create policy "own_profile_insert" on public.profiles for insert with check (auth.uid() = id);
  end if;

  -- user_roles
  if not exists (select 1 from pg_policies where tablename='user_roles' and policyname='own_roles_read') then
    create policy "own_roles_read" on public.user_roles for select
      using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
  end if;
  if not exists (select 1 from pg_policies where tablename='user_roles' and policyname='no_self_role_assignment') then
    create policy "no_self_role_assignment" on public.user_roles
      as restrictive for all to authenticated
      using (public.has_role(auth.uid(), 'admin'))
      with check (public.has_role(auth.uid(), 'admin'));
  end if;
  if not exists (select 1 from pg_policies where tablename='user_roles' and policyname='admin_roles_insert') then
    create policy "admin_roles_insert" on public.user_roles for insert to authenticated
      with check (public.has_role(auth.uid(), 'admin'));
  end if;
  if not exists (select 1 from pg_policies where tablename='user_roles' and policyname='admin_roles_update') then
    create policy "admin_roles_update" on public.user_roles for update to authenticated
      using (public.has_role(auth.uid(), 'admin'))
      with check (public.has_role(auth.uid(), 'admin'));
  end if;
  if not exists (select 1 from pg_policies where tablename='user_roles' and policyname='admin_roles_delete') then
    create policy "admin_roles_delete" on public.user_roles for delete to authenticated
      using (public.has_role(auth.uid(), 'admin'));
  end if;

  -- organizations
  if not exists (select 1 from pg_policies where tablename='organizations' and policyname='org_member_select') then
    create policy "org_member_select" on public.organizations for select
      using (
        auth.uid() = owner_id
        or public.is_org_member(id, auth.uid())
        or public.has_role(auth.uid(), 'admin')
      );
  end if;
  if not exists (select 1 from pg_policies where tablename='organizations' and policyname='org_owner_insert') then
    create policy "org_owner_insert" on public.organizations for insert
      with check (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='organizations' and policyname='org_owner_update') then
    create policy "org_owner_update" on public.organizations for update
      using (public.is_org_owner(id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='organizations' and policyname='org_owner_delete') then
    create policy "org_owner_delete" on public.organizations for delete
      using (auth.uid() = owner_id);
  end if;

  -- organization_members
  if not exists (select 1 from pg_policies where tablename='organization_members' and policyname='members_self_read') then
    create policy "members_self_read" on public.organization_members for select
      using (auth.uid() = user_id or public.is_org_owner(organization_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='organization_members' and policyname='members_owner_bootstrap_insert') then
    create policy "members_owner_bootstrap_insert" on public.organization_members for insert
      with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='organization_members' and policyname='members_owner_write') then
    create policy "members_owner_write" on public.organization_members for update
      using (public.is_org_owner(organization_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='organization_members' and policyname='members_self_delete') then
    create policy "members_self_delete" on public.organization_members for delete
      using (auth.uid() = user_id or public.is_org_owner(organization_id, auth.uid()));
  end if;

  -- subscriptions
  if not exists (select 1 from pg_policies where tablename='subscriptions' and policyname='sub_member_read') then
    create policy "sub_member_read" on public.subscriptions for select
      using (public.is_org_member(organization_id, auth.uid()));
  end if;

  -- onboarding_responses
  if not exists (select 1 from pg_policies where tablename='onboarding_responses' and policyname='onboard_own') then
    create policy "onboard_own" on public.onboarding_responses for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  -- plan_tier_limits (public read)
  if not exists (select 1 from pg_policies where tablename='plan_tier_limits' and policyname='plan_tier_limits_read') then
    create policy "plan_tier_limits_read" on public.plan_tier_limits for select using (true);
  end if;

  -- stripe_webhook_events (service role only via restrictive policy)
  if not exists (select 1 from pg_policies where tablename='stripe_webhook_events' and policyname='no_direct_api_access') then
    create policy "no_direct_api_access" on public.stripe_webhook_events
      as restrictive using (false);
  end if;

  -- tool_runs
  if not exists (select 1 from pg_policies where tablename='tool_runs' and policyname='runs_org_read') then
    create policy "runs_org_read" on public.tool_runs for select
      using (public.is_org_member(organization_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='tool_runs' and policyname='runs_org_insert') then
    create policy "runs_org_insert" on public.tool_runs for insert
      with check (public.is_org_member(organization_id, auth.uid()) and auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='tool_runs' and policyname='runs_own_update') then
    create policy "runs_own_update" on public.tool_runs for update
      using (auth.uid() = user_id);
  end if;

  -- generated_assets
  if not exists (select 1 from pg_policies where tablename='generated_assets' and policyname='assets_org_read') then
    create policy "assets_org_read" on public.generated_assets for select
      using (public.is_org_member(organization_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='generated_assets' and policyname='assets_org_insert') then
    create policy "assets_org_insert" on public.generated_assets for insert
      with check (public.is_org_member(organization_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='generated_assets' and policyname='assets_org_update') then
    create policy "assets_org_update" on public.generated_assets for update
      using (public.is_org_member(organization_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='generated_assets' and policyname='assets_org_delete') then
    create policy "assets_org_delete" on public.generated_assets for delete
      using (public.is_org_member(organization_id, auth.uid()));
  end if;

  -- failed_jobs
  if not exists (select 1 from pg_policies where tablename='failed_jobs' and policyname='service_role_all') then
    create policy "service_role_all" on public.failed_jobs for all to service_role
      using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='failed_jobs' and policyname='own_rows_read') then
    create policy "own_rows_read" on public.failed_jobs for select to authenticated
      using (user_id = auth.uid());
  end if;

  -- leads
  if not exists (select 1 from pg_policies where tablename='leads' and policyname='leads_org_member') then
    create policy "leads_org_member" on public.leads for all to authenticated
      using (public.is_org_member(organization_id, auth.uid()))
      with check (public.is_org_member(organization_id, auth.uid()));
  end if;

  -- automation_settings
  if not exists (select 1 from pg_policies where tablename='automation_settings' and policyname='auto_org_read') then
    create policy "auto_org_read" on public.automation_settings for select to authenticated
      using (public.is_org_member(organization_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='automation_settings' and policyname='auto_org_write') then
    create policy "auto_org_write" on public.automation_settings for all to authenticated
      using (public.is_org_member(organization_id, auth.uid()))
      with check (public.is_org_member(organization_id, auth.uid()));
  end if;

  -- usage_tracking
  if not exists (select 1 from pg_policies where tablename='usage_tracking' and policyname='usage_own_org') then
    create policy "usage_own_org" on public.usage_tracking for all to authenticated
      using (public.is_org_member(organization_id, auth.uid()));
  end if;

  -- website_analyses
  if not exists (select 1 from pg_policies where tablename='website_analyses' and policyname='wa_org_read') then
    create policy "wa_org_read" on public.website_analyses for select
      using (public.is_org_member(organization_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='website_analyses' and policyname='wa_org_write') then
    create policy "wa_org_write" on public.website_analyses for all
      using (public.is_org_member(organization_id, auth.uid()));
  end if;

  -- user_integrations
  if not exists (select 1 from pg_policies where tablename='user_integrations' and policyname='ui_own_delete') then
    create policy "ui_own_delete" on public.user_integrations for delete
      using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='user_integrations' and policyname='ui_own_masked_select') then
    create policy "ui_own_masked_select" on public.user_integrations for select
      using (auth.uid() = user_id);
  end if;

  -- ai_operator_configs (service_role full, authenticated own rows)
  if not exists (select 1 from pg_policies where tablename='ai_operator_configs' and policyname='service_role_all') then
    create policy "service_role_all" on public.ai_operator_configs for all to service_role
      using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='ai_operator_configs' and policyname='own_rows_read') then
    create policy "own_rows_read" on public.ai_operator_configs for select to authenticated
      using (user_id = auth.uid());
  end if;

  -- ai_dashboards
  if not exists (select 1 from pg_policies where tablename='ai_dashboards' and policyname='ai_dashboards_select') then
    create policy "ai_dashboards_select" on public.ai_dashboards for select to authenticated
      using (public.is_org_member(organization_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='ai_dashboards' and policyname='ai_dashboards_insert') then
    create policy "ai_dashboards_insert" on public.ai_dashboards for insert to authenticated
      with check (public.is_org_member(organization_id, auth.uid()) and auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='ai_dashboards' and policyname='ai_dashboards_delete') then
    create policy "ai_dashboards_delete" on public.ai_dashboards for delete to authenticated
      using (auth.uid() = user_id);
  end if;

  -- operator_prompts
  if not exists (select 1 from pg_policies where tablename='operator_prompts' and policyname='service_role_all') then
    create policy "service_role_all" on public.operator_prompts for all to service_role
      using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='operator_prompts' and policyname='own_rows_read') then
    create policy "own_rows_read" on public.operator_prompts for select to authenticated
      using (true);
  end if;

end $$;

-- ── 12. Grants ────────────────────────────────────────────────────────
grant select on public.users                  to anon, authenticated, service_role;
grant select on public.user_credit_balance    to authenticated, service_role;
grant select on public.user_integrations_masked to authenticated;
grant select on public.ai_operator_config     to anon, authenticated, service_role;
grant select on public.plan_tier_limits       to authenticated, anon;
grant select, insert, delete on public.ai_dashboards to authenticated;
grant all on public.ai_dashboards             to service_role;
grant all on public.leads                     to service_role;
grant all on public.automation_settings       to service_role;
grant all on public.usage_tracking            to service_role;
grant all on public.website_analyses          to service_role;
grant all on public.user_integrations         to service_role;
grant all on public.operator_prompts          to service_role;

revoke execute on function public.get_org_entitlements(uuid)   from anon;
revoke execute on function public.set_user_integration(uuid, text, text, text) from anon, public;
revoke execute on function public.get_user_integration_secret(uuid, text, text) from anon, public;
grant  execute on function public.get_org_entitlements(uuid)   to authenticated, service_role;
grant  execute on function public.set_user_integration(uuid, text, text, text) to authenticated, service_role;
grant  execute on function public.get_user_integration_secret(uuid, text, text) to service_role;

-- ── 13. Storage ────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values
  ('uploads',            'uploads',            false),
  ('generated-assets',   'generated-assets',   false),
  ('website-snapshots',  'website-snapshots',  false),
  ('brand-assets',       'brand-assets',       false),
  ('exports',            'exports',            false)
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='private_buckets_org_read') then
    create policy "private_buckets_org_read" on storage.objects for select to authenticated
      using (bucket_id in ('uploads','generated-assets','website-snapshots','exports')
        and public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='private_buckets_org_write') then
    create policy "private_buckets_org_write" on storage.objects for insert to authenticated
      with check (bucket_id in ('uploads','generated-assets','website-snapshots','exports')
        and public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='private_buckets_org_update') then
    create policy "private_buckets_org_update" on storage.objects for update to authenticated
      using (bucket_id in ('uploads','generated-assets','website-snapshots','exports')
        and public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='private_buckets_org_delete') then
    create policy "private_buckets_org_delete" on storage.objects for delete to authenticated
      using (bucket_id in ('uploads','generated-assets','website-snapshots','exports')
        and public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='brand_assets_org_write') then
    create policy "brand_assets_org_write" on storage.objects for insert to authenticated
      with check (bucket_id = 'brand-assets'
        and public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='brand_assets_org_update') then
    create policy "brand_assets_org_update" on storage.objects for update to authenticated
      using (bucket_id = 'brand-assets'
        and public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));
  end if;
end $$;

-- ── 14. Seed: Plan Tier Limits ────────────────────────────────────────
insert into public.plan_tier_limits (plan, price_usd, monthly_generation_limit, allowed_tools)
values
  ('starter', 0,   5,
   array['validate-idea','generate-pitch']),
  ('launch',  49,  50,
   array['validate-idea','generate-pitch','generate-gtm-strategy','generate-offer',
         'kill-my-idea','idea-vs-idea','landing-page','first-10-customers']),
  ('operate', 149, 200,
   array['validate-idea','generate-pitch','generate-gtm-strategy','generate-offer',
         'kill-my-idea','idea-vs-idea','landing-page','first-10-customers',
         'generate-ops-plan','generate-followup-sequence','funding-score',
         'investor-emails','business-plan','analyze-website']),
  ('scale',   299, null,
   array['validate-idea','generate-pitch','generate-gtm-strategy','generate-offer',
         'kill-my-idea','idea-vs-idea','landing-page','first-10-customers',
         'generate-ops-plan','generate-followup-sequence','funding-score',
         'investor-emails','business-plan','analyze-website','competitor-analysis',
         'pricing-strategy','revenue-projector'])
on conflict (plan) do update set
  price_usd                = excluded.price_usd,
  monthly_generation_limit = excluded.monthly_generation_limit,
  allowed_tools            = excluded.allowed_tools,
  updated_at               = now();

-- ── 15. Seed: Operator Prompts ────────────────────────────────────────
insert into public.operator_prompts (component, system_prompt, version)
values
  ('brand_voice',
   'You are a brand voice strategist. Given a business niche, tone, and ICP, produce a concise brand voice guide: 3-5 core voice attributes, a writing style description, 10 power words, and 3 example sentences.',
   'v1'),
  ('content_blog',
   'You are an SEO content strategist. Write a complete 800-1200 word blog post with H2/H3 structure, a compelling intro, actionable body sections, and a CTA. Optimise for the target keyword.',
   'v1'),
  ('social',
   'You are a social-media copywriter. Produce platform-optimised posts: LinkedIn (thought leadership, 150-200 words), Twitter/X (thread of 5 tweets ≤280 chars each), Instagram (caption + 10 hashtags). Match brand voice.',
   'v1'),
  ('sales_script',
   'You are a sales coach. Write a full sales call script: opener, pain-discovery questions, solution pitch, objection-handling (price / timing / trust), trial-close, and follow-up CTA. Keep it conversational.',
   'v1'),
  ('client_reporting',
   'You are a client success analyst. Given KPI data (leads, calls booked, revenue, churn), write a concise executive summary: highlights, lowlights, 3 action items, and a forward-looking paragraph.',
   'v1'),
  ('automation_builder',
   'You are an n8n workflow architect. Given a business process description, output a valid n8n workflow JSON with nodes, connections, and credentials placeholders. Include a plain-English summary of what the workflow does.',
   'v1')
on conflict (component) do update set
  system_prompt = excluded.system_prompt,
  version       = excluded.version,
  updated_at    = now();
