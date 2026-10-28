import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { repBehaviorQuery, behaviorFeedbackQuery, comparableKey } from "@/lib/coaching/behavior";
import {
  BEHAVIOR_LABELS,
  timeLabel,
  latestBehaviorReviews,
  feedbackAllowsRecommendation,
} from "@/lib/coaching/behavior";
import { behaviorTrend } from "../../../../supabase/functions/_shared/coaching/behavior-trends";
import { FAMILIES } from "../../../../supabase/functions/_shared/coaching/behavior-intelligence";

export function BehaviorManagerBrief({
  repId,
  onOpenCall,
}: {
  repId: string;
  onOpenCall: (id: string, seconds?: number | null) => void;
}) {
  const [now] = useState(Date.now);
  const since = new Date(now - 60 * 86400_000).toISOString();
  const q = useQuery(repBehaviorQuery(repId, since));
  const feedback = useQuery(behaviorFeedbackQuery((q.data?.events ?? []).map((e) => e.id)));
  if (q.isLoading) return <p className="text-xs">Loading behavioral evidence…</p>;
  if (q.error)
    return (
      <p className="rounded border p-3 text-xs text-neutral-600">
        Behavior history is not available in this workspace yet. Existing reports remain available
        below.
      </p>
    );
  const { runs, events } = q.data ?? { runs: [], events: [] };
  if (!runs.length)
    return (
      <p className="rounded border p-3 text-sm">
        Re-analyze calls to build the evidence-based manager brief. Existing reports are not
        backfilled into behavioral facts.
      </p>
    );
  const byRun = new Map(runs.map((r) => [r.id, r]));
  const groups = new Set(runs.map(comparableKey));
  const latestReview = new Map<string, NonNullable<typeof feedback.data>[number]>();
  for (const f of feedback.data ?? [])
    if (!latestReview.has(f.event_id)) latestReview.set(f.event_id, f);
  const reviewedAccurate = (id: string) => {
    const labels = new Map<string, string>();
    for (const f of feedback.data ?? [])
      if (f.event_id === id && !labels.has(f.reviewed_by)) labels.set(f.reviewed_by, f.accuracy);
    return labels.size > 0 && [...labels.values()].every((a) => a === "accurate");
  };
  const eligible = events.filter(
    (e) =>
      e.opportunity === "eligible" &&
      latestBehaviorReviews((feedback.data ?? []).filter((f) => f.event_id === e.id)).every(
        (f) => f.accuracy !== "incorrect",
      ),
  );
  return (
    <section className="space-y-3 rounded border bg-white p-5" aria-label="Manager behavior brief">
      <h2 className="text-base font-semibold">Behavioral coaching brief</h2>
      <p className="text-xs text-neutral-600">
        {runs.length} calls in the last 60 days, using call occurrence time and the latest retained
        analysis per call. Counts describe selected observed opportunities, not every possible
        opportunity. {latestReview.size} events reviewed.
      </p>
      <p className="text-xs">
        {groups.size > 1
          ? "Different objectives, models or analysis versions are present. Their counts are not one comparable performance series."
          : "No improvement or coaching-effect claim is made without comparable reviewed periods and buyer context."}
      </p>
      {FAMILIES.map((family) => {
        const selected = eligible.filter((e) => e.family === family);
        const strengths = selected.filter((e) => e.result === "strength"),
          concerns = selected.filter((e) => e.result === "concern" || e.result === "mixed");
        const trend = behaviorTrend(
          selected.map((e) => {
            const run = byRun.get(e.run_id),
              stage = e.assessment.stage,
              constraints = run?.analysis.context.constraints;
            const scope =
              run &&
              stage &&
              stage !== "unknown" &&
              constraints &&
              constraints !== "unknown" &&
              run.analysis.context.objective !== "unknown"
                ? JSON.stringify([comparableKey(run), stage, constraints.toLowerCase().trim()])
                : null;
            return {
              id: e.id,
              call_id: e.call_id,
              occurred_at: run?.call_occurred_at ?? "",
              scope,
              eligible: true,
              reviewed: reviewedAccurate(e.id),
              result: e.result,
            };
          }),
          now,
        );
        const useful = (id: string) =>
          feedbackAllowsRecommendation((feedback.data ?? []).filter((f) => f.event_id === id));
        const concern = concerns.find((e) => useful(e.id));
        const examples = [
          concern,
          strengths.find((s) => useful(s.id) && s.call_id !== concern?.call_id) ??
            strengths.find((s) => useful(s.id)),
        ].filter((e, i, a) => e && a.findIndex((x) => x?.id === e.id) === i);
        return (
          <article key={family} className="rounded border p-3 text-sm">
            <h3 className="font-semibold">{BEHAVIOR_LABELS[family]}</h3>
            <p className="mt-1 text-xs">
              {strengths.length} strengths, {concerns.length} concerns/mixed,{" "}
              {selected.filter((e) => e.result === "unobservable").length} unobservable across{" "}
              {selected.length} selected eligible moments. Trend: {trend.state.replaceAll("_", " ")}
              .
              {trend.scope &&
                ` Reviewed comparable opportunities: ${trend.current.successful}/${trend.current.judged} now versus ${trend.previous.successful}/${trend.previous.judged} in the preceding 30 days. This is descriptive, not an effect of coaching.`}
            </p>
            {examples.map(
              (e) =>
                e && (
                  <div key={e.id} className="mt-3 border-t pt-2 text-xs">
                    <p>
                      {e.result}: {e.assessment.rep_behavior}
                    </p>
                    <p className="mt-1">Buyer response: {e.assessment.buyer_reaction}</p>
                    <p className="mt-1">Coaching action: {e.assessment.coaching_action}</p>
                    <button
                      className="mt-1 font-semibold text-blue-700"
                      onClick={() => onOpenCall(e.call_id, e.start_s)}
                    >
                      {e.start_s === null ? "Open source call" : `Review ${timeLabel(e.start_s)}`} ·{" "}
                      {new Date(
                        byRun.get(e.run_id)?.call_occurred_at ?? since,
                      ).toLocaleDateString()}
                    </button>
                  </div>
                ),
            )}
            {!selected.length && (
              <p className="mt-2 text-xs text-neutral-500">
                No eligible source-backed moments; do not interpret this as failure or success.
              </p>
            )}
          </article>
        );
      })}
      {feedback.error && (
        <p className="text-xs text-red-700">
          Feedback unavailable; review counts may be incomplete.
        </p>
      )}
    </section>
  );
}
