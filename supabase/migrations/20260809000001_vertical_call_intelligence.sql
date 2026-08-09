-- Industry-aware, evidence-backed call extraction and approval queue.
alter table public.call_insights
  add column if not exists sales_profile text not null default 'generic',
  add column if not exists vertical_insights jsonb not null default '{}'::jsonb,
  add column if not exists crm_writeback_preview jsonb not null default '[]'::jsonb,
  add column if not exists missing_required_fields text[] not null default '{}',
  add column if not exists analysis_version integer not null default 2,
  add column if not exists writeback_status text not null default 'pending_review',
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null;

alter table public.call_insights drop constraint if exists call_insights_writeback_status_check;
alter table public.call_insights add constraint call_insights_writeback_status_check
  check (writeback_status in ('pending_review', 'approved', 'writing', 'written', 'failed'));

create index if not exists idx_call_insights_writeback_queue
  on public.call_insights (organization_id, writeback_status, created_at desc);
