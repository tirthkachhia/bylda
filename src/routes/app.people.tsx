import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { repsQuery } from "@/lib/queries";
import { Inactive } from "@/components/app/FigmaPrimitives";
import { repCallCountsQuery, initials } from "@/lib/coaching/calls";
export const Route = createFileRoute("/app/people")({ component: People });
function People() {
  const { currentOrgId } = useAuth();
  const [since] = useState(() => new Date(Date.now() - 30 * 86400_000).toISOString());
  const counts = useQuery(repCallCountsQuery(currentOrgId ?? "", since));
  const q = useQuery({ ...repsQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  return (
    <section
      className="figma-surface figma-panel min-h-[calc(100dvh-72px)]"
      data-design-screen="people"
    >
      <div className="flex flex-wrap justify-between gap-4">
        <h1>People</h1>
        <Link className="figma-button" to="/app/settings" search={{ tab: "users" }}>
          Manage users
        </Link>
      </div>
      <p className="mt-3 text-xs text-by-text-secondary">
        Sales reps in your workspace. Team baselines and coaching assignments are not available yet.
      </p>
      <div className="figma-tabs" role="tablist" aria-label="People view">
        <button role="tab" aria-selected="true">
          All reps {q.data?.length ?? ""}
        </button>
        {["Needs coaching", "Improving", "Declining", "Compare reps"].map((t) => (
          <button role="tab" key={t} disabled title="Not available yet">
            {t}
          </button>
        ))}
      </div>
      {q.isPending ? (
        <p role="status">Loading reps…</p>
      ) : q.error ? (
        <p role="alert">
          Reps could not load.{" "}
          <button className="underline" onClick={() => void q.refetch()}>
            Retry
          </button>
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="figma-table">
            <thead>
              <tr>
                <th>Rep</th>
                <th>Attention</th>
                <th>Current focus</th>
                <th>Trajectory</th>
                <th>Recent change</th>
                <th>Calls · 30d</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link
                      to="/app/crm/calls"
                      search={{ view: "people", repId: r.id }}
                      className="flex items-center gap-3"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-by-avatar-metal text-xs">
                        {initials(r.name)}
                      </span>
                      {r.name}
                    </Link>
                  </td>
                  {[1, 2, 3, 4].map((i) => (
                    <td key={i} title="Not available yet">
                      —
                    </td>
                  ))}
                  <td>{counts.data ? (counts.data[r.id] ?? 0) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!q.data?.length && (
            <p className="figma-empty mt-5">
              No reps yet. Create a rep when uploading your first call.
            </p>
          )}
        </div>
      )}
      <div className="mt-6 flex gap-3">
        <Link className="figma-button" to="/app/crm/calls" search={{ view: "calls", upload: true }}>
          Upload calls
        </Link>
        <Inactive>Export comparison</Inactive>
      </div>
    </section>
  );
}
