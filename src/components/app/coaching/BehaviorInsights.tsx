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
export function EvidenceLinks({
  evidence,
  onSeek,
}: {
  evidence: Evidence[];
  onSeek: (seconds: number) => void;
}) {
  return (
    <ul className="mt-2 space-y-2">
      {evidence.map((e) => (
        <li key={e.turn_id} className="rounded border border-black/10 p-2 text-xs">
          <button
            type="button"
            disabled={e.start_s === null}
            className="font-semibold text-blue-700 disabled:text-neutral-500"
            onClick={() => e.start_s !== null && onSeek(e.start_s)}
          >
            {timeLabel(e.start_s)} · {e.speaker}
          </button>
          <p className="mt-1 whitespace-pre-wrap">{e.text}</p>
        </li>
      ))}
    </ul>
  );
}
export function BehaviorInsights({
  analysis,
  runId,
  onSeek,
}: {
  analysis: BehaviorAnalysis;
  runId: string;
  onSeek: (seconds: number) => void;
}) {
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
      if (error) return false;
      const { data: membership } = await db
        .from("organization_members")
        .select("role")
        .eq("organization_id", run.organization_id)
        .eq("user_id", user.id)
        .maybeSingle();
      return ["owner", "admin", "manager"].includes(membership?.role);
    },
  });
  const ready = !q.isLoading && !feedback.isLoading && !q.error && !feedback.error;
  const available = analysis.events.filter((event) => {
    const row = rows.find((r) => r.assessment.occurrence_key === event.occurrence_key);
    return (
      !row ||
      feedbackAllowsRecommendation((feedback.data ?? []).filter((f) => f.event_id === row.id))
    );
  });
  const selected = ready ? selectBehaviorMoments(available) : [];
  const priority = selected.find((e) => e.result === "concern" || e.result === "mixed");
  const strength = selected.find((e) => e.result === "strength");
  return (
    <section className="space-y-4" aria-label="Evidence-backed coaching">
      <p className="rounded border border-amber-200 bg-amber-50 p-3 text-xs">
        Analyzed {analysis.coverage.analyzed_turns} of {analysis.coverage.total_turns} available
        transcript turns.{" "}
        {analysis.coverage.ending_analyzed ? "Transcript ending included." : "Ending not analyzed."}{" "}
        Recording completeness, speaker identity and timestamp accuracy are not independently
        verified.
      </p>
      <p className="text-sm">
        <strong>Observed final state:</strong> {analysis.final_state.label}{" "}
        <span className="text-neutral-500">
          ({analysis.final_state.verification.replaceAll("_", " ")})
        </span>
      </p>
      {strength && (
        <div className="rounded bg-green-50 p-3 text-sm">
          <strong>Keep doing:</strong> {strength.rep_behavior}
          <p className="mt-1">{strength.interpretation}</p>
          <p className="mt-1">Repeat: {strength.coaching_action}</p>
        </div>
      )}
      {priority && (
        <div className="rounded bg-blue-50 p-3 text-sm">
          <strong>Next-call action:</strong> {priority.coaching_action}
          <p className="mt-1">Buyer response: {priority.buyer_reaction}</p>
        </div>
      )}
      {ready && !selected.length && (
        <p className="text-sm text-neutral-500">
          Insufficient validated evidence for a behavioral coaching moment. Missing evidence is not
          a failure by the rep.
        </p>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-semibold">Six separate judgments</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {Object.entries(analysis.dimensions).map(([key, f]) => (
            <div key={key} className="rounded border p-3 text-xs">
              <strong>
                {DIMENSION_LABELS[key as keyof typeof DIMENSION_LABELS]} · {f.assessment}
              </strong>
              <p className="mt-1">{f.explanation}</p>
              {key === "risk_review" && (
                <p className="mt-1">
                  {f.policy_reference
                    ? `Supplied source: ${f.policy_reference.title} v${f.policy_reference.version} — ${f.policy_reference.quote}`
                    : "No verified policy reference attached. This is a review signal, not a compliance determination."}
                </p>
              )}
              <EvidenceLinks evidence={f.evidence} onSeek={onSeek} />
            </div>
          ))}
        </div>
      </details>
      <details>
        <summary className="cursor-pointer text-sm font-semibold">
          Call context and limitations
        </summary>
        <p className="mt-2 text-xs">
          Objective: {analysis.context.objective}
          <br />
          Starting state: {analysis.context.starting_state}
          <br />
          Buyer constraints: {analysis.context.constraints}
          <br />
          Prior history: {analysis.context.prior_history}
        </p>
        <EvidenceLinks evidence={analysis.context.evidence} onSeek={onSeek} />
      </details>
      {selected.map((event) => {
        const row = rows.find((r) => r.assessment.occurrence_key === event.occurrence_key);
        const review = row && feedback.data?.find((f) => f.event_id === row.id);
        return (
          <article key={event.occurrence_key} className="rounded border p-4 text-sm">
            <h3 className="font-semibold">
              {BEHAVIOR_LABELS[event.family]} · {event.result}
            </h3>
            <p className="mt-2">{event.rep_behavior}</p>
            <p className="mt-1">
              <strong>Buyer:</strong> {event.buyer_reaction}
            </p>
            <p className="mt-1">
              <strong>Progression:</strong> {event.observed_progression}
            </p>
            <p className="mt-1">
              <strong>Interpretation:</strong> {event.interpretation}
            </p>
            <p className="mt-1">
              <strong>Action:</strong> {event.coaching_action}
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold">
                Source evidence and uncertainty
              </summary>
              <EvidenceLinks
                evidence={[
                  ...event.context_evidence,
                  ...event.rep_evidence,
                  ...event.buyer_evidence,
                ].filter((e, i, a) => a.findIndex((x) => x.turn_id === e.turn_id) === i)}
                onSeek={onSeek}
              />
              <p className="mt-2 text-xs">
                Other explanation: {event.alternative_explanation || "Unknown"}. Limitations:{" "}
                {event.limitations.join("; ") ||
                  "Speaker attribution and interpretation require review."}
              </p>
            </details>
            {review && (
              <p className="mt-2 text-xs text-neutral-600">
                Latest review: {review.accuracy} · {review.usefulness}
                {review.correction && ` · ${review.correction}`}
              </p>
            )}
            {row && permission.data && <ReviewForm event={row} />}
          </article>
        );
      })}
      {q.error && (
        <p className="text-xs text-red-700">
          Saved evidence could not be loaded. Try refreshing or contact your workspace
          administrator.
        </p>
      )}
      {feedback.error && (
        <p className="text-xs text-red-700">Reviewer feedback could not be loaded.</p>
      )}
      {analysis.events.length > selected.length && (
        <details>
          <summary className="cursor-pointer text-xs">
            All {analysis.events.length} retained events
          </summary>
          {analysis.events
            .filter((e) => !selected.some((s) => s.occurrence_key === e.occurrence_key))
            .map((e) => {
              const row = rows.find((r) => r.assessment.occurrence_key === e.occurrence_key);
              const review = row && feedback.data?.find((f) => f.event_id === row.id);
              return (
                <article key={e.occurrence_key} className="mt-3 border-t pt-3 text-xs">
                  <p>
                    {e.result}: {e.rep_behavior} — {e.buyer_reaction}
                  </p>
                  <p className="mt-1">Original interpretation: {e.interpretation}</p>
                  {review && (
                    <p className="mt-1">
                      Review: {review.accuracy} · {review.usefulness}. {review.correction}
                    </p>
                  )}
                  <EvidenceLinks
                    evidence={[...e.rep_evidence, ...e.buyer_evidence]}
                    onSeek={onSeek}
                  />
                  {row && permission.data && <ReviewForm event={row} />}
                </article>
              );
            })}
        </details>
      )}
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
