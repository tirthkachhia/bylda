-- Enrolled MFA must protect data APIs as well as the React challenge screen.
create or replace function public.coaching_session_verified() returns boolean
language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and (
    coalesce(auth.jwt()->>'aal'='aal2',false) or not exists(
      select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.status::text='verified'
    )
  )
$$;
revoke all on function public.coaching_session_verified() from public,anon;
grant execute on function public.coaching_session_verified() to authenticated,service_role;

create or replace function public.coaching_can_view_call(org uuid,target uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select public.coaching_session_verified() and public.is_org_member(org,auth.uid()) and exists(
   select 1 from public.calls c where c.id=target and c.organization_id=org and (
     public.is_org_admin(org,auth.uid()) or public.coaching_can_view_rep(org,c.rep_id)
     or (c.rep_id is null and c.user_id=auth.uid())
   )
 )
$$;

do $$ declare t text; begin
 foreach t in array array['calls','reps','call_transcripts','call_insights','call_exchange_scores',
  'call_score_summaries','call_learning_moments','call_guideline_adherence','coaching_analysis_runs',
  'coaching_behavior_events','coaching_call_notes','coaching_recorded_outcomes','coaching_reports',
  'coaching_assignments','coaching_report_schedules','coaching_teams','memory_artifacts','context_memory_chunks',
  'coaching_report_deliveries','coaching_delivery_channels'] loop
  execute format('drop policy if exists verified_session on public.%I',t);
  execute format('create policy verified_session on public.%I as restrictive for all to authenticated using(public.coaching_session_verified()) with check(public.coaching_session_verified())',t);
 end loop;
end $$;
drop policy if exists verified_recording_session on storage.objects;
create policy verified_recording_session on storage.objects as restrictive for all to authenticated
using(bucket_id<>'call-audio' or public.coaching_session_verified())
with check(bucket_id<>'call-audio' or public.coaching_session_verified());
