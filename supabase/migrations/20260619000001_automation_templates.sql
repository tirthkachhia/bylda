-- ─────────────────────────────────────────────────────────────────────────────
-- Automation templates & publishing (GoHighLevel-style snapshots / recipes)
--
-- Lets an operator build a workflow in the Builder and PUBLISH it as a reusable
-- automation template, choosing WHO it is for:
--   • self          — a private template only this org can install
--   • client        — published for one specific client (CRM contact)
--   • all_clients   — published to every client the org manages
--   • marketplace   — published publicly so any other org can install it
--
-- Installs are tracked so we can show install counts and let users re-open a
-- published template back in the Builder.
--
-- Everything is additive + idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── automation_templates ─────────────────────────────────────────────────────
create table if not exists public.automation_templates (
  id                 uuid        primary key default gen_random_uuid(),
  organization_id    uuid        not null references public.organizations(id) on delete cascade,
  created_by         uuid        references auth.users(id) on delete set null,
  name               text        not null,
  description        text        not null default '',
  category           text        not null default 'general',
  icon               text        not null default 'workflow',
  -- The full builder canvas (array of WorkflowBlock) captured at publish time.
  blocks             jsonb       not null default '[]',
  -- Human summary of the entry trigger, e.g. "When a new lead arrives".
  trigger_summary    text        not null default '',
  -- Who this template is published for.
  audience_scope     text        not null default 'self'
                       check (audience_scope in ('self', 'client', 'all_clients', 'marketplace')),
  -- When audience_scope = 'client', the specific client this was published for.
  target_contact_id  uuid        references public.contacts(id) on delete set null,
  target_label       text,
  tags               text[]      not null default '{}',
  status             text        not null default 'published'
                       check (status in ('draft', 'published', 'archived')),
  install_count      integer     not null default 0,
  is_featured        boolean     not null default false,
  -- Optional link back to the builder draft this was published from.
  source_workflow_id uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.automation_templates enable row level security;

create index if not exists idx_automation_templates_org      on public.automation_templates(organization_id, created_at desc);
create index if not exists idx_automation_templates_scope    on public.automation_templates(audience_scope, status);
create index if not exists idx_automation_templates_target   on public.automation_templates(target_contact_id);
create index if not exists idx_automation_templates_category on public.automation_templates(category);

-- Members of the owning org can see + manage their own templates…
drop policy if exists "automation_templates_org_member" on public.automation_templates;
create policy "automation_templates_org_member" on public.automation_templates
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- …and ANY authenticated user can read templates published to the marketplace.
drop policy if exists "automation_templates_marketplace_read" on public.automation_templates;
create policy "automation_templates_marketplace_read" on public.automation_templates
  for select to authenticated
  using (audience_scope = 'marketplace' and status = 'published');

drop trigger if exists trg_automation_templates_updated on public.automation_templates;
create trigger trg_automation_templates_updated
  before update on public.automation_templates
  for each row execute function public.set_updated_at();

-- ── automation_template_installs ─────────────────────────────────────────────
create table if not exists public.automation_template_installs (
  id                  uuid        primary key default gen_random_uuid(),
  template_id         uuid        not null references public.automation_templates(id) on delete cascade,
  organization_id     uuid        not null references public.organizations(id) on delete cascade,
  installed_by        uuid        references auth.users(id) on delete set null,
  target_contact_id   uuid        references public.contacts(id) on delete set null,
  created_at          timestamptz not null default now()
);

alter table public.automation_template_installs enable row level security;

create index if not exists idx_template_installs_template on public.automation_template_installs(template_id);
create index if not exists idx_template_installs_org      on public.automation_template_installs(organization_id, created_at desc);

drop policy if exists "template_installs_org_member" on public.automation_template_installs;
create policy "template_installs_org_member" on public.automation_template_installs
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

-- ── install_automation_template ──────────────────────────────────────────────
-- SECURITY DEFINER so installing a *marketplace* template owned by another org
-- can bump that template's install_count (which RLS would otherwise block) while
-- still recording the install row against the caller's own org.
create or replace function public.install_automation_template(
  _template_id     uuid,
  _organization_id uuid,
  _target_contact  uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _scope text;
  _owner uuid;
begin
  -- caller must be a member of the org they are installing into
  if not public.is_org_member(_organization_id, auth.uid()) then
    raise exception 'not a member of the target organization';
  end if;

  select audience_scope, organization_id into _scope, _owner
  from public.automation_templates
  where id = _template_id and status = 'published';

  if _scope is null then
    raise exception 'template not found or not published';
  end if;

  -- Only the owning org's templates, or anything in the marketplace, can be installed.
  if _scope <> 'marketplace' and _owner <> _organization_id then
    raise exception 'template is not available to this organization';
  end if;

  insert into public.automation_template_installs
    (template_id, organization_id, installed_by, target_contact_id)
  values (_template_id, _organization_id, auth.uid(), _target_contact);

  update public.automation_templates
  set install_count = install_count + 1
  where id = _template_id;
end;
$$;

grant execute on function public.install_automation_template(uuid, uuid, uuid) to authenticated;
-- Mutation RPC must not be anon-callable (it self-guards on membership, but be explicit).
revoke execute on function public.install_automation_template(uuid, uuid, uuid) from public;
revoke execute on function public.install_automation_template(uuid, uuid, uuid) from anon;
