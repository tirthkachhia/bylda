-- migration_003_monitoring.sql
-- Phase 3: Outcome Monitoring + Deviation Detection

-- -----------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS expected_outcomes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        NOT NULL REFERENCES auth.users(id),
  strategy_id    uuid        REFERENCES strategies(id),
  metric_name    text        NOT NULL,
  target_value   numeric     NOT NULL,
  target_unit    text,
  check_date     timestamptz NOT NULL,
  tolerance_pct  numeric     DEFAULT 20,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS observed_metrics (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid        NOT NULL REFERENCES auth.users(id),
  expected_outcome_id  uuid        REFERENCES expected_outcomes(id),
  metric_name          text        NOT NULL,
  observed_value       numeric     NOT NULL,
  source               text,
  observed_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deviation_alerts (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid        NOT NULL REFERENCES auth.users(id),
  expected_outcome_id  uuid        REFERENCES expected_outcomes(id),
  alert_type           text        CHECK (alert_type IN ('metric_deviation','strategic_misalignment','stalled_workflow','open_loop_critical')),
  severity             text        CHECK (severity IN ('low','medium','high','critical')),
  title                text        NOT NULL,
  diagnosis            text,
  status               text        DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  triggered_at         timestamptz DEFAULT now(),
  resolved_at          timestamptz
);

-- -----------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------

ALTER TABLE expected_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE observed_metrics  ENABLE ROW LEVEL SECURITY;
ALTER TABLE deviation_alerts  ENABLE ROW LEVEL SECURITY;

-- expected_outcomes
DROP POLICY IF EXISTS "eo_select" ON expected_outcomes;
DROP POLICY IF EXISTS "eo_insert" ON expected_outcomes;
DROP POLICY IF EXISTS "eo_update" ON expected_outcomes;
DROP POLICY IF EXISTS "eo_delete" ON expected_outcomes;

CREATE POLICY "eo_select" ON expected_outcomes FOR SELECT USING (org_id = auth.uid());
CREATE POLICY "eo_insert" ON expected_outcomes FOR INSERT WITH CHECK (org_id = auth.uid());
CREATE POLICY "eo_update" ON expected_outcomes FOR UPDATE USING (org_id = auth.uid());
CREATE POLICY "eo_delete" ON expected_outcomes FOR DELETE USING (org_id = auth.uid());

-- observed_metrics
DROP POLICY IF EXISTS "om_select" ON observed_metrics;
DROP POLICY IF EXISTS "om_insert" ON observed_metrics;
DROP POLICY IF EXISTS "om_update" ON observed_metrics;
DROP POLICY IF EXISTS "om_delete" ON observed_metrics;

CREATE POLICY "om_select" ON observed_metrics FOR SELECT USING (org_id = auth.uid());
CREATE POLICY "om_insert" ON observed_metrics FOR INSERT WITH CHECK (org_id = auth.uid());
CREATE POLICY "om_update" ON observed_metrics FOR UPDATE USING (org_id = auth.uid());
CREATE POLICY "om_delete" ON observed_metrics FOR DELETE USING (org_id = auth.uid());

-- deviation_alerts
DROP POLICY IF EXISTS "da_select" ON deviation_alerts;
DROP POLICY IF EXISTS "da_insert" ON deviation_alerts;
DROP POLICY IF EXISTS "da_update" ON deviation_alerts;
DROP POLICY IF EXISTS "da_delete" ON deviation_alerts;

CREATE POLICY "da_select" ON deviation_alerts FOR SELECT USING (org_id = auth.uid());
CREATE POLICY "da_insert" ON deviation_alerts FOR INSERT WITH CHECK (org_id = auth.uid());
CREATE POLICY "da_update" ON deviation_alerts FOR UPDATE USING (org_id = auth.uid());
CREATE POLICY "da_delete" ON deviation_alerts FOR DELETE USING (org_id = auth.uid());

-- -----------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_expected_outcomes_org_id     ON expected_outcomes(org_id);
CREATE INDEX IF NOT EXISTS idx_expected_outcomes_check_date ON expected_outcomes(check_date);
CREATE INDEX IF NOT EXISTS idx_observed_metrics_org_id      ON observed_metrics(org_id);
CREATE INDEX IF NOT EXISTS idx_observed_metrics_eo_id       ON observed_metrics(expected_outcome_id);
CREATE INDEX IF NOT EXISTS idx_deviation_alerts_org_id      ON deviation_alerts(org_id);
CREATE INDEX IF NOT EXISTS idx_deviation_alerts_status      ON deviation_alerts(status);
CREATE INDEX IF NOT EXISTS idx_deviation_alerts_severity    ON deviation_alerts(severity);
