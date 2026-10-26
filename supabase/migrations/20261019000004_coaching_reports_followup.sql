-- Close the coaching loop. A report's drill is stored as a canonical guideline so
-- the next report can measure whether it was practiced; delivered_at records when
-- the manager actually had the conversation; previous_report_id links the chain.
alter table public.coaching_reports
  add column if not exists drill_guideline_id uuid references public.coaching_playbook_guidelines(id) on delete set null,
  add column if not exists previous_report_id uuid references public.coaching_reports(id) on delete set null,
  add column if not exists delivered_at timestamptz;

-- Members may mark a report delivered. Everything else is written by the edge function.
drop policy if exists "coaching_reports_member_update" on public.coaching_reports;
create policy "coaching_reports_member_update" on public.coaching_reports for update to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

comment on column public.coaching_reports.drill_guideline_id is
  'The guideline this report asked the rep to practice; the next report measures it.';
