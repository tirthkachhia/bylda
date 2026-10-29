import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  repBehaviorQuery,
  behaviorFeedbackQuery,
  comparableKey,
  BEHAVIOR_LABELS,
  timeLabel,
  latestBehaviorReviews,
  feedbackAllowsRecommendation,
} from "@/lib/coaching/behavior";
import { behaviorTrend } from "../../../../supabase/functions/_shared/coaching/behavior-trends";
import { FAMILIES } from "../../../../supabase/functions/_shared/coaching/behavior-intelligence";
import { requestCallSource, type SourceNavigationProps } from "@/lib/coaching/source-navigation";

export type BehaviorManagerBriefProps = SourceNavigationProps & {
  repId: string;
  initialTab?: "Overview" | "Evidence" | "Trends";
};
const trendLabels = {
  improving: "Improving",
  degrading: "Declining",
  unchanged: "No meaningful change",
  insufficient_evidence: "Not enough comparable evidence",
};

export function BehaviorManagerBrief({
  repId,
  onOpenCall,
  onOpenSource,
  initialTab = "Overview",
}: BehaviorManagerBriefProps) {
  const { currentOrgId } = useAuth();
  const [now] = useState(Date.now);
  const [tab, setTab] = useState<"Overview" | "Evidence" | "Trends">(initialTab);
  const q = useQuery(
    repBehaviorQuery(
      repId,
      new Date(now - 60 * 86400_000).toISOString(),
      currentOrgId ?? undefined,
    ),
  );
  const feedback = useQuery(behaviorFeedbackQuery((q.data?.events ?? []).map((e) => e.id)));
  if (q.isPending)
    return (
      <p role="status" className="p-6 text-sm text-by-text-secondary">
        Loading behavioral history…
      </p>
    );
  if (q.error)
    return (
      <div role="alert" className="rounded-xl border border-by-border-engraved p-6 text-sm">
        Behavior history could not load.{" "}
        <button type="button" className="underline" onClick={() => void q.refetch()}>
          Retry
        </button>
      </div>
    );
  const { runs, events } = q.data ?? { runs: [], events: [] };
  if (!runs.length)
    return (
      <section className="rounded-xl border border-by-border-engraved p-8">
        <h2 className="text-lg">No behavioral history yet</h2>
        <p className="mt-2 text-sm leading-6 text-by-text-secondary">
          Analyze this rep’s calls to build their profile. Existing reports remain available; they
          are not converted into behavioral facts.
        </p>
      </section>
    );
  const byRun = new Map(runs.map((r) => [r.id, r]));
  const ready = !events.length || (!feedback.isPending && !feedback.error);
  const reviewsFor = (id: string) =>
    latestBehaviorReviews((feedback.data ?? []).filter((f) => f.event_id === id));
  const eligible = events.filter(
    (e) =>
      e.opportunity === "eligible" && reviewsFor(e.id).every((f) => f.accuracy !== "incorrect"),
  );
  const groups = FAMILIES.map((family) => {
    const selected = eligible.filter((e) => e.family === family);
    const trend = behaviorTrend(
      selected.map((e) => {
        const run = byRun.get(e.run_id),
          stage = e.assessment.stage,
          constraints = run?.analysis.context.constraints;
        const scope =
          run &&
          stage !== "unknown" &&
          constraints &&
          constraints !== "unknown" &&
          run.analysis.context.objective !== "unknown"
            ? JSON.stringify([comparableKey(run), stage, constraints.toLowerCase().trim()])
            : null;
        const labels = reviewsFor(e.id);
        return {
          id: e.id,
          call_id: e.call_id,
          occurred_at: run?.call_occurred_at ?? "",
          scope,
          eligible: true,
          reviewed: ready && labels.length > 0 && labels.every((l) => l.accuracy === "accurate"),
          result: e.result,
        };
      }),
      now,
    );
    return {
      family,
      selected,
      trend,
      strengths: selected.filter((e) => e.result === "strength"),
      concerns: selected.filter((e) => e.result === "concern" || e.result === "mixed"),
    };
  });
  const examples =
    tab === "Evidence"
      ? eligible
      : groups
          .flatMap((g) => [
            g.concerns.find((e) => feedbackAllowsRecommendation(reviewsFor(e.id))),
            g.strengths.find((e) => feedbackAllowsRecommendation(reviewsFor(e.id))),
          ])
          .filter((e): e is NonNullable<typeof e> => !!e);
  return (
    <section className="space-y-5" aria-label="Rep behavioral profile">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg">Behavioral profile</h2>
          <p className="mt-1 text-xs text-by-text-secondary">
            {runs.length} calls · last 60 days · latest analysis per call
          </p>
        </div>
        <div
          role="group"
          aria-label="Rep profile view"
          className="inline-flex rounded-lg border border-by-border-engraved bg-by-surface-hover p-1"
        >
          {(["Overview", "Evidence", "Trends"] as const).map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={tab === item}
              onClick={() => setTab(item)}
              className={`rounded-md px-3 py-2 text-xs ${tab === item ? "bg-white shadow-sm" : "text-by-text-secondary"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      {feedback.error ? (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs">
          Reviewer feedback is unavailable. Recommendations and comparisons are withheld.{" "}
          <button type="button" onClick={() => void feedback.refetch()} className="underline">
            Retry
          </button>
        </p>
      ) : feedback.isPending && events.length > 0 ? (
        <p role="status" className="text-xs text-by-text-secondary">
          Loading reviewer evidence…
        </p>
      ) : null}
      {tab !== "Evidence" && (
        <div className="grid gap-3 md:grid-cols-3">
          {groups.map((g) => (
            <article
              key={g.family}
              className="rounded-xl border border-by-border-engraved bg-by-surface-hover p-4"
            >
              <h3 className="text-[13px] font-medium">{BEHAVIOR_LABELS[g.family]}</h3>
              <p className="mt-3 text-xl tabular-nums">
                {ready ? g.selected.length : "—"}
                <span className="ml-2 text-xs text-by-text-secondary">selected opportunities</span>
              </p>
              {ready && (
                <p className="mt-2 text-xs text-by-text-secondary">
                  {g.strengths.length} strengths · {g.concerns.length} concerns / mixed ·{" "}
                  {g.selected.filter((e) => e.result === "unobservable").length} unobservable
                </p>
              )}
              <p className="mt-4 text-xs font-medium">
                {ready ? trendLabels[g.trend.state] : "Comparison unavailable"}
              </p>
              {tab === "Trends" && ready && g.trend.scope && (
                <p className="mt-2 text-xs leading-5 text-by-text-secondary">
                  {g.trend.current.successful} / {g.trend.current.judged} reviewed opportunities
                  now, versus {g.trend.previous.successful} / {g.trend.previous.judged} in the
                  previous 30 days. {g.trend.current.calls} and {g.trend.previous.calls} calls
                  respectively.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
      {tab === "Trends" ? (
        <p className="rounded-xl border border-by-border-engraved p-4 text-xs leading-6 text-by-text-secondary">
          Comparisons need matching model, prompt, taxonomy, objective, stage and buyer constraints;
          at least five accurately reviewed opportunities across three calls in each 30-day period.
          These comparisons describe behavior. They do not establish a coaching effect or a
          commercial outcome.
        </p>
      ) : (
        ready && (
          <div className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wide">
              {tab === "Evidence" ? "Selected source-backed opportunities" : "Examples to review"}
            </h3>
            {examples.length ? (
              examples.map((e) => (
                <article
                  key={e.id}
                  className="rounded-xl border border-by-border-engraved p-4 text-[13px]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-by-text-secondary">
                      {BEHAVIOR_LABELS[e.family]}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${e.result === "strength" ? "bg-emerald-100 text-emerald-900" : e.result === "unobservable" ? "bg-neutral-100" : "bg-amber-100 text-amber-900"}`}
                    >
                      {e.result}
                    </span>
                  </div>
                  <p className="mt-3 font-medium">{e.assessment.rep_behavior}</p>
                  <p className="mt-2 leading-6 text-by-text-secondary">
                    <strong className="font-medium">Buyer reaction:</strong>{" "}
                    {e.assessment.buyer_reaction}
                  </p>
                  <p className="mt-1 leading-6 text-by-text-secondary">
                    <strong className="font-medium">Observed progression:</strong>{" "}
                    {e.assessment.observed_progression}
                  </p>
                  {["high", "medium"].includes(e.assessment.confidence) &&
                    feedbackAllowsRecommendation(reviewsFor(e.id)) && (
                      <p className="mt-2 leading-6">{e.assessment.coaching_action}</p>
                    )}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] text-by-text-tertiary">
                      Confidence {e.assessment.confidence} ·{" "}
                      {byRun.get(e.run_id)?.call_occurred_at
                        ? new Date(byRun.get(e.run_id)!.call_occurred_at).toLocaleDateString()
                        : "Call time unknown"}
                    </span>
                    <button
                      type="button"
                      disabled={!onOpenSource || !currentOrgId}
                      title={
                        !onOpenSource
                          ? "Source navigation is not available in this view"
                          : undefined
                      }
                      className="rounded-md border border-by-border-control px-3 py-2 text-xs disabled:opacity-40"
                      onClick={() => {
                        if (!currentOrgId) return;
                        void requestCallSource(
                          {
                            organizationId: currentOrgId,
                            repId,
                            callId: e.call_id,
                            startSeconds: e.start_s,
                            source: {
                              kind: "behavior",
                              runId: e.run_id,
                              eventId: e.id,
                              turnId: e.evidence.rep[0]?.turn_id,
                            },
                          },
                          { onOpenCall, onOpenSource },
                        ).catch((error) =>
                          toast.error(
                            error instanceof Error ? error.message : "Source unavailable",
                          ),
                        );
                      }}
                    >
                      {e.start_s === null ? "Review source" : "Review at " + timeLabel(e.start_s)} →
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-xl border border-by-border-engraved p-5 text-sm text-by-text-secondary">
                No eligible source-backed examples to recommend. Missing evidence is not failure.
              </p>
            )}
          </div>
        )
      )}
      <p className="text-[11px] leading-5 text-by-text-tertiary">
        Counts describe selected observed opportunities, not every opportunity in each recording.
        Different objectives and analysis versions are not one comparable series.
      </p>
    </section>
  );
}
