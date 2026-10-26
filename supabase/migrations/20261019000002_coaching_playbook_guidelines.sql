-- Canonical guidelines: a playbook version turned into a short checklist of
-- observable rep behaviors, each with a stable code (G1, G2, ...). Extracted once
-- per version by the coaching-playbook-guidelines edge function. Later judgments
-- (adherence, moments, report drills) cite a guideline id instead of free text,
-- which is what makes behavior measurable call over call and week over week.
create table if not exists public.coaching_playbook_guidelines (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  playbook_id     uuid not null references public.coaching_playbooks(id) on delete cascade,
  version_id      uuid not null references public.coaching_playbook_versions(id) on delete cascade,
  position        integer not null,
  code            text not null,
  title           text not null,
  detail          text,
  phase           text not null default 'other',
  created_at      timestamptz not null default now(),
  constraint coaching_playbook_guidelines_phase_check check (
    phase in ('opening', 'discovery', 'presentation', 'objections', 'close', 'compliance', 'other')
  ),
  constraint coaching_playbook_guidelines_title_check check (length(title) between 1 and 120),
  constraint coaching_playbook_guidelines_position_check check (position >= 1),
  unique (version_id, position),
  unique (version_id, code)
);

create index if not exists coaching_playbook_guidelines_version_idx
  on public.coaching_playbook_guidelines (version_id, position);

alter table public.coaching_playbook_versions
  add column if not exists guidelines_extracted_at timestamptz,
  add column if not exists guidelines_error text;

alter table public.coaching_playbook_guidelines enable row level security;

-- Members read; only the edge function (service role) writes.
drop policy if exists "coaching_playbook_guidelines_org_read" on public.coaching_playbook_guidelines;
create policy "coaching_playbook_guidelines_org_read" on public.coaching_playbook_guidelines
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

comment on table public.coaching_playbook_guidelines is
  'Observable behaviors extracted from one playbook version. code is stable within a version (G1..Gn); shape follows Guideline in _shared/coaching/guidelines.ts.';
