-- migration_002_memory.sql
-- Phase 2: Durable Memory + Company Knowledge Graph

-- -----------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS decisions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES auth.users(id),
  session_id  uuid,
  title       text        NOT NULL,
  description text,
  rationale   text,
  outcome     text,
  status      text        DEFAULT 'open' CHECK (status IN ('open','validated','reversed','superseded')),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS strategies (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid        NOT NULL REFERENCES auth.users(id),
  title           text        NOT NULL,
  objective       text,
  steps           jsonb       DEFAULT '[]',
  triggers        jsonb       DEFAULT '[]',
  success_metrics jsonb       DEFAULT '[]',
  executable      boolean     DEFAULT false,
  status          text        DEFAULT 'active' CHECK (status IN ('active','paused','completed','archived')),
  spec_type       text        CHECK (spec_type IN ('campaign','product','automation','growth','ops')),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outcomes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        NOT NULL REFERENCES auth.users(id),
  strategy_id    uuid        REFERENCES strategies(id),
  decision_id    uuid        REFERENCES decisions(id),
  description    text        NOT NULL,
  expected_value text,
  actual_value   text,
  status         text        DEFAULT 'pending' CHECK (status IN ('pending','met','missed','partial')),
  due_date       timestamptz,
  resolved_at    timestamptz,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS open_loops (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid        NOT NULL REFERENCES auth.users(id),
  title                text        NOT NULL,
  description          text,
  linked_decision_id   uuid        REFERENCES decisions(id),
  linked_strategy_id   uuid        REFERENCES strategies(id),
  priority             text        DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  status               text        DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','dropped')),
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- -----------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------

ALTER TABLE decisions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE open_loops ENABLE ROW LEVEL SECURITY;

-- decisions
DROP POLICY IF EXISTS "dec_select" ON decisions;
DROP POLICY IF EXISTS "dec_insert" ON decisions;
DROP POLICY IF EXISTS "dec_update" ON decisions;
DROP POLICY IF EXISTS "dec_delete" ON decisions;

CREATE POLICY "dec_select" ON decisions FOR SELECT USING (org_id = auth.uid());
CREATE POLICY "dec_insert" ON decisions FOR INSERT WITH CHECK (org_id = auth.uid());
CREATE POLICY "dec_update" ON decisions FOR UPDATE USING (org_id = auth.uid());
CREATE POLICY "dec_delete" ON decisions FOR DELETE USING (org_id = auth.uid());

-- strategies
DROP POLICY IF EXISTS "str_select" ON strategies;
DROP POLICY IF EXISTS "str_insert" ON strategies;
DROP POLICY IF EXISTS "str_update" ON strategies;
DROP POLICY IF EXISTS "str_delete" ON strategies;

CREATE POLICY "str_select" ON strategies FOR SELECT USING (org_id = auth.uid());
CREATE POLICY "str_insert" ON strategies FOR INSERT WITH CHECK (org_id = auth.uid());
CREATE POLICY "str_update" ON strategies FOR UPDATE USING (org_id = auth.uid());
CREATE POLICY "str_delete" ON strategies FOR DELETE USING (org_id = auth.uid());

-- outcomes
DROP POLICY IF EXISTS "out_select" ON outcomes;
DROP POLICY IF EXISTS "out_insert" ON outcomes;
DROP POLICY IF EXISTS "out_update" ON outcomes;
DROP POLICY IF EXISTS "out_delete" ON outcomes;

CREATE POLICY "out_select" ON outcomes FOR SELECT USING (org_id = auth.uid());
CREATE POLICY "out_insert" ON outcomes FOR INSERT WITH CHECK (org_id = auth.uid());
CREATE POLICY "out_update" ON outcomes FOR UPDATE USING (org_id = auth.uid());
CREATE POLICY "out_delete" ON outcomes FOR DELETE USING (org_id = auth.uid());

-- open_loops
DROP POLICY IF EXISTS "ol_select" ON open_loops;
DROP POLICY IF EXISTS "ol_insert" ON open_loops;
DROP POLICY IF EXISTS "ol_update" ON open_loops;
DROP POLICY IF EXISTS "ol_delete" ON open_loops;

CREATE POLICY "ol_select" ON open_loops FOR SELECT USING (org_id = auth.uid());
CREATE POLICY "ol_insert" ON open_loops FOR INSERT WITH CHECK (org_id = auth.uid());
CREATE POLICY "ol_update" ON open_loops FOR UPDATE USING (org_id = auth.uid());
CREATE POLICY "ol_delete" ON open_loops FOR DELETE USING (org_id = auth.uid());

-- -----------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_decisions_org_id    ON decisions(org_id);
CREATE INDEX IF NOT EXISTS idx_decisions_status    ON decisions(status);
CREATE INDEX IF NOT EXISTS idx_strategies_org_id   ON strategies(org_id);
CREATE INDEX IF NOT EXISTS idx_strategies_exec     ON strategies(executable);
CREATE INDEX IF NOT EXISTS idx_outcomes_org_id     ON outcomes(org_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_strategy   ON outcomes(strategy_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_status     ON outcomes(status);
CREATE INDEX IF NOT EXISTS idx_open_loops_org_id   ON open_loops(org_id);
CREATE INDEX IF NOT EXISTS idx_open_loops_status   ON open_loops(status);
CREATE INDEX IF NOT EXISTS idx_open_loops_priority ON open_loops(priority);
