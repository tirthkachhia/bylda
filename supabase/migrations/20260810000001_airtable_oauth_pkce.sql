-- Airtable OAuth requires PKCE. This value is server-only and expires with the OAuth state.
alter table public.integration_oauth_states
  add column if not exists oauth_code_verifier text;
