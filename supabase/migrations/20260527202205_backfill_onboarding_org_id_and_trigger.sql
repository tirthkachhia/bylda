-- Backfill organization_id on existing onboarding_responses rows
UPDATE public.onboarding_responses onr
SET organization_id = om.organization_id
FROM public.organization_members om
WHERE onr.user_id = om.user_id
  AND onr.organization_id IS NULL;

-- Auto-populate organization_id on INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.populate_onboarding_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO v_org_id
    FROM public.organization_members
    WHERE user_id = NEW.user_id
    ORDER BY created_at ASC
    LIMIT 1;
    NEW.organization_id := v_org_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_populate_onboarding_org_id ON public.onboarding_responses;
CREATE TRIGGER trg_populate_onboarding_org_id
  BEFORE INSERT OR UPDATE ON public.onboarding_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.populate_onboarding_org_id();
