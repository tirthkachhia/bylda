-- Add missing UNIQUE constraint on user_id so upsert onConflict: 'user_id' works
-- ADD CONSTRAINT IF NOT EXISTS requires PG15+; use a DO block for compatibility
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'onboarding_responses_user_id_key'
      AND conrelid = 'public.onboarding_responses'::regclass
  ) THEN
    ALTER TABLE public.onboarding_responses
      ADD CONSTRAINT onboarding_responses_user_id_key UNIQUE (user_id);
  END IF;
END $$;
