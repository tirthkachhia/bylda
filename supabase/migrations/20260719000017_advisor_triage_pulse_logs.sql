-- ── Advisor triage: pulse_logs RLS ───────────────────────────────────────────
-- pulse_logs is an internal ops log (one row per pulse run: org_count,
-- alerts_sent, ran_at). RLS was enabled with no policy, so it was fully locked
-- (service-role writes only) — secure, but the advisor flags rls_enabled_no_policy.
-- It has no per-tenant column to scope by, so grant read to admins only, matching
-- the existing user_roles admin pattern (see prompt_feedback policies). Writes
-- stay service-role-only (no insert/update/delete policy).
drop policy if exists "pulse_logs_admin_read" on public.pulse_logs;
create policy "pulse_logs_admin_read" on public.pulse_logs
  for select to authenticated
  using (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid()
        and user_roles.role = 'admin'::app_role
    )
  );
