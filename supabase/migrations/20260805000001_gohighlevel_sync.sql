-- Stable provider IDs make repeated GoHighLevel imports idempotent.
alter table public.contacts add column if not exists external_source text;
alter table public.contacts add column if not exists external_id text;
create unique index if not exists contacts_external_source_id
  on public.contacts (org_id, external_source, external_id);

alter table public.leads add column if not exists external_source text;
alter table public.leads add column if not exists external_id text;
alter table public.leads add column if not exists external_data jsonb not null default '{}';
create unique index if not exists leads_external_source_id
  on public.leads (organization_id, external_source, external_id);
