-- Workspace collaboration is separate from immutable AI analysis.
create table public.coaching_call_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  call_id uuid not null references public.calls(id) on delete cascade,
  author_id uuid default auth.uid() references auth.users(id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coaching_call_notes_call on public.coaching_call_notes(organization_id,call_id,created_at,id);
alter table public.coaching_call_notes enable row level security;
create policy call_notes_read on public.coaching_call_notes for select to authenticated
  using(public.is_org_member(organization_id,auth.uid()) and exists(select 1 from public.calls c where c.id=call_id and c.organization_id=coaching_call_notes.organization_id));
create policy call_notes_create on public.coaching_call_notes for insert to authenticated
  with check(author_id=auth.uid() and public.is_org_member(organization_id,auth.uid()) and exists(select 1 from public.calls c where c.id=call_id and c.organization_id=coaching_call_notes.organization_id));
create policy call_notes_edit on public.coaching_call_notes for update to authenticated
  using(author_id=auth.uid() and public.is_org_member(organization_id,auth.uid()))
  with check(author_id=auth.uid() and public.is_org_member(organization_id,auth.uid()));
create policy call_notes_delete on public.coaching_call_notes for delete to authenticated
  using(author_id=auth.uid() and public.is_org_member(organization_id,auth.uid()));
revoke all on public.coaching_call_notes from anon,authenticated;
grant select,delete on public.coaching_call_notes to authenticated;
grant insert(organization_id,call_id,body) on public.coaching_call_notes to authenticated;
grant update(body) on public.coaching_call_notes to authenticated;
grant all on public.coaching_call_notes to service_role;
create function public.touch_coaching_note() returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=clock_timestamp(); return new; end $$;
create trigger coaching_note_updated before update on public.coaching_call_notes for each row execute function public.touch_coaching_note();

create function public.coaching_is_manager(org uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.organization_members where organization_id=org and user_id=auth.uid() and role::text in ('owner','admin','manager'))
$$;
revoke all on function public.coaching_is_manager(uuid) from public;
grant execute on function public.coaching_is_manager(uuid) to authenticated,service_role;

create table public.coaching_assignments (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 rep_id uuid not null references public.reps(id) on delete cascade,
 call_id uuid references public.calls(id) on delete set null,
 run_id uuid references public.coaching_analysis_runs(id) on delete set null,
 assigned_by uuid default auth.uid() references auth.users(id) on delete set null,
 focus text not null check(length(btrim(focus)) between 1 and 300),
 note text not null default '' check(length(note)<=10000),
 check_in_at date not null,
 status text not null default 'active' check(status in ('active','completed','cancelled')),
 check_in_note text not null default '' check(length(check_in_note)<=10000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 completed_at timestamptz
);
create index coaching_assignments_org on public.coaching_assignments(organization_id,status,check_in_at);
alter table public.coaching_assignments enable row level security;
create policy assignments_read on public.coaching_assignments for select to authenticated using(public.is_org_member(organization_id,auth.uid()));
create policy assignments_create on public.coaching_assignments for insert to authenticated with check(
 public.coaching_is_manager(organization_id) and assigned_by=auth.uid()
 and exists(select 1 from public.reps r where r.id=rep_id and r.organization_id=coaching_assignments.organization_id)
 and (call_id is null or exists(select 1 from public.calls c where c.id=call_id and c.organization_id=coaching_assignments.organization_id and c.rep_id=coaching_assignments.rep_id))
 and (run_id is null or exists(select 1 from public.coaching_analysis_runs r where r.id=run_id and r.organization_id=coaching_assignments.organization_id and r.call_id=coaching_assignments.call_id and r.rep_id=coaching_assignments.rep_id))
);
create policy assignments_update on public.coaching_assignments for update to authenticated using(public.coaching_is_manager(organization_id)) with check(public.coaching_is_manager(organization_id));
revoke all on public.coaching_assignments from anon,authenticated;
grant select on public.coaching_assignments to authenticated;
grant insert(organization_id,rep_id,call_id,run_id,focus,note,check_in_at) on public.coaching_assignments to authenticated;
grant update(focus,note,check_in_at,status,check_in_note) on public.coaching_assignments to authenticated;
grant all on public.coaching_assignments to service_role;
create function public.touch_coaching_assignment() returns trigger language plpgsql set search_path=public as $$
begin
 new.updated_at=clock_timestamp();
 new.completed_at=case when new.status='completed' then coalesce(old.completed_at,clock_timestamp()) else null end;
 return new;
end $$;
create trigger coaching_assignment_updated before update on public.coaching_assignments for each row execute function public.touch_coaching_assignment();
