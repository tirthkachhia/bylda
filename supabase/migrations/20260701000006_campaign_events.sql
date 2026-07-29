-- Per-recipient campaign engagement events (opens / clicks / unsubscribes),
-- written server-side by track-event. Distinct-contact counts roll up into
-- campaigns.open_count / click_count / unsubscribe_count and power the
-- contact-level campaign report. Additive + idempotent.

create table if not exists public.campaign_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id     uuid not null references public.campaigns(id) on delete cascade,
  contact_id      uuid references public.contacts(id) on delete set null,
  type            text not null check (type in ('open','click','unsubscribe')),
  url             text,
  created_at      timestamptz not null default now()
);

alter table public.campaign_events enable row level security;

create index if not exists idx_campaign_events_campaign on public.campaign_events(campaign_id, type);
create index if not exists idx_campaign_events_org on public.campaign_events(organization_id);
-- One distinct (campaign, contact, type) row is enough for unique counts;
-- track-event upserts against this so repeated opens don't inflate totals.
create unique index if not exists uq_campaign_events_unique
  on public.campaign_events(campaign_id, contact_id, type)
  where contact_id is not null;

-- Org members can read engagement; writes happen via service role (track-event).
drop policy if exists "campaign_events_read" on public.campaign_events;
create policy "campaign_events_read" on public.campaign_events
  for select using (public.is_org_member(organization_id, auth.uid()));
