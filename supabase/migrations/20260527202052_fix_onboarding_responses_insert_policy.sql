-- Fix INSERT policy: add WITH CHECK so users can only insert their own row
DROP POLICY IF EXISTS "onboarding_insert_own" ON public.onboarding_responses;
CREATE POLICY "onboarding_insert_own" ON public.onboarding_responses
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
