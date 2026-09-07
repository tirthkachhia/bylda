-- Durable receipts for approved call intelligence written into a CRM.
alter table public.call_insights
  add column if not exists writeback_result jsonb not null default '{}'::jsonb,
  add column if not exists writeback_error text;

