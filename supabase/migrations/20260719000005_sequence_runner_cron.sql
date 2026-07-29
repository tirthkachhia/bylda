-- Schedule the sequence-runner edge function every 15 minutes to advance due
-- sequence enrollments. Requires pg_cron + pg_net (optional Supabase
-- extensions); no-op when pg_cron is absent so fresh/preview branches never
-- block. The body carries {"internal": true} so the function takes its
-- service-role (cron) path rather than expecting a user JWT.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'sequence-runner-15min',
      '*/15 * * * *',
      $job$
        SELECT net.http_post(
          url     := current_setting('app.settings.supabase_url') || '/functions/v1/sequence-runner',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
          ),
          body    := '{"internal": true}'::jsonb
        ) AS request_id;
      $job$
    );
  ELSE
    RAISE NOTICE
      'pg_cron not installed — enable it in Supabase Dashboard > Extensions to activate the sequence-runner schedule.';
  END IF;
END;
$$;
