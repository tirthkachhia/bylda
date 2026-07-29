-- ─────────────────────────────────────────────────────────────────────────────
-- Daily briefings surface in-app
--
-- The nova-pulse worker builds a per-org briefing every morning (open alerts,
-- critical loops, overdue outcomes, one recommended action) but only posted it
-- to Slack — the app never showed that Nova checked the business overnight.
-- This table persists each day's briefing so Nova Home can show it. The worker
-- writes with the service role; org members can only read their own org's rows.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.org_briefings (
  id                     uuid        primary key default gen_random_uuid(),
  org_id                 uuid        not null references public.organizations(id) on delete cascade,
  briefing_date          date        not null default current_date,
  alert_count            integer     not null default 0,
  critical_loop_count    integer     not null default 0,
  overdue_outcome_count  integer     not null default 0,
  -- Highest-severity open alert at briefing time: { severity, title, diagnosis }
  top_alert              jsonb,
  recommended_action     text        not null default '',
  created_at             timestamptz not null default now(),
  unique (org_id, briefing_date)
);

alter table public.org_briefings enable row level security;

create index if not exists idx_org_briefings_org_date
  on public.org_briefings(org_id, briefing_date desc);

drop policy if exists "org_briefings_member_read" on public.org_briefings;
create policy "org_briefings_member_read" on public.org_briefings
  for select to authenticated
  using (public.is_org_member(org_id, auth.uid()));
