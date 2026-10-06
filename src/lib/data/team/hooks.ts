import { assertNotRep, scopeRepId, type DataCtx } from "../core/context";
import { ForbiddenForRoleError } from "../core/errors";
import { useCtxQuery } from "../core/hook";
import { isEmptyArray } from "../core/query";
import { resolveSource } from "../core/source";
import { loadMyCoaching } from "../coaching/hooks";
import { loadRepScores } from "../behaviors/hooks";
import { loadInsights } from "../insights/hooks";
import { CALLS } from "../mocks/calls";
import { SCORES_JORDAN } from "../mocks/intelligence";
import { MM_REP_IDS, PEOPLE, TEAMS, TEAM_MM, personById } from "../mocks/people";
import type {
  BehaviorScore,
  CoachingFocus,
  GatedInsight,
  Person,
  RepComparison,
  RepSummary,
  Team,
} from "../types";
import { fetchOrgMembers, fetchRepComparison, fetchTeams } from "./fetchers";
import { mapMember, mapRepComparison, mapTeam } from "./map";
import { teamKeys } from "./queryKeys";
import { SOURCE, TEAMS_SOURCE } from "./source";

const mockTeam = (id: string): Team | null => {
  const t = TEAMS.find((x) => x.id === id);
  if (!t) return null;
  const repIds = id === TEAM_MM ? MM_REP_IDS : [];
  return {
    id: t.id,
    name: t.name,
    managerId: id === TEAM_MM ? "u_dana" : null,
    repIds,
    status: t.status,
    callsThisWeek: id === TEAM_MM ? 186 : 0,
    analyzedCalls: id === TEAM_MM ? 486 : 0,
  };
};

/** T1–T7 — team views are manager-side. */
export async function loadTeam(ctx: DataCtx, teamId: string): Promise<Team | null> {
  assertNotRep(ctx, "team views");
  if (resolveSource(TEAMS_SOURCE) === "mock") return mockTeam(teamId);
  return (await fetchTeams()).map(mapTeam).find((t) => t.id === teamId) ?? null;
}

/** Members of a team (or the whole org when teamId is null). A rep gets only themself. */
export async function loadTeamMembers(ctx: DataCtx, teamId: string | null): Promise<Person[]> {
  if (resolveSource(SOURCE) === "mock") {
    const list = PEOPLE.filter((p) => (teamId ? p.teamId === teamId && p.role === "rep" : true));
    return ctx.role === "rep" ? list.filter((p) => p.id === ctx.userId) : list;
  }
  if (!ctx.orgId) return [];
  const members = (await fetchOrgMembers(ctx.orgId)).map(mapMember);
  return ctx.role === "rep" ? members.filter((p) => p.id === ctx.userId) : members;
}

/** T8/T9 — a manager's view of a rep. A rep may read only their own summary. */
export async function loadRepSummary(ctx: DataCtx, repId: string): Promise<RepSummary | null> {
  const id = scopeRepId(ctx, repId)!;
  const rep =
    resolveSource(SOURCE) === "mock"
      ? personById(id)
      : (await loadTeamMembers(ctx, null)).find((p) => p.id === id);
  if (!rep) return null;
  const scores: BehaviorScore[] = await loadRepScores(ctx, id).catch(() => []);
  const focus =
    (await loadMyCoaching({ ...ctx, userId: id })).find(
      (c) => c.status !== "held" && c.status !== "reverted",
    ) ?? null;
  const calls = CALLS.filter((c) => c.repId === id);
  return {
    rep,
    // GAP: analyzed-call counts per rep — C-02 behavior_scores sample sizes
    analyzedCalls:
      resolveSource(SOURCE) === "mock" ? calls.filter((c) => c.status === "ready").length * 12 : 0,
    callsThisWeek: resolveSource(SOURCE) === "mock" ? calls.length : 0,
    strengths: scores.filter((s) => s.direction === "improving"),
    leaks: scores.filter((s) => s.direction === "regressing"),
    activeFocus: focus
      ? { focusId: focus.id, behaviorName: focus.behaviorName, status: focus.status }
      : null,
  };
}

