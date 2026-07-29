-- Phase 7 — close the loops in the admin console.
-- Adds admin-read visibility so the data Phases 2/4/5 capture is actionable:
--   * workspaces.provisioning_status  → provisioning health / repair queue
--   * prompt_feedback                 → graduate the dead-end feedback pipeline
--     (admins can mark a suggestion applied)
-- stripe_webhook_events + n8n_error_log already got admin-read in
-- 20260610100004; this fills the two gaps.

-- workspaces: admins can read every workspace (owner-only until now).
drop policy if exists "workspaces_select_admin" on public.workspaces;
create policy "workspaces_select_admin"
  on public.workspaces for select
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'::public.app_role));

-- prompt_feedback: admins read all + mark suggestions applied.
drop policy if exists "prompt_feedback_select_admin" on public.prompt_feedback;
create policy "prompt_feedback_select_admin"
  on public.prompt_feedback for select
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'::public.app_role));

drop policy if exists "prompt_feedback_update_admin" on public.prompt_feedback;
create policy "prompt_feedback_update_admin"
  on public.prompt_feedback for update
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'::public.app_role));
