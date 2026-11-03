create table public.coaching_recorded_outcomes (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 call_id uuid not null references public.calls(id) on delete cascade,
 outcome text not null check(outcome in ('application_completed','approved','placed','declined','cancelled','unknown')),
 occurred_at timestamptz not null,source_reference text not null default '' check(length(source_reference)<=500),
 recorded_by uuid default auth.uid() references auth.users(id) on delete set null,created_at timestamptz not null default now(),
 verification text not null default 'manager_recorded' check(verification='manager_recorded'),
 unique(organization_id,call_id,outcome,occurred_at,source_reference)
);
alter table public.coaching_recorded_outcomes enable row level security;
create policy recorded_outcomes_read on public.coaching_recorded_outcomes for select to authenticated using(public.is_org_member(organization_id,auth.uid()));
revoke all on public.coaching_recorded_outcomes from public,anon,authenticated;
grant select on public.coaching_recorded_outcomes to authenticated;grant all on public.coaching_recorded_outcomes to service_role;
create function public.import_coaching_outcomes(p_org uuid,p_rows jsonb) returns integer language plpgsql security definer set search_path=public as $$
declare inserted integer;begin
 if not public.coaching_is_manager(p_org) then raise exception 'Manager access required'; end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 then raise exception 'Provide 1-500 outcome rows'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r where not exists(select 1 from calls c where c.id=(r->>'call_id')::uuid and c.organization_id=p_org)) then raise exception 'One or more calls are outside this workspace'; end if;
 insert into coaching_recorded_outcomes(organization_id,call_id,outcome,occurred_at,source_reference,recorded_by)
 select p_org,(r->>'call_id')::uuid,r->>'outcome',(r->>'occurred_at')::timestamptz,coalesce(r->>'source_reference',''),auth.uid() from jsonb_array_elements(p_rows) r on conflict do nothing;
 get diagnostics inserted=row_count;return inserted;
end $$;
revoke all on function public.import_coaching_outcomes(uuid,jsonb) from public,anon;
grant execute on function public.import_coaching_outcomes(uuid,jsonb) to authenticated;
create trigger outcome_records_audit after insert on public.coaching_recorded_outcomes for each row execute function public.audit_coaching_change();
