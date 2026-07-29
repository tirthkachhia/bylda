-- ── Full-text search for leads + contacts ───────────────────────────────────
-- A generated tsvector column can't be used here because to_tsvector's regconfig
-- cast isn't IMMUTABLE, so we maintain a plain tsvector via a BEFORE trigger,
-- backfill existing rows, and add a GIN index. Search goes through a
-- security-invoker function so existing RLS still scopes results. Idempotent.

-- leads ----------------------------------------------------------------------
alter table public.leads add column if not exists search_tsv tsvector;

create or replace function public.leads_search_tsv_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.search_tsv := to_tsvector(
    'simple',
    coalesce(new.name, '') || ' ' ||
    coalesce(new.email, '') || ' ' ||
    coalesce(new.company, '') || ' ' ||
    coalesce(new.source, '') || ' ' ||
    coalesce(new.notes, '') || ' ' ||
    array_to_string(coalesce(new.tags, '{}'), ' ')
  );
  return new;
end;
$$;

drop trigger if exists trg_leads_search on public.leads;
create trigger trg_leads_search
  before insert or update on public.leads
  for each row execute function public.leads_search_tsv_update();

update public.leads set search_tsv = to_tsvector(
  'simple',
  coalesce(name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(company, '') || ' ' ||
  coalesce(source, '') || ' ' || coalesce(notes, '') || ' ' ||
  array_to_string(coalesce(tags, '{}'), ' ')
) where search_tsv is null;

create index if not exists idx_leads_search on public.leads using gin(search_tsv);

create or replace function public.search_leads(_q text)
returns setof public.leads
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from public.leads
  where _q is null or _q = ''
     or search_tsv @@ websearch_to_tsquery('simple', _q)
  order by updated_at desc
  limit 200;
$$;

-- contacts -------------------------------------------------------------------
alter table public.contacts add column if not exists search_tsv tsvector;

create or replace function public.contacts_search_tsv_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.search_tsv := to_tsvector(
    'simple',
    coalesce(new.first_name, '') || ' ' ||
    coalesce(new.last_name, '') || ' ' ||
    coalesce(new.email, '') || ' ' ||
    coalesce(new.company, '') || ' ' ||
    coalesce(new.notes, '') || ' ' ||
    array_to_string(coalesce(new.tags, '{}'), ' ')
  );
  return new;
end;
$$;

drop trigger if exists trg_contacts_search on public.contacts;
create trigger trg_contacts_search
  before insert or update on public.contacts
  for each row execute function public.contacts_search_tsv_update();

update public.contacts set search_tsv = to_tsvector(
  'simple',
  coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(email, '') || ' ' ||
  coalesce(company, '') || ' ' || coalesce(notes, '') || ' ' ||
  array_to_string(coalesce(tags, '{}'), ' ')
) where search_tsv is null;

create index if not exists idx_contacts_search on public.contacts using gin(search_tsv);

create or replace function public.search_contacts(_q text)
returns setof public.contacts
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from public.contacts
  where _q is null or _q = ''
     or search_tsv @@ websearch_to_tsquery('simple', _q)
  order by created_at desc
  limit 200;
$$;
