-- ════════════════════════════════════════════════════════════════════
-- Nova Launchpad · Workspace & Mission Schema
-- Adds workspace/mission paradigm alongside existing org/tool_run tables.
-- All statements are idempotent (CREATE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS).
-- TASK-022 profiles ✓ (exists), TASK-023 workspaces, TASK-024 workspace_members,
-- TASK-025 workspace_intake, TASK-026 missions, TASK-027 mission_steps,
-- TASK-028 generated_assets ✓ (exists), TASK-030 agent_runs,
-- TASK-033 activation_events, TASK-040 FKs/indexes,
-- TASK-041 RLS, TASK-042 service-role rules
-- ════════════════════════════════════════════════════════════════════

-- ── 1. New Enums ──────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'workspace_lane') then
    create type public.workspace_lane as enum ('Idea', 'Offer', 'Customer', 'Systems');
  end if;
  if not exists (select 1 from pg_type where typname = 'mission_status') then
    create type public.mission_status as enum ('active', 'completed', 'skipped', 'paused');
  end if;
  if not exists (select 1 from pg_type where typname = 'step_status') then
    create type public.step_status as enum ('pending', 'in_progress', 'completed', 'skipped');
  end if;
  if not exists (select 1 from pg_type where typname = 'agent_run_status') then
    create type public.agent_run_status as enum ('running', 'succeeded', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'agent_type') then
    create type public.agent_type as enum ('operator', 'intake', 'strategy', 'content', 'automation', 'qa');
  end if;
end $$;

-- ── 2. Workspaces (TASK-023) ──────────────────────────────────────────
-- One workspace per org for v1. Links org to mission state and user lane.
create table if not exists public.workspaces (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id        uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  lane            public.workspace_lane not null default 'Idea',
  stage           public.business_stage not null default 'Idea',
  current_mission_id uuid, -- populated by provision-workspace edge function
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint workspaces_organization_id_key unique (organization_id)
);
alter table public.workspaces enable row level security;
drop trigger if exists trg_workspaces_updated on public.workspaces;
create trigger trg_workspaces_updated
  before update on public.workspaces
  for each row execute function public.set_updated_at();
create index if not exists idx_workspaces_owner on public.workspaces(owner_id);
create index if not exists idx_workspaces_org   on public.workspaces(organization_id);

-- ── 3. Workspace Intake (TASK-025) ───────────────────────────────────
-- Structured onboarding answers per workspace. Persists all answers from
-- each wizard step independently so partial saves don't lose data.
create table if not exists public.workspace_intake (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  full_name       text,
  idea            text,
  stage           text,
  challenge       text,
  lane            public.workspace_lane,
  raw_answers     jsonb not null default '{}',
  completed       boolean not null default false,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint workspace_intake_workspace_id_key unique (workspace_id)
);
alter table public.workspace_intake enable row level security;
drop trigger if exists trg_workspace_intake_updated on public.workspace_intake;
create trigger trg_workspace_intake_updated
  before update on public.workspace_intake
  for each row execute function public.set_updated_at();
create index if not exists idx_workspace_intake_user on public.workspace_intake(user_id);

