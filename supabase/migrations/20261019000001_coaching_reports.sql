-- Rep coaching reports: one short page per rep per period, written by the
-- coaching-report edge function from stored moments, scores, and adherence.
-- trigger is the seam for scheduled (weekly) reports later; today only manual.
create table if not exists public.coaching_reports (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  rep_id              uuid not null references public.reps(id) on delete cascade,
  created_by          uuid references auth.users(id) on delete set null,
  period_start        date not null,
  period_end          date not null,
  trigger             text not null default 'manual',
  status              text not null default 'running',
  error_message       text,
  call_ids            uuid[] not null default '{}',
  call_count          integer not null default 0,
  playbook_id         uuid references public.coaching_playbooks(id) on delete set null,
  playbook_version_id uuid references public.coaching_playbook_versions(id) on delete set null,
  input               jsonb,
  report              jsonb,
  model               text,
  tokens_in           integer,
  tokens_out          integer,
  cost_usd            numeric(10,6),
  created_at          timestamptz not null default now(),
  completed_at        timestamptz,
  constraint coaching_reports_trigger_check check (trigger in ('manual', 'scheduled')),
  constraint coaching_reports_status_check check (status in ('running', 'completed', 'failed')),
  constraint coaching_reports_period_check check (period_end >= period_start)
);

create index if not exists coaching_reports_rep_idx
  on public.coaching_reports (organization_id, rep_id, created_at desc);

alter table public.coaching_reports enable row level security;

-- Members read; only the edge function (service role) writes.
drop policy if exists "coaching_reports_org_read" on public.coaching_reports;
create policy "coaching_reports_org_read" on public.coaching_reports for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

comment on table public.coaching_reports is
  'One-page coaching note per rep per period. report jsonb follows RepReport in _shared/coaching/report-contract.ts; input jsonb is the ReportInput it was written from.';
