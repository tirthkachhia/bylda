create table public.coaching_delivery_channels (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 kind text not null check(kind in ('slack','teams','email','webhook')),label text not null check(length(btrim(label)) between 1 and 150),
 secret_ref text not null,created_by uuid not null references auth.users(id) on delete cascade,enabled boolean not null default true,created_at timestamptz not null default now()
);
alter table public.coaching_delivery_channels enable row level security;
create policy delivery_channels_read on public.coaching_delivery_channels for select to authenticated using(public.is_org_member(organization_id,auth.uid()));
revoke all on public.coaching_delivery_channels from public,anon,authenticated;
grant select(id,organization_id,kind,label,created_by,enabled,created_at) on public.coaching_delivery_channels to authenticated;
grant all on public.coaching_delivery_channels to service_role;
create table public.coaching_report_deliveries (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 report_id uuid not null references public.coaching_reports(id) on delete cascade,channel_id uuid not null references public.coaching_delivery_channels(id) on delete cascade,
 status text not null default 'queued' check(status in ('queued','sending','accepted','failed')),error_message text,created_at timestamptz not null default now(),completed_at timestamptz,started_at timestamptz,
 unique(report_id,channel_id)
);
alter table public.coaching_report_deliveries enable row level security;
create policy report_deliveries_read on public.coaching_report_deliveries for select to authenticated using(public.is_org_member(organization_id,auth.uid()));
revoke all on public.coaching_report_deliveries from public,anon,authenticated;
grant select on public.coaching_report_deliveries to authenticated;grant all on public.coaching_report_deliveries to service_role;
create function public.queue_coaching_report_delivery(p_report uuid) returns void language sql security definer set search_path=public as $$
 insert into coaching_report_deliveries(organization_id,report_id,channel_id)
 select r.organization_id,r.id,c.id from coaching_reports r join coaching_delivery_channels c on c.organization_id=r.organization_id and c.enabled where r.id=p_report and r.status='completed' on conflict do nothing
$$;
revoke all on function public.queue_coaching_report_delivery(uuid) from public,anon,authenticated;
grant execute on function public.queue_coaching_report_delivery(uuid) to service_role;
create function public.claim_coaching_report_delivery() returns setof public.coaching_report_deliveries language sql security definer set search_path=public as $$
 update coaching_report_deliveries set status='sending',started_at=now() where id=(select id from coaching_report_deliveries where status='queued' order by created_at for update skip locked limit 1) returning *
$$;
revoke all on function public.claim_coaching_report_delivery() from public,anon,authenticated;
grant execute on function public.claim_coaching_report_delivery() to service_role;
create trigger delivery_channel_audit after insert or update or delete on public.coaching_delivery_channels for each row execute function public.audit_coaching_change();
