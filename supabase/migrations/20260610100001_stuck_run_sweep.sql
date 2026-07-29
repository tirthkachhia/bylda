-- Stuck-run sweep: tool_runs rows left in status='running' (the edge function
-- crashed or timed out mid-run) currently spin forever in the UI as
-- "Generating…". Sweep anything older than 10 minutes to 'failed' so the user
-- gets a retry affordance instead of an eternal spinner.
--
-- Pure SQL (no pg_net/http needed); only the scheduling requires pg_cron.
-- No-op when pg_cron isn't installed so fresh/preview branches never block.

create or replace function public.sweep_stuck_tool_runs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  swept integer;
begin
  update public.tool_runs
     set status       = 'failed',
         error        = 'Timed out — the run did not complete. Please try again.',
         completed_at = now()
   where status = 'running'
     and created_at < now() - interval '10 minutes';
  get diagnostics swept = row_count;
  return swept;
end;
$$;

comment on function public.sweep_stuck_tool_runs() is
  'Marks tool_runs stuck in running >10min as failed. Scheduled via pg_cron (stuck-run-sweep-10min).';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Re-schedule idempotently
    PERFORM cron.unschedule('stuck-run-sweep-10min')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'stuck-run-sweep-10min');

    PERFORM cron.schedule(
      'stuck-run-sweep-10min',
      '*/10 * * * *',
      'SELECT public.sweep_stuck_tool_runs();'
    );
  ELSE
    RAISE NOTICE
      'pg_cron not installed — enable it in Supabase Dashboard > Extensions to activate the stuck-run sweep.';
  END IF;
END;
$$;
