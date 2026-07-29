-- Phase E: granular permissions + explicit account_type persona routing.
--
-- 1. organization_members.permissions jsonb — per-member capability flags
--    as an additive override layer over the coarse org_role default.
--    Keys: approve_spend, edit_automations, invite_members (extensible).
--
-- 2. organizations.account_type — explicit founder/operator/agency persona.
--    Default 'founder' so existing rows are unaffected. The onboarding
--    flow and sidebar composition can read this to customise the experience.
--
-- 3. public.has_permission(_org_id, _user_id, _perm) helper — follows the
--    same security-definer pattern as is_org_member/has_role.
--
-- 4. sop_documents table — org-scoped SOP library (item 16).

-- ── 1. organization_members.permissions ─────────────────────────────────────
alter table public.organization_members
  add column if not exists permissions jsonb not null default '{}';

-- ── 2. organizations.account_type ───────────────────────────────────────────
do $$ begin
  if not exists (
    select 1 from pg_type where typname = 'account_type'
  ) then
    create type public.account_type as enum ('founder', 'operator', 'agency');
  end if;
end $$;

alter table public.organizations
  add column if not exists account_type public.account_type not null default 'founder';

-- ── 3. has_permission helper ─────────────────────────────────────────────────
create or replace function public.has_permission(
  _org_id  uuid,
  _user_id uuid,
  _perm    text
)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (permissions ->> _perm)::boolean,
    -- owners and admins have all permissions by default
    role in ('owner', 'admin')
  )
  from public.organization_members
  where organization_id = _org_id
    and user_id = _user_id
  limit 1;
$$;

-- ── 4. SOP documents ─────────────────────────────────────────────────────────
do $$ begin
  if not exists (
    select 1 from pg_type where typname = 'sop_status'
  ) then
    create type public.sop_status as enum ('draft', 'published', 'archived');
  end if;
end $$;

create table if not exists public.sop_documents (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  created_by           uuid references auth.users(id) on delete set null,
  title                text not null,
  category             text,
  content              text not null default '',
  related_tool_keys    text[] not null default '{}',
  related_module_ids   text[] not null default '{}',
  status               public.sop_status not null default 'draft',
  version              integer not null default 1,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists sop_documents_org_idx
  on public.sop_documents(organization_id);

alter table public.sop_documents enable row level security;

create policy "members_select" on public.sop_documents
  for select using (public.is_org_member(organization_id, auth.uid()));

create policy "members_insert" on public.sop_documents
  for insert with check (
    public.is_org_member(organization_id, auth.uid())
    and created_by = auth.uid()
  );

create policy "members_update" on public.sop_documents
  for update using (public.is_org_member(organization_id, auth.uid()));

create policy "members_delete" on public.sop_documents
  for delete using (public.is_org_member(organization_id, auth.uid()));

create policy "service_role_all" on public.sop_documents
  for all using (auth.role() = 'service_role');

drop trigger if exists trg_sop_updated on public.sop_documents;
create trigger trg_sop_updated
  before update on public.sop_documents
  for each row execute function public.set_updated_at();
