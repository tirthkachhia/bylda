-- Builder & Research layer
-- Adds: workflow_builders table, research_results table, operator_memory org index

-- ─────────────────────────────────────────────────────────
-- workflow_builders: stores saved builder canvas workflows
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workflow_builders (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id          uuid        REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL DEFAULT 'Untitled workflow',
  description     text,
  blocks          jsonb       NOT NULL DEFAULT '[]',
  is_active       boolean     NOT NULL DEFAULT false,
  mode            text        NOT NULL DEFAULT 'build' CHECK (mode IN ('build', 'test', 'live')),
  last_run_at     timestamptz,
  run_count       integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_builders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wb_select" ON public.workflow_builders;
CREATE POLICY "wb_select" ON public.workflow_builders
  FOR SELECT USING (user_id = auth.uid() OR org_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "wb_insert" ON public.workflow_builders;
CREATE POLICY "wb_insert" ON public.workflow_builders
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "wb_update" ON public.workflow_builders;
CREATE POLICY "wb_update" ON public.workflow_builders
  FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "wb_delete" ON public.workflow_builders;
CREATE POLICY "wb_delete" ON public.workflow_builders
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_workflow_builders_user ON public.workflow_builders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_builders_org  ON public.workflow_builders(org_id);
CREATE INDEX IF NOT EXISTS idx_workflow_builders_active ON public.workflow_builders(is_active);

-- ─────────────────────────────────────────────────────────
-- research_results: full strategy outputs from Research page
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.research_results (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id          uuid        REFERENCES public.organizations(id) ON DELETE CASCADE,
  idea            text        NOT NULL,
  niche           text,
  target_customer text,
  stage           text        NOT NULL DEFAULT 'idea' CHECK (stage IN ('idea','validating','launched','scaling')),
  verdict         text        NOT NULL DEFAULT 'viable' CHECK (verdict IN ('strong','viable','risky','rethink')),
  strategy_json   jsonb       NOT NULL DEFAULT '{}',
  saved_to_memory boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.research_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rr_select" ON public.research_results;
CREATE POLICY "rr_select" ON public.research_results
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "rr_insert" ON public.research_results;
CREATE POLICY "rr_insert" ON public.research_results
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "rr_update" ON public.research_results;
CREATE POLICY "rr_update" ON public.research_results
  FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "rr_delete" ON public.research_results;
CREATE POLICY "rr_delete" ON public.research_results
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_research_results_user    ON public.research_results(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_results_org     ON public.research_results(org_id);
CREATE INDEX IF NOT EXISTS idx_research_results_verdict ON public.research_results(verdict);

-- ─────────────────────────────────────────────────────────
-- Add org_id to operator_memory if it doesn't exist
-- ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'operator_memory'
      AND column_name = 'org_id'
  ) THEN
    ALTER TABLE public.operator_memory ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_operator_memory_org ON public.operator_memory(org_id);
  END IF;
END $$;

-- Add metadata column to operator_memory for richer storage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'operator_memory'
      AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.operator_memory ADD COLUMN metadata jsonb DEFAULT '{}';
  END IF;
END $$;
