-- Two-track onboarding foundation:
--   1. workspaces.mode ('create' | 'operate') + provisioning_status
--   2. onboarding_sessions — per-step answer persistence (resume after tab close)
--   3. business_context — the canonical Business Context Graph every AI call reads
--   4. provision_workspace_tx() — atomic workspace + mission + steps creation,
--      replacing the non-transactional multi-insert in provision-workspace.

-- ── 1. Workspace mode + provisioning status ──────────────────────────
alter table public.workspaces
  add column if not exists mode text not null default 'create'
    check (mode in ('create', 'operate'));

-- Existing workspaces were provisioned by the old flow; default 'complete'
-- so the repair CTA only ever shows for genuinely broken ones.
alter table public.workspaces
  add column if not exists provisioning_status text not null default 'complete'
    check (provisioning_status in ('pending', 'provisioning', 'complete', 'failed'));

-- ── 2. Onboarding sessions (per-step persistence) ────────────────────
create table if not exists public.onboarding_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  mode        text check (mode in ('create', 'operate')),
  step        integer not null default 0,
  answers     jsonb not null default '{}'::jsonb,
  status      text not null default 'in_progress'
              check (status in ('in_progress', 'completed', 'abandoned')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint onboarding_sessions_user_key unique (user_id)
);

alter table public.onboarding_sessions enable row level security;

drop policy if exists "onboarding_sessions_select_own" on public.onboarding_sessions;
create policy "onboarding_sessions_select_own"
  on public.onboarding_sessions for select
  using (user_id = auth.uid());

drop policy if exists "onboarding_sessions_insert_own" on public.onboarding_sessions;
create policy "onboarding_sessions_insert_own"
  on public.onboarding_sessions for insert
  with check (user_id = auth.uid());

drop policy if exists "onboarding_sessions_update_own" on public.onboarding_sessions;
create policy "onboarding_sessions_update_own"
  on public.onboarding_sessions for update
  using (user_id = auth.uid());

drop trigger if exists trg_onboarding_sessions_updated on public.onboarding_sessions;
create trigger trg_onboarding_sessions_updated
  before update on public.onboarding_sessions
  for each row execute function public.set_updated_at();

-- ── 3. Business Context Graph ─────────────────────────────────────────
-- One canonical, versioned context object per organization. Block layout:
--   identity   { name, description, industry, niche, mode }
--   customer   { target, description, personas[] }
--   stage      { stage, lane, revenue_band, team_size }
--   model      { monetization, price_point, fulfillment }
--   goals      { goal_90d, scale_goal, north_star, timeline }
--   constraints{ time, budget, experience, technical }
--   verdicts   { validator_score, validator_verdict, risks[], funding_readiness }
--   motion     { channels[], sales_maturity, bottlenecks[], tool_stack[], reporting_gaps[] }
--   activity   { last_tools[], mission_state, summary }
create table if not exists public.business_context (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id    uuid references public.workspaces(id) on delete set null,
  version         integer not null default 1,
  identity        jsonb not null default '{}'::jsonb,
  customer        jsonb not null default '{}'::jsonb,
  stage           jsonb not null default '{}'::jsonb,
  model           jsonb not null default '{}'::jsonb,
  goals           jsonb not null default '{}'::jsonb,
  constraints     jsonb not null default '{}'::jsonb,
  verdicts        jsonb not null default '{}'::jsonb,
  motion          jsonb not null default '{}'::jsonb,
  activity        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint business_context_org_key unique (organization_id)
);

alter table public.business_context enable row level security;

drop policy if exists "business_context_select_member" on public.business_context;
create policy "business_context_select_member"
  on public.business_context for select
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "business_context_insert_member" on public.business_context;
create policy "business_context_insert_member"
  on public.business_context for insert
  with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "business_context_update_member" on public.business_context;
create policy "business_context_update_member"
  on public.business_context for update
  using (public.is_org_member(organization_id, auth.uid()));

drop trigger if exists trg_business_context_updated on public.business_context;
create trigger trg_business_context_updated
  before update on public.business_context
  for each row execute function public.set_updated_at();

create index if not exists idx_business_context_org on public.business_context(organization_id);

-- Bump version automatically on every update so AI consumers can detect change.
create or replace function public.bump_business_context_version()
returns trigger language plpgsql as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;

drop trigger if exists trg_business_context_version on public.business_context;
create trigger trg_business_context_version
  before update on public.business_context
  for each row execute function public.bump_business_context_version();

-- ── 4. Atomic workspace provisioning ─────────────────────────────────
-- p_mission shape: { title, description, steps: [{ title, description, tool_key }] }
-- Pass null p_mission for operate-mode workspaces (they get a playbook, not a mission).
-- Idempotent: re-running on an already-provisioned workspace keeps its existing mission.
create or replace function public.provision_workspace_tx(
  p_organization_id uuid,
  p_owner_id        uuid,
  p_name            text,
  p_lane            text,
  p_stage           text,
  p_mode            text,
  p_mission         jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_mission_id   uuid;
  v_existing_mission uuid;
  v_step jsonb;
  v_i integer := 0;
begin
  insert into public.workspaces (organization_id, owner_id, name, lane, stage, mode, provisioning_status)
  values (
    p_organization_id,
    p_owner_id,
    coalesce(nullif(p_name, ''), 'My Workspace'),
    coalesce(p_lane, 'Idea')::public.workspace_lane,
    coalesce(p_stage, 'Idea')::public.business_stage,
    coalesce(p_mode, 'create'),
    'provisioning'
  )
  on conflict (organization_id) do update
    set lane  = excluded.lane,
        stage = excluded.stage,
        mode  = excluded.mode,
        provisioning_status = case
          when public.workspaces.provisioning_status = 'complete' then 'complete'
          else 'provisioning'
        end
  returning id, current_mission_id into v_workspace_id, v_existing_mission;

  if v_existing_mission is null and p_mission is not null then
    insert into public.missions (workspace_id, title, description, lane, status, sort_order)
    values (
      v_workspace_id,
      p_mission->>'title',
      p_mission->>'description',
      coalesce(p_lane, 'Idea')::public.workspace_lane,
      'active',
      0
    )
    returning id into v_mission_id;

    for v_step in select * from jsonb_array_elements(coalesce(p_mission->'steps', '[]'::jsonb))
    loop
      insert into public.mission_steps (mission_id, title, description, tool_key, sort_order, status)
      values (
        v_mission_id,
        v_step->>'title',
        v_step->>'description',
        nullif(v_step->>'tool_key', ''),
        v_i,
        'pending'
      );
      v_i := v_i + 1;
    end loop;

    update public.workspaces
       set current_mission_id = v_mission_id
     where id = v_workspace_id;
  else
    v_mission_id := v_existing_mission;
  end if;

  update public.workspaces
     set provisioning_status = 'complete'
   where id = v_workspace_id;

  return jsonb_build_object('workspace_id', v_workspace_id, 'mission_id', v_mission_id);
end;
$$;

comment on function public.provision_workspace_tx is
  'Atomic workspace + first mission + steps creation used by complete-onboarding. Single transaction: no more half-provisioned workspaces.';
