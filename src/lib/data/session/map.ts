import type { Role, Viewer } from "../types";

const V1_ROLES: Role[] = ["owner", "admin", "manager", "rep", "viewer", "coach"];

/**
 * Role resolution (real mode):
 *  1. organization_members.role owner/admin wins.
 *  2. else workspace_member_roles.role if it is a V1 role.
 *  3. else "rep" — least privilege; a rep sees only their own data.
 */
export function resolveRole(orgRole: string | null, workspaceRole: string | null): Role {
  if (orgRole === "owner" || orgRole === "admin") return orgRole;
  if (workspaceRole && (V1_ROLES as string[]).includes(workspaceRole)) return workspaceRole as Role;
  return "rep";
}

export function toViewer(input: {
  userId: string;
  name: string | null;
  email: string | null;
  role: Role;
  orgId: string | null;
  workspace: { id: string; name: string } | null;
}): Viewer {
  const roleLabel = input.role[0].toUpperCase() + input.role.slice(1);
  return {
    id: input.userId,
    name: input.name || input.email || "You",
    email: input.email,
    avatarUrl: null,
    role: input.role,
    subtitle: input.workspace ? `${roleLabel} · ${input.workspace.name}` : roleLabel,
    presence: "active",
    orgId: input.orgId,
    workspace: input.workspace,
    // GAP: teams — no teams/team_members tables (BACKEND_BACKLOG → teams)
    team: null,
  };
}

/** C-09 · proposed workspace_member_roles row once `role` is constrained to the V1 enum. */
export type WorkspaceRoleV1Row = {
  workspace_id: string;
  organization_id: string;
  user_id: string;
  role: Role;
  team_id: string | null;
};
export const mapWorkspaceRole = (r: WorkspaceRoleV1Row): Role => resolveRole(null, r.role);
