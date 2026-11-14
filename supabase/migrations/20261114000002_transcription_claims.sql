-- Queue delivery IDs survive retries. Competing deliveries cannot pay to
-- transcribe the same recording while one delivery already owns the work.
create table if not exists public.coaching_transcription_claims (
  call_id uuid primary key references public.calls(id) on delete cascade,
  delivery_id text not null,
  lease_expires_at timestamptz not null
);
alter table public.coaching_transcription_claims enable row level security;
revoke all on public.coaching_transcription_claims from public,anon,authenticated;
grant all on public.coaching_transcription_claims to service_role;

create or replace function public.claim_coaching_transcription(p_call uuid,p_org uuid,p_user uuid,p_path text,p_delivery text)
returns text language plpgsql security definer set search_path=public as $$
declare target public.calls%rowtype; claimed uuid;
begin
  select * into target from public.calls where id=p_call for update;
  if not found or target.organization_id is distinct from p_org or target.user_id is distinct from p_user
    or target.metadata->>'audio_path' is distinct from p_path then raise exception 'Invalid transcription source'; end if;
  if exists(select 1 from public.call_insights where call_id=p_call) then return 'complete'; end if;
  if exists(select 1 from public.call_transcripts where call_id=p_call) then return 'saved'; end if;
  insert into public.coaching_transcription_claims(call_id,delivery_id,lease_expires_at)
    values(p_call,p_delivery,now()+interval '20 minutes')
  on conflict(call_id) do update set delivery_id=excluded.delivery_id,lease_expires_at=excluded.lease_expires_at
    where coaching_transcription_claims.delivery_id=p_delivery or coaching_transcription_claims.lease_expires_at<now()
  returning call_id into claimed;
  return case when claimed is null then 'busy' else 'claimed' end;
end $$;
create or replace function public.release_coaching_transcription(p_call uuid,p_delivery text)
returns void language sql security definer set search_path=public as $$
  delete from public.coaching_transcription_claims where call_id=p_call and delivery_id=p_delivery
$$;
revoke all on function public.claim_coaching_transcription(uuid,uuid,uuid,text,text),public.release_coaching_transcription(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_coaching_transcription(uuid,uuid,uuid,text,text),public.release_coaching_transcription(uuid,text) to service_role;
