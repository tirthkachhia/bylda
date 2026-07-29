-- Template applications: tracks which template an org has selected.
-- Thin state table — template definitions live in the static catalog.
-- Follows the is_org_member RLS convention from workspace_mission_schema.sql.

create table if not exists public.template_applications (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  template_slug    text not null,
  applied_at       timestamptz not null default now(),
  customizations   jsonb not null default '{}'
);

create index if not exists template_applications_org_idx
  on public.template_applications(organization_id);

alter table public.template_applications enable row level security;

-- Members can read their org's template selections
create policy "members_select" on public.template_applications
  for select using (public.is_org_member(organization_id, auth.uid()));

-- Members can insert (apply a template)
create policy "members_insert" on public.template_applications
  for insert with check (public.is_org_member(organization_id, auth.uid()));

-- Members can update customizations
create policy "members_update" on public.template_applications
  for update using (public.is_org_member(organization_id, auth.uid()));

-- Service role write access for n8n/edge functions
create policy "service_role_all" on public.template_applications
  for all using (auth.role() = 'service_role');
