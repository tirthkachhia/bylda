-- Backend Fix A — output_shape on tool_runs
--
-- The Casefile renderer routes on a semantic "output shape" rather than on
-- individual tool_key. There was no such column: the Casefile page read
-- tool_runs.output as a freeform blob and branched on tool_key. This adds a
-- first-class, nullable output_shape column, backfills existing runs from
-- tool_key, and lets the edge writer forward-fill it going forward.
--
-- Shapes: 'score_verdict' | 'comparison' | 'report' | 'memo'
--       | 'plan_with_steps' | 'pipeline_snapshot' | 'session_summary'
-- NULL is intentional and meaningful: a genuinely unwired tool stays NULL so
-- the frontend can surface it (fallback to memo + console warning) instead of
-- silently blobbing it.

ALTER TABLE public.tool_runs
  ADD COLUMN IF NOT EXISTS output_shape text;

COMMENT ON COLUMN public.tool_runs.output_shape IS
  'Semantic render shape for the Casefile renderer. One of score_verdict, comparison, report, memo, plan_with_steps, pipeline_snapshot, session_summary. NULL = unmapped tool (frontend surfaces it).';

-- Canonical tool_key -> output_shape mapping. Kept in sync with
-- deriveOutputShape() in src/lib/casefile.ts and supabase/functions/_shared/helpers.ts.
CREATE OR REPLACE FUNCTION public.tool_output_shape(tool_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    -- Explicit, highest-confidence mappings
    WHEN tool_key IN (
      'validate-idea','idea-validator','kill-my-idea',
      'funding-readiness-score','funding-readiness','score-idea','validate'
    ) THEN 'score_verdict'
    WHEN tool_key IN (
      'pricing-strategy','pricing-calculator','competitor-scanner',
      'competitor-analysis','compare'
    ) THEN 'comparison'
    WHEN tool_key IN (
      'business-plan','generate-gtm-strategy','gtm-strategy-builder',
      'positioning','research','market-research','analyze-website',
      'generate-offer','generate-pitch','investor-emails'
    ) THEN 'report'
    WHEN tool_key IN ('decision','pricing-memo') THEN 'memo'
    WHEN tool_key IN (
      'first-10-customers','first-10-customers-finder',
      'generate-followup-sequence','launch-plan','90-day-plan',
      'action-plan','generate-gtm-plan'
    ) THEN 'plan_with_steps'
    WHEN tool_key IN (
      'pipeline-snapshot','crm-snapshot','forecast','forecast-rollup'
    ) THEN 'pipeline_snapshot'
    WHEN tool_key IN (
      'mentor-session','session-summary','coaching-session'
    ) THEN 'session_summary'
    -- Heuristic fallbacks by substring (order matters)
    WHEN tool_key ~ '(valid|readiness|assess)' THEN 'score_verdict'
    WHEN tool_key ~ '(pric|compar|competitor|versus)' THEN 'comparison'
    WHEN tool_key ~ '(pipeline|forecast|snapshot)' THEN 'pipeline_snapshot'
    WHEN tool_key ~ '(mentor|session|coaching)' THEN 'session_summary'
    WHEN tool_key ~ '(sequence|customers|outreach|roadmap|steps|plan)' THEN 'plan_with_steps'
    WHEN tool_key ~ '(report|research|analy|strateg|gtm|positioning|pitch|offer)' THEN 'report'
    -- Unknown -> NULL (surfaced by the frontend, not silently defaulted)
    ELSE NULL
  END;
$$;

-- Backfill existing runs.
UPDATE public.tool_runs
SET output_shape = public.tool_output_shape(tool_key)
WHERE output_shape IS NULL;
