-- Cleanup survives deletion of the parent workspace. Only service-role workers
-- can see paths or execute it; no authenticated client can queue storage deletes.
create table public.coaching_storage_cleanup (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,paths text[] not null,
 created_at timestamptz not null default now(),last_error text
);
alter table public.coaching_storage_cleanup enable row level security;
revoke all on public.coaching_storage_cleanup from public,anon,authenticated;
grant all on public.coaching_storage_cleanup to service_role;
create function public.coaching_usage_stats(p_org uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare files bigint;bytes bigint;known bigint;seats bigint;
begin
 if not public.is_org_member(p_org,auth.uid()) then raise exception 'Workspace access required'; end if;
 select count(*),count(*) filter(where metadata->>'size' ~ '^\d+$'),coalesce(sum(case when metadata->>'size' ~ '^\d+$' then (metadata->>'size')::bigint else 0 end),0)
 into files,known,bytes from storage.objects where bucket_id='call-audio' and name like p_org::text||'/%';
 select count(distinct rep_id) into seats from coaching_analysis_runs where organization_id=p_org;
 return jsonb_build_object('recordings',files,'known_size_recordings',known,'storage_bytes',bytes,'analyzed_reps',seats);
end $$;
revoke all on function public.coaching_usage_stats(uuid) from public,anon;
grant execute on function public.coaching_usage_stats(uuid) to authenticated,service_role;
create function public.coaching_workspace_audio_paths(p_org uuid,p_actor uuid) returns setof text language sql security definer set search_path=public as $$
 select name from storage.objects where bucket_id='call-audio' and name like p_org::text||'/%' and exists(select 1 from organizations where id=p_org and owner_id=p_actor)
$$;
revoke all on function public.coaching_workspace_audio_paths(uuid,uuid) from public,anon,authenticated;
grant execute on function public.coaching_workspace_audio_paths(uuid,uuid) to service_role;
