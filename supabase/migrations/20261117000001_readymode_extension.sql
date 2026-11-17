-- Tokens are import-only, revocable per member/workspace, and stored only as hashes.
create table if not exists public.readymode_extension_connections (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
alter table public.readymode_extension_connections enable row level security;
revoke all on public.readymode_extension_connections from anon, authenticated;
grant all on public.readymode_extension_connections to service_role;
