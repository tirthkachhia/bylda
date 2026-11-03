alter table public.coaching_reports add column request_key text unique;
create table public.coaching_report_schedules (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 rep_id uuid not null references public.reps(id) on delete cascade,created_by uuid default auth.uid() references auth.users(id) on delete set null,
 days integer not null default 14 check(days between 1 and 365),cadence text not null check(cadence in ('daily','weekly')),
 next_run_at timestamptz not null,enabled boolean not null default true,
 last_report_id uuid references public.coaching_reports(id) on delete set null,last_error text,
 lease_token uuid,lease_expires_at timestamptz,created_at timestamptz not null default now()
);
alter table public.coaching_report_schedules enable row level security;
create policy report_schedules_read on public.coaching_report_schedules for select to authenticated using(public.is_org_member(organization_id,auth.uid()));
create policy report_schedules_insert on public.coaching_report_schedules for insert to authenticated with check(public.coaching_is_manager(organization_id) and created_by=auth.uid() and exists(select 1 from reps r where r.id=rep_id and r.organization_id=coaching_report_schedules.organization_id));
create policy report_schedules_update on public.coaching_report_schedules for update to authenticated using(public.coaching_is_manager(organization_id)) with check(public.coaching_is_manager(organization_id));
create policy report_schedules_delete on public.coaching_report_schedules for delete to authenticated using(public.coaching_is_manager(organization_id));
revoke all on public.coaching_report_schedules from anon,authenticated;
grant select,delete on public.coaching_report_schedules to authenticated;
grant insert(organization_id,rep_id,days,cadence,next_run_at),update(enabled) on public.coaching_report_schedules to authenticated;
grant all on public.coaching_report_schedules to service_role;
create function public.claim_due_coaching_reports() returns setof public.coaching_report_schedules language sql security definer set search_path=public as $$
 update public.coaching_report_schedules s set lease_token=gen_random_uuid(),lease_expires_at=now()+interval '15 minutes'
 where id in (select id from public.coaching_report_schedules where enabled and next_run_at<=now() and (lease_expires_at is null or lease_expires_at<now()) order by next_run_at for update skip locked limit 1) returning s.*
$$;
revoke all on function public.claim_due_coaching_reports() from public,anon,authenticated;
grant execute on function public.claim_due_coaching_reports() to service_role;
