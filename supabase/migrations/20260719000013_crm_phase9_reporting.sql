-- ── Phase 9: Reporting + Analytics ───────────────────────────────────────────
-- Only new source-of-truth table is dashboard_widgets (per-user widget config);
-- reports read from existing tables via security_invoker views so RLS is
-- preserved. Additive and idempotent.

-- ── dashboard_widgets ────────────────────────────────────────────────────────
create table if not exists public.dashboard_widgets (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  title           text not null,
  widget_type     text not null,               -- kpi | bar | line | funnel | table | leaderboard
  config          jsonb not null default '{}',  -- { source, metric, group_by, filters, ... }
  layout_position integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.dashboard_widgets enable row level security;
create index if not exists idx_dashboard_widgets_owner on public.dashboard_widgets(user_id, layout_position);

-- Owner manages their own widgets; org members may read shared org widgets.
drop policy if exists "dashboard_widgets_owner" on public.dashboard_widgets;
create policy "dashboard_widgets_owner" on public.dashboard_widgets
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_org_member(organization_id, auth.uid()));

drop trigger if exists trg_dashboard_widgets_updated on public.dashboard_widgets;
create trigger trg_dashboard_widgets_updated
  before update on public.dashboard_widgets
  for each row execute function public.set_updated_at();

-- ── crm_kpis — org-level headline numbers ────────────────────────────────────
create or replace view public.crm_kpis
with (security_invoker = true) as
select
  l.organization_id,
  count(*)                                                    as total_leads,
  count(*) filter (where l.stage not in ('Won', 'Lost'))     as open_leads,
  count(*) filter (where l.stage = 'Won')                     as won_leads,
  count(*) filter (where l.stage = 'Lost')                    as lost_leads,
  coalesce(sum(l.value) filter (where l.stage = 'Won'), 0)                     as won_value,
  coalesce(sum(l.value) filter (where l.stage not in ('Won', 'Lost')), 0)      as open_pipeline_value,
  coalesce(sum(l.value * coalesce(l.probability, 0) / 100.0)
             filter (where l.stage not in ('Won', 'Lost')), 0)                 as weighted_pipeline_value,
  round(
    count(*) filter (where l.stage = 'Won')::numeric
    / nullif(count(*) filter (where l.stage in ('Won', 'Lost')), 0) * 100, 1
  )                                                           as win_rate_pct
from public.leads l
group by l.organization_id;

grant select on public.crm_kpis to authenticated;

-- ── pipeline_stage_velocity — avg time in each stage, from history ───────────
create or replace view public.pipeline_stage_velocity
with (security_invoker = true) as
select
  h.organization_id,
  h.from_stage                              as stage,
  count(*)                                  as moves,
  round(avg(h.duration_seconds))            as avg_seconds,
  round(avg(h.duration_seconds) / 86400.0, 1) as avg_days
from public.deal_stage_history h
where h.from_stage is not null and h.duration_seconds is not null
group by h.organization_id, h.from_stage;

grant select on public.pipeline_stage_velocity to authenticated;

-- ── rep_leaderboard — per-owner production ───────────────────────────────────
create or replace view public.rep_leaderboard
with (security_invoker = true) as
select
  l.organization_id,
  l.user_id,
  count(*) filter (where l.stage = 'Won')                                 as won_deals,
  coalesce(sum(l.value) filter (where l.stage = 'Won'), 0)                as won_value,
  count(*) filter (where l.stage not in ('Won', 'Lost'))                  as open_deals,
  coalesce(sum(l.value) filter (where l.stage not in ('Won', 'Lost')), 0) as open_value
from public.leads l
where l.user_id is not null
group by l.organization_id, l.user_id;

grant select on public.rep_leaderboard to authenticated;
