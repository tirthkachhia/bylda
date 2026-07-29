-- Scheduler cron: drains due scheduled campaigns and sends appointment reminders.
--
-- Mirrors the feedback-loop cron pattern: requires pg_cron + pg_net and the
-- app.settings.supabase_url / app.settings.service_role_key GUCs. No-op when
-- pg_cron isn't installed so it never blocks CI / preview branches.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Send scheduled campaigns whose scheduled_at is due (every 5 minutes).
    PERFORM cron.schedule(
      'send-scheduled-campaigns-5min',
      '*/5 * * * *',
      $job$
        SELECT net.http_post(
          url     := current_setting('app.settings.supabase_url') || '/functions/v1/send-campaign',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
          ),
          body    := '{"internal":true}'::jsonb
        ) AS request_id;
      $job$
    );

    -- Send appointment reminders for the next 24h (every 15 minutes).
    PERFORM cron.schedule(
      'appointment-reminders-15min',
      '*/15 * * * *',
      $job$
        SELECT net.http_post(
          url     := current_setting('app.settings.supabase_url') || '/functions/v1/process-reminders',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
          ),
          body    := '{}'::jsonb
        ) AS request_id;
      $job$
    );
  ELSE
    RAISE NOTICE 'pg_cron not installed — enable it to activate campaign + reminder schedules.';
  END IF;
END;
$$;
