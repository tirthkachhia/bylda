-- Nova execution mode: proposed actions Nova can take after founder approval.
-- Org-scoped (organization_id + is_org_member), matching the rest of the schema
-- (mentor_insights, crm_activities, deviation_alerts) — not user_id-only, so a
-- teammate sees and can approve actions Nova proposed to anyone on the team.

create table if not exists public.nova_actions (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations(id) on delete cascade,
  user_id                uuid not null references auth.users(id) on delete cascade,
  session_id             text,
  action_type            text not null check (action_type in (
                           'update_lead_stage', 'log_crm_note', 'log_memory', 'trigger_n8n_workflow'
                         )),
  payload                jsonb not null default '{}',
  plain_english          text not null,
  confirmation_required  boolean not null default true,
  status                 text not null default 'pending' check (status in (
                           'pending', 'executed', 'failed', 'skipped'
                         )),
  result                 jsonb,
  error                  text,
  created_at             timestamptz not null default now(),
  executed_at            timestamptz
);

alter table public.nova_actions enable row level security;

create index if not exists idx_nova_actions_org      on public.nova_actions(organization_id, created_at desc);
create index if not exists idx_nova_actions_session   on public.nova_actions(session_id);

drop policy if exists "nova_actions_select_org" on public.nova_actions;
create policy "nova_actions_select_org" on public.nova_actions
  for select using (public.is_org_member(organization_id, auth.uid()));

-- Inserts happen server-side (service role) when Nova proposes an action.
drop policy if exists "nova_actions_no_client_insert" on public.nova_actions;
create policy "nova_actions_no_client_insert" on public.nova_actions
  for insert with check (false);

drop policy if exists "nova_actions_no_client_update" on public.nova_actions;
create policy "nova_actions_no_client_update" on public.nova_actions
  for update using (false);
