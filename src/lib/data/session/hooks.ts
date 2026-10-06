import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import type { DataCtx } from "../core/context";
import { useDevRole } from "../core/devRole";
import { withEmpty, type DataResult } from "../core/query";
import { resolveSource, type Source } from "../core/source";
import { TEAMS, WORKSPACES, mockViewer } from "../mocks/people";
import type { Role, TeamSummary, Viewer, WorkspaceSummary } from "../types";
import { fetchOrgRole, fetchWorkspace, fetchWorkspaceRole } from "./fetchers";
import { resolveRole, toViewer } from "./map";
import { sessionKeys } from "./queryKeys";
import { SOURCE } from "./source";

export type AuthLike = {
  userId: string | null;
  name: string | null;
  email: string | null;
  orgId: string | null;
  orgName: string | null;
};

/** Pure loader — testable without React. */
export async function loadViewer(
  source: Source,
  auth: AuthLike,
  devRole: Role | null,
): Promise<Viewer> {
  if (source === "mock") return mockViewer(devRole ?? "manager");
  if (!auth.userId) throw new Error("NOT_SIGNED_IN");
  const [orgRole, wsRole, ws] = await Promise.all([
    auth.orgId ? fetchOrgRole(auth.orgId, auth.userId) : Promise.resolve(null),
    fetchWorkspaceRole(auth.userId).catch(() => null),
    auth.orgId ? fetchWorkspace(auth.orgId) : Promise.resolve(null),
  ]);
  const viewer = toViewer({
    userId: auth.userId,
    name: auth.name,
    email: auth.email,
    role: resolveRole(orgRole, wsRole?.role ?? null),
    orgId: auth.orgId,
    workspace: ws
      ? { id: ws.id, name: ws.name }
      : auth.orgId
        ? { id: auth.orgId, name: auth.orgName ?? "Workspace" }
        : null,
  });
  if (source === "hybrid") {
    // GAP: teams — real viewers get the fixture's team shape only in mock mode; stays null here.
  }
  return viewer;
}

/** The signed-in person + role. Every other hook derives its DataCtx from this. */
export function useViewer(): DataResult<Viewer> {
  const source = resolveSource(SOURCE);
  const devRole = useDevRole();
  const auth = useAuth();
  const authLike: AuthLike = {
    userId: auth.user?.id ?? null,
    name: auth.profile?.full_name ?? null,
    email: auth.user?.email ?? auth.profile?.email ?? null,
    orgId: auth.currentOrgId,
    orgName: auth.currentOrg?.name ?? null,
  };
  const q = useQuery({
    queryKey: sessionKeys.viewer(source, authLike.userId, devRole),
    queryFn: () => loadViewer(source, authLike, devRole),
    enabled: source === "mock" || !auth.loading,
    staleTime: Infinity,
  });
  return withEmpty(q, () => false);
}

export function toCtx(v: Viewer): DataCtx {
  return {
    userId: v.id,
    orgId: v.orgId,
    workspaceId: v.workspace?.id ?? null,
    teamId: v.team?.id ?? null,
    role: v.role,
  };
}

/** DataCtx for loaders; undefined while the viewer loads (hooks stay disabled). */
export function useDataCtx(): DataCtx | undefined {
  const v = useViewer();
  return v.data ? toCtx(v.data) : undefined;
}

/** Workspace switcher (50:27315). GAP: multi-workspace membership — mock list in every mode. */
export function useWorkspaces(): DataResult<WorkspaceSummary[]> {
  const v = useViewer();
  const q = useQuery({
    queryKey: sessionKeys.workspaces(v.data?.id ?? "anon"),
    queryFn: async () =>
      resolveSource(SOURCE) === "mock"
        ? WORKSPACES
        : !v.data?.workspace
          ? []
          : // GAP: workspaces list per user — only the current one is real
            [
              {
                id: v.data.workspace.id,
                name: v.data.workspace.name,
                isCurrent: true,
                initials: v.data.workspace.name.slice(0, 2).toUpperCase(),
              },
            ],
    enabled: !!v.data,
  });
  return withEmpty(q, (d) => d.length === 0);
}

/** Teams in the workspace — rail chips, switcher. GAP: teams (mock in every mode). */
export function useTeams(): DataResult<TeamSummary[]> {
  const ctx = useDataCtx();
  const q = useQuery({
    queryKey: sessionKeys.teams(ctx?.orgId ?? null),
    // GAP: teams/team_members tables are MISSING (GAPS 09) — fixture until backend/teams
    queryFn: async () =>
      resolveSource(SOURCE) === "mock"
        ? ctx?.role === "rep"
          ? TEAMS.filter((t) => t.id === ctx.teamId)
          : TEAMS
        : [],
    enabled: !!ctx,
  });
  return withEmpty(q, (d) => d.length === 0);
}
