-- ════════════════════════════════════════════════════════════════════════════
-- Full admin access ("god mode") for a designated account.
--   1. Ensure is_admin() exists (SECURITY DEFINER, used by all admin policies).
--   2. Grant the `admin` role to anshp@nova-ops.space.
--   3. Give admins FULL read + write (FOR ALL) on every user-data table, so an
--      admin can open and change any account (the impersonation flow in the
--      Admin hub relies on this — the admin keeps their own JWT, so is_admin()
--      is true and these policies grant access to the target account's rows).
--
-- All statements are additive and idempotent. The admin policies are PERMISSIVE
-- and OR with existing per-user policies, so normal users are completely
-- unaffected (is_admin() is false for them).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. is_admin() (idempotent) ───────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ── 2. Grant admin to the designated account (no-op until that user exists) ──
do $$
declare
  v_uid uuid;
begin
  select id into v_uid from auth.users where lower(email) = lower('anshp@nova-ops.space') limit 1;
  if v_uid is not null then
    insert into public.user_roles (user_id, role) values (v_uid, 'admin')
    on conflict do nothing;
    raise notice 'Granted admin to anshp@nova-ops.space (%).', v_uid;
  else
    raise notice 'anshp@nova-ops.space not found yet — admin grant will need a re-run after signup.';
  end if;
end $$;

-- ── 3. Admin FULL-access (read + write) policies on every user-data table ────
do $$
declare
  t    text;
  pol  text;
  tables text[] := array[
    'profiles', 'organizations', 'organization_members', 'subscriptions',
    'leads', 'contacts', 'companies', 'crm_activities',
    'tool_runs', 'tool_outputs', 'generated_assets', 'content_outputs',
    'automation_settings', 'usage_tracking', 'website_analyses', 'user_integrations',
    'business_context', 'workspaces', 'missions', 'mission_steps', 'workspace_intake',
    'onboarding_responses', 'onboarding_sessions',
    'mentor_insights', 'mentor_agent_sessions',
    'setup_checklist_items', 'template_applications', 'approval_requests',
    'memory_sources', 'memory_artifacts', 'sop_documents', 'user_roles'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      pol := t || '_admins_manage_all';
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %I on public.%I', pol, t);
      execute format(
        'create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin())',
        pol, t
      );
    end if;
  end loop;
end $$;
