-- Fix organization_members INSERT policy: add WITH CHECK
DROP POLICY IF EXISTS "members: self insert owner" ON public.organization_members;
CREATE POLICY "members: self insert owner" ON public.organization_members
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
