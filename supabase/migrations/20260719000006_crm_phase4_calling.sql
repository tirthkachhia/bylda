-- ── Phase 4: Calling Workspace + Conversation Intelligence ───────────────────
-- Schema for the dialer stack, recordings, transcripts and AI call insights.
-- The telephony/recording integration (carrier choice) is wired separately by
-- the operator; this migration is provider-agnostic — a call row can be created
-- by any carrier webhook, and analyze-call turns a transcript into insights.
-- Additive and idempotent.

-- ── calls ────────────────────────────────────────────────────────────────────
create table if not exists public.calls (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id      uuid references public.contacts(id) on delete set null,
  lead_id         uuid references public.leads(id) on delete set null,
  user_id         uuid references auth.users(id) on delete set null,
  direction       text not null default 'outbound' check (direction in ('inbound', 'outbound')),
  status          text not null default 'completed'
                    check (status in ('queued', 'ringing', 'in_progress', 'completed', 'missed', 'voicemail', 'failed')),
  duration        integer,
  recording_url   text,
  disposition     text,
  outcome_tag     text,
  from_number     text,
  to_number       text,
  provider        text,
  provider_call_id text,
  started_at      timestamptz,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
alter table public.calls enable row level security;
create index if not exists idx_calls_org     on public.calls(organization_id, created_at desc);
create index if not exists idx_calls_contact on public.calls(contact_id);
create index if not exists idx_calls_lead    on public.calls(lead_id);

drop policy if exists "calls_org_member" on public.calls;
create policy "calls_org_member" on public.calls
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- ── call_transcripts ─────────────────────────────────────────────────────────
create table if not exists public.call_transcripts (
  id               uuid primary key default gen_random_uuid(),
  call_id          uuid not null references public.calls(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  transcript_text  text,
  speaker_segments jsonb not null default '[]',
  sentiment_score  numeric,
  created_at       timestamptz not null default now()
);
alter table public.call_transcripts enable row level security;
create index if not exists idx_call_transcripts_call on public.call_transcripts(call_id);

drop policy if exists "call_transcripts_org_member" on public.call_transcripts;
create policy "call_transcripts_org_member" on public.call_transcripts
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- ── call_insights ────────────────────────────────────────────────────────────
create table if not exists public.call_insights (
  id                   uuid primary key default gen_random_uuid(),
  call_id              uuid not null references public.calls(id) on delete cascade,
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  objections           jsonb not null default '[]',
  competitor_mentions  jsonb not null default '[]',
  talk_ratio           numeric,
  next_steps_extracted jsonb not null default '[]',
  summary              text,
  created_at           timestamptz not null default now(),
  unique (call_id)
);
alter table public.call_insights enable row level security;
create index if not exists idx_call_insights_call on public.call_insights(call_id);

drop policy if exists "call_insights_org_member" on public.call_insights;
create policy "call_insights_org_member" on public.call_insights
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- ── call_queues + dial_sessions (power/progressive dialer state) ─────────────
create table if not exists public.call_queues (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  mode            text not null default 'progressive' check (mode in ('preview', 'progressive', 'power')),
  contact_ids     uuid[] not null default '{}',
  is_active       boolean not null default true,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.call_queues enable row level security;
create index if not exists idx_call_queues_org on public.call_queues(organization_id);

drop policy if exists "call_queues_org_member" on public.call_queues;
create policy "call_queues_org_member" on public.call_queues
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop trigger if exists trg_call_queues_updated on public.call_queues;
create trigger trg_call_queues_updated
  before update on public.call_queues
  for each row execute function public.set_updated_at();

create table if not exists public.dial_sessions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  queue_id        uuid references public.call_queues(id) on delete set null,
  user_id         uuid references auth.users(id) on delete set null,
  status          text not null default 'active' check (status in ('active', 'paused', 'ended')),
  cursor          integer not null default 0,
  calls_made      integer not null default 0,
  connects        integer not null default 0,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz
);
alter table public.dial_sessions enable row level security;
create index if not exists idx_dial_sessions_org on public.dial_sessions(organization_id, started_at desc);

drop policy if exists "dial_sessions_org_member" on public.dial_sessions;
create policy "dial_sessions_org_member" on public.dial_sessions
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));
