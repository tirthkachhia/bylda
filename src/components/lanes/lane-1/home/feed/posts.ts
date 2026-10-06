import type { Call, CoachingFocus, Insight, ReportListItem } from "@/lib/data";

/**
 * The For You stream under the hero: Bylda posts, newest first, composed from hooks.
 */
export type Post =
  | { kind: "insight"; id: string; at: string; insight: Insight }
  | { kind: "report"; id: string; at: string; report: ReportListItem }
  | { kind: "call"; id: string; at: string; call: Call }
  | { kind: "coaching"; id: string; at: string; focus: CoachingFocus };

export function buildPosts(p: {
  insights: Insight[];
  reports: ReportListItem[];
  calls: Call[];
  foci: CoachingFocus[];
}): Post[] {
  const posts: Post[] = [
    ...p.insights.map((insight) => ({
      kind: "insight" as const,
      id: `i-${insight.id}`,
      at: insight.createdAt,
      insight,
    })),
    // Latest brief only — the Reports tab lists the rest.
    ...p.reports
      .slice()
      .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt))
      .slice(0, 1)
      .map((report) => ({
        kind: "report" as const,
        id: `r-${report.id}`,
        at: report.generatedAt,
        report,
      })),
    // The most coachable analyzed call — ranked by coaching_value (Dev Handoff `Call`).
    ...p.calls
      .filter((c) => c.status === "ready" && c.coachingValue !== null)
      .sort((a, b) => (b.coachingValue ?? 0) - (a.coachingValue ?? 0))
      .slice(0, 1)
      .map((call) => ({ kind: "call" as const, id: `c-${call.id}`, at: call.startedAt, call })),
    // Coaching results that resolved (held / not yet / reverted).
    ...p.foci
      .filter((f) => f.result !== null)
      .map((focus) => ({
        kind: "coaching" as const,
        id: `g-${focus.id}`,
        at: focus.result?.measuredOn ?? focus.assignedAt,
        focus,
      })),
  ];
  return posts.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
