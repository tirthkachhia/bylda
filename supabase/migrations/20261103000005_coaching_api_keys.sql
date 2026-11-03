create table public.coaching_api_keys (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 100),prefix text not null,key_hash text not null unique,
 created_by uuid references auth.users(id) on delete cascade,created_at timestamptz not null default now(),revoked_at timestamptz,last_used_at timestamptz,
 rate_started_at timestamptz not null default now(),request_count integer not null default 0
);
alter table public.coaching_api_keys enable row level security;
create policy coaching_api_key_read on public.coaching_api_keys for select to authenticated using(exists(select 1 from organization_members where organization_id=coaching_api_keys.organization_id and user_id=auth.uid() and role::text in ('owner','admin')));
revoke all on public.coaching_api_keys from anon,authenticated;
grant select(id,organization_id,name,prefix,created_by,created_at,revoked_at,last_used_at) on public.coaching_api_keys to authenticated;
grant all on public.coaching_api_keys to service_role;
create function public.use_coaching_api_key(p_hash text) returns uuid language plpgsql security definer set search_path=public as $$
declare k coaching_api_keys;begin
 select * into k from coaching_api_keys where key_hash=p_hash and revoked_at is null for update;
 if not found or not exists(select 1 from organization_members where organization_id=k.organization_id and user_id=k.created_by and role::text in ('owner','admin')) then return null; end if;
 if k.rate_started_at>now()-interval '1 minute' and k.request_count>=120 then raise exception 'API rate limit exceeded'; end if;
 update coaching_api_keys set request_count=case when rate_started_at<=now()-interval '1 minute' then 1 else request_count+1 end,rate_started_at=case when rate_started_at<=now()-interval '1 minute' then now() else rate_started_at end,last_used_at=now() where id=k.id;
 return k.organization_id;
end $$;
revoke all on function public.use_coaching_api_key(text) from public,anon,authenticated;
grant execute on function public.use_coaching_api_key(text) to service_role;
create trigger api_keys_created_audit after insert on public.coaching_api_keys for each row execute function public.audit_coaching_change();
create trigger api_keys_revoked_audit after update of revoked_at on public.coaching_api_keys for each row when(old.revoked_at is distinct from new.revoked_at) execute function public.audit_coaching_change();
