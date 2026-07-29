-- Fix argument order in admin_audit_log admin_select policy.
-- has_role signature is (uuid, app_role) but the original migration
-- called it as (app_role, uuid), which fails on a fresh migration run.

drop policy if exists "admin_select" on public.admin_audit_log;
create policy "admin_select" on public.admin_audit_log
  for select using (public.has_role(auth.uid(), 'admin'::public.app_role));
