-- Harden the trigger/counter functions added in this batch: trigger functions
-- must never be callable as RPC, so revoke EXECUTE from anon/authenticated/public.
-- They still fire from their triggers (which run as the table owner). Addresses
-- the anon/authenticated_security_definer_function_executable advisors for the
-- functions this migration set introduced. Idempotent.

REVOKE EXECUTE ON FUNCTION public.bump_form_submission_count() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.bump_tag_usage_counts() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.leads_emit_automation_events() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.form_submissions_emit_automation_events() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.calendar_events_emit_automation_events() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.conversations_emit_automation_events() FROM anon, authenticated, public;
