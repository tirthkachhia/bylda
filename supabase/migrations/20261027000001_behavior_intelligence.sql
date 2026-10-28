-- Immutable evidence history; current call_insights remains a backwards-compatible projection.
alter table public.call_guideline_adherence drop constraint call_guideline_adherence_status_check;
alter table public.call_guideline_adherence add constraint call_guideline_adherence_status_check
  check(status in ('followed','adapted','partial','missed','not_applicable','not_observable'));
create table public.coaching_policy_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check(length(title) between 1 and 200),
  version integer not null check(version > 0),
  content text not null check(length(content) between 8 and 12000),
  source_url text check(source_url is null or source_url ~ '^https://'),
  approved_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique(organization_id,title,version)
);
alter table public.coaching_policy_versions enable row level security;
create policy policy_versions_read on public.coaching_policy_versions for select to authenticated using(public.is_org_member(organization_id,auth.uid()));
create policy policy_versions_approve on public.coaching_policy_versions for insert to authenticated with check (
  approved_by=auth.uid() and exists(select 1 from public.organization_members m where m.organization_id=coaching_policy_versions.organization_id and m.user_id=auth.uid() and m.role::text in ('owner','admin','manager'))
);
revoke all on public.coaching_policy_versions from public,anon,authenticated;
grant select on public.coaching_policy_versions to authenticated;
grant insert(organization_id,title,version,content,source_url) on public.coaching_policy_versions to authenticated;
grant all on public.coaching_policy_versions to service_role;

create table public.coaching_analysis_runs (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  call_id uuid not null references public.calls(id) on delete cascade,
  rep_id uuid references public.reps(id) on delete set null,
  transcript_id uuid references public.call_transcripts(id) on delete set null,
  transcript_hash text not null,
  call_occurred_at timestamptz not null,
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  prompt_version text not null,
  taxonomy_version text not null,
  playbook_version_id uuid references public.coaching_playbook_versions(id) on delete set null,
  models jsonb not null,
  context_receipt jsonb not null default '{}'::jsonb,
  coverage jsonb not null,
  source_snapshot jsonb not null,
  analysis jsonb not null,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  unique(id, organization_id)
);
create index coaching_analysis_runs_call_idx on public.coaching_analysis_runs(call_id, started_at desc);
create index coaching_analysis_runs_rep_idx on public.coaching_analysis_runs(organization_id, rep_id, call_occurred_at);

create table public.coaching_behavior_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  organization_id uuid not null,
  call_id uuid not null references public.calls(id) on delete cascade,
  rep_id uuid references public.reps(id) on delete set null,
  occurrence_key text not null,
  family text not null check (family in ('discovery_recommendation','objection_resolution','commitment_next_step')),
  opportunity text not null check (opportunity in ('eligible','not_applicable','unknown')),
  result text not null check (result in ('strength','concern','mixed','unobservable')),
  start_s numeric,
  end_s numeric,
  evidence jsonb not null check (jsonb_typeof(evidence) = 'object'),
  assessment jsonb not null check (jsonb_typeof(assessment) = 'object'),
  foreign key (run_id, organization_id) references public.coaching_analysis_runs(id, organization_id) on delete cascade,
  unique(run_id, occurrence_key)
);
create index coaching_behavior_events_run_idx on public.coaching_behavior_events(run_id, family);

create table public.coaching_behavior_feedback (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.coaching_behavior_events(id) on delete cascade,
  reviewed_by uuid not null default auth.uid(),
  accuracy text not null check (accuracy in ('accurate','incorrect','uncertain')),
  usefulness text not null check (usefulness in ('useful','unhelpful','uncertain')),
  correction text not null default '' check(length(correction) <= 4000),
  created_at timestamptz not null default now()
);

alter table public.coaching_analysis_runs enable row level security;
alter table public.coaching_behavior_events enable row level security;
alter table public.coaching_behavior_feedback enable row level security;
create policy behavior_runs_read on public.coaching_analysis_runs for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));
create policy behavior_events_read on public.coaching_behavior_events for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));
create policy behavior_feedback_read on public.coaching_behavior_feedback for select to authenticated using (
  exists(select 1 from public.coaching_behavior_events e where e.id=event_id and public.is_org_member(e.organization_id, auth.uid()))
);
create policy behavior_feedback_insert on public.coaching_behavior_feedback for insert to authenticated with check (
  reviewed_by=auth.uid() and exists(select 1 from public.coaching_behavior_events e
    join public.organization_members m on m.organization_id=e.organization_id
    where e.id=event_id and m.user_id=auth.uid() and m.role::text in ('owner','admin','manager'))
);
revoke all on public.coaching_analysis_runs, public.coaching_behavior_events, public.coaching_behavior_feedback from anon, authenticated;
grant select on public.coaching_analysis_runs, public.coaching_behavior_events, public.coaching_behavior_feedback to authenticated;
grant insert (event_id,accuracy,usefulness,correction) on public.coaching_behavior_feedback to authenticated;
grant all on public.coaching_analysis_runs, public.coaching_behavior_events, public.coaching_behavior_feedback to service_role;

-- Guarded core retains transcript/job lease checks. Wrapper and core execute in one transaction.
alter function public.complete_call_analysis(uuid,uuid,uuid,uuid,uuid,text,jsonb) rename to complete_call_analysis_legacy;
create function public.complete_call_analysis(p_job_id uuid,p_attempt_token uuid,p_organization_id uuid,p_call_id uuid,p_transcript_id uuid,p_transcript_hash text,p_result jsonb)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare
  archive jsonb := p_result->'behavior_archive';
  event jsonb;
  run_id uuid;
  call_row public.calls%rowtype;
  actual_structured jsonb;
