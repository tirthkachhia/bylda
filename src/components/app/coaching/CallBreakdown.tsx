import type { BehaviorAnalysis, BehaviorEvent, Evidence } from "@/lib/coaching/types";
import { EvidenceLinks } from "./EvidenceLinks";
const areas: Array<{ label: string; match: (e: BehaviorEvent) => boolean }> = [
  { label: "Discovery & probing", match: (e) => e.stage === "discovery" },
  { label: "Presentation & recommendation", match: (e) => e.stage === "recommendation" },
  { label: "Objection handling", match: (e) => e.family === "objection_resolution" },
  {
    label: "Closing & application",
    match: (e) => e.stage === "application" || e.stage === "decision",
  },
  {
    label: "Follow-through & additional interest",
    match: (e) => e.stage === "follow_up" || e.family === "commitment_next_step",
  },
];
export function CallBreakdown({
  analysis,
  events,
  onSelect,
}: {
  analysis: BehaviorAnalysis;
  events: BehaviorEvent[];
  onSelect?: (e: Evidence) => void;
}) {
  const priorities = [...events]
    .sort((a, b) => (a.coaching_priority ?? 3) - (b.coaching_priority ?? 3))
    .filter(
      (e) =>
        (e.result === "concern" || e.result === "mixed") &&
        ["high", "medium"].includes(e.confidence),
    )
    .slice(0, 3);
  const strength = events.find(
    (e) => e.result === "strength" && ["high", "medium"].includes(e.confidence),
  );
  return (
    <section
      aria-label="Individual call breakdown"
      className="space-y-4 rounded-xl border border-by-border-engraved p-4"
    >
      <h2 className="text-base">Individual call breakdown</h2>
      <p className="text-sm leading-6">
        <strong>Overall: </strong>
        {analysis.dimensions.sales_effectiveness.evidence.length
          ? analysis.dimensions.sales_effectiveness.explanation
          : "The retained evidence is too limited for an overall effectiveness judgment."}
      </p>
      <h3 className="text-sm font-medium">How the call went</h3>
      <div className="overflow-x-auto">
        <table className="figma-table">
          <thead>
            <tr>
              <th>Area</th>
              <th>What stood out</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Rapport & communication</td>
              <td>
                {analysis.dimensions.rep_behavior.evidence.length
                  ? analysis.dimensions.rep_behavior.explanation
                  : "Not enough retained evidence to judge."}
              </td>
            </tr>
            {areas.map((area) => {
              const observed = events.filter(area.match);
              return (
                <tr key={area.label}>
                  <td>{area.label}</td>
                  <td>
                    {observed.length
                      ? observed
                          .slice(0, 2)
                          .map((e) => e.rep_behavior)
                          .join(" ")
                      : "Not enough retained evidence to judge."}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h3 className="text-sm font-medium">What this call is telling us</h3>
      {!priorities.length && (
        <p className="text-xs text-by-text-secondary">
          No sufficiently supported concern is ready for coaching. Inspect the evidence before
          drawing a conclusion.
        </p>
      )}
      {priorities.map((e, i) => (
        <article key={e.occurrence_key} className="space-y-2 text-sm leading-6">
          <h4 className="font-medium">
            {i + 1}. {e.rep_behavior}
          </h4>
          <p>
            <strong>Buyer response: </strong>
            {e.buyer_reaction}
          </p>
          <p>
            <strong>What this means: </strong>
            {e.interpretation}
          </p>
          <p>
            <strong>What needs work: </strong>
            {e.coaching_action}
          </p>
          {e.alternative_explanation && (
            <p className="text-xs text-by-text-secondary">
              Also consider: {e.alternative_explanation}
            </p>
          )}
          <details>
            <summary className="cursor-pointer text-xs underline">Source evidence</summary>
            <EvidenceLinks
              evidence={[...e.rep_evidence, ...e.buyer_evidence]}
              onSelect={onSelect}
              onSeek={() => {}}
            />
          </details>
        </article>
      ))}
      {strength && (
        <article className="rounded-lg bg-emerald-50 p-3 text-sm">
          <h3 className="font-medium">Keep doing</h3>
          <p className="mt-2">
            {strength.rep_behavior} {strength.buyer_reaction}
          </p>
          <p className="mt-2">{strength.coaching_action}</p>
        </article>
      )}
      {!!priorities.length && (
        <div>
          <h3 className="font-medium text-sm">What to coach first</h3>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
            {priorities.map((e) => (
              <li key={e.occurrence_key}>{e.coaching_action}</li>
            ))}
          </ol>
          <h3 className="mt-4 text-sm font-medium">What to watch on the next calls</h3>
          <p className="mt-2 text-xs leading-6">
            Check whether the buyer understands the explanation, whether preliminary details are
            clearly qualified, and whether accepted next steps have an owner and a time. Compare the
            same behavior in eligible opportunities before calling it a recurring weakness.
          </p>
        </div>
      )}
      <p className="rounded-lg bg-by-surface-hover p-3 text-xs leading-6">
        One call does not establish a recurring weakness or prove lost business. The recording
        cannot verify application completion, underwriting approval, placement, payment or later
        fallout. An additional buying opportunity is not a missed sale merely because the rep
        finishes the current application first.
      </p>
    </section>
  );
}
