-- ════════════════════════════════════════════════════════════════════
-- Fix: organizations.owner_id + ai_dashboards.generated_at
--
-- The organizations table was initially created with a `created_by`
-- column but all app code and RLS policies reference `owner_id`.
-- This migration adds `owner_id`, backfills it from `created_by`, and
-- recreates the RLS policies so org creation works end-to-end.
--
-- The ai_dashboards table was missing `generated_at` which the
-- frontend reads to display "generated X ago" on the dashboard.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. organizations.owner_id ─────────────────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS owner_id uuid references auth.users(id) on delete cascade;

-- Backfill owner_id from created_by only if created_by exists (live DB).
-- On a fresh preview DB built from the squash migration, organizations is
-- already created with owner_id so created_by does not exist — skip safely.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'organizations'
      AND column_name  = 'created_by'
  ) THEN
    UPDATE public.organizations SET owner_id = created_by WHERE owner_id IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  BEGIN
    ALTER TABLE public.organizations ALTER COLUMN owner_id SET NOT NULL;
  EXCEPTION WHEN others THEN null;
  END;
END $$;

-- Recreate RLS policies using owner_id
DROP POLICY IF EXISTS "org_member_select"  ON public.organizations;
DROP POLICY IF EXISTS "org_owner_insert"   ON public.organizations;
DROP POLICY IF EXISTS "org_owner_update"   ON public.organizations;
DROP POLICY IF EXISTS "org_owner_delete"   ON public.organizations;

CREATE POLICY "org_member_select" ON public.organizations FOR SELECT
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = id AND om.user_id = auth.uid()
    )
  );
CREATE POLICY "org_owner_insert" ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "org_owner_update" ON public.organizations FOR UPDATE
  USING (auth.uid() = owner_id);
CREATE POLICY "org_owner_delete" ON public.organizations FOR DELETE
  USING (auth.uid() = owner_id);

-- ── 2. ai_dashboards.generated_at ────────────────────────────────────
ALTER TABLE public.ai_dashboards
  ADD COLUMN IF NOT EXISTS generated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.ai_dashboards SET generated_at = created_at WHERE created_at < now();
