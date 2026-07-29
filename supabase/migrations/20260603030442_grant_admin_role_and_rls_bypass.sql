
-- Helper function: check if current user is an admin
-- SECURITY DEFINER bypasses RLS on the user_roles table, preventing circular recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- Grant ansh.patel102104@gmail.com the admin role (no-op on preview branches where this user doesn't exist)
DO $$ BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES ('00fc0b23-4126-4a7d-8088-a04f310b6e67', 'admin')
  ON CONFLICT DO NOTHING;
EXCEPTION WHEN foreign_key_violation THEN NULL;
END $$;

-- Admin SELECT bypass policies
-- These are permissive (OR'd with existing policies) — existing user-scoped access is unchanged

DO $$ BEGIN
  CREATE POLICY "profiles: admins view all"
    ON public.profiles FOR SELECT USING (public.is_admin());
EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "organizations: admins view all"
    ON public.organizations FOR SELECT USING (public.is_admin());
EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "subscriptions: admins view all"
    ON public.subscriptions FOR SELECT USING (public.is_admin());
EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "tool_runs: admins view all"
    ON public.tool_runs FOR SELECT USING (public.is_admin());
EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "user_roles: admins view all"
    ON public.user_roles FOR SELECT USING (public.is_admin());
EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "automation_logs: admins view all"
    ON public.automation_logs FOR SELECT USING (public.is_admin());
EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "nova_conversations: admins view all"
    ON public.nova_conversations FOR SELECT USING (public.is_admin());
EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "credit_ledger: admins view all"
    ON public.credit_ledger FOR SELECT USING (public.is_admin());
EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL; END $$;
