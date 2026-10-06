import { organizationMembersQuery } from "@/lib/queries";
import { NotBuiltError } from "../core/errors";
import type { RepComparisonRow, TeamRow } from "./map";

/** REAL — org members via the existing list_org_members wrapper (src/lib/queries.ts). */
export async function fetchOrgMembers(orgId: string) {
  const q = organizationMembersQuery(orgId);
  return (await q.queryFn!({
    queryKey: q.queryKey,
    signal: new AbortController().signal,
    meta: undefined,
  } as never)) as unknown as {
    user_id: string;
    role: string;
    full_name?: string | null;
    email?: string | null;
  }[];
}

/** C-10 · teams + team_members */
export async function fetchTeams(): Promise<TeamRow[]> {
  throw new NotBuiltError("teams");
}
/** C-13 · get_rep_comparison(team_id) RPC — manager-only, security definer */
export async function fetchRepComparison(_teamId: string): Promise<RepComparisonRow[]> {
  throw new NotBuiltError("get_rep_comparison");
}
