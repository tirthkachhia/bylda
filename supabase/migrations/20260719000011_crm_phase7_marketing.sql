-- ── Phase 7: Marketing ───────────────────────────────────────────────────────
-- UTM tagging on campaigns, lead↔campaign attribution, campaign links on the
-- existing forms/form_submissions, and native landing pages. Additive/idempotent.

-- ── campaigns: UTM + spend so broadcasts double as attributable campaigns ────
alter table public.campaigns
  add column if not exists utm_source    text,
  add column if not exists utm_medium    text,
  add column if not exists utm_campaign  text,
  add column if not exists campaign_type text,
  add column if not exists budget        numeric;
create index if not exists idx_campaigns_utm on public.campaigns(organization_id, utm_campaign);

-- ── campaign links on leads + forms + submissions ────────────────────────────
alter table public.leads
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
create index if not exists idx_leads_campaign on public.leads(campaign_id);

alter table public.forms
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
alter table public.form_submissions
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;

-- ── campaign_attributions — first/last touch, UTM snapshot, revenue credit ───
create table if not exists public.campaign_attributions (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  campaign_id         uuid references public.campaigns(id) on delete set null,
  lead_id             uuid references public.leads(id) on delete cascade,
  contact_id          uuid references public.contacts(id) on delete set null,
  touch               text not null default 'first_touch' check (touch in ('first_touch', 'last_touch')),
  utm_source          text,
  utm_medium          text,
  utm_campaign        text,
  revenue_attributed  numeric not null default 0,
  attributed_at       timestamptz not null default now(),
  unique (lead_id, campaign_id, touch)
);
alter table public.campaign_attributions enable row level security;
create index if not exists idx_campaign_attributions_campaign on public.campaign_attributions(campaign_id);
create index if not exists idx_campaign_attributions_lead     on public.campaign_attributions(lead_id);

drop policy if exists "campaign_attributions_org_member" on public.campaign_attributions;
create policy "campaign_attributions_org_member" on public.campaign_attributions
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- ── landing_pages — native landing pages ─────────────────────────────────────
create table if not exists public.landing_pages (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  campaign_id      uuid references public.campaigns(id) on delete set null,
  form_id          uuid references public.forms(id) on delete set null,
  slug             text unique not null,
  title            text not null,
  content          jsonb not null default '{}',   -- block/section model
  is_published     boolean not null default false,
  view_count       integer not null default 0,
  submission_count integer not null default 0,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.landing_pages enable row level security;
create index if not exists idx_landing_pages_org  on public.landing_pages(organization_id);
create index if not exists idx_landing_pages_slug on public.landing_pages(slug);

-- Public may read published pages to render /p/[slug].
drop policy if exists "landing_pages_public_read" on public.landing_pages;
create policy "landing_pages_public_read" on public.landing_pages
  for select using (is_published = true);
drop policy if exists "landing_pages_manage" on public.landing_pages;
create policy "landing_pages_manage" on public.landing_pages
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop trigger if exists trg_landing_pages_updated on public.landing_pages;
create trigger trg_landing_pages_updated
  before update on public.landing_pages
  for each row execute function public.set_updated_at();

-- ── campaign_performance view — spend, leads, pipeline, won, ROI ─────────────
create or replace view public.campaign_performance
with (security_invoker = true) as
select
  c.id            as campaign_id,
  c.organization_id,
  c.name,
  c.channel,
  c.utm_campaign,
  c.budget,
  count(distinct l.id)                                            as lead_count,
  count(distinct l.id) filter (where l.stage = 'Won')            as won_count,
  coalesce(sum(l.value) filter (where l.stage = 'Won'), 0)       as won_value,
  coalesce(sum(l.value) filter (where l.stage not in ('Won','Lost')), 0) as open_pipeline,
  case
    when coalesce(c.budget, 0) > 0
      then round(coalesce(sum(l.value) filter (where l.stage = 'Won'), 0) / c.budget, 2)
    else null
  end as roi
from public.campaigns c
left join public.leads l on l.campaign_id = c.id
group by c.id;

grant select on public.campaign_performance to authenticated;
