-- Recording authority is a server-maintained binding, never a mutable JSON reference.
create table if not exists public.coaching_recording_attachments (
  path text primary key,
  call_id uuid not null unique references public.calls(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade
);
alter table public.coaching_recording_attachments enable row level security;
revoke all on public.coaching_recording_attachments from public,anon,authenticated;
grant all on public.coaching_recording_attachments to service_role;

-- Only accept historical references matching the original upload contract.
insert into public.coaching_recording_attachments(path,call_id,organization_id)
select metadata->>'audio_path',id,organization_id from public.calls
where metadata->>'audio_path' ~ ('^' || organization_id::text || '/' || user_id::text || '/' || id::text || '\.(mp3|mp4|m4a|wav|webm|ogg|flac)$')
on conflict do nothing;

create or replace function public.bind_call_recording() returns trigger
language plpgsql security definer set search_path=public as $$
declare path text := nullif(new.metadata->>'audio_path','');
begin
  if tg_op='UPDATE' then
    if new.id is distinct from old.id or new.organization_id is distinct from old.organization_id
       or new.user_id is distinct from old.user_id
       or path is distinct from nullif(old.metadata->>'audio_path','') then
      raise exception 'Recording identity and attachment are immutable';
    end if;
    return new;
  end if;
  if path is null then return new; end if;
  if path !~ ('^' || new.organization_id::text || '/' || new.user_id::text || '/' || new.id::text || '\.(mp3|mp4|m4a|wav|webm|ogg|flac)$')
     or new.user_id is null then raise exception 'Invalid recording attachment'; end if;
  if current_setting('role',true)='authenticated' and new.user_id is distinct from auth.uid() then
    raise exception 'Recording must belong to the importing user';
  end if;
  if not exists(select 1 from storage.objects where bucket_id='call-audio' and name=path) then
    raise exception 'Recording upload was not found';
  end if;
  return new;
end $$;
drop trigger if exists protect_call_recording on public.calls;
create trigger protect_call_recording before insert or update on public.calls
for each row execute function public.bind_call_recording();

create or replace function public.save_call_recording_binding() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if nullif(new.metadata->>'audio_path','') is not null then
    insert into public.coaching_recording_attachments(path,call_id,organization_id)
    values(new.metadata->>'audio_path',new.id,new.organization_id);
  end if;
  return new;
end $$;
drop trigger if exists save_call_recording_binding on public.calls;
create trigger save_call_recording_binding after insert on public.calls
for each row execute function public.save_call_recording_binding();

-- Definer lookup sees bindings hidden by RLS. An uploaded file is readable by
-- its uploader before insertion; once bound, the call's visibility is authoritative.
create or replace function public.coaching_can_read_recording(path text) returns boolean
language sql stable security definer set search_path=public as $$
  select case when exists(select 1 from coaching_recording_attachments a where a.path=$1)
    then exists(select 1 from coaching_recording_attachments a where a.path=$1
      and coaching_can_view_call(a.organization_id,a.call_id))
    else split_part($1,'/',2)=auth.uid()::text
      and exists(select 1 from organization_members m where m.organization_id::text=split_part($1,'/',1) and m.user_id=auth.uid())
      and not exists(select 1 from calls c where c.id::text=split_part(split_part($1,'/',3),'.',1))
  end
$$;
revoke all on function public.coaching_can_read_recording(text) from public,anon;
grant execute on function public.coaching_can_read_recording(text) to authenticated,service_role;
drop policy if exists manager_audio_scope on storage.objects;
create policy manager_audio_scope on storage.objects as restrictive for select to authenticated
using(bucket_id<>'call-audio' or public.coaching_can_read_recording(name));
drop policy if exists recording_delete_scope on storage.objects;
create policy recording_delete_scope on storage.objects as restrictive for delete to authenticated
using(bucket_id<>'call-audio' or public.coaching_can_read_recording(name));

-- Derived copies and delivery logs must obey the source's visibility too.
create or replace function public.coaching_can_read_call_artifact(org uuid, meta jsonb) returns boolean
language plpgsql stable security definer set search_path=public as $$
begin
  if not (meta ? 'call_id') then return true; end if;
  if coalesce(meta->>'call_id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return false; end if;
  return public.coaching_can_view_call(org,(meta->>'call_id')::uuid);
end $$;
revoke all on function public.coaching_can_read_call_artifact(uuid,jsonb) from public,anon;
grant execute on function public.coaching_can_read_call_artifact(uuid,jsonb) to authenticated,service_role;
drop policy if exists call_artifact_scope on public.memory_artifacts;
create policy call_artifact_scope on public.memory_artifacts as restrictive for all to authenticated
using(public.coaching_can_read_call_artifact(org_id,metadata))
with check(public.coaching_can_read_call_artifact(org_id,metadata));
drop policy if exists call_chunk_scope on public.context_memory_chunks;
create policy call_chunk_scope on public.context_memory_chunks as restrictive for all to authenticated
using((call_id is null or public.coaching_can_view_call(organization_id,call_id))
  and (transcript_id is null or exists(select 1 from public.call_transcripts t where t.id=transcript_id and public.coaching_can_view_call(t.organization_id,t.call_id))))
with check((call_id is null or public.coaching_can_view_call(organization_id,call_id))
  and (transcript_id is null or exists(select 1 from public.call_transcripts t where t.id=transcript_id and public.coaching_can_view_call(t.organization_id,t.call_id))));
create or replace function public.protect_call_artifact_identity() returns trigger
language plpgsql set search_path=public as $$
begin
  if old.metadata ? 'call_id' and (new.org_id is distinct from old.org_id
     or new.metadata->>'call_id' is distinct from old.metadata->>'call_id') then
    raise exception 'Call artifact source is immutable';
  end if;
  return new;
end $$;
drop trigger if exists protect_call_artifact_identity on public.memory_artifacts;
create trigger protect_call_artifact_identity before update on public.memory_artifacts
for each row execute function public.protect_call_artifact_identity();
drop policy if exists delivery_report_scope on public.coaching_report_deliveries;
create policy delivery_report_scope on public.coaching_report_deliveries as restrictive for select to authenticated
using(exists(select 1 from public.coaching_reports r where r.id=report_id
  and r.organization_id=coaching_report_deliveries.organization_id and public.coaching_can_view_rep(r.organization_id,r.rep_id)));

-- Queue report notifications transactionally. A failed queue insert rolls the
-- completion back, so a completed report cannot silently lose its delivery jobs.
create or replace function public.queue_completed_coaching_report() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.status='completed' then perform public.queue_coaching_report_delivery(new.id); end if;
  return new;
end $$;
drop trigger if exists queue_completed_coaching_report on public.coaching_reports;
create trigger queue_completed_coaching_report after insert or update of status on public.coaching_reports
for each row execute function public.queue_completed_coaching_report();
insert into public.coaching_report_deliveries(organization_id,report_id,channel_id)
select r.organization_id,r.id,c.id from public.coaching_reports r
join public.coaching_delivery_channels c on c.organization_id=r.organization_id and c.enabled
where r.status='completed' on conflict do nothing;
