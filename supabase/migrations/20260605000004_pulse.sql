-- migration_004_pulse.sql
-- Phase 4: Pulse run logging (internal only, no RLS)

CREATE TABLE IF NOT EXISTS pulse_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_count   int,
  alerts_sent int,
  ran_at      timestamptz DEFAULT now(),
  metadata    jsonb       DEFAULT '{}'
);
