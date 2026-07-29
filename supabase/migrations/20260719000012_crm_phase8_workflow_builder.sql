-- ── Phase 8: Workflow Automation (visual builder) ────────────────────────────
-- workflow_definitions stores the visual graph (nodes/edges). The existing
-- automation_workflows table remains the compiled, executable form the
-- workflow-engine runs — compile-workflow lowers a definition into it.
-- Additive and idempotent. (This is org-level in-app custom rules, separate
-- from the n8n orchestration layer.)

create table if not exists public.workflow_definitions (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  created_by           uuid references auth.users(id),
  name                 text not null,
  description          text,
  graph                jsonb not null default '{"nodes":[],"edges":[]}',
  status               text not null default 'draft'
                         check (status in ('draft', 'active', 'paused', 'archived')),
  compiled_workflow_id uuid references public.automation_workflows(id) on delete set null,
  last_compiled_at     timestamptz,
  compile_error        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
alter table public.workflow_definitions enable row level security;
create index if not exists idx_workflow_definitions_org on public.workflow_definitions(organization_id, created_at desc);

drop policy if exists "workflow_definitions_org_member" on public.workflow_definitions;
create policy "workflow_definitions_org_member" on public.workflow_definitions
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop trigger if exists trg_workflow_definitions_updated on public.workflow_definitions;
create trigger trg_workflow_definitions_updated
  before update on public.workflow_definitions
  for each row execute function public.set_updated_at();

-- Link the compiled workflow back to its source definition (traceability).
alter table public.automation_workflows
  add column if not exists definition_id uuid references public.workflow_definitions(id) on delete set null;
