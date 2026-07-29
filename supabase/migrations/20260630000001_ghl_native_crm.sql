-- ─────────────────────────────────────────────────────────────────────────────
-- GHL-native CRM expansion (Launchpad Nova — Master Build, Phase 1 / Migration 1)
--
-- Adds the unified-inbox, scheduling, automation-builder, forms, campaigns and
-- reputation tables that let Nova replace GoHighLevel natively.
--
-- Reconciliation notes (this schema already existed before the directive):
--   • The directive specs `org_id` on new tables. The live schema's dominant
--     convention is `organization_id` gated by `public.is_org_member(org, uid)`
--     (leads, companies, crm_activities, nova_actions, weekly_reviews…). We follow
--     the existing convention so RLS, joins and helpers stay consistent.
--   • `workflow_runs` already EXISTS as the n8n execution log — NOT recreated.
--     Automation-builder run tracking is served by the existing
--     `automation_workflow_runs` table; `automation_workflows` below stores the
--     visual builder definition it runs against.
--   • Everything here is additive and idempotent (IF NOT EXISTS / drop-create
--     policy), safe to run more than once and safe alongside the deploy pipeline.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. automation_workflows — visual workflow builder definitions ────────────
create table if not exists public.automation_workflows (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  created_by        uuid references auth.users(id),
  name              text not null,
  description       text,
  trigger_type      text not null check (trigger_type in (
                      'contact_created','contact_tagged','lead_stage_changed',
                      'form_submitted','appointment_booked','appointment_cancelled',
                      'appointment_no_show','message_received','payment_received',
                      'manual','schedule','webhook'
                    )),
  trigger_config    jsonb not null default '{}',
  steps             jsonb not null default '[]',
  is_active         boolean not null default false,
  run_count         integer not null default 0,
  last_triggered_at timestamptz,
  status            text not null default 'draft' check (status in ('draft','active','paused','archived')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.automation_workflows enable row level security;
create index if not exists idx_automation_workflows_org on public.automation_workflows(organization_id, created_at desc);
drop policy if exists "automation_workflows_all" on public.automation_workflows;
create policy "automation_workflows_all" on public.automation_workflows
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));
drop trigger if exists set_updated_at on public.automation_workflows;
create trigger set_updated_at before update on public.automation_workflows
  for each row execute function public.set_updated_at();

-- ── 2. conversations — unified inbox across channels ─────────────────────────
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id      uuid references public.contacts(id) on delete set null,
  channel         text not null check (channel in ('email','sms','whatsapp','instagram','facebook','webchat')),
  direction       text not null check (direction in ('inbound','outbound')),
  subject         text,
  body            text not null,
  status          text not null default 'open' check (status in ('open','read','replied','archived')),
  assigned_to     uuid references auth.users(id),
  ai_draft        text,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
alter table public.conversations enable row level security;
create index if not exists idx_conversations_org     on public.conversations(organization_id, created_at desc);
create index if not exists idx_conversations_contact on public.conversations(contact_id);
drop policy if exists "conversations_all" on public.conversations;
create policy "conversations_all" on public.conversations
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- ── 3. calendar_events — appointments ────────────────────────────────────────
create table if not exists public.calendar_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id      uuid references public.contacts(id) on delete set null,
  title           text not null,
  description     text,
  start_time      timestamptz not null,
  end_time        timestamptz not null,
  status          text not null default 'scheduled' check (status in ('scheduled','confirmed','cancelled','no_show','completed')),
  event_type      text not null default 'appointment' check (event_type in ('appointment','call','demo','follow_up','meeting')),
  location        text,
  meeting_link    text,
  assigned_to     uuid references auth.users(id),
  reminder_sent   boolean not null default false,
  notes           text,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.calendar_events enable row level security;
create index if not exists idx_calendar_events_org   on public.calendar_events(organization_id, start_time);
create index if not exists idx_calendar_events_contact on public.calendar_events(contact_id);
drop policy if exists "calendar_events_all" on public.calendar_events;
create policy "calendar_events_all" on public.calendar_events
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));
drop trigger if exists set_updated_at on public.calendar_events;
create trigger set_updated_at before update on public.calendar_events
  for each row execute function public.set_updated_at();

