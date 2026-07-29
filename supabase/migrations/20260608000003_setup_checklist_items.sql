-- Roadmap item: "Domain/business-setup checklist persistence"
-- The existing `launch-checklist` tool is a one-shot generator with no completion
-- tracking, and its output (a launch-DAY countdown across Product/Marketing/Sales/
-- Operations categories) is a different concept than the foundational business-setup
-- tasks (domain, email, legal, banking, tools) this roadmap item calls for — so this
-- is new persisted state, not a reuse of that tool's output.
--
-- Mirrors the `mission_steps` shape/conventions (status enum as text+check rather than
-- a dedicated pg enum, since these statuses are local to this one table) and the
-- `is_org_member`-gated `for all` RLS convention used by `leads`/`automation_settings`.
create table if not exists public.setup_checklist_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category        text not null check (category in ('domain', 'email', 'legal', 'banking', 'tools')),
  label           text not null,
  status          text not null default 'pending' check (status in ('pending', 'done', 'skipped')),
  sort_order      integer not null default 0,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.setup_checklist_items enable row level security;

drop trigger if exists trg_setup_checklist_items_updated on public.setup_checklist_items;
create trigger trg_setup_checklist_items_updated
  before update on public.setup_checklist_items
  for each row execute function public.set_updated_at();

create index if not exists idx_setup_checklist_items_org
  on public.setup_checklist_items(organization_id, sort_order);

drop policy if exists "setup_checklist_items_org_member" on public.setup_checklist_items;
create policy "setup_checklist_items_org_member"
  on public.setup_checklist_items for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));
