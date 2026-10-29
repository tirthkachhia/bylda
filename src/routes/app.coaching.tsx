import { createFileRoute, Link } from "@tanstack/react-router";
import { Inactive } from "@/components/app/FigmaPrimitives";
export const Route = createFileRoute("/app/coaching")({ component: Coaching });
function Coaching() {
  return (
    <section
      className="figma-surface figma-panel min-h-[calc(100dvh-72px)]"
      data-design-screen="coaching"
    >
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1>Coaching</h1>
          <p className="mt-2 text-xs text-by-text-secondary">Evidence, focus and follow-through.</p>
        </div>
        <Inactive>Assign coaching</Inactive>
      </div>
      <div className="figma-tabs" role="tablist" aria-label="Coaching status">
        <button role="tab" aria-selected="true">
          Active
        </button>
        <button role="tab" disabled>
          Needs follow-up
        </button>
        <button role="tab" disabled>
          Completed
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="figma-table">
          <thead>
            <tr>
              {["Rep", "Focus behavior", "Status", "Started", "Next check", "Progress"].map((t) => (
                <th key={t}>{t}</th>
              ))}
            </tr>
          </thead>
        </table>
      </div>
      <div className="figma-empty mt-4">
        Coaching assignments and check-ins are not available yet.
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link className="figma-button" to="/app/reports">
          Open coaching reports
        </Link>
        <Link className="figma-button" to="/app/crm/calls" search={{ view: "report" }}>
          Review a rep’s report
        </Link>
      </div>
      <p className="mt-3 text-xs text-by-text-secondary">
        Reports support manager-recorded conversation status. Assignment and acknowledgement states
        remain unavailable.
      </p>
    </section>
  );
}
