-- Performance (P2): add covering indexes for foreign keys that lack one.
-- Each FK below was verified against repo schema to have no existing index whose
-- leading column matches the FK column. All are additive and idempotent.
--
-- RLS auth.uid() -> (select auth.uid()) rewrite is intentionally NOT included here:
-- there are 30+ policies (many wrapping auth.uid() inside helper functions such as
-- is_org_member/is_org_owner) and rewriting them via DROP/CREATE in a blind migration
-- is risky. Left for out-of-band handling against live pg_policies.

create index if not exists idx_tool_runs_user on public.tool_runs(user_id);
create index if not exists idx_generated_assets_user on public.generated_assets(user_id);
create index if not exists idx_generated_assets_tool_run on public.generated_assets(tool_run_id);
-- leads and website_analyses are org-scoped (no user_id column); index the org FK instead.
create index if not exists idx_leads_organization on public.leads(organization_id);
create index if not exists idx_website_analyses_organization on public.website_analyses(organization_id);
create index if not exists idx_asset_versions_created_by on public.asset_versions(created_by);
