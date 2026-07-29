-- ── Phase 1: Core CRM Objects ────────────────────────────────────────────────
-- Deepens the contact/company/lead model:
--   • parent/child accounts + firmographics on companies
--   • relationship depth + decision-maker context on contacts
--   • contact_relationships (buying committee / org-chart mapping)
--   • duplicate_matches (dedupe queue) + a dynamic merge function
-- Additive and idempotent.

-- ── companies: firmographics + parent/child + merge bookkeeping ───────────────
alter table public.companies
  add column if not exists parent_company_id uuid references public.companies(id) on delete set null,
  add column if not exists funding_stage     text,
  add column if not exists employee_count    integer,
  add column if not exists merged_into_id     uuid references public.companies(id) on delete set null,
  add column if not exists archived_at        timestamptz;

create index if not exists idx_companies_parent on public.companies(parent_company_id);

-- ── contacts: relationship depth + decision-maker context + merge bookkeeping ─
alter table public.contacts
  add column if not exists relationship_strength integer,
  add column if not exists decision_maker_role   text,
  add column if not exists linkedin_url          text,
  add column if not exists merged_into_id        uuid references public.contacts(id) on delete set null;

alter table public.contacts drop constraint if exists contacts_relationship_strength_check;
alter table public.contacts
  add constraint contacts_relationship_strength_check
  check (relationship_strength is null or relationship_strength between 0 and 100);

-- ── contact_relationships: buying committee / org-chart edges ─────────────────
create table if not exists public.contact_relationships (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  contact_id_a      uuid not null references public.contacts(id) on delete cascade,
  contact_id_b      uuid not null references public.contacts(id) on delete cascade,
  relationship_type text not null default 'colleague',
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint contact_relationships_distinct check (contact_id_a <> contact_id_b)
);

-- One edge per unordered pair (ordering enforced in app + this index).
create unique index if not exists uq_contact_relationships_pair
  on public.contact_relationships (organization_id, least(contact_id_a, contact_id_b), greatest(contact_id_a, contact_id_b));

alter table public.contact_relationships enable row level security;

drop policy if exists "contact_relationships_org_member" on public.contact_relationships;
create policy "contact_relationships_org_member" on public.contact_relationships
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop trigger if exists trg_contact_relationships_updated on public.contact_relationships;
create trigger trg_contact_relationships_updated
  before update on public.contact_relationships
  for each row execute function public.set_updated_at();

-- ── duplicate_matches: dedupe queue populated by crm-dedupe ───────────────────
create table if not exists public.duplicate_matches (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type     text not null check (entity_type in ('contact', 'company')),
  entity_id_a     uuid not null,
  entity_id_b     uuid not null,
  confidence      numeric not null default 0 check (confidence between 0 and 1),
  reason          text,
  status          text not null default 'pending' check (status in ('pending', 'merged', 'dismissed')),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  constraint duplicate_matches_distinct check (entity_id_a <> entity_id_b)
);

-- One row per unordered (org, type, pair) so re-scanning is idempotent.
create unique index if not exists uq_duplicate_matches_pair
  on public.duplicate_matches (organization_id, entity_type, least(entity_id_a, entity_id_b), greatest(entity_id_a, entity_id_b));
create index if not exists idx_duplicate_matches_status
  on public.duplicate_matches (organization_id, status);

alter table public.duplicate_matches enable row level security;

drop policy if exists "duplicate_matches_org_member" on public.duplicate_matches;
create policy "duplicate_matches_org_member" on public.duplicate_matches
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- ── crm_merge_records: reassign every FK, archive the loser ───────────────────
-- Discovers all foreign-key columns that reference the target table's id and
-- repoints them from loser → winner, so new referencing tables are covered
-- automatically without editing this function. SECURITY DEFINER (bypasses RLS);
-- callers MUST verify org membership first, and execute is restricted to the
-- service role, so the crm-merge edge function is the only entry point.
create or replace function public.crm_merge_records(
  p_entity_type text,
  p_winner_id   uuid,
  p_loser_id    uuid,
  p_org_id      uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table regclass;
  v_rec   record;
begin
  if p_winner_id = p_loser_id then
    raise exception 'winner and loser must differ';
  end if;

  if p_entity_type = 'contact' then
    v_table := 'public.contacts'::regclass;
  elsif p_entity_type = 'company' then
    v_table := 'public.companies'::regclass;
  else
    raise exception 'unsupported entity_type: %', p_entity_type;
  end if;

  -- Repoint every single-column FK that references the target table.
  for v_rec in
    select con.conrelid::regclass as child_table, att.attname as child_column
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    where con.contype = 'f'
      and con.confrelid = v_table
      and array_length(con.conkey, 1) = 1
  loop
    execute format('update %s set %I = $1 where %I = $2',
      v_rec.child_table, v_rec.child_column, v_rec.child_column)
      using p_winner_id, p_loser_id;
  end loop;

  -- Archive the loser and record the survivor.
  if p_entity_type = 'contact' then
    update public.contacts
      set merged_into_id = p_winner_id, status = 'merged', updated_at = now()
      where id = p_loser_id;
  else
    update public.companies
      set merged_into_id = p_winner_id, archived_at = now(), updated_at = now()
      where id = p_loser_id;
  end if;

  -- Resolve any pending dedupe rows that involved the loser.
  update public.duplicate_matches
    set status = 'merged', resolved_at = now()
    where organization_id = p_org_id
      and entity_type = p_entity_type
      and (entity_id_a = p_loser_id or entity_id_b = p_loser_id)
      and status = 'pending';
end;
$$;

revoke all on function public.crm_merge_records(text, uuid, uuid, uuid) from public;
