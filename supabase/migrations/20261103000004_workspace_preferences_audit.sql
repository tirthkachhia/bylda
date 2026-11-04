create table public.coaching_workspace_preferences (
 organization_id uuid primary key references public.organizations(id) on delete cascade,
 time_zone text not null default 'America/New_York',week_starts_on integer not null default 1 check(week_starts_on between 0 and 6),
 analysis_language text not null default 'English' check(analysis_language in ('English','Spanish','French','German','Portuguese','Hindi')),
 confidence_floor text not null default 'medium' check(confidence_floor in ('medium','high')),
 history_days integer not null default 60 check(history_days between 30 and 180),
 updated_at timestamptz not null default now()
);
alter table public.coaching_workspace_preferences enable row level security;
create policy workspace_preferences_read on public.coaching_workspace_preferences for select to authenticated using(public.is_org_member(organization_id,auth.uid()));
create policy workspace_preferences_write on public.coaching_workspace_preferences for all to authenticated using(public.coaching_is_manager(organization_id)) with check(public.coaching_is_manager(organization_id));
revoke all on public.coaching_workspace_preferences from anon,authenticated;
grant select on public.coaching_workspace_preferences to authenticated;
grant insert(organization_id,time_zone,week_starts_on,analysis_language,confidence_floor,history_days),update(time_zone,week_starts_on,analysis_language,confidence_floor,history_days) on public.coaching_workspace_preferences to authenticated;
grant all on public.coaching_workspace_preferences to service_role;
create function public.validate_coaching_preferences() returns trigger language plpgsql set search_path=public as $$
begin
 if not exists(select 1 from pg_timezone_names where name=new.time_zone) then raise exception 'Invalid IANA time zone'; end if;
 new.updated_at=clock_timestamp();return new;
end $$;
create trigger coaching_preferences_valid before insert or update on public.coaching_workspace_preferences for each row execute function public.validate_coaching_preferences();

create table public.coaching_notification_preferences (
 user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
 muted_types text[] not null default '{}',updated_at timestamptz not null default now()
);
alter table public.coaching_notification_preferences enable row level security;
create policy notification_preferences_own on public.coaching_notification_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke all on public.coaching_notification_preferences from anon,authenticated;
grant select on public.coaching_notification_preferences to authenticated;
grant insert(user_id,muted_types),update(muted_types) on public.coaching_notification_preferences to authenticated;
grant all on public.coaching_notification_preferences to service_role;
create function public.filter_coaching_notification() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from coaching_notification_preferences where user_id=new.user_id and (coalesce(new.type,'tool_output')=any(muted_types) or '*'=any(muted_types))) then return null; end if;
 return new;
end $$;
create trigger coaching_notification_filter before insert on public.notifications for each row execute function public.filter_coaching_notification();

create table public.coaching_audit_log (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 actor_id uuid,entity_type text not null,entity_id text not null,action text not null,created_at timestamptz not null default now()
);
alter table public.coaching_audit_log enable row level security;
create policy coaching_audit_read on public.coaching_audit_log for select to authenticated using(public.coaching_is_manager(organization_id));
revoke all on public.coaching_audit_log from anon,authenticated;
grant select on public.coaching_audit_log to authenticated;grant all on public.coaching_audit_log to service_role;
create function public.audit_coaching_change() returns trigger language plpgsql security definer set search_path=public as $$
declare row_data jsonb;
begin
 row_data=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if not exists(select 1 from organizations where id=(row_data->>'organization_id')::uuid) then return case when tg_op='DELETE' then old else new end; end if;
 insert into coaching_audit_log(organization_id,actor_id,entity_type,entity_id,action) values((row_data->>'organization_id')::uuid,auth.uid(),tg_table_name,coalesce(row_data->>'id',row_data->>'organization_id'),lower(tg_op));
 return case when tg_op='DELETE' then old else new end;
end $$;
create trigger notes_audit after insert or update or delete on public.coaching_call_notes for each row execute function public.audit_coaching_change();
create trigger assignments_audit after insert or update on public.coaching_assignments for each row execute function public.audit_coaching_change();
create trigger teams_audit after insert or update or delete on public.coaching_teams for each row execute function public.audit_coaching_change();
create trigger rooms_audit after insert or update on public.coaching_rooms for each row execute function public.audit_coaching_change();
create trigger preferences_audit after insert or update on public.coaching_workspace_preferences for each row execute function public.audit_coaching_change();
