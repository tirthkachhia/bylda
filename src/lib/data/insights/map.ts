import type {
  EvidenceRef,
  FeedItem,
  HomeTab,
  Insight,
  InsightAction,
  WorkspaceHealth,
} from "../types";

/** C-03 · proposed insights row (evidence denormalised as jsonb for V1). */
export type InsightRow = {
  id: string;
  organization_id: string;
  team_id: string | null;
  kind: Insight["kind"];
  headline: string;
  body: string | null;
  confidence: Insight["confidence"];
  sample_n: number;
  sample_label: string | null;
  calls_n: number;
  affected_rep_ids: string[];
  evidence: {
    call_id: string;
    t_seconds: number;
    speaker: "rep" | "prospect" | "other";
    speaker_label: string;
    quote: string;
  }[];
  action_type: InsightAction["type"] | null;
  action_label: string | null;
  action_target: Record<string, unknown> | null;
  causal_tested: boolean;
  tone: Insight["tone"];
  tag: string | null;
  created_at: string;
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function mapInsight(r: InsightRow): Insight {
  const evidence: EvidenceRef[] = (r.evidence ?? []).map((e) => ({
    callId: e.call_id,
    timestamp: mmss(e.t_seconds),
    tSeconds: e.t_seconds,
    speaker: e.speaker,
    speakerLabel: e.speaker_label,
    quote: e.quote,
  }));
  // Low confidence = observation only: the mapper drops the action (CLAUDE.md §4).
  const action =
    r.confidence === "low" || !r.action_type
      ? null
      : ({
          type: r.action_type,
          label: r.action_label ?? "",
          ...(r.action_target ?? {}),
        } as InsightAction);
  return {
    id: r.id,
    kind: r.kind,
    headline: r.headline,
    body: r.body,
    confidence: r.confidence,
    sampleSize: r.sample_n,
    sampleLabel: r.sample_label,
    callsAnalyzed: r.calls_n,
    affectedRepIds: r.affected_rep_ids ?? [],
    evidence,
    action,
    causalTested: r.causal_tested,
    tone: r.tone,
    tag: r.tag,
    createdAt: r.created_at,
  };
}

/** C-04 · proposed get_home_feed row: an insight placed on a tab for a user, ranked. */
export type FeedItemRow = {
  id: string;
  user_id: string;
  tab: HomeTab;
  rank: number;
  insight: InsightRow;
};
export const mapFeedItem = (r: FeedItemRow): FeedItem => ({
  id: r.id,
  tab: r.tab,
  insight: mapInsight(r.insight),
});

/** C-31 · proposed get_workspace_health row */
export type WorkspaceHealthRow = {
  sources: { key: string; name: string; status: "ok" | "degraded" | "down" }[];
  failed_jobs: number;
  calls_analyzed_this_week: number;
  seats_used: number;
  seats_total: number | null;
  alerts: { id: string; title: string; severity: "attention" | "regress" }[];
};
export const mapWorkspaceHealth = (r: WorkspaceHealthRow): WorkspaceHealth => ({
  sources: r.sources,
  failedJobs: r.failed_jobs,
  callsAnalyzedThisWeek: r.calls_analyzed_this_week,
  seats: { used: r.seats_used, total: r.seats_total },
  alerts: r.alerts,
});
