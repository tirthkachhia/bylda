-- Founder streaks — persists daily-activity streaks per organization so the
-- game layer (level, XP, streak) survives across devices instead of being
-- recomputed client-side. XP/level already derive from persisted tool_runs;
-- streaks need their own row because "days active" isn't otherwise recorded.

create table if not exists public.founder_streaks (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_active_date date,
  updated_at timestamptz not null default now()
);

alter table public.founder_streaks enable row level security;

drop policy if exists founder_streaks_org_members on public.founder_streaks;
create policy founder_streaks_org_members on public.founder_streaks
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));
