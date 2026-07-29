-- ─────────────────────────────────────────────────────────────────────────────
-- Automation execution layer
--
-- Adds the runtime side of the Builder: a per-run trace table that records what
-- each step of a workflow did (sent / simulated / skipped / error), plus a
-- decrypt RPC so the run-workflow edge function can read an operator's
-- bring-your-own provider credentials (SendGrid / Slack) from user_integrations.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── automation_workflow_runs ─────────────────────────────────────────────────
create table if not exists public.automation_workflow_runs (
  id               uuid        primary key default gen_random_uuid(),
  organization_id  uuid        not null references public.organizations(id) on delete cascade,
  user_id          uuid        references auth.users(id) on delete set null,
  template_id      uuid        references public.automation_templates(id) on delete set null,
  workflow_name    text        not null default 'Workflow',
  trigger_type     text,
  contact_id       uuid        references public.contacts(id) on delete set null,
  mode             text        not null default 'test' check (mode in ('test', 'live')),
  status           text        not null default 'running'
                     check (status in ('running', 'success', 'failed', 'simulated')),
  steps_total      integer     not null default 0,
  steps_completed  integer     not null default 0,
  trace            jsonb       not null default '[]',
  error            text,
  duration_ms      integer,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.automation_workflow_runs enable row level security;

create index if not exists idx_workflow_runs_org      on public.automation_workflow_runs(organization_id, created_at desc);
create index if not exists idx_workflow_runs_template on public.automation_workflow_runs(template_id);
create index if not exists idx_workflow_runs_contact  on public.automation_workflow_runs(contact_id);

drop policy if exists "workflow_runs_org_member" on public.automation_workflow_runs;
create policy "workflow_runs_org_member" on public.automation_workflow_runs
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop trigger if exists trg_workflow_runs_updated on public.automation_workflow_runs;
create trigger trg_workflow_runs_updated
  before update on public.automation_workflow_runs
  for each row execute function public.set_updated_at();

-- ── get_user_integration (decrypt) ───────────────────────────────────────────
-- Mirrors set_user_integration's pgp_sym_encrypt(...) + base64. SECURITY DEFINER
-- and granted ONLY to service_role so it is never reachable from the public API
-- (anon / authenticated) — only the run-workflow edge function (service role) can
-- decrypt an operator's stored provider key to actually send on their behalf.
create or replace function public.get_user_integration(
  _user_id          uuid,
  _integration_key  text,
  _encryption_key   text
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _enc text;
begin
  select encrypted_value into _enc
  from public.user_integrations
  where user_id = _user_id and integration_key = _integration_key and status = 'connected';

  if _enc is null then
    return null;
  end if;

  return pgp_sym_decrypt(decode(_enc, 'base64'), _encryption_key);
exception
  when others then
    return null;
end;
$$;

revoke execute on function public.get_user_integration(uuid, text, text) from public;
revoke execute on function public.get_user_integration(uuid, text, text) from anon;
revoke execute on function public.get_user_integration(uuid, text, text) from authenticated;
grant execute on function public.get_user_integration(uuid, text, text) to service_role;
