import { createFileRoute, Link } from "@tanstack/react-router";
import { FigmaViewLink, FigmaViewPicker } from "@/components/app/FigmaPageViews";
export const Route = createFileRoute("/app/insights")({ component: Insights });
function Insights() {
  return (
    <div
      className="figma-surface grid gap-2 xl:grid-cols-[minmax(0,1fr)_344px]"
      data-design-screen="intelligence"
    >
      <section className="figma-panel min-h-[calc(100dvh-72px)]">
        <h1>Intelligence</h1>
        <FigmaViewPicker group="insights" />
        <p className="mt-2 text-xs text-by-text-secondary">
          Behavior patterns across your sales conversations.
        </p>
        <div className="figma-tabs" role="tablist" aria-label="Intelligence view">
          <button role="tab" aria-selected="true">
            Overview
          </button>
          {[
            ["emerging-patterns", "Emerging patterns"],
            ["objections", "Objections"],
            ["team-behaviors", "Team behaviors"],
            ["methodology-adherence", "Methodology"],
            ["outcome-patterns", "Outcome patterns"],
          ].map(([key, title]) => (
            <FigmaViewLink key={key} screen={key} className="">
              {title}
            </FigmaViewLink>
          ))}
        </div>
        <h3>Important today</h3>
        <div className="figma-empty min-h-36">Team pattern detection is not available yet.</div>
        <div className="my-4 grid gap-4 md:grid-cols-2">
          <section className="rounded-lg border border-by-border-engraved p-4">
            <h3 className="!mt-0">Objection pattern</h3>
            <p className="text-xs text-by-text-secondary">Not available yet</p>
          </section>
          <section className="rounded-lg border border-by-border-engraved p-4">
            <h3 className="!mt-0">Call length</h3>
            <p className="text-xs text-by-text-secondary">Not available yet</p>
          </section>
        </div>
        <h3>Team behaviors</h3>
        <div className="overflow-x-auto">
          <table className="figma-table">
            <thead>
              <tr>
                {["Behavior", "Team now", "30-day change", "Trend", "Associated with"].map((t) => (
                  <th key={t}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {["—", "—", "—", "—", "—"].map((t, i) => (
                  <td key={i}>{t}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="figma-button" to="/app/crm/calls" search={{ view: "insights" }}>
            Review supported per-rep trends
          </Link>
          <FigmaViewLink screen="assign-coaching">Assign coaching</FigmaViewLink>
        </div>
      </section>
      <aside className="space-y-3 p-6">
        <h2 className="text-xs uppercase">Pattern lifecycle</h2>
        {["Emerging", "Confirmed", "Fading", "Resolved"].map((label) => (
          <div key={label} className="figma-row">
            <span>{label}</span>
            <span className="text-xs text-by-text-secondary">—</span>
          </div>
        ))}
        <h2 className="pt-4 text-xs uppercase">Open patterns</h2>
        <div className="figma-empty">Not available yet</div>
        <p className="mt-5 rounded-lg border border-by-border-engraved p-4 text-xs text-by-text-secondary">
          Pattern lifecycle and team associations are not available yet. Existing per-rep
          comparisons remain evidence-gated.
        </p>
      </aside>
    </div>
  );
}
