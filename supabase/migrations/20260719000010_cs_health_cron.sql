-- Schedule cs-health nightly to recompute customer health / churn risk across
-- all orgs. Requires pg_cron + pg_net; no-op when pg_cron is absent so
-- fresh/preview branches never block. Body carries {"internal": true} so the
-- function takes its cron path.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cs-health-nightly',
      '0 7 * * *',
      $job$
        SELECT net.http_post(
          url     := current_setting('app.settings.supabase_url') || '/functions/v1/cs-health',
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
      'pg_cron not installed — enable it in Supabase Dashboard > Extensions to activate the cs-health schedule.';
  END IF;
END;
$$;