begin
  select * into call_row from public.calls where id=p_call_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Call organization mismatch'; end if;
  select structured_turns into actual_structured from public.call_transcripts where id=p_transcript_id and call_id=p_call_id for update;
  if archive is not null and nullif(archive->>'rep_id','')::uuid is distinct from call_row.rep_id then return false; end if;
  if archive is not null and coalesce(actual_structured,'null'::jsonb) is distinct from coalesce(archive->'structured_snapshot','null'::jsonb) then
    return false;
  end if;
  if archive is not null and exists(select 1 from public.coaching_analysis_runs r where r.call_id=p_call_id and r.started_at > (archive->>'started_at')::timestamptz) then
    return false;
  end if;
  if not public.complete_call_analysis_legacy(p_job_id,p_attempt_token,p_organization_id,p_call_id,p_transcript_id,p_transcript_hash,p_result) then return false; end if;
  -- Old callers stay compatible, but only new callers generate behavioral history.
  if archive is null then return true; end if;
  run_id := (archive->>'id')::uuid;
  if coalesce((archive#>>'{analysis,coverage,complete}')::boolean,false) is not true then raise exception 'Incomplete behavior run'; end if;
  insert into public.coaching_analysis_runs(id,organization_id,call_id,rep_id,transcript_id,transcript_hash,call_occurred_at,started_at,prompt_version,taxonomy_version,playbook_version_id,models,coverage,source_snapshot,analysis,tokens_in,tokens_out,context_receipt)
  values(run_id,p_organization_id,p_call_id,call_row.rep_id,p_transcript_id,p_transcript_hash,coalesce(call_row.started_at,call_row.created_at),
    (archive->>'started_at')::timestamptz,archive->>'prompt_version',archive#>>'{analysis,version}',
    nullif(p_result#>>'{vertical_insights,playbook,version_id}','')::uuid,archive->'models',archive#>'{analysis,coverage}',
    jsonb_build_object('structured_turns',archive->'structured_snapshot','structured_meta',archive->'structured_meta','transcript_text',archive->'source_text_snapshot'),archive->'analysis',
    coalesce((archive->>'tokens_in')::integer,0),coalesce((archive->>'tokens_out')::integer,0),jsonb_build_object('prior_context',coalesce(archive->'prior_context_receipt','{}'::jsonb),'approved_policies',coalesce(archive->'approved_policies','[]'::jsonb)));
  for event in select value from jsonb_array_elements(archive#>'{analysis,events}') loop
    insert into public.coaching_behavior_events(run_id,organization_id,call_id,rep_id,occurrence_key,family,opportunity,result,start_s,end_s,evidence,assessment)
    values(run_id,p_organization_id,p_call_id,call_row.rep_id,event->>'occurrence_key',event->>'family',event->>'opportunity',event->>'result',
      (select min((v->>'start_s')::numeric) from jsonb_array_elements(event->'rep_evidence') v),
      (select max((v->>'end_s')::numeric) from jsonb_array_elements((event->'rep_evidence')||(event->'buyer_evidence')) v),
      jsonb_build_object('context',event->'context_evidence','rep',event->'rep_evidence','buyer',event->'buyer_evidence'),
      event-'context_evidence'-'rep_evidence'-'buyer_evidence');
  end loop;
  update public.calls set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('coaching_stage','analyzed','coaching_error',null,'behavior_run_id',run_id)
    where id=p_call_id and metadata->>'behavior_attempt_id'=archive->>'behavior_attempt_id';
  return true;
end $$;
revoke all on function public.complete_call_analysis(uuid,uuid,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.complete_call_analysis(uuid,uuid,uuid,uuid,uuid,text,jsonb) to service_role;

-- Only explicitly accurate AND useful examples, with no conflicting latest reviewer labels,
-- may be retrieved as coaching examples. This is retrieval, not automatic weight training.
create view public.coaching_reviewed_examples with (security_invoker=true) as
select distinct on(e.organization_id,e.call_id,e.occurrence_key,r.transcript_hash) e.id,e.organization_id,e.family,e.assessment,r.taxonomy_version,r.completed_at
from public.coaching_behavior_events e join public.coaching_analysis_runs r on r.id=e.run_id
where exists(select 1 from public.coaching_behavior_feedback f where f.event_id=e.id)
and not exists (
  select 1 from (
    select distinct on (f.reviewed_by) f.accuracy,f.usefulness
    from public.coaching_behavior_feedback f where f.event_id=e.id
    order by f.reviewed_by,f.created_at desc,f.id desc
  ) latest where latest.accuracy <> 'accurate' or latest.usefulness <> 'useful'
) order by e.organization_id,e.call_id,e.occurrence_key,r.transcript_hash,r.started_at desc;
revoke all on public.coaching_reviewed_examples from public,anon,authenticated;
grant select on public.coaching_reviewed_examples to service_role;

-- Marking a conversation delivered must not permit editing report evidence, scores or authorship.
drop policy if exists coaching_reports_member_update on public.coaching_reports;
revoke update on public.coaching_reports from authenticated;
grant update(delivered_at) on public.coaching_reports to authenticated;
create policy coaching_reports_delivery_update on public.coaching_reports for update to authenticated
  using (exists(select 1 from public.organization_members m where m.organization_id=coaching_reports.organization_id and m.user_id=auth.uid() and m.role::text in ('owner','admin','manager')))
  with check (exists(select 1 from public.organization_members m where m.organization_id=coaching_reports.organization_id and m.user_id=auth.uid() and m.role::text in ('owner','admin','manager')));
