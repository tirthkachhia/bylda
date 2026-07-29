-- Fix: accounts created via the /auth/sign-up flow (or any flow other than
-- /signup) never got an organization / organization_members / subscriptions
-- row, because that provisioning only happened in client code on one of the
-- two sign-up pages. Move it into handle_new_user() so every new auth.users
-- row is guaranteed a complete, isolated account (org + membership +
-- subscription) regardless of which client flow created it.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_full_name text;
begin
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', '');

  insert into public.profiles (id, email, full_name)
    values (new.id, new.email, v_full_name);

  insert into public.user_roles (user_id, role)
    values (new.id, 'user');

  insert into public.organizations (owner_id, name)
    values (
      new.id,
      case when v_full_name <> '' then v_full_name || E'''s Business' else 'My Business' end
    )
    returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
    values (v_org_id, new.id, 'owner');

  -- An `on_organization_created` trigger may already auto-provision the
  -- subscription for the new org, so guard against a duplicate. This also keeps
  -- the insert correct on environments (e.g. CI preview branches) that don't
  -- have that trigger, where this statement does the provisioning itself.
  insert into public.subscriptions (organization_id, plan, status)
    values (v_org_id, 'starter', 'trialing')
    on conflict (organization_id) do nothing;

  return new;
end $$;

-- Backfill accounts that already slipped through without an organization.
do $$
declare
  r record;
  v_org_id uuid;
begin
  for r in
    select p.id as user_id, p.full_name
    from public.profiles p
    where not exists (
      select 1 from public.organization_members om where om.user_id = p.id
    )
  loop
    insert into public.organizations (owner_id, name)
      values (
        r.user_id,
        case when coalesce(r.full_name, '') <> '' then r.full_name || E'''s Business' else 'My Business' end
      )
      returning id into v_org_id;

    insert into public.organization_members (organization_id, user_id, role)
      values (v_org_id, r.user_id, 'owner');

    -- Same guard as handle_new_user(): the on_organization_created trigger may
    -- have already created this subscription when the org row was inserted.
    insert into public.subscriptions (organization_id, plan, status)
      values (v_org_id, 'starter', 'trialing')
      on conflict (organization_id) do nothing;
  end loop;
end $$;
