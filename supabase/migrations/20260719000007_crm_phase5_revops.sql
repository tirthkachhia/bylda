-- ── Phase 5: Revenue Operations + Forecasting ────────────────────────────────
-- Territories + assignments, per-rep quotas, a derived forecast-category view,
-- and forecast_snapshots for historical accuracy tracking. Additive/idempotent.

-- Schema-drift guard: leads.user_id is in the base schema's create-table, but
-- some environments' leads table predates it (create-table-if-not-exists skips
-- column definitions on an existing table). The deal_forecast + rep_leaderboard
-- views and the create_lead action all read leads.user_id, so ensure it exists.
alter table public.leads
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- ── territories + assignments ────────────────────────────────────────────────
create table if not exists public.territories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  description     text,
  rules           jsonb not null default '{}',  -- e.g. { region, industry, company_size }
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.territories enable row level security;
create index if not exists idx_territories_org on public.territories(organization_id);

drop policy if exists "territories_org_member" on public.territories;
create policy "territories_org_member" on public.territories
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop trigger if exists trg_territories_updated on public.territories;
create trigger trg_territories_updated
  before update on public.territories
  for each row execute function public.set_updated_at();

create table if not exists public.territory_assignments (
  id              uuid primary key default gen_random_uuid(),
  territory_id    uuid not null references public.territories(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'owner',  -- owner | overlay
  created_at      timestamptz not null default now(),
  unique (territory_id, user_id)
);
alter table public.territory_assignments enable row level security;
create index if not exists idx_territory_assignments_terr on public.territory_assignments(territory_id);
create index if not exists idx_territory_assignments_user on public.territory_assignments(user_id);

drop policy if exists "territory_assignments_org_member" on public.territory_assignments;
create policy "territory_assignments_org_member" on public.territory_assignments
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- ── quotas (per rep, per period) ─────────────────────────────────────────────
create table if not exists public.quotas (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  period          text not null,               -- e.g. '2026-Q3' or '2026-07'
  target_amount   numeric not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, user_id, period)
);
alter table public.quotas enable row level security;
create index if not exists idx_quotas_org_period on public.quotas(organization_id, period);

drop policy if exists "quotas_org_member" on public.quotas;
create policy "quotas_org_member" on public.quotas
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop trigger if exists trg_quotas_updated on public.quotas;
create trigger trg_quotas_updated
  before update on public.quotas
  for each row execute function public.set_updated_at();

-- ── forecast_snapshots (periodic rollup for accuracy tracking) ───────────────
create table if not exists public.forecast_snapshots (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  user_id           uuid references auth.users(id) on delete set null,  -- null = org-wide
  period            text not null,
  forecast_category text not null,             -- pipeline | best_case | commit | closed | omitted
  amount            numeric not null default 0,
  weighted_amount   numeric not null default 0,
  deal_count        integer not null default 0,
  captured_at       timestamptz not null default now()
);
alter table public.forecast_snapshots enable row level security;
create index if not exists idx_forecast_snapshots_org
  on public.forecast_snapshots(organization_id, period, captured_at desc);

drop policy if exists "forecast_snapshots_org_member" on public.forecast_snapshots;
create policy "forecast_snapshots_org_member" on public.forecast_snapshots
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- ── deal_forecast view — forecast category derived from stage + probability ──
-- Not a stored column: derived so it always reflects the live deal. Inherits
-- the caller's RLS on leads (security_invoker view).
create or replace view public.deal_forecast
with (security_invoker = true) as
select
  l.id,
  l.organization_id,
  l.user_id,
  l.pipeline_id,
  l.name,
  l.stage,
  coalesce(l.probability, 0) as probability,
  coalesce(l.value, 0)       as value,
  round(coalesce(l.value, 0) * coalesce(l.probability, 0) / 100.0, 2) as weighted_value,
  case
    when l.stage = 'Won'                                   then 'closed'
    when l.stage = 'Lost'                                  then 'omitted'
    when coalesce(l.probability, 0) >= 75 or l.stage = 'Proposal' then 'commit'
    when coalesce(l.probability, 0) >= 40                  then 'best_case'
    else 'pipeline'
  end as forecast_category
from public.leads l;

grant select on public.deal_forecast to authenticated;
