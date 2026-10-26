-- Reps are people a manager coaches. They are not auth users and have no login.
-- calls.user_id remains the uploader (storage policies depend on it); rep_id is the coached person.
create table if not exists public.reps (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by      uuid references auth.users(id) on delete set null,
  name            text not null,
  email           text,
  status          text not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint reps_status_check check (status in ('active', 'archived')),
  constraint reps_name_check check (length(trim(name)) between 1 and 120)
);

alter table public.reps enable row level security;

drop policy if exists "reps_org_read" on public.reps;
create policy "reps_org_read" on public.reps for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "reps_owner_insert" on public.reps;
create policy "reps_owner_insert" on public.reps for insert to authenticated
  with check (created_by = auth.uid() and public.is_org_member(organization_id, auth.uid()));

drop policy if exists "reps_owner_update" on public.reps;
create policy "reps_owner_update" on public.reps for update to authenticated
  using (created_by = auth.uid() and public.is_org_member(organization_id, auth.uid()))
  with check (created_by = auth.uid() and public.is_org_member(organization_id, auth.uid()));

drop policy if exists "reps_owner_delete" on public.reps;
create policy "reps_owner_delete" on public.reps for delete to authenticated
  using (created_by = auth.uid() and public.is_org_member(organization_id, auth.uid()));

drop trigger if exists trg_reps_updated on public.reps;
create trigger trg_reps_updated before update on public.reps
  for each row execute function public.set_updated_at();

create index if not exists idx_reps_org_status on public.reps (organization_id, status);
create unique index if not exists idx_reps_org_email
  on public.reps (organization_id, lower(email)) where email is not null;

alter table public.calls add column if not exists rep_id uuid references public.reps(id) on delete set null;
create index if not exists idx_calls_rep on public.calls (rep_id);

grant select, insert, update, delete on public.reps to authenticated;
