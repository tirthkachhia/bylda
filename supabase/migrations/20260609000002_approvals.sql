-- Approval request system: allows org members to request sign-off on
-- actions (content publish, automation changes, budget spend, client comms).
-- Uses is_org_member RLS convention (multi-member aware, unlike simple
-- org_id = auth.uid() check) since approvals involve multiple actors.

do $$ begin
  create type public.approval_request_type as enum (
    'content_publish',
    'automation_change',
    'budget_spend',
    'client_communication'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.approval_status as enum (
    'pending',
    'approved',
    'rejected',
    'expired'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.approval_requests (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  requested_by         uuid not null references auth.users(id) on delete cascade,
  request_type         public.approval_request_type not null,
  title                text not null,
  description          text,
  payload              jsonb not null default '{}',
  status               public.approval_status not null default 'pending',
  approver_id          uuid references auth.users(id) on delete set null,
  decided_at           timestamptz,
  decision_note        text,
  related_mission_id   uuid references public.missions(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists approval_requests_org_idx
  on public.approval_requests(organization_id);

create index if not exists approval_requests_status_idx
  on public.approval_requests(organization_id, status);

alter table public.approval_requests enable row level security;

-- Members can view their org's approval requests
create policy "members_select" on public.approval_requests
  for select using (public.is_org_member(organization_id, auth.uid()));

-- Members can create approval requests for their org
create policy "members_insert" on public.approval_requests
  for insert with check (
    public.is_org_member(organization_id, auth.uid())
    and requested_by = auth.uid()
  );

-- Only the org owner/admin can update (decide) approval requests
-- The decide-approval edge function runs as service_role
create policy "service_role_all" on public.approval_requests
  for all using (auth.role() = 'service_role');

-- Auto-update updated_at
drop trigger if exists trg_approvals_updated on public.approval_requests;
create trigger trg_approvals_updated
  before update on public.approval_requests
  for each row execute function public.set_updated_at();
