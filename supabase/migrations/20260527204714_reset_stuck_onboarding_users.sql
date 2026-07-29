-- Reset users who have onboarding_complete=true but 0 onboarding_responses rows
-- This forces them through the fixed onboarding flow so they get proper org context + dashboard
UPDATE profiles
SET onboarding_complete = false
WHERE onboarding_complete = true
  AND id NOT IN (
    SELECT DISTINCT user_id FROM onboarding_responses
    WHERE user_id IS NOT NULL
  );
