import type { Person, RepComparison, Team } from "../types";

/** C-10 · proposed teams row (members denormalised from team_members). */
export type TeamRow = {
  id: string;
  organization_id: string;
  name: string;
  manager_id: string | null;
  status: "active" | "setup";
  rep_ids: string[];
  calls_this_week: number;
  analyzed_calls: number;
};
export const mapTeam = (r: TeamRow): Team => ({
  id: r.id,
  name: r.name,
  managerId: r.manager_id,
  repIds: r.rep_ids ?? [],
  status: r.status,
  callsThisWeek: r.calls_this_week,
  analyzedCalls: r.analyzed_calls,
});

/** C-13 · proposed get_rep_comparison row: one behavior across the team's reps. */
export type RepComparisonRow = {
  behavior_key: string;
  behavior_name: string;
  team_median: number;
  values: { rep_id: string; value: number; n: number }[];
};
export const mapRepComparison = (rows: RepComparisonRow[]): RepComparison => ({
  repIds: [...new Set(rows.flatMap((r) => r.values.map((v) => v.rep_id)))],
  rows: rows.map((r) => ({
    behaviorKey: r.behavior_key,
    name: r.behavior_name,
    teamMedian: r.team_median,
    values: r.values.map((v) => ({ repId: v.rep_id, value: v.value, n: v.n })),
  })),
  // GAP: suggested pairing — derived client-side once real rows exist
  suggestedPairing: null,
});

/** Real org member → Person (V1 role/team/presence are GAP until C-10/C-11). */
export function mapMember(m: {
  user_id: string;
  role: string;
  full_name?: string | null;
  email?: string | null;
}): Person {
  const name = m.full_name || m.email || "Member";
  return {
    id: m.user_id,
    name,
    firstName: name.split(" ")[0],
    role: m.role === "owner" || m.role === "admin" ? m.role : "rep",
    title: null,
    avatarUrl: null,
    // GAP: presence — no presence source
    presence: null,
    // GAP: team membership — C-10
    teamId: null,
  };
}
