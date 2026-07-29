-- ── Phase 10: Enterprise (RBAC, audit log, multi-workspace) ──────────────────
-- Field-level roles/permissions, an audit trail with a generic change trigger,
-- and workspace-level membership scoping. SSO/SCIM (identity-provider
-- integration) is wired separately once a provider is chosen — this migration is
-- the native, provider-agnostic groundwork. Additive and idempotent.

-- ── roles + field-level permissions ──────────────────────────────────────────
create table if not exists public.roles (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug            text not null,
  name            text not null,
  description     text,
  is_system       boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (organization_id, slug)
);
alter table public.roles enable row level security;
create index if not exists idx_roles_org on public.roles(organization_id);

drop policy if exists "roles_org_member" on public.roles;
create policy "roles_org_member" on public.roles
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

create table if not exists public.role_permissions (
  id         uuid primary key default gen_random_uuid(),
  role_id    uuid not null references public.roles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resource   text not null,                 -- '*' or a table/object name
  action     text not null default 'read',  -- read | write | delete | '*'
  field      text,                          -- null = all fields (field-level scoping)
  effect     text not null default 'allow' check (effect in ('allow', 'deny')),
  created_at timestamptz not null default now()
);
alter table public.role_permissions enable row level security;
create index if not exists idx_role_permissions_role on public.role_permissions(role_id);
-- Expression unique index (a table UNIQUE constraint can't use coalesce): one
-- row per (role, resource, action, field) treating null field as '*'.
create unique index if not exists uq_role_permissions_grant
  on public.role_permissions (role_id, resource, action, coalesce(field, '*'));

drop policy if exists "role_permissions_org_member" on public.role_permissions;
create policy "role_permissions_org_member" on public.role_permissions
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- Assign a fine-grained role alongside the existing org_role enum.
alter table public.organization_members
  add column if not exists role_id uuid references public.roles(id) on delete set null;

-- Seed the four system roles + baseline permissions for every org (idempotent).
do $$
declare
  v_org  record;
  v_role uuid;
begin
  for v_org in select id from public.organizations loop
    -- owner
    insert into public.roles(organization_id, slug, name, description, is_system)
      values (v_org.id, 'owner', 'Owner', 'Full access, including billing and members.', true)
      on conflict (organization_id, slug) do nothing;
    -- admin
    insert into public.roles(organization_id, slug, name, description, is_system)
      values (v_org.id, 'admin', 'Admin', 'Manage CRM data, automations and settings.', true)
      on conflict (organization_id, slug) do nothing;
    -- member
    insert into public.roles(organization_id, slug, name, description, is_system)
      values (v_org.id, 'member', 'Member', 'Create and edit CRM records.', true)
      on conflict (organization_id, slug) do nothing;
    -- viewer
    insert into public.roles(organization_id, slug, name, description, is_system)
      values (v_org.id, 'viewer', 'Viewer', 'Read-only access to CRM data.', true)
      on conflict (organization_id, slug) do nothing;

    -- Baseline permissions.
    for v_role in
      select id from public.roles where organization_id = v_org.id and slug in ('owner', 'admin')
    loop
      insert into public.role_permissions(role_id, organization_id, resource, action, effect)
        values (v_role, v_org.id, '*', '*', 'allow')
        on conflict (role_id, resource, action, coalesce(field, '*')) do nothing;
    end loop;

    select id into v_role from public.roles where organization_id = v_org.id and slug = 'member';
    if v_role is not null then
      insert into public.role_permissions(role_id, organization_id, resource, action, effect)
        values (v_role, v_org.id, '*', 'read', 'allow'),
               (v_role, v_org.id, '*', 'write', 'allow')
        on conflict (role_id, resource, action, coalesce(field, '*')) do nothing;
    end if;

    select id into v_role from public.roles where organization_id = v_org.id and slug = 'viewer';
    if v_role is not null then
      insert into public.role_permissions(role_id, organization_id, resource, action, effect)
        values (v_role, v_org.id, '*', 'read', 'allow')
        on conflict (role_id, resource, action, coalesce(field, '*')) do nothing;
    end if;
  end loop;
end $$;

-- ── audit_log + generic change trigger ───────────────────────────────────────
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references public.organizations(id) on delete cascade,
  actor_id    uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id   uuid,
  action      text not null,   -- insert | update | delete
  diff        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create index if not exists idx_audit_log_org    on public.audit_log(org_id, created_at desc);
create index if not exists idx_audit_log_entity on public.audit_log(entity_type, entity_id);

-- Members read their org's trail; inserts happen only via the definer trigger.
drop policy if exists "audit_log_org_read" on public.audit_log;
create policy "audit_log_org_read" on public.audit_log
  for select to authenticated
  using (org_id is not null and public.is_org_member(org_id, auth.uid()));

create or replace function public.audit_row_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_org uuid;
  v_entity uuid;
  v_diff jsonb;
begin
  v_new := case when TG_OP <> 'DELETE' then to_jsonb(NEW) else null end;
  v_old := case when TG_OP <> 'INSERT' then to_jsonb(OLD) else null end;

  -- organization_id (most tables) or org_id (contacts).
  v_org := coalesce(
    nullif(v_new->>'organization_id', '')::uuid, nullif(v_old->>'organization_id', '')::uuid,
    nullif(v_new->>'org_id', '')::uuid,          nullif(v_old->>'org_id', '')::uuid
  );
  v_entity := coalesce(nullif(v_new->>'id', '')::uuid, nullif(v_old->>'id', '')::uuid);

  if TG_OP = 'UPDATE' then
    select jsonb_object_agg(e.key, jsonb_build_object('old', v_old->e.key, 'new', e.value))
      into v_diff
      from jsonb_each(v_new) as e
      where e.value is distinct from (v_old->e.key)
        and e.key not in ('updated_at', 'last_activity_at');
    if v_diff is null then return NEW; end if;  -- nothing meaningful changed
  elsif TG_OP = 'INSERT' then
    v_diff := jsonb_build_object('created', true);
  else
    v_diff := jsonb_build_object('deleted', true);
  end if;

  insert into public.audit_log(org_id, actor_id, entity_type, entity_id, action, diff)
    values (v_org, auth.uid(), TG_TABLE_NAME, v_entity, lower(TG_OP), v_diff);

  return coalesce(NEW, OLD);
end $$;

-- Attach the audit trigger to the core CRM objects.
do $$
declare
  v_tbl text;
begin
  foreach v_tbl in array array['leads', 'contacts', 'companies', 'customer_accounts'] loop
    if to_regclass('public.' || v_tbl) is not null then
      execute format('drop trigger if exists trg_audit_%1$s on public.%1$s', v_tbl);
      execute format(
        'create trigger trg_audit_%1$s after insert or update or delete on public.%1$s
           for each row execute function public.audit_row_change()', v_tbl);
    end if;
  end loop;
end $$;

-- ── workspace_member_roles — multi-workspace-per-org role scoping ────────────
-- Named workspace_member_roles (not workspace_members) because a compatibility
-- VIEW named workspace_members already exists in some environments — it derives
-- membership from organization_members ⋈ workspaces. This is a distinct,
-- writable table for assigning a user an explicit role within one workspace.
create table if not exists public.workspace_member_roles (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member',
  created_at   timestamptz not null default now(),
  unique (workspace_id, user_id)
);
alter table public.workspace_member_roles enable row level security;
create index if not exists idx_workspace_member_roles_ws   on public.workspace_member_roles(workspace_id);
create index if not exists idx_workspace_member_roles_user on public.workspace_member_roles(user_id);

drop policy if exists "workspace_member_roles_org_member" on public.workspace_member_roles;
create policy "workspace_member_roles_org_member" on public.workspace_member_roles
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));
