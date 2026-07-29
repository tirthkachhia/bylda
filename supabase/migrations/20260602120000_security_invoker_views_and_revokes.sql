-- Security hardening (P2)
-- 1. Flip security_invoker=true on existing views so the querying user's RLS applies.
--    Use ALTER VIEW ... SET (not CREATE OR REPLACE) so we never touch column sets —
--    these views were already (re)created live with their canonical column lists, and
--    CREATE OR REPLACE cannot drop/alter columns (SQLSTATE 42P16). ALTER only flips the flag.
-- 2. Revoke anon EXECUTE on internal trigger functions.
-- All statements are idempotent / safe to re-run.

-- ── security_invoker on all exposed views (idempotent flag flip) ────────────
do $$
declare v text;
begin
  foreach v in array array[
    'public.user_profiles',
    'public.user_entitlements',
    'public.user_credits',
    'public.plan_entitlements',
    'public.users',
    'public.workspace_members'
  ]
  loop
    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'v'
        and n.nspname = split_part(v, '.', 1)
        and c.relname = split_part(v, '.', 2)
    ) then
      execute format('alter view %s set (security_invoker = true)', v);
    end if;
  end loop;
end $$;

-- ── Revoke anon EXECUTE on internal trigger functions (idempotent) ──────────
do $$ begin revoke execute on function public.populate_onboarding_org_id() from anon; exception when undefined_function then null; end $$;
do $$ begin revoke execute on function public.update_users_view_fn() from anon; exception when undefined_function then null; end $$;
