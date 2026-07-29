-- ════════════════════════════════════════════════════════════════════
-- Nova Launchpad · Sprint 2 & 3 Schema Additions
-- TASK-031 automation_connections, TASK-032 workflow_runs,
-- TASK-034 usage_events, TASK-037 feature_entitlements,
-- TASK-029 asset_versions, TASK-043 audit fields,
-- TASK-024 workspace_members view
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Automation Connections (TASK-031) ─────────────────────────────
-- Stores active automation/integration configs per workspace.
-- One row per integration type per workspace.
create table if not exists public.automation_connections (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  integration_key text not null,      -- e.g. 'zapier', 'n8n', 'slack', 'airtable'
  status          text not null default 'connected'
                  check (status in ('connected', 'disconnected', 'error')),
  config          jsonb not null default '{}',   -- non-sensitive config only
  last_triggered_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint automation_connections_workspace_integration_key unique (workspace_id, integration_key)
);
alter table public.automation_connections enable row level security;
drop trigger if exists trg_automation_connections_updated on public.automation_connections;
create trigger trg_automation_connections_updated
  before update on public.automation_connections
  for each row execute function public.set_updated_at();
create index if not exists idx_automation_connections_workspace on public.automation_connections(workspace_id);

drop policy if exists "automation_connections_select_owner" on public.automation_connections;
create policy "automation_connections_select_owner"
  on public.automation_connections for select using (user_id = auth.uid());

drop policy if exists "automation_connections_insert_owner" on public.automation_connections;
create policy "automation_connections_insert_owner"
  on public.automation_connections for insert with check (user_id = auth.uid());

drop policy if exists "automation_connections_update_owner" on public.automation_connections;
create policy "automation_connections_update_owner"
  on public.automation_connections for update using (user_id = auth.uid());

drop policy if exists "automation_connections_delete_owner" on public.automation_connections;
create policy "automation_connections_delete_owner"
  on public.automation_connections for delete using (user_id = auth.uid());

