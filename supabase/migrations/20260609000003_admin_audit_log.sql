-- Bring admin_audit_log under version control + add RLS.
-- The table already exists in the live DB (visible in types.ts) but
-- has no migration file — this is idempotent via CREATE TABLE IF NOT EXISTS.

create table if not exists public.admin_audit_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  email      text,
  event_type text not null,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log(created_at desc);

create index if not exists admin_audit_log_event_type_idx
  on public.admin_audit_log(event_type);

alter table public.admin_audit_log enable row level security;

-- Only admins (via app_role) can read audit log
drop policy if exists "admin_select" on public.admin_audit_log;
create policy "admin_select" on public.admin_audit_log
  for select using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Service role writes all audit events (n8n, edge functions, etc.)
drop policy if exists "service_role_all" on public.admin_audit_log;
create policy "service_role_all" on public.admin_audit_log
  for all using (auth.role() = 'service_role');
