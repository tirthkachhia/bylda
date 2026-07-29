-- ── Security hardening: lock down SECURITY DEFINER function grants ────────────
-- Supabase's default privileges grant EXECUTE on new public-schema functions to
-- anon + authenticated. For these SECURITY DEFINER functions that's flagged by
-- the security advisor (anon/authenticated_security_definer_function_executable).
--
--   • crm_merge_records — reassigns FKs + archives records; only the crm-merge
--     edge function (service_role) may call it. It does NOT self-check org
--     membership (the edge function does), so it must not be client-callable.
--   • record_deal_stage_change / audit_row_change — trigger functions, invoked
--     only by triggers. Postgres does not check EXECUTE on trigger functions
--     when a trigger fires, so revoking client EXECUTE is safe; the triggers
--     still run. There is no reason to call them directly.
--
-- service_role keeps EXECUTE (the RPC path for crm-merge). Idempotent.

revoke execute on function public.crm_merge_records(text, uuid, uuid, uuid)
  from anon, authenticated;

revoke execute on function public.record_deal_stage_change()
  from public, anon, authenticated;

revoke execute on function public.audit_row_change()
  from public, anon, authenticated;
