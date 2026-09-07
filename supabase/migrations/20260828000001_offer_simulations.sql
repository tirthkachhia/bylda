-- Bylda Phantom: durable, auditable offer-simulation snapshots.
-- The full result JSON preserves the exact assumptions, evidence, filters, and
-- deterministic financial output shown to the user at run time.

create table if not exists public.offer_simulations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  scenario text not null,
  population_count integer not null check (population_count >= 0),
  confidence_score integer not null check (confidence_score between 0 and 100),
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.offer_simulations enable row level security;
create index if not exists idx_offer_simulations_org_created
  on public.offer_simulations (organization_id, created_at desc);
drop policy if exists "offer_simulations_org_member" on public.offer_simulations;
create policy "offer_simulations_org_member" on public.offer_simulations
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (
    created_by = auth.uid()
    and public.is_org_member(organization_id, auth.uid())
  );
grant select, insert, update, delete on public.offer_simulations to authenticated;
