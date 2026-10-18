-- Sales playbooks a manager writes and assigns to reps. analyze-call judges a rep's
-- calls against the assigned playbook. Versions are immutable rows: saving an edit
-- inserts a new version; restoring an old one inserts a new version with its content.
create table if not exists public.coaching_playbooks (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  created_by         uuid references auth.users(id) on delete set null,
  name               text not null,
  status             text not null default 'active',
  current_version_id uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint coaching_playbooks_status_check check (status in ('active', 'archived')),
  constraint coaching_playbooks_name_check check (length(trim(name)) between 1 and 120)
);

create table if not exists public.coaching_playbook_versions (
  id              uuid primary key default gen_random_uuid(),
  playbook_id     uuid not null references public.coaching_playbooks(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version         integer not null,
  content         text not null,
  change_note     text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint coaching_playbook_versions_content_check check (length(content) between 1 and 12000),
  constraint coaching_playbook_versions_version_check check (version >= 1),
  unique (playbook_id, version)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'coaching_playbooks_current_version_fk'
  ) then
    alter table public.coaching_playbooks
      add constraint coaching_playbooks_current_version_fk
      foreign key (current_version_id) references public.coaching_playbook_versions(id)
      on delete set null;
  end if;
end $$;

alter table public.coaching_playbooks enable row level security;
alter table public.coaching_playbook_versions enable row level security;

drop policy if exists "coaching_playbooks_org_read" on public.coaching_playbooks;
create policy "coaching_playbooks_org_read" on public.coaching_playbooks for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "coaching_playbooks_owner_insert" on public.coaching_playbooks;
create policy "coaching_playbooks_owner_insert" on public.coaching_playbooks for insert to authenticated
  with check (created_by = auth.uid() and public.is_org_member(organization_id, auth.uid()));

drop policy if exists "coaching_playbooks_owner_update" on public.coaching_playbooks;
create policy "coaching_playbooks_owner_update" on public.coaching_playbooks for update to authenticated
  using (created_by = auth.uid() and public.is_org_member(organization_id, auth.uid()))
  with check (created_by = auth.uid() and public.is_org_member(organization_id, auth.uid()));

-- Versions: members read, the creator inserts. No update or delete policy: history is immutable.
drop policy if exists "coaching_playbook_versions_org_read" on public.coaching_playbook_versions;
create policy "coaching_playbook_versions_org_read" on public.coaching_playbook_versions
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "coaching_playbook_versions_owner_insert" on public.coaching_playbook_versions;
create policy "coaching_playbook_versions_owner_insert" on public.coaching_playbook_versions
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_org_member(organization_id, auth.uid())
    and exists (
      select 1 from public.coaching_playbooks p
      where p.id = playbook_id
        and p.organization_id = coaching_playbook_versions.organization_id
        and p.created_by = auth.uid()
    )
  );

drop trigger if exists trg_coaching_playbooks_updated on public.coaching_playbooks;
create trigger trg_coaching_playbooks_updated before update on public.coaching_playbooks
  for each row execute function public.set_updated_at();

create index if not exists idx_coaching_playbooks_org_status
  on public.coaching_playbooks (organization_id, status);
create index if not exists idx_coaching_playbook_versions_pb
  on public.coaching_playbook_versions (playbook_id, version desc);

alter table public.reps
  add column if not exists playbook_id uuid references public.coaching_playbooks(id) on delete set null;
create index if not exists idx_reps_playbook on public.reps (playbook_id);

comment on column public.reps.playbook_id is
  'Explicit playbook assignment. Null means: use the org''s only active playbook if exactly one exists, else none.';

grant select, insert, update on public.coaching_playbooks to authenticated;
grant select, insert on public.coaching_playbook_versions to authenticated;
