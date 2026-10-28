import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  BehaviorAnalysis,
  BehaviorEvent,
  Evidence,
} from "../../../supabase/functions/_shared/coaching/behavior-intelligence";
export type { BehaviorAnalysis, BehaviorEvent, Evidence };
export type BehaviorRow = {
  id: string;
  run_id: string;
  call_id: string;
  rep_id: string | null;
  family: BehaviorEvent["family"];
  opportunity: BehaviorEvent["opportunity"];
  result: BehaviorEvent["result"];
  start_s: number | null;
  assessment: BehaviorEvent;
  evidence: { context: Evidence[]; rep: Evidence[]; buyer: Evidence[] };
};
export type BehaviorRun = {
  id: string;
  call_id: string;
  rep_id: string | null;
  call_occurred_at: string;
  started_at: string;
  prompt_version: string;
  taxonomy_version: string;
  models: string[];
  analysis: BehaviorAnalysis;
};
export type BehaviorFeedback = {
  id: string;
  event_id: string;
  reviewed_by: string;
  accuracy: "accurate" | "incorrect" | "uncertain";
  usefulness: "useful" | "unhelpful" | "uncertain";
  correction: string;
  created_at: string;
};
// Generated database types are regenerated after applying the migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
export const behaviorEventsQuery = (runId: string | null) =>
  queryOptions({
    queryKey: ["behavior-events", runId],
    enabled: !!runId,
    queryFn: async (): Promise<BehaviorRow[]> => {
      const { data, error } = await db
        .from("coaching_behavior_events")
        .select("*")
        .eq("run_id", runId)
        .order("start_s");
      if (error) throw error;
      return data ?? [];
    },
  });
export const behaviorFeedbackQuery = (eventIds: string[]) =>
  queryOptions({
    queryKey: ["behavior-feedback", ...eventIds],
    enabled: eventIds.length > 0,
    queryFn: async (): Promise<BehaviorFeedback[]> => {
      const all: BehaviorFeedback[] = [];
      for (let i = 0; i < eventIds.length; i += 100)
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await db
            .from("coaching_behavior_feedback")
            .select("*")
            .in("event_id", eventIds.slice(i, i + 100))
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(offset, offset + 999);
          if (error) throw error;
          all.push(...(data ?? []));
          if (!data || data.length < 1000) break;
        }
      return all.sort(
        (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
      );
    },
  });
export async function reviewBehavior(
  eventId: string,
  accuracy: BehaviorFeedback["accuracy"],
  usefulness: BehaviorFeedback["usefulness"],
  correction: string,
) {
  const { error } = await db
    .from("coaching_behavior_feedback")
    .insert({ event_id: eventId, accuracy, usefulness, correction });
  if (error) throw error;
}
export const repBehaviorQuery = (repId: string, since: string) =>
  queryOptions({
    queryKey: ["rep-behavior", repId, since],
    queryFn: async (): Promise<{ runs: BehaviorRun[]; events: BehaviorRow[] }> => {
      const { data, error } = await db
        .from("coaching_analysis_runs")
        .select(
          "id,call_id,rep_id,call_occurred_at,started_at,prompt_version,taxonomy_version,models,analysis",
        )
        .eq("rep_id", repId)
        .gte("call_occurred_at", since)
        .order("started_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const latest = new Map<string, BehaviorRun>();
      for (const r of (data ?? []) as BehaviorRun[])
        if (!latest.has(r.call_id)) latest.set(r.call_id, r);
      const runs = [...latest.values()];
      const events: BehaviorRow[] = [];
      if (runs.length)
        for (let offset = 0; ; offset += 1000) {
          const { data: rows, error: eventError } = await db
            .from("coaching_behavior_events")
            .select("*")
            .in(
              "run_id",
              runs.map((r) => r.id),
            )
            .order("id")
            .range(offset, offset + 999);
          if (eventError) throw eventError;
          events.push(...(rows ?? []));
          if (!rows || rows.length < 1000) break;
        }
      return { runs, events };
    },
  });
export function comparableKey(run: BehaviorRun) {
  return JSON.stringify([
    run.taxonomy_version,
    run.prompt_version,
    [...run.models].sort(),
    run.analysis.context.objective,
  ]);
}
export function secondsFromCitation(at: string): number | null {
  if (!/^\d+:\d{2}(?::\d{2})?$/.test(at)) return null;
  const parts = at.split(":").map(Number);
  if (parts.slice(1).some((n) => n >= 60)) return null;
  return parts.reduce((n, v) => n * 60 + v, 0);
}

export const BEHAVIOR_LABELS = {
  discovery_recommendation: "Discovery and recommendation",
  objection_resolution: "Objection clarification and resolution",
  commitment_next_step: "Commitment and next steps",
};

export const timeLabel = (seconds: number | null) =>
  seconds === null
    ? "Time unknown"
    : `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function latestBehaviorReviews(feedback: BehaviorFeedback[]) {
  const latest = new Map<string, BehaviorFeedback>();
  for (const review of [...feedback].sort(
    (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
  ))
    if (!latest.has(review.reviewed_by)) latest.set(review.reviewed_by, review);
  return [...latest.values()];
}
export function feedbackAllowsRecommendation(feedback: BehaviorFeedback[]) {
  return latestBehaviorReviews(feedback).every(
    (f) => f.accuracy === "accurate" && f.usefulness === "useful",
  );
}
