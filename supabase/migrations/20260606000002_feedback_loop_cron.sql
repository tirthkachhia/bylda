-- Schedule the feedback-loop edge function every 30 minutes.
--
-- Requires pg_cron + pg_net. These are optional Supabase extensions:
--   Dashboard → Database → Extensions → enable pg_cron and pg_net
--
-- This migration is a no-op when the extensions are not installed so it
-- never blocks CI on fresh / preview branches.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'feedback-loop-30min',
      '*/30 * * * *',
      $job$
        SELECT net.http_post(
          url     := current_setting('app.settings.supabase_url') || '/functions/v1/feedback-loop',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
          ),
          body    := '{}'::jsonb
        ) AS request_id;
      $job$
    );
  ELSE
    RAISE NOTICE
      'pg_cron not installed — enable it in Supabase Dashboard > Extensions to activate the feedback-loop schedule.';
  END IF;
END;
$$;
