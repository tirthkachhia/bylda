import type { Confidence, EvidenceRef, ID, ISODate, SignalTone } from "./common";

/** Dev Handoff `Insight` (21:110). `confidence` + `sampleSize` are REQUIRED — never render without. */
export type InsightKind = "pattern" | "regression" | "improvement" | "call" | "coaching" | "report";

export type InsightAction =
  | { type: "assign_coaching"; label: string; repId: ID; behaviorKey: string }
  | { type: "review_calls"; label: string; callIds: ID[] }
  | { type: "open_report"; label: string; reportId: ID }
  | { type: "open_behavior"; label: string; behaviorKey: string };

export type Insight = {
  id: ID;
  kind: InsightKind;
  headline: string;
  body: string | null;
  confidence: Confidence;
  sampleSize: number;
  /** e.g. "6 objections · 4 calls" */
  sampleLabel: string | null;
  /**
   * Analyzed calls behind the insight — the rep's for a rep insight, the team's for a
   * team pattern. Gates rendering (CLAUDE.md §13.13): see `gateInsight`.
   */
  callsAnalyzed: number;
  affectedRepIds: ID[];
  evidence: EvidenceRef[];
  /** null when confidence is low — observation only. */
  action: InsightAction | null;
  /** The word "caused" may appear only when true. */
  causalTested: boolean;
  tone: SignalTone;
  tag: string | null;
  createdAt: ISODate;
};

/** H1–H6 Manager Home. */
export type HomeTab = "for_you" | "team_updates" | "calls" | "coaching" | "reports" | "mentions";
export type FeedItem = { id: ID; tab: HomeTab; insight: Insight };
export type AttentionItem = {
  id: ID;
  title: string;
  severity: "attention" | "regress";
  href: string;
};
export type HomeFeed = {
  items: FeedItem[];
  attention: AttentionItem[];
  coachQueue: { repId: ID; repName: string; behaviorName: string; reason: string }[];
};

/**
 * Hard evidence thresholds (CLAUDE.md §4, §13.13 — Dev Handoff 19:19, 19:6).
 * Below them a screen renders the Y3 "not enough data yet" state, never the insight.
 */
export const REP_INSIGHT_MIN_CALLS = 10;
export const TEAM_PATTERN_MIN_CALLS = 50;

export type InsightScope = "rep" | "team";

/** Below threshold: no headline, no body — only what Y3 needs to say what's missing. */
export type InsufficientInsight = {
  state: "insufficient";
  id: ID;
  kind: InsightKind;
  scope: InsightScope;
  callsAnalyzed: number;
  callsNeeded: number;
};
export type GatedInsight = { state: "insight"; insight: Insight } | InsufficientInsight;

/** A pattern, or anything not about exactly one rep, is a team pattern. */
export const insightScope = (i: Pick<Insight, "kind" | "affectedRepIds">): InsightScope =>
  i.kind === "pattern" || i.affectedRepIds.length !== 1 ? "team" : "rep";

export const insightMinCalls = (i: Pick<Insight, "kind" | "affectedRepIds">): number =>
  insightScope(i) === "team" ? TEAM_PATTERN_MIN_CALLS : REP_INSIGHT_MIN_CALLS;

export const isInsightSufficient = (
  i: Pick<Insight, "kind" | "affectedRepIds" | "callsAnalyzed">,
): boolean => i.callsAnalyzed >= insightMinCalls(i);

export function gateInsight(i: Insight): GatedInsight {
  if (isInsightSufficient(i)) return { state: "insight", insight: i };
  return {
    state: "insufficient",
    id: i.id,
    kind: i.kind,
    scope: insightScope(i),
    callsAnalyzed: i.callsAnalyzed,
    callsNeeded: insightMinCalls(i),
  };
}
