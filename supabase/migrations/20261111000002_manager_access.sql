-- Team assignments are the authority for manager access. A rep's login is an
-- explicit auth identity; changing an email must never transfer access.
-- Existing teams were assigned by owners/admins before the dedicated role existed.
update public.organization_members m set role='manager'
where m.role::text='member' and exists(select 1 from public.coaching_teams t
  where t.organization_id=m.organization_id and t.manager_id=m.user_id);

drop policy if exists verified_membership_insert on public.organization_members;
create policy verified_membership_insert on public.organization_members as restrictive for insert to authenticated
 with check(public.is_org_admin(organization_id,auth.uid()) or (
   user_id=auth.uid() and role::text='owner' and exists(
     select 1 from public.organizations o where o.id=organization_id and o.owner_id=auth.uid()
   )
 ));

alter table public.reps add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists reps_org_user on public.reps(organization_id,user_id) where user_id is not null;
update public.reps r set user_id=p.id from public.profiles p
where r.user_id is null and lower(r.email)=lower(p.email)
  and exists(select 1 from public.organization_members m where m.organization_id=r.organization_id and m.user_id=p.id);

create or replace function public.coaching_can_manage_rep(org uuid, rep uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select public.is_org_admin(org,auth.uid()) or (
   public.coaching_is_manager(org) and exists(
     select 1 from public.reps r where r.id=rep and r.organization_id=org and
       ((r.created_by=auth.uid() and not exists(select 1 from public.coaching_teams t where t.organization_id=org and t.manager_id is not null and r.id=any(t.rep_ids))) or exists(select 1 from public.coaching_teams t
        where t.organization_id=org and t.manager_id=auth.uid() and r.id=any(t.rep_ids)))
   )
 )
$$;
create or replace function public.coaching_can_view_rep(org uuid, rep uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select public.is_org_member(org,auth.uid()) and (
   public.coaching_can_manage_rep(org,rep) or exists(
     select 1 from public.reps r where r.id=rep and r.organization_id=org and r.user_id=auth.uid()
   )
 )
$$;
create or replace function public.coaching_can_view_call(org uuid, target uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select public.is_org_member(org,auth.uid()) and exists(
   select 1 from public.calls c where c.id=target and c.organization_id=org and (
     public.is_org_admin(org,auth.uid()) or public.coaching_can_view_rep(org,c.rep_id)
     or (c.rep_id is null and c.user_id=auth.uid())
   )
 )
$$;
revoke all on function public.coaching_can_manage_rep(uuid,uuid),public.coaching_can_view_rep(uuid,uuid),public.coaching_can_view_call(uuid,uuid) from public;
grant execute on function public.coaching_can_manage_rep(uuid,uuid),public.coaching_can_view_rep(uuid,uuid),public.coaching_can_view_call(uuid,uuid) to authenticated,service_role;

-- Restrictive policies also constrain the pre-existing permissive org policies.
drop policy if exists manager_rep_scope on public.reps;
create policy manager_rep_scope on public.reps as restrictive for select to authenticated
 using(public.coaching_can_view_rep(organization_id,id));
drop policy if exists manager_rep_insert_scope on public.reps;
create policy manager_rep_insert_scope on public.reps as restrictive for insert to authenticated
 with check(public.coaching_is_manager(organization_id) and created_by=auth.uid() and user_id is null);
drop policy if exists manager_rep_update_scope on public.reps;
create policy manager_rep_update_scope on public.reps as restrictive for update to authenticated
 using(public.coaching_can_manage_rep(organization_id,id))
 with check(public.coaching_can_manage_rep(organization_id,id));
drop policy if exists manager_rep_write on public.reps;
create policy manager_rep_write on public.reps for update to authenticated
 using(public.coaching_can_manage_rep(organization_id,id)) with check(public.coaching_can_manage_rep(organization_id,id));
drop policy if exists manager_rep_delete_scope on public.reps;
create policy manager_rep_delete_scope on public.reps as restrictive for delete to authenticated
 using(public.coaching_can_manage_rep(organization_id,id));

-- Auth links can only be set by the invite service. Preserve all other rep fields.
create or replace function public.protect_rep_identity() returns trigger language plpgsql set search_path=public as $$
begin
 if current_user='authenticated' and (new.user_id is distinct from old.user_id or new.organization_id<>old.organization_id or new.created_by is distinct from old.created_by) then
   raise exception 'Agent identity can only be changed by the invite service';
 end if;
 return new;
end $$;
drop trigger if exists protect_rep_identity on public.reps;
create trigger protect_rep_identity before update on public.reps for each row execute function public.protect_rep_identity();

drop policy if exists manager_call_scope on public.calls;
create policy manager_call_scope on public.calls as restrictive for all to authenticated
 using(public.coaching_can_view_call(organization_id,id))
 with check(public.is_org_member(organization_id,auth.uid()) and (
   public.is_org_admin(organization_id,auth.uid()) or public.coaching_can_view_rep(organization_id,rep_id)
   or (rep_id is null and user_id=auth.uid())
 ));

do $$ declare t text; begin
 foreach t in array array['call_transcripts','call_insights','call_exchange_scores','call_score_summaries','call_learning_moments','call_guideline_adherence','coaching_analysis_runs','coaching_behavior_events','coaching_call_notes','coaching_recorded_outcomes'] loop
   execute format('drop policy if exists manager_call_scope on public.%I',t);
   execute format('create policy manager_call_scope on public.%I as restrictive for all to authenticated using(public.coaching_can_view_call(organization_id,call_id)) with check(public.coaching_can_view_call(organization_id,call_id))',t);
 end loop;
 foreach t in array array['coaching_reports','coaching_assignments','coaching_report_schedules'] loop
   execute format('drop policy if exists manager_rep_scope on public.%I',t);
   execute format('create policy manager_rep_scope on public.%I as restrictive for all to authenticated using(public.coaching_can_view_rep(organization_id,rep_id)) with check(public.coaching_can_manage_rep(organization_id,rep_id))',t);
 end loop;
end $$;

drop policy if exists manager_team_scope on public.coaching_teams;
create policy manager_team_scope on public.coaching_teams as restrictive for all to authenticated
 using(public.is_org_admin(organization_id,auth.uid()) or (public.coaching_is_manager(organization_id) and manager_id=auth.uid()))
 with check(public.is_org_admin(organization_id,auth.uid()) or (public.coaching_is_manager(organization_id) and manager_id=auth.uid()));

-- Validate all rep assignments even for the service invite path, and prevent
-- managers from claiming an arbitrary existing rep by guessing its UUID.
create or replace function public.validate_coaching_team() returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from unnest(new.rep_ids) r(id) where not exists(select 1 from public.reps p where p.id=r.id and p.organization_id=new.organization_id)) then raise exception 'Rep is outside this workspace'; end if;
 if new.manager_id is not null and not exists(select 1 from public.organization_members where user_id=new.manager_id and organization_id=new.organization_id and role::text in ('owner','admin','manager')) then raise exception 'Choose a workspace manager'; end if;
 if new.playbook_id is not null and not exists(select 1 from public.coaching_playbooks where id=new.playbook_id and organization_id=new.organization_id) then raise exception 'Playbook is outside this workspace'; end if;
 if current_user='authenticated' and not public.is_org_admin(new.organization_id,auth.uid()) and exists(select 1 from unnest(new.rep_ids) r(id) where not public.coaching_can_manage_rep(new.organization_id,r.id)) then raise exception 'Agent belongs to another manager'; end if;
 new.updated_at=clock_timestamp(); return new;
end $$;

-- Recording URLs must obey the same team boundary as transcripts.
drop policy if exists manager_audio_scope on storage.objects;
create policy manager_audio_scope on storage.objects as restrictive for select to authenticated using(
 bucket_id<>'call-audio' or exists(select 1 from public.calls c
   where c.metadata->>'audio_path'=name and public.coaching_can_view_call(c.organization_id,c.id))
);

create or replace function public.attach_coaching_agent(p_org uuid,p_user uuid,p_caller uuid,p_team uuid,p_name text,p_email text)
returns uuid language plpgsql security definer set search_path=public as $$
declare caller_role text; target_role text; rep uuid; team public.coaching_teams%rowtype;
begin
 select role::text into caller_role from public.organization_members where organization_id=p_org and user_id=p_caller;
 if caller_role is null or caller_role not in ('owner','admin','manager') then raise exception 'Manager access required'; end if;
 select * into team from public.coaching_teams where id=p_team and organization_id=p_org for update;
 if not found or (caller_role='manager' and team.manager_id is distinct from p_caller) then raise exception 'Choose a team you manage'; end if;
 select role::text into target_role from public.organization_members where organization_id=p_org and user_id=p_user;
 if target_role is not null and target_role<>'member' then raise exception 'This account already has a privileged workspace role'; end if;
 insert into public.organization_members(organization_id,user_id,role) values(p_org,p_user,'member') on conflict(organization_id,user_id) do nothing;
 select r.id into rep from public.reps r where r.organization_id=p_org and (r.user_id=p_user or lower(r.email)=lower(p_email)) for update;
 if rep is not null then
   if caller_role='manager' and not exists(select 1 from public.reps r where r.id=rep and ((r.created_by=p_caller and not exists(select 1 from public.coaching_teams t where t.organization_id=p_org and t.manager_id is not null and r.id=any(t.rep_ids))) or exists(select 1 from public.coaching_teams t where t.organization_id=p_org and t.manager_id=p_caller and r.id=any(t.rep_ids)))) then raise exception 'Agent belongs to another manager'; end if;
   update public.reps set user_id=p_user,email=lower(p_email),status='active' where id=rep and (user_id is null or user_id=p_user);
   if not found then raise exception 'Agent is linked to another account'; end if;
 else
   insert into public.reps(organization_id,created_by,user_id,name,email) values(p_org,p_caller,p_user,btrim(p_name),lower(p_email)) returning id into rep;
 end if;
 update public.coaching_teams set rep_ids=array_append(rep_ids,rep) where id=p_team and not (rep=any(rep_ids));
 return rep;
end $$;
revoke all on function public.attach_coaching_agent(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.attach_coaching_agent(uuid,uuid,uuid,uuid,text,text) to service_role;

-- This SECURITY DEFINER importer must check scope explicitly because table RLS
-- does not run under the function owner's identity.
create or replace function public.import_coaching_outcomes(p_org uuid,p_rows jsonb) returns integer language plpgsql security definer set search_path=public as $$
declare inserted integer;begin
 if not public.coaching_is_manager(p_org) then raise exception 'Manager access required'; end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 then raise exception 'Provide 1-500 outcome rows'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r where not public.coaching_can_view_call(p_org,(r->>'call_id')::uuid)) then raise exception 'One or more calls are outside your team'; end if;
 insert into coaching_recorded_outcomes(organization_id,call_id,outcome,occurred_at,source_reference,recorded_by)
 select p_org,(r->>'call_id')::uuid,r->>'outcome',(r->>'occurred_at')::timestamptz,coalesce(r->>'source_reference',''),auth.uid() from jsonb_array_elements(p_rows) r on conflict do nothing;
 get diagnostics inserted=row_count;return inserted;
end $$;
