import { assertNotRep, scopeRepId, type DataCtx } from "../core/context";
import { useCtxQuery } from "../core/hook";
import { isEmptyArray } from "../core/query";
import { resolveSource } from "../core/source";
import {
  BEHAVIORS,
  BEHAVIOR_DETAILS,
  OBJECTIONS,
  OUTCOME_PATTERNS,
  PATTERNS,
  PROSPECT_PATTERNS,
  SCORES_JORDAN,
  TEAM_BEHAVIOR_ROWS,
} from "../mocks/intelligence";
import { personById, TEAMS } from "../mocks/people";
import type {
  Behavior,
  BehaviorDetail,
  BehaviorScore,
  ObjectionStat,
  Pattern,
  TeamBehaviorRow,
} from "../types";
import { fetchBehaviorScores, fetchBehaviors, fetchObjectionRows, fetchPatterns } from "./fetchers";
import {
  aggregateObjections,
  gateTeamMedian,
  mapBehavior,
  mapBehaviorScore,
  mapPattern,
} from "./map";
import { behaviorKeys } from "./queryKeys";
import { OBJECTIONS_SOURCE, SOURCE } from "./source";

export async function loadBehaviors(ctx: DataCtx): Promise<Behavior[]> {
  void ctx;
  if (resolveSource(SOURCE) === "mock") return BEHAVIORS;
  return (await fetchBehaviors()).map(mapBehavior);
}

/**
 * I2 — team-wide, so never served to a rep. Each behavior gets its own detail or null: a
 * behavior with no detail fixture returns null, never another behavior's numbers.
 */
export async function loadBehaviorDetail(
  ctx: DataCtx,
  key: string,
): Promise<BehaviorDetail | null> {
  assertNotRep(ctx, "team behavior detail");
  if (resolveSource(SOURCE) === "mock") {
    const b = BEHAVIORS.find((x) => x.key === key);
    const d = b ? BEHAVIOR_DETAILS[key] : undefined;
    if (!b || !d) return null;
    return { ...d, behavior: b };
  }
  await fetchBehaviorScores();
  return null;
}

/** I1 / I7 — the team-behaviors table in one read. Team-wide, so never served to a rep. */
export async function loadTeamBehaviors(ctx: DataCtx): Promise<TeamBehaviorRow[]> {
  assertNotRep(ctx, "team behaviors");
  if (resolveSource(SOURCE) === "mock") return TEAM_BEHAVIOR_ROWS;
  await fetchBehaviorScores();
  return [];
}

/**
 * T9/T12/R2 — a rep only ever gets their own scores. `teamMedian` is null when the
 * rep's team has fewer than 8 reps (§4, §13.6): real rows gate in mapBehaviorScore,
 * mocks gate here, so no screen can ever receive the number.
 */
export async function loadRepScores(ctx: DataCtx, repId: string): Promise<BehaviorScore[]> {
  const id = scopeRepId(ctx, repId);
  if (resolveSource(SOURCE) === "mock") {
    const teamId = id ? personById(id)?.teamId : null;
    const teamSize = TEAMS.find((t) => t.id === teamId)?.repCount ?? null;
    const scores =
      id === "u_jordan"
        ? SCORES_JORDAN
        : SCORES_JORDAN.map((s) => ({ ...s, value: +(s.value * 1.2).toFixed(1) }));
    return scores.map((s) => ({ ...s, teamMedian: gateTeamMedian(s.teamMedian, teamSize) }));
  }
  return (await fetchBehaviorScores()).map(mapBehaviorScore);
}

/**
 * I1/I3/I7–I11 — team-wide patterns, managers only.
 * Mock: with no scope this is the I3 list (team · rep · methodology), as I1 and I3 draw it. The
 * I9 outcome and I11 prospect fixtures are served only when that scope is asked for, so they
 * don't land in I3's tabs or I1's open-pattern count.
 */
export async function loadPatterns(ctx: DataCtx, scope?: Pattern["scope"]): Promise<Pattern[]> {
  assertNotRep(ctx, "team patterns");
  if (resolveSource(SOURCE) === "mock") {
    if (!scope) return PATTERNS;
    return [...PATTERNS, ...OUTCOME_PATTERNS, ...PROSPECT_PATTERNS].filter(
      (p) => p.scope === scope,
    );
  }
  return (await fetchPatterns()).map(mapPattern).filter((p) => !scope || p.scope === scope);
}

/** I4 — hybrid: frequency is real (call_insights.objections), handled-well + trend are GAP. */
export async function loadObjectionStats(ctx: DataCtx): Promise<ObjectionStat[]> {
  assertNotRep(ctx, "team objection stats");
  if (resolveSource(OBJECTIONS_SOURCE) === "mock") return OBJECTIONS;
  if (!ctx.orgId) return [];
  return aggregateObjections(await fetchObjectionRows(ctx.orgId));
}

export const useBehaviors = () => useCtxQuery(behaviorKeys.list(), loadBehaviors, isEmptyArray);
export const useTeamBehaviors = () =>
  useCtxQuery(behaviorKeys.team(), loadTeamBehaviors, isEmptyArray);
export const useBehaviorDetail = (key: string) =>
  useCtxQuery(
    behaviorKeys.detail(key),
    (ctx) => loadBehaviorDetail(ctx, key),
    (d) => d === null,
  );
export const useRepScores = (repId: string) =>
  useCtxQuery(behaviorKeys.scores(repId), (ctx) => loadRepScores(ctx, repId), isEmptyArray);
export const usePatterns = (scope?: Pattern["scope"]) =>
  useCtxQuery(
    behaviorKeys.patterns(scope ?? "all"),
    (ctx) => loadPatterns(ctx, scope),
    isEmptyArray,
  );
export const useObjectionStats = () =>
  useCtxQuery(behaviorKeys.objections(), loadObjectionStats, isEmptyArray);
