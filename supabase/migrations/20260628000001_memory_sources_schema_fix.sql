-- memory_sources was never defined in any tracked migration (only referenced
-- by app code and edge functions), and memory_artifacts was only ever created
-- with a handful of columns (org_id, source_label, content_preview,
-- created_at, content). Every other column the app and edge functions read
-- and write — user_id, source_id, source_type, title, status, metadata,
-- updated_at, etc. — was missing, so memory writes/reads have been failing
-- or silently dropping data depending on which code path touched the table
-- first on a given environment.
--
-- This brings both tables up to the full schema the app actually uses, scopes
-- them to a real organization via org_id -> organizations(id) (the same
-- pattern as every other org-scoped table in this codebase), and locks them
-- down with is_org_member() RLS so memory is strictly isolated per account.

-- -----------------------------------------------------------------------
-- memory_sources
-- -----------------------------------------------------------------------

create table if not exists public.memory_sources (
  id              uuid        primary key default gen_random_uuid(),
  org_id          uuid        not null references public.organizations(id) on delete cascade,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  source_type     text        not null check (source_type in ('tool', 'integration', 'nova', 'notion', 'slack', 'github', 'text', 'url')),
  source_label    text,
  source_url      text,
  status          text        not null default 'pending' check (status in ('pending', 'indexing', 'indexed', 'error', 'disabled')),
  error_message   text,
  artifact_count  integer     not null default 0,
  last_synced_at  timestamptz,
  metadata        jsonb       not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.memory_sources add column if not exists artifact_count integer not null default 0;

create unique index if not exists idx_memory_sources_org_type_label
  on public.memory_sources (org_id, source_type, source_label);

create index if not exists idx_memory_sources_org_id on public.memory_sources(org_id);
create index if not exists idx_memory_sources_user_id on public.memory_sources(user_id);

drop trigger if exists trg_memory_sources_updated on public.memory_sources;
create trigger trg_memory_sources_updated
  before update on public.memory_sources
  for each row execute function public.set_updated_at();

alter table public.memory_sources enable row level security;

drop policy if exists "memory_sources_select" on public.memory_sources;
drop policy if exists "memory_sources_insert" on public.memory_sources;
drop policy if exists "memory_sources_update" on public.memory_sources;
drop policy if exists "memory_sources_delete" on public.memory_sources;

create policy "memory_sources_select" on public.memory_sources
  for select using (public.is_org_member(org_id, auth.uid()));
create policy "memory_sources_insert" on public.memory_sources
  for insert with check (public.is_org_member(org_id, auth.uid()));
create policy "memory_sources_update" on public.memory_sources
  for update using (public.is_org_member(org_id, auth.uid()));
create policy "memory_sources_delete" on public.memory_sources
  for delete using (public.is_org_member(org_id, auth.uid()));

-- -----------------------------------------------------------------------
-- memory_artifacts — bring the minimal table created in
-- 20260610100003_memory_full_content.sql up to the full schema.
-- -----------------------------------------------------------------------

create table if not exists public.memory_artifacts (
  id              uuid        primary key default gen_random_uuid(),
  org_id          uuid        not null,
  source_label    text,
  content_preview text,
  created_at      timestamptz not null default now()
);

alter table public.memory_artifacts add column if not exists user_id uuid;
alter table public.memory_artifacts add column if not exists source_id uuid references public.memory_sources(id) on delete set null;
alter table public.memory_artifacts add column if not exists source_type text;
alter table public.memory_artifacts add column if not exists title text;
alter table public.memory_artifacts add column if not exists content text;
alter table public.memory_artifacts add column if not exists content_hash text;
alter table public.memory_artifacts add column if not exists token_count int;
alter table public.memory_artifacts add column if not exists status text not null default 'indexed';
alter table public.memory_artifacts add column if not exists metadata jsonb not null default '{}';
alter table public.memory_artifacts add column if not exists updated_at timestamptz not null default now();

-- Backfill required fields on any rows that predate the columns above.
update public.memory_artifacts set title = coalesce(title, source_label, 'Untitled') where title is null;
update public.memory_artifacts set status = 'indexed' where status is null;
update public.memory_artifacts set updated_at = created_at where updated_at is null;

alter table public.memory_artifacts alter column title set not null;

-- org_id -> organizations(id) FK, added separately (not validated against
-- historical rows that may predate the organizations table being the source
-- of truth) so this migration never fails on existing data.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'memory_artifacts_org_id_fkey'
  ) then
    alter table public.memory_artifacts
      add constraint memory_artifacts_org_id_fkey
      foreign key (org_id) references public.organizations(id) on delete cascade
      not valid;
  end if;
end $$;

drop trigger if exists trg_memory_artifacts_updated on public.memory_artifacts;
create trigger trg_memory_artifacts_updated
  before update on public.memory_artifacts
  for each row execute function public.set_updated_at();

create index if not exists idx_memory_artifacts_org_id on public.memory_artifacts(org_id);
create index if not exists idx_memory_artifacts_source_id on public.memory_artifacts(source_id);

alter table public.memory_artifacts enable row level security;

drop policy if exists "memory_artifacts_select" on public.memory_artifacts;
drop policy if exists "memory_artifacts_insert" on public.memory_artifacts;
drop policy if exists "memory_artifacts_update" on public.memory_artifacts;
drop policy if exists "memory_artifacts_delete" on public.memory_artifacts;

create policy "memory_artifacts_select" on public.memory_artifacts
  for select using (public.is_org_member(org_id, auth.uid()));
create policy "memory_artifacts_insert" on public.memory_artifacts
  for insert with check (public.is_org_member(org_id, auth.uid()));
create policy "memory_artifacts_update" on public.memory_artifacts
  for update using (public.is_org_member(org_id, auth.uid()));
create policy "memory_artifacts_delete" on public.memory_artifacts
  for delete using (public.is_org_member(org_id, auth.uid()));

-- Backfill artifact_count for sources that already have artifacts, then keep
-- it in sync going forward (the Memory tab reads this column directly).
update public.memory_sources ms
set artifact_count = (
  select count(*) from public.memory_artifacts ma where ma.source_id = ms.id
);

create or replace function public.sync_memory_source_artifact_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.source_id is not null then
      update public.memory_sources set artifact_count = artifact_count + 1 where id = new.source_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.source_id is not null then
      update public.memory_sources set artifact_count = greatest(artifact_count - 1, 0) where id = old.source_id;
    end if;
  elsif tg_op = 'UPDATE' and old.source_id is distinct from new.source_id then
    if old.source_id is not null then
      update public.memory_sources set artifact_count = greatest(artifact_count - 1, 0) where id = old.source_id;
    end if;
    if new.source_id is not null then
      update public.memory_sources set artifact_count = artifact_count + 1 where id = new.source_id;
    end if;
  end if;
  return null;
end $$;

drop trigger if exists trg_memory_artifacts_sync_count on public.memory_artifacts;
create trigger trg_memory_artifacts_sync_count
  after insert or update or delete on public.memory_artifacts
  for each row execute function public.sync_memory_source_artifact_count();
