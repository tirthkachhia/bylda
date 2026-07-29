-- Fix organizations INSERT policy: add WITH CHECK
DROP POLICY IF EXISTS "org_owner_insert" ON public.organizations;
CREATE POLICY "org_owner_insert" ON public.organizations
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());
