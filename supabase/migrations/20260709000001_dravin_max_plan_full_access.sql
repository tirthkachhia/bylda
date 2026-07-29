-- ════════════════════════════════════════════════════════════════════════════
-- Full access + top ("Scale") plan for dravin.dilip@gmail.com.
--   1. Grant the `admin` role — the permissive is_admin() policies from
--      20260618000001_admin_full_access.sql then give this account full
--      read + write on every user-data table.
--   2. Upgrade the subscription of every org this user belongs to to the
--      `scale` plan (all 17 tools, unlimited generations) with status
--      `active`, creating the subscription row if the org has none.
--
-- Idempotent and a no-op on environments where this user doesn't exist
-- (e.g. preview branches).
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_uid uuid;
  v_org uuid;
begin
  select id into v_uid
  from auth.users
  where lower(email) = lower('dravin.dilip@gmail.com')
  limit 1;

  if v_uid is null then
    raise notice 'dravin.dilip@gmail.com not found — re-run this migration after signup.';
    return;
  end if;

  -- 1. Admin role (full access via existing is_admin() policies)
  insert into public.user_roles (user_id, role)
  values (v_uid, 'admin')
  on conflict do nothing;

  -- 2. Scale plan on every org the user is a member of
  for v_org in
    select organization_id from public.organization_members where user_id = v_uid
  loop
    insert into public.subscriptions (organization_id, plan, status)
    values (v_org, 'scale', 'active')
    on conflict (organization_id) do update set
      plan       = 'scale',
      status     = 'active',
      updated_at = now();
    raise notice 'Org % upgraded to scale/active for dravin.dilip@gmail.com (%).', v_org, v_uid;
  end loop;
end $$;