/** T13 — Rep Comparison. MANAGER-ONLY. A rep is refused outright. */
export async function loadRepComparison(ctx: DataCtx, teamId: string): Promise<RepComparison> {
  if (ctx.role === "rep") throw new ForbiddenForRoleError("rep comparison", ctx.role);
  if (resolveSource(TEAMS_SOURCE) === "mock") {
    const ids = ["u_jordan", "u_sarah", "u_alex", "u_theo"];
    const row = (behaviorKey: string, name: string, vals: number[], median: number) => ({
      behaviorKey,
      name,
      teamMedian: median,
      values: ids.map((repId, i) => ({ repId, value: vals[i], n: 38 + i * 7 })),
    });
    return {
      repIds: ids,
      rows: [
        row("discovery_depth", "Discovery depth (follow-ups / topic)", [2.9, 2.2, 2.4, 3.1], 2.5),
        row("pause_after_objection", "Pause after objection", [0.4, 0.6, 1.3, 2.1], 1.0),
        row("talk_share", "Talk share", [0.58, 0.55, 0.49, 0.44], 0.52),
      ],
      suggestedPairing: {
        repId: "u_jordan",
        withRepId: "u_theo",
        reason: "Biggest gap on the same behavior, same deal size.",
      },
    };
  }
  return mapRepComparison(await fetchRepComparison(teamId));
}

/** R1 Rep Home — ONLY the signed-in rep's own data. */
export type RepHome = {
  rep: Person;
  focus: CoachingFocus | null;
  insights: GatedInsight[];
  scores: BehaviorScore[];
  analyzedCalls: number;
  neededForInsights: number;
};
export async function loadRepHome(ctx: DataCtx): Promise<RepHome | null> {
  const me = { ...ctx, role: "rep" as const };
  const rep =
    resolveSource(SOURCE) === "mock"
      ? personById(ctx.userId)
      : (await loadTeamMembers(me, null))[0];
  if (!rep) return null;
  const [focus, insights, scores] = await Promise.all([
    loadMyCoaching(me).then(
      (f) => f.find((c) => c.status !== "held" && c.status !== "reverted") ?? null,
    ),
    loadInsights(me, { repId: ctx.userId, limit: 3 }),
    loadRepScores(me, ctx.userId).catch(() => []),
  ]);
  return {
    rep,
    focus,
    insights,
    scores,
    analyzedCalls: resolveSource(SOURCE) === "mock" ? 41 : 0,
    neededForInsights: 10,
  };
}

/** R2 My progress — own scores + focus history only. */
export type MyProgress = { scores: BehaviorScore[]; foci: CoachingFocus[] };
export async function loadMyProgress(ctx: DataCtx): Promise<MyProgress> {
  const me = { ...ctx, role: "rep" as const };
  const [scores, foci] = await Promise.all([
    loadRepScores(me, ctx.userId).catch(() => SCORES_JORDAN.slice(0, 0)),
    loadMyCoaching(me),
  ]);
  return { scores, foci };
}

export const useTeam = (teamId: string) =>
  useCtxQuery(
    teamKeys.team(teamId),
    (ctx) => loadTeam(ctx, teamId),
    (d) => d === null,
  );
export const useTeamMembers = (teamId: string | null = null) =>
  useCtxQuery(teamKeys.members(teamId), (ctx) => loadTeamMembers(ctx, teamId), isEmptyArray);
export const useRepSummary = (repId: string) =>
  useCtxQuery(
    teamKeys.rep(repId),
    (ctx) => loadRepSummary(ctx, repId),
    (d) => d === null,
  );
export const useRepComparison = (teamId: string) =>
  useCtxQuery(
    teamKeys.compare(teamId),
    (ctx) => loadRepComparison(ctx, teamId),
    (d) => d.rows.length === 0,
  );
export const useRepHome = () => useCtxQuery(teamKeys.repHome(), loadRepHome, (d) => d === null);
export const useMyProgress = () =>
  useCtxQuery(
    teamKeys.progress(),
    loadMyProgress,
    (d) => d.scores.length === 0 && d.foci.length === 0,
  );
