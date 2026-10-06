import { supabase, untyped, unwrap } from "../core/db";
import type { WorkspaceMemberRoleRow } from "../db-types";

/** organization_members — owner | admin | member (Enums.org_role). */
export async function fetchOrgRole(orgId: string, userId: string): Promise<string | null> {
  const res = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return (res.data?.role as string | undefined) ?? null;
}

/** workspace_member_roles — free-text role, not in types.ts (db-types.ts). */
export async function fetchWorkspaceRole(userId: string): Promise<WorkspaceMemberRoleRow | null> {
  const res = await untyped()
    .from("workspace_member_roles")
    .select("*")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return unwrap<WorkspaceMemberRoleRow | null>(res);
}

/** The first workspace of the org (workspaces table). */
export async function fetchWorkspace(orgId: string) {
  const res = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("organization_id", orgId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return res.data;
}
