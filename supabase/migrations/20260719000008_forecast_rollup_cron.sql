-- Schedule the forecast-rollup edge function nightly to snapshot each org's
-- forecast by category and refresh Dhruv's verdict. Requires pg_cron + pg_net;
-- no-op when pg_cron is absent so fresh/preview branches never block. The body
-- carries {"internal": true} so the function takes its cron path (all orgs).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'forecast-rollup-nightly',
      '30 6 * * *',
      $job$
        SELECT net.http_post(
          url     := current_setting('app.settings.supabase_url') || '/functions/v1/forecast-rollup',
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
      'pg_cron not installed — enable it in Supabase Dashboard > Extensions to activate the forecast-rollup schedule.';
  END IF;
END;
$$;
