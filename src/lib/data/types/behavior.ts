import type { Confidence, Direction, EvidenceRef, ID, Sparkline } from "./common";

/** Dev Handoff `BehavioralEvent` (21:102) — the atomic layer, immutable, versioned by detector. */
export type BehavioralEventType =
  | "objection"
  | "interruption"
  | "question"
  | "monologue"
  | "pause"
  | "sentiment_shift"
  | "control_shift"
  | "stage";

export type BehavioralEvent = {
  id: ID;
  callId: ID;
  type: BehavioralEventType;
  /** seconds */
  tStart: number;
  tEnd: number;
  speaker: "rep" | "prospect" | "other";
  attrs: Record<string, string | number | boolean | null>;
  detectorVersion: string;
};

/** Dev Handoff `Behavior` (21:106). */
export type Behavior = {
  key: string;
  name: string;
  definition: string;
  rule: Record<string, unknown>;
  methodologyId: ID | null;
  enabled: boolean;
  higherIsBetter: boolean;
};

/** I2 — one worked moment: an example to avoid or to copy (LANE_REQUESTS #26). */
export type BehaviorExample = {
  repId: ID;
  repName: string;
  account: string;
  callId: ID;
  /** "18:44" — where the moment starts. */
  timestamp: string;
  tSeconds: number;
  /** What happened, one or two sentences. */
  summary: string;
  /** Length of the playable clip, seconds; null when no clip exists. */
  clipSeconds: number | null;
  /** The quote shown on the Evidence Block. */
  moment: EvidenceRef;
};

/** I2 "AFFECTED CALLS" row — one call where the behavior was observed. */
export type AffectedCall = {
  callId: ID;
  account: string;
  repName: string;
  timestamp: string;
  tSeconds: number;
  /** Times the behavior occurred in that call. */
  count: number;
};

/** I2 Behavior Detail. */
export type BehaviorDetail = {
  behavior: Behavior;
  teamValue: number;
  unit: "ratio" | "seconds" | "per_call" | "percent" | "count";
  direction: Direction;
  confidence: Confidence;
  sampleSize: number;
  sparkline: Sparkline;
  byRep: {
    repId: ID;
    repName: string;
    value: number;
    n: number;
    /** Signed change vs the rep's own baseline (same unit as `value`); null when unknown. */
    // GAP: no baseline per rep/behavior in the backend (C-03)
    vsBaseline: number | null;
  }[];
  evidence: EvidenceRef[];
  /** "38 / 142" — calls with the behavior over analyzed calls. null when not computed. */
  // GAP: needs BehavioralEvent aggregation (C-02/C-03)
  callsWithBehavior: { withBehavior: number; total: number } | null;
  /** Reps on the team, for "4 of 9". null when unknown. */
  // GAP: C-03
  teamSize: number | null;
  /** Per-rep trend on the same fixed y-range as `sparkline`, keyed by repId. */
  // GAP: C-03
  repSparklines: Record<ID, Sparkline>;
  /** Projected continuation of `sparkline` (same y-range). Empty = no projection. */
  // GAP: projection is computed server-side in C-03
  projected: number[];
  /** Example to avoid / example to copy. Either may be absent. */
  // GAP: C-02
  examples: { avoid: BehaviorExample | null; copy: BehaviorExample | null };
  /** One-sentence recommended change. null → no recommendation (observation only). */
  // GAP: C-02
  recommendedChange: string | null;
  /** Calls where the behavior was observed, newest first, capped by the source. */
  // GAP: C-02
  affectedCalls: AffectedCall[];
};

/** I3 lifecycle: Emerging (< 2 weeks, n < 20) · Confirmed (3+ weeks, n ≥ 30) · Fading · Resolved. */
export type PatternStatus = "emerging" | "confirmed" | "fading" | "resolved";

/**
 * I3 context panel, "SELECTED · <pattern>": three display strings. They compare the rep with the
 * rest of the team ("1 of 38 rest of team", "team 74%"), so they exist only on a Pattern, which
 * is manager-only (loadPatterns asserts) and never reaches a rep.
 */
export type PatternSelected = {
  /** "5 of 7 Mia first calls · 1 of 38 rest of team" */
  frequency: string;
  /** "Next step 40% vs team 74%". null when no outcome is associated yet. */
  associatedOutcome: string | null;
  /** "New this month" */
  trend: string;
};

/** I3 Emerging Patterns / I7–I11 pattern rows. */
export type Pattern = {
  id: ID;
  scope: "team" | "rep" | "prospect" | "outcome" | "methodology";
  headline: string;
  confidence: Confidence;
  sampleSize: number;
  firstSeenAt: string;
  behaviorKey: string | null;
  affectedRepIds: ID[];
  // Optional on purpose: the real table has none of these yet (F-1 in LANE_REQUESTS.md asks for them).
  /** GAP: lifecycle status — F-1 */
  status?: PatternStatus;
  /** GAP: the detection rule under the title, "Answers price objection < 1s, then discounts" — F-1 */
  rule?: string | null;
  /** GAP: context-panel values — F-1 */
  selected?: PatternSelected | null;
};

/**
 * A resolved pattern, or one with no calls in the window, has no live evidence, so a screen shows
 * no confidence level for it (I3 draws "Talking over prospects in demos" with 0 calls). `confidence`
 * stays required so existing screens keep compiling; this is the one place that decides.
 */
export const patternShowsConfidence = (p: Pick<Pattern, "status" | "sampleSize">): boolean =>
  p.status !== "resolved" && p.sampleSize > 0;

/**
 * I1 "Team behaviors" / I7 table row: one per tracked behavior, so a screen reads the list in one
 * call instead of `useBehaviorDetail` per row. Team-wide, so never served to a rep.
 */
export type TeamBehaviorRow = {
  behaviorKey: string;
  name: string;
  teamValue: number;
  unit: BehaviorDetail["unit"];
  /** TEAM NOW as drawn: "2.6 / topic", "0.9 / obj", "52 / 48". The unit enum can't carry these. */
  valueLabel: string;
  /** 30-DAY CHANGE as drawn: "+0.4", "+18%", "−2 pts", "—". */
  changeLabel: string;
  /** Behaviour direction (the Improving / Regressing / Steady tag), not the sign of the change. */
  direction: Direction;
  /** Fixed y-range per behavior (CLAUDE.md §4). */
  sparkline: Sparkline;
  confidence: Confidence;
  sampleSize: number;
};

/** I4 Objections — frequency view (buildable today from call_insights.objections). */
export type ObjectionStat = {
  label: string;
  count: number;
  callCount: number;
  handledWellRate: number | null;
  trend: Direction;
  sampleSize: number;
  confidence: Confidence;
};
