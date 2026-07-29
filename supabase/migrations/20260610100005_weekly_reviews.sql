-- Weekly Operating Review — the retention engine for the "Weekly Loop" stage.
-- One AI-generated review per org per week: wins, stalls, and next week's
-- focus, grounded in the Business Context Graph + the week's actual activity.

create table if not exists public.weekly_reviews (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  week_start      date not null,
  payload         jsonb not null default '{}'::jsonb,
  model           text,
  created_at      timestamptz not null default now(),
  constraint weekly_reviews_org_week unique (organization_id, week_start)
);

alter table public.weekly_reviews enable row level security;

drop policy if exists "weekly_reviews_select_member" on public.weekly_reviews;
create policy "weekly_reviews_select_member"
  on public.weekly_reviews for select
  using (public.is_org_member(organization_id, auth.uid()));

create index if not exists idx_weekly_reviews_org_week
  on public.weekly_reviews (organization_id, week_start desc);

-- Schedule generation every Monday 07:00 UTC (no-op without pg_cron/pg_net).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('weekly-review-monday')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-review-monday');

    PERFORM cron.schedule(
      'weekly-review-monday',
      '0 7 * * 1',
      $job$
        SELECT net.http_post(
          url     := current_setting('app.settings.supabase_url') || '/functions/v1/weekly-review',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
          ),
          body    := '{"mode":"cron"}'::jsonb
        ) AS request_id;
      $job$
    );
  ELSE
    RAISE NOTICE 'pg_cron not installed — weekly-review schedule skipped.';
  END IF;
END;
$$;
