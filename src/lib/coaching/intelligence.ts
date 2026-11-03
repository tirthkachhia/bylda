import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BehaviorRun, BehaviorRow, BehaviorFeedback } from "./types";
import { comparableKey, latestBehaviorReviews } from "./behavior";
import { behaviorTrend } from "../../../supabase/functions/_shared/coaching/behavior-trends";
import { FAMILIES } from "../../../supabase/functions/_shared/coaching/behavior-intelligence";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
export type IntelligenceCall = {
  id: string;
  rep_id: string | null;
  duration: number | null;
  started_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};
export type WorkspaceIntelligence = {
  totalCalls: number;
  calls: IntelligenceCall[];
  runs: BehaviorRun[];
  events: BehaviorRow[];
};
async function pages<T>(
  read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await read(from, from + 499);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("Workspace evidence could not load completely.");
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
export const workspaceIntelligenceQuery = (org: string, since: string) =>
  queryOptions({
    queryKey: ["workspace-intelligence", org, since],
    enabled: !!org,
    staleTime: 15000,
    queryFn: async (): Promise<WorkspaceIntelligence> => {
      const { count, error } = await db
        .from("calls")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org);
      if (error) throw error;
      if (count === null) throw new Error("Call count could not load.");
      const [calls, history] = await Promise.all([
        pages<IntelligenceCall>((from, to) =>
          db
            .from("calls")
            .select("id,rep_id,duration,started_at,created_at,metadata")
            .eq("organization_id", org)
            .or(`started_at.gte.${since},and(started_at.is.null,created_at.gte.${since})`)
            .order("id")
            .range(from, to),
        ),
        pages<BehaviorRun>((from, to) =>
          db
            .from("coaching_analysis_runs")
            .select(
              "id,call_id,rep_id,call_occurred_at,started_at,prompt_version,taxonomy_version,models,analysis",
            )
            .eq("organization_id", org)
            .gte("call_occurred_at", since)
            .order("started_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to),
        ),
      ]);
      const runs = [...new Map([...history].reverse().map((r) => [r.call_id, r])).values()];
      const events: BehaviorRow[] = [];
      for (let i = 0; i < runs.length; i += 100)
        events.push(
          ...(await pages<BehaviorRow>((from, to) =>
            db
              .from("coaching_behavior_events")
              .select("*")
              .eq("organization_id", org)
              .in(
                "run_id",
                runs.slice(i, i + 100).map((r) => r.id),
              )
              .order("id")
              .range(from, to),
          )),
        );
      return { totalCalls: count, calls, runs, events };
    },
  });

/** Counts are calls with observed opportunities, never the number of all uploaded calls. */
export function summarizeWorkspace(
  data: WorkspaceIntelligence,
  feedback: BehaviorFeedback[],
  now = Date.now(),
) {
  const byRun = new Map(data.runs.map((r) => [r.id, r]));
  const usable = data.events.filter(
    (e) =>
      e.opportunity === "eligible" &&
      e.result !== "unobservable" &&
      !latestBehaviorReviews(feedback.filter((f) => f.event_id === e.id)).some(
        (f) => f.accuracy === "incorrect",
      ),
  );
  const families = FAMILIES.map((family) => {
    const events = usable.filter((e) => e.family === family),
      calls = new Set(events.map((e) => e.call_id)),
      concerns = new Set(
        events.filter((e) => e.result === "concern" || e.result === "mixed").map((e) => e.call_id),
      ),
      strengths = new Set(events.filter((e) => e.result === "strength").map((e) => e.call_id));
    const trend = behaviorTrend(
      events.map((e) => {
        const r = byRun.get(e.run_id),
          labels = latestBehaviorReviews(feedback.filter((f) => f.event_id === e.id));
        return {
          id: e.id,
          call_id: e.call_id,
          occurred_at: r?.call_occurred_at ?? "",
          scope:
            r &&
            e.assessment.stage !== "unknown" &&
            r.analysis.context.objective !== "unknown" &&
            r.analysis.context.constraints &&
            r.analysis.context.constraints !== "unknown"
              ? JSON.stringify([
                  comparableKey(r),
                  e.assessment.stage,
                  r.analysis.context.constraints.toLowerCase().trim(),
                ])
              : null,
          eligible: true,
          reviewed: labels.length > 0 && labels.every((f) => f.accuracy === "accurate"),
          result: e.result,
        };
      }),
      now,
    );
    return {
      family,
      events,
      callCount: calls.size,
      concernCalls: concerns.size,
      strengthCalls: strengths.size,
      repCount: new Set(events.map((e) => e.rep_id).filter(Boolean)).size,
      trend,
    };
  });
  const lengths = data.calls
    .map((c) => c.duration)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  return {
    families,
    usable,
    medianSeconds: lengths.length
      ? (lengths[Math.floor((lengths.length - 1) / 2)] + lengths[Math.floor(lengths.length / 2)]) /
        2
      : null,
    knownDurations: lengths.length,
  };
}
