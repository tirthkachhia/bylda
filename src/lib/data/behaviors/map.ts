import type { Behavior, BehaviorScore, BehavioralEvent, ObjectionStat, Pattern } from "../types";

// ── C-01 · proposed behavioral_events row ────────────────────────────────────
export type BehavioralEventRow = {
  id: string;
  organization_id: string;
  call_id: string;
  type: BehavioralEvent["type"];
  t_start: number;
  t_end: number;
  speaker: "rep" | "prospect" | "other";
  attrs: Record<string, string | number | boolean | null>;
  detector_version: string;
  created_at: string;
};
export const mapBehavioralEvent = (r: BehavioralEventRow): BehavioralEvent => ({
  id: r.id,
  callId: r.call_id,
  type: r.type,
  tStart: r.t_start,
  tEnd: r.t_end,
  speaker: r.speaker,
  attrs: r.attrs ?? {},
  detectorVersion: r.detector_version,
});

// ── C-02 · proposed behaviors row ────────────────────────────────────────────
export type BehaviorRow = {
  key: string;
  organization_id: string;
  name: string;
  definition: string;
  rule: Record<string, unknown>;
  methodology_id: string | null;
  enabled: boolean;
  higher_is_better: boolean;
};
export const mapBehavior = (r: BehaviorRow): Behavior => ({
  key: r.key,
  name: r.name,
  definition: r.definition,
  rule: r.rule ?? {},
  methodologyId: r.methodology_id,
  enabled: r.enabled,
  higherIsBetter: r.higher_is_better,
});

// ── Team median privacy gate (CLAUDE.md §4, §13.6) ───────────────────────────
/** Below this many reps a median is close enough to back out a peer's number. */
export const MIN_REPS_FOR_TEAM_MEDIAN = 8;
/**
 * The ONLY way a team median reaches a view model. Fails closed: an unknown team
 * size, a team under 8 reps or a non-finite median all become `null`.
 */
export function gateTeamMedian(
  median: number | null | undefined,
  teamSize: number | null | undefined,
): number | null {
  if (teamSize == null || teamSize < MIN_REPS_FOR_TEAM_MEDIAN) return null;
  return typeof median === "number" && Number.isFinite(median) ? median : null;
}

// ── C-02 · proposed behavior_scores row (weekly snapshot per subject) ────────
export type BehaviorScoreRow = {
  subject_type: "rep" | "team";
  subject_id: string;
  behavior_key: string;
  behavior_name: string;
  unit: BehaviorScore["unit"];
  value: number;
  team_median: number | null;
  /** reps on the subject's team for the period — gates team_median (< 8 → null) */
  team_size: number | null;
  direction: BehaviorScore["direction"];
  confidence: BehaviorScore["confidence"];
  sample_size: number;
  /** last N weekly values, oldest first */
  series: number[];
  y_min: number;
  y_max: number;
  period_start: string;
};
export const mapBehaviorScore = (r: BehaviorScoreRow): BehaviorScore => ({
  behaviorKey: r.behavior_key,
  name: r.behavior_name,
  value: r.value,
  unit: r.unit,
  teamMedian: gateTeamMedian(r.team_median, r.team_size),
  direction: r.direction,
  confidence: r.confidence,
  sampleSize: r.sample_size,
  sparkline: { points: r.series, yMin: r.y_min, yMax: r.y_max },
});

// ── C-15 · proposed patterns row ─────────────────────────────────────────────
export type PatternRow = {
  id: string;
  organization_id: string;
  scope: Pattern["scope"];
  headline: string;
  confidence: Pattern["confidence"];
  sample_size: number;
  first_seen_at: string;
  behavior_key: string | null;
  affected_rep_ids: string[];
};
export const mapPattern = (r: PatternRow): Pattern => ({
  id: r.id,
  scope: r.scope,
  headline: r.headline,
  confidence: r.confidence,
  sampleSize: r.sample_size,
  firstSeenAt: r.first_seen_at,
  behaviorKey: r.behavior_key,
  affectedRepIds: r.affected_rep_ids ?? [],
});

// ── I4 · objection stats from today's call_insights.objections ───────────────
export function aggregateObjections(
  rows: { call_id: string; objections: unknown }[],
): ObjectionStat[] {
  const byLabel = new Map<string, { count: number; calls: Set<string> }>();
  for (const r of rows) {
    const list = Array.isArray(r.objections) ? r.objections : [];
    for (const o of list) {
      const label =
        typeof o === "string"
          ? o
          : String(
              (o as Record<string, unknown>)?.label ??
                (o as Record<string, unknown>)?.objection ??
                "Other",
            );
      const cur = byLabel.get(label) ?? { count: 0, calls: new Set<string>() };
      cur.count += 1;
      cur.calls.add(r.call_id);
      byLabel.set(label, cur);
    }
  }
  return [...byLabel.entries()]
    .map(([label, v]) => ({
      label,
      count: v.count,
      callCount: v.calls.size,
      // GAP: handled-well needs behavioral_events (C-01) — unknown until then
      handledWellRate: null,
      // GAP: trend needs weekly snapshots (C-16)
      trend: "steady" as const,
      sampleSize: v.count,
      confidence: (v.count >= 20
        ? "high"
        : v.count >= 8
          ? "medium"
          : "low") as ObjectionStat["confidence"],
    }))
    .sort((a, b) => b.count - a.count);
}

// ── C-25 · proposed get_objection_stats row ──────────────────────────────────
export type ObjectionStatRow = {
  label: string;
  count: number;
  call_count: number;
  handled_well_rate: number | null;
  trend: ObjectionStat["trend"];
  sample_size: number;
  confidence: ObjectionStat["confidence"];
};
export const mapObjectionStat = (r: ObjectionStatRow): ObjectionStat => ({
  label: r.label,
  count: r.count,
  callCount: r.call_count,
  handledWellRate: r.handled_well_rate,
  trend: r.trend,
  sampleSize: r.sample_size,
  confidence: r.confidence,
});
