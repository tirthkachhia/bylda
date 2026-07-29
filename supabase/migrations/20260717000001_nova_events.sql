-- nova_events: append-only event ledger (additive — no existing table changes).
-- Org-scoped (organization_id + is_org_member), matching the rest of the schema.
-- Writes only ever happen server-side from edge functions using the service-role
-- client (which bypasses RLS), never directly from users — mirrors nova_actions.

create table public.nova_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source          text not null,
  event_type      text not null,
  subject_type    text,
  subject_id      uuid,
  payload         jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

create index idx_nova_events_org_time on public.nova_events(organization_id, created_at desc);
create index idx_nova_events_type on public.nova_events(event_type);

alter table public.nova_events enable row level security;

-- Select: org members can read their own org's events
-- (same pattern as business_context_select_member — via public.is_org_member()).
drop policy if exists "nova_events_select_member" on public.nova_events;
create policy "nova_events_select_member" on public.nova_events
  for select using (public.is_org_member(organization_id, auth.uid()));

-- Insert: service-role only (following nova_actions_no_client_insert's pattern).
-- Writes only ever happen from edge functions using the service-role client,
-- which bypasses RLS, so clients are blocked outright.
drop policy if exists "nova_events_no_client_insert" on public.nova_events;
create policy "nova_events_no_client_insert" on public.nova_events
  for insert with check (false);
