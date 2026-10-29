import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  BEHAVIOR_LABELS,
  timeLabel,
  feedbackAllowsRecommendation,
  behaviorEventsQuery,
  behaviorFeedbackQuery,
  reviewBehavior,
  type BehaviorAnalysis,
  type BehaviorRow,
  type Evidence,
} from "@/lib/coaching/behavior";
import { selectBehaviorMoments } from "../../../../supabase/functions/_shared/coaching/behavior-intelligence";
const DIMENSION_LABELS = {
  playbook_execution: "Playbook execution",
  sales_effectiveness: "Sales effectiveness",
  rep_behavior: "Rep behavior",
  buyer_state: "Buyer reaction",
  sales_progression: "Sales progression",
  risk_review: "Potential risk review",
};
const tone = (result: string) =>
  ["positive", "strength", "followed", "adapted"].includes(result)
    ? "bg-emerald-100 text-emerald-900"
    : ["concern", "missed"].includes(result)
      ? "bg-red-100 text-red-900"
      : ["mixed", "partial"].includes(result)
        ? "bg-amber-100 text-amber-900"
        : "bg-neutral-100 text-neutral-600";
export function EvidenceLinks({
  evidence,
  onSeek,
  onSelect,
}: {
  evidence: Evidence[];
  onSeek: (seconds: number) => void;
  onSelect?: (evidence: Evidence) => void;
}) {
  return (
    <ul className="mt-3 space-y-2">
      {evidence.map((e) => (
        <li
          key={e.turn_id}
          className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-md border border-by-border-engraved bg-by-surface-hover px-3 py-3 text-xs"
        >
          <div>
            <button
              type="button"
              disabled={!onSelect && e.start_s === null}
              onClick={() => {
                if (onSelect) onSelect(e);
                else if (e.start_s !== null) onSeek(e.start_s);
              }}
              className="font-mono underline-offset-4 hover:underline disabled:text-by-text-tertiary"
            >
              {timeLabel(e.start_s)}
            </button>
            <p className="mt-1 text-[10px] uppercase text-by-text-secondary">{e.speaker}</p>
            <span className="text-[9px] text-by-text-tertiary">Turn {e.turn_id}</span>
          </div>
          <blockquote className="whitespace-pre-wrap leading-5">“{e.text}”</blockquote>
        </li>
      ))}
    </ul>
  );
}
export function BehaviorInsights({
  analysis,
  runId,
  onSeek,
  onSelectEvidence,
  mode = "overview",
  focusedOccurrenceKey,
  onChooseMoment,
}: {
  analysis: BehaviorAnalysis;
  runId: string;
  onSeek: (seconds: number) => void;
  onSelectEvidence?: (evidence: Evidence) => void;
  mode?: "overview" | "analysis";
  focusedOccurrenceKey?: string | null;
  onChooseMoment?: (key: string, evidence?: Evidence) => void;
}) {
  const [localKey, setLocalKey] = useState<string | null>(null);
  const q = useQuery(behaviorEventsQuery(runId));
  const rows = q.data ?? [];
  const feedback = useQuery(behaviorFeedbackQuery(rows.map((e) => e.id)));
  const permission = useQuery({
    queryKey: ["behavior-review-permission", runId],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data: run, error } = await db
        .from("coaching_analysis_runs")
        .select("organization_id")
        .eq("id", runId)
        .single();
      if (error || !run) return false;
      const { data: membership } = await db
        .from("organization_members")
        .select("role")
        .eq("organization_id", run.organization_id)
        .eq("user_id", user.id)
        .maybeSingle();
      return ["owner", "admin", "manager"].includes(membership?.role);
    },
  });
  const ready =
    !q.isPending && !q.error && (!rows.length || !feedback.isPending) && !feedback.error;
  const rowFor = (key: string) => rows.find((r) => r.assessment.occurrence_key === key);
  const canRecommend = (key: string) => {
    const row = rowFor(key);
    return (
      ready &&
      !!row &&
      feedbackAllowsRecommendation((feedback.data ?? []).filter((f) => f.event_id === row.id))
    );
  };
  const preferred = ready
    ? selectBehaviorMoments(analysis.events.filter((e) => canRecommend(e.occurrence_key)))
    : [];
  const chosenKey = focusedOccurrenceKey ?? localKey;
  const event =
    analysis.events.find((e) => e.occurrence_key === chosenKey) ??
    preferred[0] ??
    analysis.events[0];
  const row = event ? rowFor(event.occurrence_key) : null;
  const choose = (key: string) => {
    setLocalKey(key);
    const evidence = analysis.events.find((e) => e.occurrence_key === key)?.rep_evidence[0];
    if (onChooseMoment) {
      onChooseMoment(key, evidence);
      return;
    }
    if (evidence) {
      if (onSelectEvidence) onSelectEvidence(evidence);
      else if (evidence.start_s !== null) onSeek(evidence.start_s);
    }
  };
  return (
    <section className="space-y-4" aria-label="Evidence-backed behavioral analysis">
      <header>
        <h2 className="text-sm font-medium uppercase tracking-wide">Moments on this call</h2>
        <p className="mt-1 text-[11px] leading-5 text-by-text-secondary">
          Source-backed observations, followed by interpretation. {analysis.events.length} retained
          events.
        </p>
      </header>
      {!!analysis.events.length && (
        <div
          className="flex max-h-44 flex-wrap gap-2 overflow-y-auto"
          aria-label="Select behavioral moment"
        >
          {analysis.events.map((e, index) => (
            <button
              type="button"
              key={e.occurrence_key}
              aria-pressed={event?.occurrence_key === e.occurrence_key}
              onClick={() => choose(e.occurrence_key)}
              className={`max-w-full rounded-lg border px-3 py-2 text-left text-xs ${event?.occurrence_key === e.occurrence_key ? "border-by-text-primary bg-by-surface-sidebar" : "border-by-border-engraved"}`}
            >
              <span className="font-mono">{timeLabel(e.rep_evidence[0]?.start_s ?? null)}</span>
              <span className="ml-2">
                {index + 1} · {BEHAVIOR_LABELS[e.family]}
              </span>
              <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${tone(e.result)}`}>
                {e.result}
              </span>
            </button>
          ))}
        </div>
      )}
      {event ? (
        <article className="rounded-xl border border-by-border-engraved bg-by-surface-hover p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">{BEHAVIOR_LABELS[event.family]}</h3>
            <span className={`rounded-full px-2 py-1 text-[11px] ${tone(event.result)}`}>
              {event.result}
            </span>
          </div>
          <dl className="mt-3 divide-y divide-by-border-engraved text-[13px]">
            {[
              ["Context", event.context],
              ["Rep behavior", event.rep_behavior],
              ["Buyer reaction", event.buyer_reaction],
              ["Observed progression", event.observed_progression],
              ["Sales interpretation", event.interpretation],
            ].map(([label, value]) => (
              <div key={label} className="grid gap-2 py-3 sm:grid-cols-[110px_minmax(0,1fr)]">
                <dt className="text-[11px] font-medium uppercase leading-5 text-by-text-secondary">
                  {label}
                </dt>
                <dd className="whitespace-pre-wrap leading-6">{value || "Unknown"}</dd>
              </div>
            ))}
          </dl>
          {canRecommend(event.occurrence_key) && ["high", "medium"].includes(event.confidence) ? (
            <div className="mt-3 rounded-lg border border-by-border-engraved bg-white p-3">
              <p className="text-[11px] font-medium uppercase">
                {event.result === "strength" ? "Repeat this" : "Do next"}
              </p>
              <p className="mt-1 text-[13px] leading-6">{event.coaching_action}</p>
            </div>
          ) : (
            <p className="mt-3 text-xs leading-5 text-by-text-secondary">
              Observe and review before acting. Confidence, saved evidence or reviewer feedback does
              not support an action recommendation here.
            </p>
          )}
          <EvidenceLinks
            evidence={[
              ...event.context_evidence,
              ...event.rep_evidence,
              ...event.buyer_evidence,
            ].filter((e, i, a) => a.findIndex((x) => x.turn_id === e.turn_id) === i)}
            onSeek={onSeek}
            onSelect={onSelectEvidence}
          />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-by-text-secondary">
            <span>Confidence {event.confidence} · 1 call</span>
            <span>Resolution {event.resolution}</span>
            <span>Opportunity {event.opportunity.replaceAll("_", " ")}</span>
            <span>Stage {event.stage.replaceAll("_", " ")}</span>
          </div>
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer font-medium">Uncertainty and alternatives</summary>
            <p className="mt-2 leading-6">
              {event.alternative_explanation || "Alternative explanation unknown."}
            </p>
            <ul className="mt-2 list-inside list-disc leading-6">
              {event.limitations.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </details>
          {row && (feedback.data ?? []).some((f) => f.event_id === row.id) && (
            <p className="mt-3 text-xs text-by-text-secondary">
              Latest review: {(feedback.data ?? []).find((f) => f.event_id === row.id)?.accuracy} ·{" "}
              {(feedback.data ?? []).find((f) => f.event_id === row.id)?.usefulness}
            </p>
          )}
          {row && permission.data && <ReviewForm key={row.id} event={row} />}
        </article>
      ) : (
        <p className="rounded-xl border border-by-border-engraved p-6 text-sm text-by-text-secondary">
          No validated behavioral moments. Missing evidence does not establish success or failure.
        </p>
      )}
      {(q.error || feedback.error) && (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs">
          Saved evidence or reviewer feedback could not load. Action recommendations are withheld.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              void q.refetch();
              void feedback.refetch();
            }}
          >
            Retry
          </button>
        </p>
      )}
      <details
        open={mode === "analysis"}
        className="rounded-xl border border-by-border-engraved p-4"
      >
        <summary className="cursor-pointer text-sm font-medium">Six independent judgments</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(analysis.dimensions).map(([key, f]) => (
            <article key={key} className="rounded-xl border border-by-border-engraved p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-medium">
                  {DIMENSION_LABELS[key as keyof typeof DIMENSION_LABELS]}
                </h3>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${tone(f.assessment)}`}>
                  {f.assessment}
                </span>
              </div>
              <p className="mt-3 text-xs leading-6">{f.explanation}</p>
              {key === "risk_review" && (
                <p className="mt-2 text-[11px] leading-5 text-by-text-secondary">
                  {f.policy_reference
                    ? `Supplied source: ${f.policy_reference.title} v${f.policy_reference.version} — ${f.policy_reference.quote}`
                    : "Potential review signal; no verified policy reference attached. This is not a compliance determination."}
                </p>
              )}
              <EvidenceLinks evidence={f.evidence} onSeek={onSeek} onSelect={onSelectEvidence} />
            </article>
          ))}
        </div>
      </details>
      <details className="text-xs">
        <summary className="cursor-pointer font-medium">Call context and coverage</summary>
        <p className="mt-3 leading-6">
          Objective: {analysis.context.objective}
          <br />
          Starting state: {analysis.context.starting_state}
          <br />
          Buyer constraints: {analysis.context.constraints}
          <br />
          Prior history: {analysis.context.prior_history}
        </p>
        <EvidenceLinks
          evidence={analysis.context.evidence}
          onSeek={onSeek}
          onSelect={onSelectEvidence}
        />
        <p className="mt-3 leading-6 text-by-text-secondary">
          Analyzed {analysis.coverage.analyzed_turns} of {analysis.coverage.total_turns} available
          transcript turns.{" "}
          {analysis.coverage.ending_analyzed
            ? "Transcript ending included."
            : "Ending not analyzed."}{" "}
          Recording completeness, speaker identity and timestamp accuracy are not independently
          verified.
        </p>
      </details>
    </section>
  );
}
function ReviewForm({ event }: { event: BehaviorRow }) {
  const qc = useQueryClient();
  const [accuracy, setAccuracy] = useState<"accurate" | "incorrect" | "uncertain">("uncertain");
  const [usefulness, setUsefulness] = useState<"useful" | "unhelpful" | "uncertain">("uncertain");
  const [correction, setCorrection] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs font-semibold">
        Review accuracy and usefulness
      </summary>
      <form
        className="mt-2 space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await reviewBehavior(event.id, accuracy, usefulness, correction);
            await qc.invalidateQueries({ queryKey: ["behavior-feedback"] });
            toast.success("Review saved without replacing the original finding");
            setCorrection("");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Review could not be saved");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="mr-3 text-xs">
          Accuracy{" "}
          <select
            aria-label="Finding accuracy"
            value={accuracy}
            onChange={(e) => setAccuracy(e.target.value as typeof accuracy)}
          >
            <option value="uncertain">Uncertain</option>
            <option value="accurate">Accurate</option>
            <option value="incorrect">Incorrect</option>
          </select>
        </label>
        <label className="text-xs">
          Usefulness{" "}
          <select
            aria-label="Finding usefulness"
            value={usefulness}
            onChange={(e) => setUsefulness(e.target.value as typeof usefulness)}
          >
            <option value="uncertain">Uncertain</option>
            <option value="useful">Useful</option>
            <option value="unhelpful">Unhelpful</option>
          </select>
        </label>
        <textarea
          aria-label="Correction or explanation"
          value={correction}
          maxLength={4000}
          onChange={(e) => setCorrection(e.target.value)}
          className="block w-full rounded border p-2 text-xs"
          placeholder="Explain the correction and supporting evidence"
        />
        <button disabled={busy} className="rounded border px-3 py-1 text-xs" type="submit">
          {busy ? "Saving…" : "Save review"}
        </button>
      </form>
    </details>
  );
}
