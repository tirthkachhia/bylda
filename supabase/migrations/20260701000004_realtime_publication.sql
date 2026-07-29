-- Add conversations + leads to the realtime publication so the unified inbox
-- and pipeline can subscribe to live changes. Idempotent: only adds tables not
-- already in the publication, and no-ops if the publication doesn't exist.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'leads'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
    END IF;
  END IF;
END;
$$;
