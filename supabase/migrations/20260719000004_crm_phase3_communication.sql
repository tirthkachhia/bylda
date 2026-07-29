-- ── Phase 3: Communication Hub ───────────────────────────────────────────────
-- The unified inbox already lives in `conversations` (one row per message, with
-- channel/direction/body). Phase 3 extends it for threading + delivery tracking,
-- adds email signatures, and introduces the channel-agnostic sequences engine
-- (multi-touch cadences) that also covers sales-engagement. Additive/idempotent.

-- ── conversations: threading, delivery time, deal link, internal channel ─────
alter table public.conversations
  add column if not exists thread_id  uuid,
  add column if not exists lead_id    uuid references public.leads(id) on delete set null,
  add column if not exists sent_at    timestamptz,
  add column if not exists sequence_enrollment_id uuid;

create index if not exists idx_conversations_thread on public.conversations(thread_id, created_at);
create index if not exists idx_conversations_lead   on public.conversations(lead_id);

-- Allow internal notes + generic live chat as channels alongside the originals.
alter table public.conversations drop constraint if exists conversations_channel_check;
alter table public.conversations
  add constraint conversations_channel_check
  check (channel in ('email', 'sms', 'whatsapp', 'instagram', 'facebook', 'webchat', 'chat', 'internal'));

-- ── email_signatures ─────────────────────────────────────────────────────────
create table if not exists public.email_signatures (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  name            text not null,
  body_html       text not null,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.email_signatures enable row level security;
create index if not exists idx_email_signatures_org on public.email_signatures(organization_id);

drop policy if exists "email_signatures_org_member" on public.email_signatures;
create policy "email_signatures_org_member" on public.email_signatures
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop trigger if exists trg_email_signatures_updated on public.email_signatures;
create trigger trg_email_signatures_updated
  before update on public.email_signatures
  for each row execute function public.set_updated_at();

-- ── sequences — multi-touch, channel-agnostic cadences ───────────────────────
create table if not exists public.sequences (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by      uuid references auth.users(id),
  name            text not null,
  description     text,
  status          text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.sequences enable row level security;
create index if not exists idx_sequences_org on public.sequences(organization_id);

drop policy if exists "sequences_org_member" on public.sequences;
create policy "sequences_org_member" on public.sequences
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop trigger if exists trg_sequences_updated on public.sequences;
create trigger trg_sequences_updated
  before update on public.sequences
  for each row execute function public.set_updated_at();

create table if not exists public.sequence_steps (
  id              uuid primary key default gen_random_uuid(),
  sequence_id     uuid not null references public.sequences(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  step_order      integer not null default 0,
  channel         text not null default 'email'
                    check (channel in ('email', 'sms', 'whatsapp', 'call', 'task', 'internal')),
  delay_hours     integer not null default 24,
  subject         text,
  body            text,
  template_id     uuid references public.email_templates(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (sequence_id, step_order)
);
alter table public.sequence_steps enable row level security;
create index if not exists idx_sequence_steps_seq on public.sequence_steps(sequence_id, step_order);

drop policy if exists "sequence_steps_org_member" on public.sequence_steps;
create policy "sequence_steps_org_member" on public.sequence_steps
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

create table if not exists public.sequence_enrollments (
  id              uuid primary key default gen_random_uuid(),
  sequence_id     uuid not null references public.sequences(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id      uuid not null references public.contacts(id) on delete cascade,
  lead_id         uuid references public.leads(id) on delete set null,
  current_step    integer not null default 0,
  status          text not null default 'active'
                    check (status in ('active', 'paused', 'completed', 'unsubscribed', 'bounced')),
  next_run_at     timestamptz,
  enrolled_by     uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (sequence_id, contact_id)
);
alter table public.sequence_enrollments enable row level security;
create index if not exists idx_sequence_enrollments_seq     on public.sequence_enrollments(sequence_id);
create index if not exists idx_sequence_enrollments_contact on public.sequence_enrollments(contact_id);
create index if not exists idx_sequence_enrollments_due
  on public.sequence_enrollments(next_run_at) where status = 'active';

drop policy if exists "sequence_enrollments_org_member" on public.sequence_enrollments;
create policy "sequence_enrollments_org_member" on public.sequence_enrollments
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop trigger if exists trg_sequence_enrollments_updated on public.sequence_enrollments;
create trigger trg_sequence_enrollments_updated
  before update on public.sequence_enrollments
  for each row execute function public.set_updated_at();

-- Late FK now that sequence_enrollments exists: tie a message to the enrollment
-- step that produced it (for open/click attribution back to the cadence).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'conversations_sequence_enrollment_fk') then
    alter table public.conversations
      add constraint conversations_sequence_enrollment_fk
      foreign key (sequence_enrollment_id) references public.sequence_enrollments(id) on delete set null;
  end if;
end $$;
