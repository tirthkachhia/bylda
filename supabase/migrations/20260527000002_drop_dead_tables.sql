-- Drop tables that have no references anywhere in the codebase.
-- user_dashboards was superseded by ai_dashboards.
DROP TABLE IF EXISTS public.user_dashboards CASCADE;
