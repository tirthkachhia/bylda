-- Migration: tool_events + prompt_feedback
-- Supports the automated feedback loop (Task 3).

-- ─── tool_events ──────────────────────────────────────────────────────────────
-- One row per tool run; used to detect repeated runs with identical inputs.

CREATE TABLE IF NOT EXISTS tool_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL,
  user_id       uuid        NOT NULL,
  tool_name     text        NOT NULL,
  input_hash    text        NOT NULL,   -- SHA-256 (first 32 hex chars) of normalised input
  input_summary text,                   -- up to 500 chars, for Claude context
  ran_at        timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tool_events_org_tool_time
  ON tool_events (org_id, tool_name, ran_at DESC);

CREATE INDEX IF NOT EXISTS idx_tool_events_hash_lookup
  ON tool_events (org_id, tool_name, input_hash, ran_at DESC);

ALTER TABLE tool_events ENABLE ROW LEVEL SECURITY;

-- Members of the org can read their org's events
CREATE POLICY "tool_events_select"
  ON tool_events FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Authenticated users insert their own events
CREATE POLICY "tool_events_insert"
  ON tool_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─── prompt_feedback ──────────────────────────────────────────────────────────
-- AI-generated improvement suggestions for prompts that were re-run repeatedly.

CREATE TABLE IF NOT EXISTS prompt_feedback (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL,
  tool_name    text        NOT NULL,
  input_hash   text        NOT NULL,
  repeat_count int         NOT NULL DEFAULT 2,
  suggestion   text        NOT NULL,
  applied      boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_feedback_org
  ON prompt_feedback (org_id, tool_name, created_at DESC);

ALTER TABLE prompt_feedback ENABLE ROW LEVEL SECURITY;

-- Members of the org can read feedback for their org
CREATE POLICY "prompt_feedback_select"
  ON prompt_feedback FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- The feedback-loop edge function runs as service role (bypasses RLS),
-- but add an explicit policy so the service role insert is documented.
CREATE POLICY "prompt_feedback_insert_service"
  ON prompt_feedback FOR INSERT
  WITH CHECK (true);
