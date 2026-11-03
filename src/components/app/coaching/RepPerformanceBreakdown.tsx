import { Link } from "@tanstack/react-router";
import type { BehaviorRow } from "@/lib/coaching/types";
import { COACHING_TOPICS } from "../../../../supabase/functions/_shared/coaching/behavior-intelligence";
export function RepPerformanceBreakdown({
  events,
  callCount,
  days,
}: {
  events: BehaviorRow[];
  callCount: number;
  days: number;
}) {
  const topics = Object.entries(COACHING_TOPICS).map(([key, label]) => {
    const rows = events.filter(
      (e) =>
        (e.assessment.coaching_topic ?? "other") === key &&
        e.opportunity === "eligible" &&
        e.result !== "unobservable",
    );
    return {
      key,
      label,
      rows,
      calls: new Set(rows.map((e) => e.call_id)).size,
      concerns: new Set(
        rows.filter((e) => e.result === "concern" || e.result === "mixed").map((e) => e.call_id),
      ).size,
      strengths: new Set(rows.filter((e) => e.result === "strength").map((e) => e.call_id)).size,
    };
  });
  const priorities = topics
      .filter((t) => t.concerns > 0)
      .sort((a, b) => b.concerns - a.concerns)
      .slice(0, 3),
    strengths = topics.filter((t) => t.strengths > 0);
  return (
    <section
      className="space-y-4 rounded-xl border border-by-border-engraved p-4"
      aria-label="Sales performance breakdown"
    >
      <h2 className="text-base">Sales performance breakdown</h2>
      <p className="text-xs">
        {callCount} analyzed calls · last {days} days. Counts below describe retained, eligible
        observations and are not exhaustive audits of every application or carrier discussion.
      </p>
      <h3 className="text-sm font-medium">What the calls are telling us</h3>
      {priorities.length ? (
        priorities.map((topic, i) => {
          const example = topic.rows.find((e) => e.result === "concern" || e.result === "mixed")!;
          return (
            <article key={topic.key} className="space-y-2 text-sm leading-6">
              <h4 className="font-medium">
                {i + 1}. {topic.label}
              </h4>
              <p>
                Concerns on {topic.concerns} of {topic.calls} calls with retained eligible
                observations in this topic.
                {topic.concerns === 1
                  ? " This is a single-call observation, not a recurring weakness."
                  : " The concern appears on more than one analyzed call; check the examples and context before generalizing."}
              </p>
              <p>
                <strong>What this means: </strong>
                {example.assessment.interpretation}
              </p>
              <p>
                <strong>What needs work: </strong>
                {example.assessment.coaching_action}
              </p>
              <Link
                className="text-xs underline"
                to="/app/crm/calls"
                search={{
                  callId: example.call_id,
                  runId: example.run_id,
                  eventId: example.id,
                  turnId: example.evidence.rep[0]?.turn_id,
                }}
              >
                Review the source example
              </Link>
            </article>
          );
        })
      ) : (
        <p className="text-xs">No supported concern is ready to prioritize from this sample.</p>
      )}
      <h3 className="text-sm font-medium">What is working</h3>
      {strengths.length ? (
        <ul className="list-disc pl-4 text-sm space-y-2">
          {strengths.map((t) => (
            <li key={t.key}>
              {t.label}: supported strengths on {t.strengths} calls. Preserve the useful behavior
              while addressing specific concerns.
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs">
          No source-supported strength is ready to summarize. Missing observations are not evidence
          of poor performance.
        </p>
      )}
      <details>
        <summary className="text-sm cursor-pointer">
          How they are performing across the areas reviewed
        </summary>
        <table className="figma-table mt-3">
          <thead>
            <tr>
              <th>Area</th>
              <th>Retained observations</th>
            </tr>
          </thead>
          <tbody>
            {topics.map((t) => (
              <tr key={t.key}>
                <td>{t.label}</td>
                <td>
                  {t.calls
                    ? `${t.concerns} calls with concerns; ${t.strengths} with strengths, among ${t.calls} eligible observed calls.`
                    : "Not enough retained evidence to judge."}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <p className="rounded bg-by-surface-hover p-3 text-xs leading-6">
        Observed coaching priorities do not establish their effect on close rate, revenue, approval,
        placement or fallout. An improvement claim still requires comparable reviewed opportunities
        over time; the Trends view applies that check.
      </p>
    </section>
  );
}
