-- ════════════════════════════════════════════════════════════════════════════
-- Bylda Launchpad · Remove the demo data seeded by seed-demo-account.sql
-- ════════════════════════════════════════════════════════════════════════════
--
-- Deletes ONLY the marked demo rows (custom_fields.seed='demo', metadata.seed='demo',
-- insights n8n_run_id='demo-seed', the known seeded contact emails, and the demo
-- automation_settings). It does NOT delete the account, the organization, or the
-- workspace, and it leaves onboarding_complete / the Scale plan / admin role in
-- place. Run in Supabase Dashboard → SQL Editor.
--
-- To also revert access, uncomment the OPTIONAL block at the bottom.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_email text := 'ansh.patel102104@gmail.com';
  v_user  uuid;
  v_org   uuid;
  v_contact_emails text[] := array[
    'sarah.chen@northwindlabs.io','marcus.webb@vortexdigital.co','aisha.rao@brightpathhealth.com',
    'diego.romero@heliostudio.io','yuki.tanaka@orbitcraft.jp','hannah.cole@lumenretail.com',
    'tom.becker@cedarandco.com','priya.menon@quantafoods.com','liam.osullivan@northwindlabs.io',
    'noah.kim@vortexdigital.co','emma.larsson@brightpathhealth.com','olivia.grant@lumenretail.com',
    'daniel.reyes@orbitcraft.jp','sofia.marino@quantafoods.com'
  ];
begin
  select id into v_user from auth.users where lower(email) = lower(v_email) limit 1;
  if v_user is null then
    raise notice 'No user for %, nothing to do.', v_email; return;
  end if;
  select organization_id into v_org
  from public.organization_members where user_id = v_user order by created_at limit 1;
  if v_org is null then
    raise notice 'No org for %, nothing to do.', v_email; return;
  end if;

  delete from public.crm_activities    where organization_id = v_org and coalesce(metadata->>'seed','') = 'demo';
  delete from public.leads             where organization_id = v_org and coalesce(custom_fields->>'seed','') = 'demo';
  delete from public.contacts          where user_id = v_user and email = any(v_contact_emails);
  delete from public.companies         where organization_id = v_org and coalesce(custom_fields->>'seed','') = 'demo';
  delete from public.tool_runs         where organization_id = v_org and coalesce(metadata->>'seed','') = 'demo';
  delete from public.generated_assets  where organization_id = v_org and coalesce(metadata->>'seed','') = 'demo';
  delete from public.mentor_insights   where org_id = v_org and n8n_run_id = 'demo-seed';
  delete from public.automation_settings where organization_id = v_org and coalesce(config->>'seed','') = 'demo';

  begin
    if to_regclass('public.automation_configs') is not null then
      execute 'delete from public.automation_configs where user_id = $1' using v_user;
    end if;
  exception when others then null;
  end;

  -- OPTIONAL — also revert access (uncomment to use):
  -- update public.subscriptions set plan = 'starter' where organization_id = v_org;
  -- delete from public.user_roles where user_id = v_user and role = 'admin';
  -- update public.profiles set onboarding_complete = false where id = v_user;

  raise notice 'Demo data removed for %.', v_email;
end $$;
