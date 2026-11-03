create table public.coaching_teams (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 150), manager_id uuid references auth.users(id) on delete set null,
 rep_ids uuid[] not null default '{}', playbook_id uuid references public.coaching_playbooks(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,name)
);
create function public.validate_coaching_team() returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from unnest(new.rep_ids) r(id) where not exists(select 1 from public.reps p where p.id=r.id and p.organization_id=new.organization_id)) then raise exception 'Rep is outside this workspace'; end if;
 if new.manager_id is not null and not exists(select 1 from organization_members where user_id=new.manager_id and organization_id=new.organization_id) then raise exception 'Manager is outside this workspace'; end if;
 if new.playbook_id is not null and not exists(select 1 from coaching_playbooks where id=new.playbook_id and organization_id=new.organization_id) then raise exception 'Playbook is outside this workspace'; end if;
 new.updated_at=clock_timestamp(); return new;
end $$;
create trigger coaching_team_valid before insert or update on public.coaching_teams for each row execute function public.validate_coaching_team();
alter table public.coaching_teams enable row level security;
create policy teams_read on public.coaching_teams for select to authenticated using(public.is_org_member(organization_id,auth.uid()));
create policy teams_write on public.coaching_teams for all to authenticated using(public.coaching_is_manager(organization_id)) with check(public.coaching_is_manager(organization_id));
revoke all on public.coaching_teams from anon,authenticated;
grant select,delete on public.coaching_teams to authenticated;
grant insert(organization_id,name,manager_id,rep_ids,playbook_id),update(name,manager_id,rep_ids,playbook_id) on public.coaching_teams to authenticated;
grant all on public.coaching_teams to service_role;

create table public.coaching_rooms (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 150), description text not null default '' check(length(description)<=2000),
 visibility text not null default 'workspace' check(visibility in ('workspace','private')),
 member_ids uuid[] not null default '{}', created_by uuid default auth.uid() references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create function public.validate_coaching_room() returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from unnest(new.member_ids) m(id) where not public.is_org_member(new.organization_id,m.id)) then raise exception 'Room member is outside this workspace'; end if;
 return new;
end $$;
create trigger coaching_room_valid before insert or update on public.coaching_rooms for each row execute function public.validate_coaching_room();
alter table public.coaching_rooms enable row level security;
create policy rooms_read on public.coaching_rooms for select to authenticated using(public.is_org_member(organization_id,auth.uid()) and (visibility='workspace' or created_by=auth.uid() or auth.uid()=any(member_ids)));
create policy rooms_create on public.coaching_rooms for insert to authenticated with check(public.is_org_member(organization_id,auth.uid()) and created_by=auth.uid());
create policy rooms_update on public.coaching_rooms for update to authenticated using(public.is_org_member(organization_id,auth.uid()) and created_by=auth.uid()) with check(public.is_org_member(organization_id,auth.uid()) and created_by=auth.uid());
create policy rooms_delete on public.coaching_rooms for delete to authenticated using(public.is_org_member(organization_id,auth.uid()) and created_by=auth.uid());
revoke all on public.coaching_rooms from anon,authenticated;
grant select,delete on public.coaching_rooms to authenticated;
grant insert(organization_id,name,description,visibility,member_ids),update(name,description,visibility,member_ids) on public.coaching_rooms to authenticated;
grant all on public.coaching_rooms to service_role;

create table public.coaching_room_messages (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.coaching_rooms(id) on delete cascade,
 author_id uuid default auth.uid() references auth.users(id) on delete set null,
 body text not null check(length(btrim(body)) between 1 and 10000), created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index room_messages_room on public.coaching_room_messages(room_id,created_at,id);
alter table public.coaching_room_messages enable row level security;
create policy room_messages_read on public.coaching_room_messages for select to authenticated using(exists(select 1 from public.coaching_rooms r where r.id=room_id));
create policy room_messages_create on public.coaching_room_messages for insert to authenticated with check(author_id=auth.uid() and exists(select 1 from public.coaching_rooms r where r.id=room_id));
create policy room_messages_update on public.coaching_room_messages for update to authenticated using(author_id=auth.uid() and exists(select 1 from public.coaching_rooms r where r.id=room_id)) with check(author_id=auth.uid() and exists(select 1 from public.coaching_rooms r where r.id=room_id));
create policy room_messages_delete on public.coaching_room_messages for delete to authenticated using(author_id=auth.uid() and exists(select 1 from public.coaching_rooms r where r.id=room_id));
revoke all on public.coaching_room_messages from anon,authenticated;
grant select,delete on public.coaching_room_messages to authenticated;
grant insert(room_id,body),update(body) on public.coaching_room_messages to authenticated;
grant all on public.coaching_room_messages to service_role;
create trigger coaching_message_updated before update on public.coaching_room_messages for each row execute function public.touch_coaching_note();
