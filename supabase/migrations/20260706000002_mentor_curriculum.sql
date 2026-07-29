-- Mentor curriculum — the school layer.
--
-- Three tables:
--   mentors           the six AI mentors (static roster, readable by everyone)
--   playbooks         one personalized curriculum per organization, created the
--                     moment the founder accepts their Investment Assessment
--   playbook_lessons  ordered lessons, each delegated to exactly one mentor;
--                     tool_key is backend plumbing and is never shown to the
--                     founder — the UI shows title + mentor only.

-- ── mentors ────────────────────────────────────────────────────────────────
create table if not exists public.mentors (
  id           text primary key,
  name         text not null,
  domain       text not null,
  stages       text[] not null,
  owned_format text,
  voice        text not null,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.mentors enable row level security;

drop policy if exists mentors_read_authenticated on public.mentors;
create policy mentors_read_authenticated on public.mentors
  for select to authenticated using (true);

insert into public.mentors (id, name, domain, stages, owned_format, voice, sort_order) values
  ('maya-okafor', 'Maya Okafor', 'Offer & positioning',
   array['Idea','Validate'], 'contrast',
   'Warm but exacting. Speaks in sharp either/or contrasts, pushes founders to say the uncomfortable specific thing instead of the safe vague one.', 1),
  ('dhruv-patel', 'Dhruv Patel', 'Finance & monetization',
   array['Idea','Validate','Launch','Operate','Scale'], 'score-verdict',
   'Direct and numerate. Every opinion arrives with a number attached. Calm about bad news, allergic to hand-waving. Secondary duty: investor readiness.', 2),
  ('alex-chen', 'Alex Chen', 'Go-to-market & growth',
   array['Validate','Launch'], 'intelligence-report',
   'Energetic field-commander tone. Talks in channels, angles, and weekly experiments. Always names the single next move before the grand plan.', 3),
  ('james-rivera', 'James Rivera', 'Operations & delivery',
   array['Launch','Operate'], 'step-plan',
   'Calm and methodical. Turns chaos into numbered steps. Never assigns two things at once; the current step is the only step.', 4),
  ('priya-nair', 'Priya Nair', 'AI & automation',
   array['Launch','Operate','Scale'], null,
   'Quietly futuristic and practical. Frames every automation as hours handed back. Prefers wiring one small thing today over designing a big system tomorrow.', 5),
  ('mo-latif', 'Mo Latif', 'Revenue & pipeline',
   array['Launch','Operate','Scale'], 'pipeline-snapshot',
   'Upbeat closer energy, grounded in the live pipeline. Talks about real deals by name, follow-up timing, and what money is stuck where.', 6)
on conflict (id) do update set
  name = excluded.name,
  domain = excluded.domain,
  stages = excluded.stages,
  owned_format = excluded.owned_format,
  voice = excluded.voice,
  sort_order = excluded.sort_order;

-- ── playbooks ──────────────────────────────────────────────────────────────
create table if not exists public.playbooks (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  casefile_run_id  uuid references public.tool_runs(id) on delete set null,
  business_model   text not null,
  stage            text not null default 'Validate',
  created_at       timestamptz not null default now(),
  unique (organization_id)
);

alter table public.playbooks enable row level security;

drop policy if exists playbooks_org_members on public.playbooks;
create policy playbooks_org_members on public.playbooks
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- ── playbook_lessons ───────────────────────────────────────────────────────
create table if not exists public.playbook_lessons (
  id               uuid primary key default gen_random_uuid(),
  playbook_id      uuid not null references public.playbooks(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  mentor_id        text not null references public.mentors(id),
  stage            text not null,
  title            text not null,
  tool_key         text not null,
  output_format    text,
  status           text not null default 'locked'
                   check (status in ('locked','active','completed','skipped')),
  position         int  not null,
  summary          text,
  tool_run_id      uuid references public.tool_runs(id) on delete set null,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);

create index if not exists playbook_lessons_org_idx
  on public.playbook_lessons (organization_id, position);
create index if not exists playbook_lessons_playbook_idx
  on public.playbook_lessons (playbook_id, position);

alter table public.playbook_lessons enable row level security;

drop policy if exists playbook_lessons_org_members on public.playbook_lessons;
create policy playbook_lessons_org_members on public.playbook_lessons
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));
