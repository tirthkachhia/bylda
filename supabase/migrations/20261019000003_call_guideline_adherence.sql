-- Per-call judgments against canonical guidelines. One row per (call, guideline)
-- written by analyze-call. This is the time series behind call-over-call and
-- week-over-week behavior tracking: the guideline id is stable per playbook
-- version, so adherence can be counted and compared without text matching.
create table if not exists public.call_guideline_adherence (
  id              uuid primary key default gen_random_uuid(),
  call_id         uuid not null references public.calls(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rep_id          uuid references public.reps(id) on delete set null,
  guideline_id    uuid not null references public.coaching_playbook_guidelines(id) on delete cascade,
  version_id      uuid not null references public.coaching_playbook_versions(id) on delete cascade,
  status          text not null,
  evidence_quote  text,
  note            text,
  analyzed_at     timestamptz not null default now(),
  constraint call_guideline_adherence_status_check
    check (status in ('followed', 'partial', 'missed', 'not_applicable')),
  unique (call_id, guideline_id)
);

create index if not exists call_guideline_adherence_rep_idx
  on public.call_guideline_adherence (organization_id, rep_id, analyzed_at desc);
create index if not exists call_guideline_adherence_guideline_idx
  on public.call_guideline_adherence (guideline_id, status);

-- Learning moments cite the guideline they break by id when the analyzer can map it.
alter table public.call_learning_moments
  add column if not exists guideline_id uuid references public.coaching_playbook_guidelines(id) on delete set null;

alter table public.call_guideline_adherence enable row level security;

drop policy if exists "call_guideline_adherence_org_read" on public.call_guideline_adherence;
create policy "call_guideline_adherence_org_read" on public.call_guideline_adherence
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

comment on table public.call_guideline_adherence is
  'analyze-call''s judgment of one call against one canonical guideline (coaching_playbook_guidelines). Replaced wholesale on each analysis of the call.';
