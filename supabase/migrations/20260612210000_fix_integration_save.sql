-- Fix integration saving (Connect button in /app/integrations), which failed
-- for every user with "Failed to save integration".
--
-- Two independent bugs (already applied to the remote project; this file is
-- idempotent and records them in the repo's migration history):
--
-- 1. set_user_integration() encrypts credentials with pgp_sym_encrypt(), but
--    the pgcrypto extension was never enabled.
create extension if not exists pgcrypto with schema extensions;

-- 2. The function's RETURNS TABLE(integration_key, status, ...) declares
--    PL/pgSQL variables that collide with the user_integrations columns
--    referenced in INSERT .. ON CONFLICT, raising 42702 ("integration_key is
--    ambiguous") on every call. Resolve identifiers to columns, and include
--    the extensions schema in search_path so pgp_sym_encrypt is visible.
--
-- An earlier migration (the squash) created set_user_integration() RETURNS void.
-- This redefinition changes the return type to TABLE(...), which CREATE OR
-- REPLACE cannot do (42P13 "cannot change return type") on a clean replay, so we
-- drop the old signature first. No-op on the live DB, which already has this
-- migration applied (db push never re-runs it).
DROP FUNCTION IF EXISTS public.set_user_integration(uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.set_user_integration(_user_id uuid, _integration_key text, _value text, _encryption_key text)
 RETURNS TABLE(integration_key text, status text, value_last4 text, is_connected boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
#variable_conflict use_column
DECLARE
  _encrypted text;
  _hint      text;
  _status    text;
BEGIN
  IF _value IS NULL OR _value = '' THEN
    _encrypted := NULL;
    _hint      := NULL;
    _status    := 'disabled';
  ELSE
    _encrypted := encode(
      pgp_sym_encrypt(_value, _encryption_key)::bytea,
      'base64'
    );
    _hint   := right(_value, 4);
    _status := 'connected';
  END IF;

  INSERT INTO public.user_integrations (user_id, integration_key, encrypted_value, value_hint, status, updated_at)
  VALUES (_user_id, _integration_key, _encrypted, _hint, _status, now())
  ON CONFLICT (user_id, integration_key)
  DO UPDATE SET
    encrypted_value = EXCLUDED.encrypted_value,
    value_hint      = EXCLUDED.value_hint,
    status          = EXCLUDED.status,
    updated_at      = now();

  RETURN QUERY
  SELECT
    _integration_key,
    _status,
    _hint,
    (_value IS NOT NULL AND _value <> '');
END;
$function$;

-- Dropping the function above also drops its grants, so restore them (matches
-- the squash's lockdown: not callable by anon/public).
REVOKE EXECUTE ON FUNCTION public.set_user_integration(uuid, text, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_user_integration(uuid, text, text, text) TO authenticated, service_role;
