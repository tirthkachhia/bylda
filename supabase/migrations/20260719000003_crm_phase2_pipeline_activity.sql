-- ── Phase 2: Pipeline Depth + Activity System ────────────────────────────────
-- Multi-pipeline support, automatic stage-history/velocity tracking, and task
-- depth (recurrence, dependencies, checklists). calendar_events / booking_pages
-- / tasks already exist (GHL migration) and are extended here, not recreated.
-- Additive and idempotent.

-- ── pipelines + stages ───────────────────────────────────────────────────────
create table if not exists public.pipelines (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  is_default      boolean not null default false,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.pipelines enable row level security;
create index if not exists idx_pipelines_org on public.pipelines(organization_id);
-- At most one default pipeline per org.
create unique index if not exists uq_pipelines_one_default
  on public.pipelines(organization_id) where is_default;

drop policy if exists "pipelines_org_member" on public.pipelines;
create policy "pipelines_org_member" on public.pipelines
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop trigger if exists trg_pipelines_updated on public.pipelines;
create trigger trg_pipelines_updated
  before update on public.pipelines
  for each row execute function public.set_updated_at();

create table if not exists public.pipeline_stages (
  id                  uuid primary key default gen_random_uuid(),
  pipeline_id         uuid not null references public.pipelines(id) on delete cascade,
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  name                text not null,
  sort_order          integer not null default 0,
  probability_default smallint not null default 0 check (probability_default between 0 and 100),
  is_won              boolean not null default false,
  is_lost             boolean not null default false,
  created_at          timestamptz not null default now()
);
alter table public.pipeline_stages enable row level security;
create index if not exists idx_pipeline_stages_pipeline on public.pipeline_stages(pipeline_id, sort_order);

drop policy if exists "pipeline_stages_org_member" on public.pipeline_stages;
create policy "pipeline_stages_org_member" on public.pipeline_stages
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- ── leads.pipeline_id ────────────────────────────────────────────────────────
alter table public.leads
  add column if not exists pipeline_id uuid references public.pipelines(id) on delete set null;
create index if not exists idx_leads_pipeline on public.leads(pipeline_id);

-- ── Seed a default pipeline (+ stages mirroring the lead_stage enum) per org ──
-- and point existing leads at their org's default pipeline. Idempotent: skips
-- orgs that already have a default pipeline.
do $$
declare
  v_org  record;
  v_pipe uuid;
begin
  for v_org in select id from public.organizations loop
    if exists (select 1 from public.pipelines where organization_id = v_org.id and is_default) then
      continue;
    end if;
    insert into public.pipelines(organization_id, name, is_default)
      values (v_org.id, 'Sales Pipeline', true)
      returning id into v_pipe;
    insert into public.pipeline_stages(pipeline_id, organization_id, name, sort_order, probability_default, is_won, is_lost)
    values
      (v_pipe, v_org.id, 'New',       0, 10,  false, false),
      (v_pipe, v_org.id, 'Contacted', 1, 25,  false, false),
      (v_pipe, v_org.id, 'Qualified', 2, 50,  false, false),
      (v_pipe, v_org.id, 'Proposal',  3, 75,  false, false),
      (v_pipe, v_org.id, 'Won',       4, 100, true,  false),
      (v_pipe, v_org.id, 'Lost',      5, 0,   false, true);
    update public.leads set pipeline_id = v_pipe
      where organization_id = v_org.id and pipeline_id is null;
  end loop;
end $$;

-- ── deal_stage_history — powers time-in-stage + velocity ─────────────────────
create table if not exists public.deal_stage_history (
  id               uuid primary key default gen_random_uuid(),
  lead_id          uuid not null references public.leads(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  from_stage       text,
  to_stage         text not null,
  changed_at       timestamptz not null default now(),
  duration_seconds bigint
);
alter table public.deal_stage_history enable row level security;
create index if not exists idx_deal_stage_history_lead on public.deal_stage_history(lead_id, changed_at);

drop policy if exists "deal_stage_history_org_member" on public.deal_stage_history;
create policy "deal_stage_history_org_member" on public.deal_stage_history
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- Auto-record every stage change with time spent in the previous stage.
-- SECURITY DEFINER so the row is always written regardless of the caller's RLS.
create or replace function public.record_deal_stage_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since timestamptz;
begin
  if NEW.stage is distinct from OLD.stage then
    select changed_at into v_since
      from public.deal_stage_history
      where lead_id = NEW.id
      order by changed_at desc
      limit 1;
    v_since := coalesce(v_since, OLD.created_at, NEW.created_at, now());
    insert into public.deal_stage_history(lead_id, organization_id, from_stage, to_stage, changed_at, duration_seconds)
      values (
        NEW.id, NEW.organization_id, OLD.stage::text, NEW.stage::text, now(),
        greatest(0, extract(epoch from (now() - v_since))::bigint)
      );
  end if;
  return NEW;
end $$;

drop trigger if exists trg_leads_stage_history on public.leads;
create trigger trg_leads_stage_history
  after update of stage on public.leads
  for each row execute function public.record_deal_stage_change();

-- ── tasks: recurrence, dependencies, checklist ───────────────────────────────
alter table public.tasks
  add column if not exists recurrence_rule    text,
  add column if not exists depends_on_task_id uuid references public.tasks(id) on delete set null,
  add column if not exists checklist          jsonb not null default '[]';
create index if not exists idx_tasks_depends_on on public.tasks(depends_on_task_id);

-- ── calendar_events: link to a deal (contact link already exists) ────────────
alter table public.calendar_events
  add column if not exists lead_id uuid references public.leads(id) on delete set null;
create index if not exists idx_calendar_events_lead on public.calendar_events(lead_id);

-- ── booking_pages: round-robin owner pool (Phase 2 booking_links role) ───────
alter table public.booking_pages
  add column if not exists round_robin_owners uuid[] not null default '{}';
