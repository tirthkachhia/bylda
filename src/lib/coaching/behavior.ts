import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  BehaviorFeedback,
  BehaviorRow,
  BehaviorRun,
  BehaviorRunSource,
  RepBehaviorHistory,
} from "./types";
import {
  parseCallSourceTarget,
  validSourceSeconds,
  type CallSourceTarget,
} from "./source-navigation";
export type {
  BehaviorAnalysis,
  BehaviorEvent,
  Evidence,
  BehaviorFeedback,
  BehaviorRow,
  BehaviorRun,
  BehaviorRunSource,
  RepBehaviorHistory,
  StoredBehaviorAssessment,
} from "./types";
// Generated database types are regenerated after applying the migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const PAGE_SIZE = 500;
const ID_BATCH_SIZE = 100;

/** Stable prefixes also serve as invalidation keys after manager review. */
export const behaviorQueryKeys = {
  events: ["behavior-events"] as const,
  feedback: ["behavior-feedback"] as const,
  history: ["rep-behavior"] as const,
  source: ["behavior-run-source"] as const,
};

async function allPages<T>(
  read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await read(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("Behavior data could not be read completely.");
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

export const behaviorEventsQuery = (runId: string | null, organizationId?: string) =>
  queryOptions({
    queryKey: [...behaviorQueryKeys.events, runId, organizationId ?? null],
    enabled: !!runId,
    queryFn: async (): Promise<BehaviorRow[]> => {
      if (!runId) throw new Error("An analysis run is required.");
      return allPages<BehaviorRow>((from, to) => {
        let query = db.from("coaching_behavior_events").select("*").eq("run_id", runId);
        if (organizationId) query = query.eq("organization_id", organizationId);
        return query.order("start_s", { nullsFirst: false }).order("id").range(from, to);
      });
    },
  });
export const behaviorFeedbackQuery = (eventIds: string[]) => {
  const ids = [...new Set(eventIds)].sort();
  return queryOptions({
    queryKey: [...behaviorQueryKeys.feedback, ...ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<BehaviorFeedback[]> => {
      const all: BehaviorFeedback[] = [];
      for (let i = 0; i < ids.length; i += ID_BATCH_SIZE)
        all.push(
          ...(await allPages<BehaviorFeedback>((from, to) =>
            db
              .from("coaching_behavior_feedback")
              .select("*")
              .in("event_id", ids.slice(i, i + ID_BATCH_SIZE))
              .order("created_at", { ascending: false })
              .order("id", { ascending: false })
              .range(from, to),
          )),
        );
      return all.sort(
        (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
      );
    },
  });
};
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
export const repBehaviorQuery = (repId: string, since: string, organizationId?: string) =>
  queryOptions({
    queryKey: [...behaviorQueryKeys.history, repId, since, organizationId ?? null],
    enabled: !!repId && Number.isFinite(Date.parse(since)),
    queryFn: async (): Promise<RepBehaviorHistory> => {
      if (!repId || !Number.isFinite(Date.parse(since)))
        throw new Error("A rep and valid history start date are required.");
      const data = await allPages<BehaviorRun>((from, to) => {
        let query = db
          .from("coaching_analysis_runs")
          .select(
            "id,call_id,rep_id,call_occurred_at,started_at,prompt_version,taxonomy_version,models,analysis",
          )
          .eq("rep_id", repId)
          .gte("call_occurred_at", since);
        if (organizationId) query = query.eq("organization_id", organizationId);
        return query
          .order("started_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to);
      });
      const latest = new Map<string, BehaviorRun>();
      for (const r of data) if (!latest.has(r.call_id)) latest.set(r.call_id, r);
      const runs = [...latest.values()];
      const events: BehaviorRow[] = [];
      for (let i = 0; i < runs.length; i += ID_BATCH_SIZE)
        events.push(
          ...(await allPages<BehaviorRow>((from, to) => {
            let query = db
              .from("coaching_behavior_events")
              .select("*")
              .in(
                "run_id",
                runs.slice(i, i + ID_BATCH_SIZE).map((r) => r.id),
              );
            if (organizationId) query = query.eq("organization_id", organizationId);
            return query.order("id").range(from, to);
          })),
        );
      return { runs, events };
    },
  });

/** Exact retained run only. A missing/mismatched source never loads the latest run. */
export const behaviorRunSourceQuery = (target: CallSourceTarget | null) =>
  queryOptions({
    queryKey: [
      ...behaviorQueryKeys.source,
      target?.organizationId ?? null,
      target?.repId ?? null,
      target?.callId ?? null,
      target?.source.kind === "behavior" ? target.source.runId : null,
    ],
    enabled: target?.source.kind === "behavior",
    queryFn: async (): Promise<BehaviorRunSource | null> => {
      const source = parseCallSourceTarget(target);
      if (source.source.kind !== "behavior")
        throw new Error("A retained analysis run is required.");
      let query = db
        .from("coaching_analysis_runs")
        .select(
          "id,organization_id,call_id,rep_id,call_occurred_at,started_at,prompt_version,taxonomy_version,models,analysis,transcript_hash,playbook_version_id,source_snapshot",
        )
        .eq("organization_id", source.organizationId)
        .eq("call_id", source.callId)
        .eq("id", source.source.runId);
      query = source.repId === null ? query.is("rep_id", null) : query.eq("rep_id", source.repId);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data ?? null;
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
  !validSourceSeconds(seconds)
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
