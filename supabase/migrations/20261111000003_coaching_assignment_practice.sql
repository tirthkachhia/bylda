-- Rep self-reports are independent of the manager's assignment and review status.
create table public.coaching_assignment_practice (
  assignment_id uuid not null references public.coaching_assignments(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  practiced boolean not null default false,
  useful boolean,
  primary key (assignment_id, user_id)
);

alter table public.coaching_assignment_practice enable row level security;

create function public.coaching_can_record_practice(assignment uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.coaching_assignments a
    join public.reps r on r.id = a.rep_id and r.organization_id = a.organization_id
    where a.id = assignment
      and r.user_id = auth.uid()
      and r.status = 'active'
      and public.is_org_member(a.organization_id, auth.uid())
  );
$$;

revoke all on function public.coaching_can_record_practice(uuid) from public, anon;
grant execute on function public.coaching_can_record_practice(uuid) to authenticated;

create policy assignment_practice_read on public.coaching_assignment_practice
  for select to authenticated using (
    (user_id = auth.uid() and public.coaching_can_record_practice(assignment_id))
    or exists (
      select 1 from public.coaching_assignments a
      where a.id = assignment_id and public.coaching_is_manager(a.organization_id)
    )
  );

create policy assignment_practice_insert on public.coaching_assignment_practice
  for insert to authenticated with check (
    user_id = auth.uid() and public.coaching_can_record_practice(assignment_id)
  );

create policy assignment_practice_update on public.coaching_assignment_practice
  for update to authenticated using (
    user_id = auth.uid() and public.coaching_can_record_practice(assignment_id)
  ) with check (
    user_id = auth.uid() and public.coaching_can_record_practice(assignment_id)
  );

revoke all on public.coaching_assignment_practice from anon, authenticated;
grant select, insert(assignment_id, practiced, useful), update(practiced, useful)
  on public.coaching_assignment_practice to authenticated;
grant all on public.coaching_assignment_practice to service_role;

create function public.record_coaching_assignment_practice(assignment uuid, patch jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.coaching_assignment_practice as current_practice (assignment_id, practiced, useful)
  values (assignment, coalesce((patch->>'practiced')::boolean, false), (patch->>'useful')::boolean)
  on conflict (assignment_id, user_id) do update set
    practiced = case when patch ? 'practiced' then excluded.practiced else current_practice.practiced end,
    useful = case when patch ? 'useful' then excluded.useful else current_practice.useful end;
$$;

revoke all on function public.record_coaching_assignment_practice(uuid, jsonb) from public, anon;
grant execute on function public.record_coaching_assignment_practice(uuid, jsonb) to authenticated;