-- ── 4. booking_pages — public self-serve scheduling config ───────────────────
create table if not exists public.booking_pages (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  slug                 text unique not null,
  title                text not null,
  description          text,
  duration_minutes     integer not null default 30,
  buffer_minutes       integer not null default 10,
  available_days       integer[] not null default '{1,2,3,4,5}',
  available_start      text not null default '09:00',
  available_end        text not null default '17:00',
  timezone             text not null default 'America/New_York',
  event_type           text not null default 'appointment',
  confirmation_message text,
  is_active            boolean not null default true,
  metadata             jsonb not null default '{}',
  created_at           timestamptz not null default now()
);
alter table public.booking_pages enable row level security;
create index if not exists idx_booking_pages_org  on public.booking_pages(organization_id);
create index if not exists idx_booking_pages_slug on public.booking_pages(slug);
-- Public (anon + authenticated) may read active booking pages to render /book/[slug].
drop policy if exists "booking_pages_public_read" on public.booking_pages;
create policy "booking_pages_public_read" on public.booking_pages
  for select using (is_active = true);
drop policy if exists "booking_pages_manage" on public.booking_pages;
create policy "booking_pages_manage" on public.booking_pages
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- ── 5. forms — lead capture forms ────────────────────────────────────────────
create table if not exists public.forms (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  created_by       uuid references auth.users(id),
  name             text not null,
  description      text,
  fields           jsonb not null default '[]',
  submit_action    text not null default 'message' check (submit_action in ('message','redirect','workflow')),
  submit_message   text,
  redirect_url     text,
  workflow_id      uuid references public.automation_workflows(id) on delete set null,
  is_active        boolean not null default true,
  submission_count integer not null default 0,
  created_at       timestamptz not null default now()
);
alter table public.forms enable row level security;
create index if not exists idx_forms_org on public.forms(organization_id);
-- Public may read active forms to render the public form page /f/[form-id].
drop policy if exists "forms_public_read" on public.forms;
create policy "forms_public_read" on public.forms
  for select using (is_active = true);
drop policy if exists "forms_manage" on public.forms;
create policy "forms_manage" on public.forms
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- ── 6. form_submissions ──────────────────────────────────────────────────────
create table if not exists public.form_submissions (
  id              uuid primary key default gen_random_uuid(),
  form_id         uuid not null references public.forms(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id      uuid references public.contacts(id) on delete set null,
  data            jsonb not null,
  ip_address      text,
  user_agent      text,
  created_at      timestamptz not null default now()
);
alter table public.form_submissions enable row level security;
create index if not exists idx_form_submissions_form on public.form_submissions(form_id, created_at desc);
create index if not exists idx_form_submissions_org  on public.form_submissions(organization_id);
-- Anyone may submit a form (public lead capture).
drop policy if exists "form_submissions_public_insert" on public.form_submissions;
create policy "form_submissions_public_insert" on public.form_submissions
  for insert with check (true);
drop policy if exists "form_submissions_read" on public.form_submissions;
create policy "form_submissions_read" on public.form_submissions
  for select using (public.is_org_member(organization_id, auth.uid()));

-- ── 7. tasks — CRM tasks ─────────────────────────────────────────────────────
create table if not exists public.tasks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id      uuid references public.contacts(id) on delete set null,
  lead_id         uuid references public.leads(id) on delete set null,
  assigned_to     uuid references auth.users(id),
  created_by      uuid references auth.users(id),
  title           text not null,
  description     text,
  due_date        timestamptz,
  priority        text not null default 'medium' check (priority in ('low','medium','high')),
  status          text not null default 'open' check (status in ('open','in_progress','completed','cancelled')),
  task_type       text not null default 'task' check (task_type in ('task','call','email','follow_up','meeting')),
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);
alter table public.tasks enable row level security;
create index if not exists idx_tasks_org      on public.tasks(organization_id, due_date);
create index if not exists idx_tasks_contact  on public.tasks(contact_id);
create index if not exists idx_tasks_lead     on public.tasks(lead_id);
create index if not exists idx_tasks_assignee on public.tasks(assigned_to);
drop policy if exists "tasks_all" on public.tasks;
create policy "tasks_all" on public.tasks
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- ── 8. tags — reusable tag definitions ───────────────────────────────────────
create table if not exists public.tags (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  color           text not null default 'gray',
  usage_count     integer not null default 0,
  created_at      timestamptz not null default now(),
  unique (organization_id, name)
);
alter table public.tags enable row level security;
create index if not exists idx_tags_org on public.tags(organization_id);
drop policy if exists "tags_all" on public.tags;
create policy "tags_all" on public.tags
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- ── 9. email_templates ───────────────────────────────────────────────────────
create table if not exists public.email_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by      uuid references auth.users(id),
  name            text not null,
  subject         text not null,
  body_html       text not null,
  body_text       text,
  category        text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.email_templates enable row level security;