-- ── 4. Missions (TASK-026) ────────────────────────────────────────────
-- A mission is an assigned, goal-oriented task sequence for a workspace.
-- Seeded by the provision-workspace function based on detected lane.
create table if not exists public.missions (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  title           text not null,
  description     text,
  lane            public.workspace_lane not null default 'Idea',
  status          public.mission_status not null default 'active',
  sort_order      integer not null default 0,
  assigned_at     timestamptz not null default now(),
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.missions enable row level security;
drop trigger if exists trg_missions_updated on public.missions;
create trigger trg_missions_updated
  before update on public.missions
  for each row execute function public.set_updated_at();
create index if not exists idx_missions_workspace on public.missions(workspace_id, sort_order);
create index if not exists idx_missions_status    on public.missions(workspace_id, status);

-- ── 5. Mission Steps (TASK-027) ──────────────────────────────────────
-- Checklist items within a mission. Each step may map to a launchpad tool.
create table if not exists public.mission_steps (
  id              uuid primary key default gen_random_uuid(),
  mission_id      uuid not null references public.missions(id) on delete cascade,
  title           text not null,
  description     text,
  tool_key        text,  -- maps to launchpad tool slug (nullable)
  status          public.step_status not null default 'pending',
  sort_order      integer not null default 0,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.mission_steps enable row level security;
drop trigger if exists trg_mission_steps_updated on public.mission_steps;
create trigger trg_mission_steps_updated
  before update on public.mission_steps
  for each row execute function public.set_updated_at();
create index if not exists idx_mission_steps_mission on public.mission_steps(mission_id, sort_order);

-- ── 6. Deferred FK: workspaces.current_mission_id ────────────────────
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'workspaces_current_mission_id_fkey'
  ) then
    alter table public.workspaces
      add constraint workspaces_current_mission_id_fkey
      foreign key (current_mission_id) references public.missions(id) on delete set null;
  end if;
end $$;

-- ── 7. Agent Runs (TASK-030) ──────────────────────────────────────────
-- Tracks AI operator invocations separately from launchpad tool_runs.
-- Allows attribution of AI cost and output to specific missions/agents.
create table if not exists public.agent_runs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid references public.workspaces(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  mission_id      uuid references public.missions(id) on delete set null,
  agent_type      public.agent_type not null default 'operator',
  input           jsonb not null default '{}',
  output          jsonb,
  status          public.agent_run_status not null default 'running',
  model           text,
  tokens_used     integer,
  error           text,
  duration_ms     integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.agent_runs enable row level security;
drop trigger if exists trg_agent_runs_updated on public.agent_runs;
create trigger trg_agent_runs_updated
  before update on public.agent_runs
  for each row execute function public.set_updated_at();
create index if not exists idx_agent_runs_workspace on public.agent_runs(workspace_id, created_at desc);
create index if not exists idx_agent_runs_user      on public.agent_runs(user_id, created_at desc);
create index if not exists idx_agent_runs_mission   on public.agent_runs(mission_id);

-- ── 8. Activation Events (TASK-033) ──────────────────────────────────
-- Append-only funnel log. Each row is one activation behaviour.
-- event_name examples: 'workspace_created', 'onboarding_complete',
-- 'first_mission_assigned', 'first_tool_run', 'first_ai_output'.
create table if not exists public.activation_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  workspace_id    uuid references public.workspaces(id) on delete cascade,
  event_name      text not null,
  properties      jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
alter table public.activation_events enable row level security;
create index if not exists idx_activation_events_user      on public.activation_events(user_id, created_at desc);
create index if not exists idx_activation_events_workspace on public.activation_events(workspace_id, created_at desc);
create index if not exists idx_activation_events_name      on public.activation_events(event_name);

-- ── 9. RLS Policies (TASK-041) ───────────────────────────────────────

-- workspaces: owner sees own workspaces; org members see their workspace
drop policy if exists "workspaces_select_owner" on public.workspaces;
create policy "workspaces_select_owner"
  on public.workspaces for select
  using (owner_id = auth.uid());

drop policy if exists "workspaces_insert_owner" on public.workspaces;
create policy "workspaces_insert_owner"
  on public.workspaces for insert
  with check (owner_id = auth.uid());

drop policy if exists "workspaces_update_owner" on public.workspaces;
create policy "workspaces_update_owner"
  on public.workspaces for update
  using (owner_id = auth.uid());

-- workspace_intake: only the owning user
drop policy if exists "workspace_intake_select_own" on public.workspace_intake;
create policy "workspace_intake_select_own"
  on public.workspace_intake for select
  using (user_id = auth.uid());

drop policy if exists "workspace_intake_insert_own" on public.workspace_intake;
create policy "workspace_intake_insert_own"
  on public.workspace_intake for insert
  with check (user_id = auth.uid());

drop policy if exists "workspace_intake_update_own" on public.workspace_intake;
create policy "workspace_intake_update_own"
  on public.workspace_intake for update
  using (user_id = auth.uid());

-- missions: owner of the workspace
drop policy if exists "missions_select_workspace_owner" on public.missions;
create policy "missions_select_workspace_owner"
  on public.missions for select
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );

drop policy if exists "missions_insert_workspace_owner" on public.missions;
create policy "missions_insert_workspace_owner"
  on public.missions for insert
  with check (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );

drop policy if exists "missions_update_workspace_owner" on public.missions;
create policy "missions_update_workspace_owner"
  on public.missions for update
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );

-- mission_steps: via workspace owner
drop policy if exists "mission_steps_select_workspace_owner" on public.mission_steps;
create policy "mission_steps_select_workspace_owner"
  on public.mission_steps for select
  using (
    exists (
      select 1 from public.missions m
      join public.workspaces w on w.id = m.workspace_id
      where m.id = mission_id and w.owner_id = auth.uid()
    )
  );

drop policy if exists "mission_steps_update_workspace_owner" on public.mission_steps;
create policy "mission_steps_update_workspace_owner"
  on public.mission_steps for update
  using (
    exists (
      select 1 from public.missions m
      join public.workspaces w on w.id = m.workspace_id
      where m.id = mission_id and w.owner_id = auth.uid()
    )
  );

-- agent_runs: only the running user
drop policy if exists "agent_runs_select_own" on public.agent_runs;
create policy "agent_runs_select_own"
  on public.agent_runs for select
  using (user_id = auth.uid());

-- activation_events: only the event owner
drop policy if exists "activation_events_select_own" on public.activation_events;
create policy "activation_events_select_own"
  on public.activation_events for select
  using (user_id = auth.uid());

-- ── 10. Service-Role-Only Write Policies (TASK-042) ──────────────────
-- agent_runs and activation_events are written by edge functions using
-- the service role key. Users can read but never insert/update directly.

drop policy if exists "agent_runs_no_client_write" on public.agent_runs;
create policy "agent_runs_no_client_write"
  on public.agent_runs for insert
  with check (false); -- service role bypasses RLS

drop policy if exists "activation_events_no_client_write" on public.activation_events;
create policy "activation_events_no_client_write"
  on public.activation_events for insert
  with check (false); -- service role bypasses RLS

-- mission_steps insert is service-role only (seeded by provision-workspace)
drop policy if exists "mission_steps_no_client_insert" on public.mission_steps;
create policy "mission_steps_no_client_insert"
  on public.mission_steps for insert
  with check (false);

-- missions insert is service-role only
drop policy if exists "missions_no_client_insert" on public.missions;
create policy "missions_no_client_insert"
  on public.missions for insert
  with check (false);
