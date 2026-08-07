-- Connected-account OAuth foundation for Bylda integrations.

create table if not exists public.integration_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  integration_key text not null,
  requested_scopes text[] not null default '{}',
  redirect_to text not null default '/app/integrations',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists integration_oauth_states_expiry_idx
  on public.integration_oauth_states (expires_at);

alter table public.integration_oauth_states enable row level security;
revoke all on public.integration_oauth_states from anon, authenticated;
grant all on public.integration_oauth_states to service_role;

alter table public.user_integrations
  add column if not exists connection_type text not null default 'legacy_credential',
  add column if not exists account_label text,
  add column if not exists external_account_id text,
  add column if not exists scopes text[] not null default '{}',
  add column if not exists token_expires_at timestamptz;

create or replace view public.user_integrations_masked
with (security_invoker = true) as
select
  id,
  user_id,
  integration_key,
  status,
  value_hint as value_last4,
  (encrypted_value is not null) as is_connected,
  created_at,
  updated_at,
  connection_type,
  account_label,
  external_account_id,
  scopes,
  token_expires_at
from public.user_integrations;

grant select on public.user_integrations_masked to authenticated;

create or replace function public.set_oauth_integration(
  _user_id uuid,
  _integration_key text,
  _token_payload text,
  _account_label text,
  _external_account_id text,
  _scopes text[],
  _token_expires_at timestamptz,
  _encryption_key text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  insert into public.user_integrations (
    user_id,
    integration_key,
    encrypted_value,
    value_hint,
    status,
    connection_type,
    account_label,
    external_account_id,
    scopes,
    token_expires_at,
    updated_at
  ) values (
    _user_id,
    _integration_key,
    encode(pgp_sym_encrypt(_token_payload, _encryption_key)::bytea, 'base64'),
    'OAuth',
    'connected',
    'oauth',
    nullif(_account_label, ''),
    nullif(_external_account_id, ''),
    coalesce(_scopes, '{}'),
    _token_expires_at,
    now()
  )
  on conflict (user_id, integration_key)
  do update set
    encrypted_value = excluded.encrypted_value,
    value_hint = excluded.value_hint,
    status = excluded.status,
    connection_type = excluded.connection_type,
    account_label = excluded.account_label,
    external_account_id = excluded.external_account_id,
    scopes = excluded.scopes,
    token_expires_at = excluded.token_expires_at,
    updated_at = now();
end;
$$;

revoke execute on function public.set_oauth_integration(
  uuid, text, text, text, text, text[], timestamptz, text
) from anon, authenticated, public;
grant execute on function public.set_oauth_integration(
  uuid, text, text, text, text, text[], timestamptz, text
) to service_role;