create index if not exists idx_email_templates_org on public.email_templates(organization_id);
drop policy if exists "email_templates_all" on public.email_templates;
create policy "email_templates_all" on public.email_templates
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));
drop trigger if exists set_updated_at on public.email_templates;
create trigger set_updated_at before update on public.email_templates
  for each row execute function public.set_updated_at();

-- ── 10. campaigns — email/SMS broadcasts ─────────────────────────────────────
create table if not exists public.campaigns (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  created_by         uuid references auth.users(id),
  name               text not null,
  channel            text not null check (channel in ('email','sms')),
  template_id        uuid references public.email_templates(id) on delete set null,
  subject            text,
  body               text,
  audience_filter    jsonb not null default '{}',
  status             text not null default 'draft' check (status in ('draft','scheduled','sending','sent','cancelled')),
  scheduled_at       timestamptz,
  sent_at            timestamptz,
  recipient_count    integer not null default 0,
  open_count         integer not null default 0,
  click_count        integer not null default 0,
  reply_count        integer not null default 0,
  unsubscribe_count  integer not null default 0,
  created_at         timestamptz not null default now()
);
alter table public.campaigns enable row level security;
create index if not exists idx_campaigns_org on public.campaigns(organization_id, created_at desc);
drop policy if exists "campaigns_all" on public.campaigns;
create policy "campaigns_all" on public.campaigns
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- ── 11. reputation_requests — review request tracking ────────────────────────
create table if not exists public.reputation_requests (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id      uuid references public.contacts(id) on delete set null,
  platform        text not null check (platform in ('google','facebook','yelp','trustpilot')),
  channel         text not null check (channel in ('email','sms')),
  status          text not null default 'sent' check (status in ('sent','opened','clicked','reviewed','ignored')),
  sent_at         timestamptz not null default now(),
  reviewed_at     timestamptz,
  review_url      text
);
alter table public.reputation_requests enable row level security;
create index if not exists idx_reputation_requests_org on public.reputation_requests(organization_id, sent_at desc);
drop policy if exists "reputation_requests_all" on public.reputation_requests;
create policy "reputation_requests_all" on public.reputation_requests
  for all using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- ── 12. Column additions to existing tables ──────────────────────────────────
-- contacts uses `org_id` (not organization_id). `tags` already exists — skipped.
alter table public.contacts add column if not exists custom_fields jsonb not null default '{}';
alter table public.contacts add column if not exists do_not_contact boolean not null default false;
alter table public.contacts add column if not exists opted_out_sms boolean not null default false;
alter table public.contacts add column if not exists lead_value numeric;
alter table public.contacts add column if not exists assigned_to uuid references auth.users(id);

alter table public.leads add column if not exists workflow_id uuid references public.automation_workflows(id) on delete set null;
alter table public.leads add column if not exists last_activity_at timestamptz;
