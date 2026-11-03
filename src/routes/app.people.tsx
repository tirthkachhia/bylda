import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { repsQuery } from "@/lib/queries";
import { workspaceIntelligenceQuery, summarizeWorkspace } from "@/lib/coaching/intelligence";
import { behaviorFeedbackQuery } from "@/lib/coaching/behavior";
import { coachingAssignmentsQuery } from "@/lib/coaching/collaboration";
import { csvText, downloadFile } from "@/lib/download";
import { FigmaViewLink, FigmaViewPicker } from "@/components/app/FigmaPageViews";
import { repCallCountsQuery, initials } from "@/lib/coaching/calls";
export const Route = createFileRoute("/app/people")({ component: People });
function People() {
  const { currentOrgId } = useAuth();
  const [since] = useState(() => new Date(Date.now() - 30 * 86400_000).toISOString());
  const counts = useQuery(repCallCountsQuery(currentOrgId ?? "", since));
  const q = useQuery({ ...repsQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  const [filter, setFilter] = useState("All reps");
  const [now] = useState(Date.now);
  const intelligence = useQuery(
    workspaceIntelligenceQuery(currentOrgId ?? "", new Date(now - 60 * 86400000).toISOString()),
  );
  const feedback = useQuery(
    behaviorFeedbackQuery(intelligence.data?.events.map((e) => e.id) ?? []),
  );
  const feedbackReady =
    !intelligence.data?.events.length || (!feedback.isPending && !feedback.error);
  const evidenceReady = !!intelligence.data && !intelligence.error && feedbackReady;
  const assignments = useQuery(coachingAssignmentsQuery(currentOrgId ?? ""));
  const metrics = new Map(
    (q.data ?? []).map((rep) => {
      const data = intelligence.data;
      const summary =
        data && evidenceReady
          ? summarizeWorkspace(
              {
                ...data,
                runs: data.runs.filter((r) => r.rep_id === rep.id),
                events: data.events.filter((e) => e.rep_id === rep.id),
              },
              feedback.data ?? [],
              now,
            )
          : null;
      const states = summary?.families.map((g) => g.trend.state) ?? [];
      const trajectory = states.includes("degrading")
        ? "Declining"
        : states.includes("improving")
          ? "Improving"
          : states.includes("unchanged")
            ? "No meaningful change"
            : "Insufficient reviewed evidence";
      const focus = assignments.data?.find((a) => a.rep_id === rep.id && a.status === "active");
      const concernCalls = new Set(
        summary?.usable
          .filter((e) => e.result === "concern" || e.result === "mixed")
          .map((e) => e.call_id),
      );
      return [rep.id, { focus, trajectory, concernCalls: concernCalls.size }];
    }),
  );
  const visible = (q.data ?? []).filter(
    (r) =>
      filter === "All reps" ||
      (filter === "Needs coaching"
        ? !!metrics.get(r.id)?.focus || !!metrics.get(r.id)?.concernCalls
        : metrics.get(r.id)?.trajectory === filter),
  );
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
      <FigmaViewPicker group="people" />
      <p className="mt-3 text-xs text-by-text-secondary">
        Saved coaching focus and observed behavior across each rep’s calls. Trends require
        comparable reviewed evidence.
      </p>
      <div className="figma-tabs" role="tablist" aria-label="People view">
        <button
          role="tab"
          aria-selected={filter === "All reps"}
          onClick={() => setFilter("All reps")}
        >
          All reps {q.data?.length ?? ""}
        </button>
        {["Needs coaching", "Improving", "Declining"].map((t) => (
          <button role="tab" key={t} aria-selected={filter === t} onClick={() => setFilter(t)}>
            {t}
          </button>
        ))}
        <FigmaViewLink screen="rep-comparison" className="">
          Compare reps
        </FigmaViewLink>
        <FigmaViewLink screen="team-overview" className="">
          Teams
        </FigmaViewLink>
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
              {visible.map((r) => (
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
                  <td>
                    {intelligence.isPending || (!feedbackReady && !feedback.error)
                      ? "Checking evidence"
                      : intelligence.error || feedback.error
                        ? "Evidence needs retry"
                        : `${metrics.get(r.id)?.concernCalls ?? 0} calls with concerns`}
                  </td>
                  <td>
                    {assignments.error
                      ? "Focus could not load"
                      : (metrics.get(r.id)?.focus?.focus ?? "No active assignment")}
                  </td>
                  <td>
                    {!evidenceReady
                      ? "Evidence pending or needs retry"
                      : metrics.get(r.id)?.trajectory}
                  </td>
                  <td>
                    {metrics.get(r.id)?.focus
                      ? `Check-in ${metrics.get(r.id)!.focus!.check_in_at}`
                      : "No scheduled check-in"}
                  </td>
                  <td>{counts.data ? (counts.data[r.id] ?? 0) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && (
            <p className="figma-empty mt-5">
              {q.data?.length
                ? "No reps match this filter."
                : "No reps yet. Create a rep when uploading your first call."}
            </p>
          )}
        </div>
      )}
      <div className="mt-6 flex gap-3">
        <Link className="figma-button" to="/app/crm/calls" search={{ view: "calls", upload: true }}>
          Upload calls
        </Link>
        <button
          className="figma-button"
          disabled={
            !q.data?.length ||
            !!q.error ||
            !evidenceReady ||
            !counts.data ||
            counts.isError ||
            assignments.isPending ||
            assignments.isError
          }
          onClick={() =>
            downloadFile(
              "rep-comparison.csv",
              csvText([
                [
                  "Rep",
                  "Calls in 30 days",
                  "Calls with retained concerns",
                  "Current focus",
                  "Trajectory",
                ],
                ...visible.map((r) => [
                  r.name,
                  counts.data?.[r.id] ?? "Unknown",
                  metrics.get(r.id)?.concernCalls ?? "Unknown",
                  metrics.get(r.id)?.focus?.focus ?? "None",
                  metrics.get(r.id)?.trajectory ?? "Unknown",
                ]),
              ]),
            )
          }
        >
          Export comparison
        </button>
      </div>
    </section>
  );
}
