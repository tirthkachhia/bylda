-- ── CRM core objects: companies + contacts ──────────────────────────────────
-- The `contacts` table was created out-of-band in production and was never
-- captured in a migration (schema drift) — so a fresh DB / `db reset` would not
-- have it. This migration codifies `contacts` to match the live shape, adds the
-- missing `companies` account object, links them, and backfills the bits the
-- live table is missing (updated_at trigger, company_id).
--
-- Everything is additive and idempotent: a no-op against the drifted production
-- schema, and a faithful create on a clean database.

-- ── companies (org-scoped account records) ───────────────────────────────────
create table if not exists public.companies (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  domain          text,
  website         text,
  industry        text,
  size            text,
  location        text,
  notes           text,
  custom_fields   jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.companies enable row level security;

create index if not exists idx_companies_org on public.companies(organization_id);

drop policy if exists "companies_org_member" on public.companies;
create policy "companies_org_member" on public.companies
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop trigger if exists trg_companies_updated on public.companies;
create trigger trg_companies_updated
  before update on public.companies
  for each row execute function public.set_updated_at();

-- ── contacts (user-owned) — mirrors the live production shape ─────────────────
-- Column set + types match what src/routes/app.contacts.tsx and the
-- workers/nova-contacts-api worker read/write.
create table if not exists public.contacts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  org_id            uuid references public.organizations(id) on delete cascade,
  first_name        text,
  last_name         text,
  email             text,
  phone             text,
  company           text,
  lead_score        integer not null default 0,
  status            text not null default 'new',
  source            text,
  tags              text[] not null default '{}',
  notes             text,
  last_contacted_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Structured association to companies (live table predates this).
alter table public.contacts
  add column if not exists company_id uuid references public.companies(id) on delete set null;

alter table public.contacts enable row level security;

create index if not exists idx_contacts_user    on public.contacts(user_id);
create index if not exists idx_contacts_status  on public.contacts(status);
create index if not exists idx_contacts_company on public.contacts(company_id);

-- Owner-scoped policy (same name as the live policy, so this is a no-op on prod).
drop policy if exists "contacts_user_all" on public.contacts;
create policy "contacts_user_all" on public.contacts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- The live table has no updated_at trigger — add it.
drop trigger if exists trg_contacts_updated on public.contacts;
create trigger trg_contacts_updated
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- ── contact_notes.contact_id FK (was missing) ────────────────────────────────
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'contact_notes_contact_fk'
  ) then
    alter table public.contact_notes
      add constraint contact_notes_contact_fk
      foreign key (contact_id) references public.contacts(id) on delete cascade;
  end if;
end $$;

-- ── Deal ↔ Contact ↔ Company associations on leads ───────────────────────────
alter table public.leads
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;
alter table public.leads
  add column if not exists company_id uuid references public.companies(id) on delete set null;

create index if not exists idx_leads_contact on public.leads(contact_id);
create index if not exists idx_leads_company on public.leads(company_id);