-- ── 2. Workflow Runs (TASK-032) ───────────────────────────────────────
-- Tracks individual n8n workflow executions tied to a workspace.
create table if not exists public.workflow_runs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid references public.workspaces(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  workflow_name   text not null,    -- e.g. 'nova-ops-onboarding-intake-save'
  trigger_event   text,             -- what triggered this run
  status          text not null default 'running'
                  check (status in ('running', 'succeeded', 'failed', 'partial')),
  input           jsonb not null default '{}',
  output          jsonb,
  error           text,
  duration_ms     integer,
  n8n_execution_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.workflow_runs enable row level security;
drop trigger if exists trg_workflow_runs_updated on public.workflow_runs;
create trigger trg_workflow_runs_updated
  before update on public.workflow_runs
  for each row execute function public.set_updated_at();
create index if not exists idx_workflow_runs_workspace on public.workflow_runs(workspace_id, created_at desc);
create index if not exists idx_workflow_runs_user      on public.workflow_runs(user_id, created_at desc);

drop policy if exists "workflow_runs_select_own" on public.workflow_runs;
create policy "workflow_runs_select_own"
  on public.workflow_runs for select using (user_id = auth.uid());

-- Service role writes only
drop policy if exists "workflow_runs_no_client_insert" on public.workflow_runs;
create policy "workflow_runs_no_client_insert"
  on public.workflow_runs for insert with check (false);

-- ── 3. Usage Events (TASK-034) ────────────────────────────────────────
-- Append-only granular usage log. Each row = one AI call or workflow.
-- Distinct from usage_tracking (which is an aggregate counter).
create table if not exists public.usage_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  workspace_id    uuid references public.workspaces(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  event_type      text not null,  -- 'tool_run', 'agent_call', 'workflow_run', 'operator_message'
  resource_key    text,           -- tool_key, agent_type, workflow_name
  credits_used    integer not null default 0,
  tokens_in       integer,
  tokens_out      integer,
  model           text,
  duration_ms     integer,
  status          text not null default 'succeeded'
                  check (status in ('succeeded', 'failed')),
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
alter table public.usage_events enable row level security;
create index if not exists idx_usage_events_user      on public.usage_events(user_id, created_at desc);
create index if not exists idx_usage_events_workspace on public.usage_events(workspace_id, created_at desc);
create index if not exists idx_usage_events_org       on public.usage_events(organization_id, created_at desc);
create index if not exists idx_usage_events_type      on public.usage_events(event_type, created_at desc);

drop policy if exists "usage_events_select_own" on public.usage_events;
create policy "usage_events_select_own"
  on public.usage_events for select using (user_id = auth.uid());

drop policy if exists "usage_events_no_client_insert" on public.usage_events;
create policy "usage_events_no_client_insert"
  on public.usage_events for insert with check (false);

-- ── 4. Feature Entitlements (TASK-037) ───────────────────────────────
-- Per-org overrides on plan features (used for manual grants, trials, etc.)
-- plan_tier_limits is the plan-wide default; this table overrides per org.
create table if not exists public.feature_entitlements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  feature_key     text not null,
  enabled         boolean not null default true,
  limit_override  integer,            -- override plan limit for this feature
  expires_at      timestamptz,        -- null = permanent
  granted_by      text,               -- 'admin', 'trial', 'promotion'
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint feature_entitlements_org_feature unique (organization_id, feature_key)
);
alter table public.feature_entitlements enable row level security;
drop trigger if exists trg_feature_entitlements_updated on public.feature_entitlements;
create trigger trg_feature_entitlements_updated
  before update on public.feature_entitlements
  for each row execute function public.set_updated_at();
create index if not exists idx_feature_entitlements_org on public.feature_entitlements(organization_id);

drop policy if exists "feature_entitlements_select_member" on public.feature_entitlements;
create policy "feature_entitlements_select_member"
  on public.feature_entitlements for select
  using (public.is_org_member(organization_id, auth.uid()));

-- Admin/service-role writes only
drop policy if exists "feature_entitlements_no_client_write" on public.feature_entitlements;
create policy "feature_entitlements_no_client_write"
  on public.feature_entitlements for insert with check (false);

-- ── 5. Asset Versions (TASK-029) ──────────────────────────────────────
-- Version history for generated_assets. Each edit creates a new version row.
create table if not exists public.asset_versions (
  id              uuid primary key default gen_random_uuid(),
  asset_id        uuid not null references public.generated_assets(id) on delete cascade,
  version_number  integer not null default 1,
  content         jsonb not null default '{}',
  diff_summary    text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint asset_versions_asset_version unique (asset_id, version_number)
);
alter table public.asset_versions enable row level security;
create index if not exists idx_asset_versions_asset on public.asset_versions(asset_id, version_number desc);

drop policy if exists "asset_versions_select_owner" on public.asset_versions;
create policy "asset_versions_select_owner"
  on public.asset_versions for select
  using (
    exists (
      select 1 from public.generated_assets ga
      where ga.id = asset_id and ga.user_id = auth.uid()
    )
  );

-- ── 6. Audit Fields on Major Tables (TASK-043) ───────────────────────
-- Add updated_by to key tables for admin audit trail.
alter table public.profiles         add column if not exists updated_by uuid references auth.users(id);
alter table public.workspaces       add column if not exists updated_by uuid references auth.users(id);
alter table public.missions         add column if not exists updated_by uuid references auth.users(id);
alter table public.generated_assets add column if not exists updated_by uuid references auth.users(id);
alter table public.subscriptions    add column if not exists updated_by uuid references auth.users(id);

-- ── 7. Workspace Members View (TASK-024) ─────────────────────────────
-- Workspace membership is derived from organization_members.
-- Expose it as a view so code can use the new naming convention.
create or replace view public.workspace_members as
  select
    om.id,
    w.id  as workspace_id,
    om.organization_id,
    om.user_id,
    om.role,
    om.created_at
  from public.organization_members om
  join public.workspaces w on w.organization_id = om.organization_id;
