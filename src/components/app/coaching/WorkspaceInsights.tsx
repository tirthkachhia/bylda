import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { repsQuery } from "@/lib/queries";
import { workspaceIntelligenceQuery, summarizeWorkspace } from "@/lib/coaching/intelligence";
import { behaviorFeedbackQuery, BEHAVIOR_LABELS } from "@/lib/coaching/behavior";
import { coachingPreferencesQuery } from "@/lib/coaching/preferences";
import { workspaceDateStamp, workspaceWeekStart } from "@/lib/coaching/calendar";
import { RecordedOutcomes } from "./RecordedOutcomes";
const tabs = [
  "Overview",
  "Emerging patterns",
  "Objections",
  "Team behaviors",
  "Methodology",
  "Outcome patterns",
] as const;
export function WorkspaceInsights({ initialTab = "Overview" }: { initialTab?: string }) {
  const { currentOrgId } = useAuth(),
    org = currentOrgId ?? "";
  const [now] = useState(Date.now),
    [tab, setTab] = useState(initialTab);
  const preferences = useQuery(coachingPreferencesQuery(org));
  const historyDays = preferences.data?.history_days ?? 60;
  const q = useQuery(
    workspaceIntelligenceQuery(org, new Date(now - historyDays * 86400000).toISOString()),
  );
  const feedback = useQuery(behaviorFeedbackQuery(q.data?.events.map((e) => e.id) ?? [])),
    reps = useQuery(repsQuery(org));
  const names = new Map(reps.data?.map((r) => [r.id, r.name]));
  const summary = q.data ? summarizeWorkspace(q.data, feedback.data ?? [], now) : null;
  const reviewReady = !q.data?.events.length || (!feedback.isPending && !feedback.error);
  const weekStart = workspaceWeekStart(
    now,
    preferences.data?.time_zone ?? "America/New_York",
    preferences.data?.week_starts_on ?? 1,
  );
  const weekCount = q.data?.calls.filter((c) => {
    const day = workspaceDateStamp(
      c.started_at ?? c.created_at,
      preferences.data?.time_zone ?? "America/New_York",
    );
    return (
      day &&
      weekStart &&
      day >= weekStart &&
      day <= workspaceDateStamp(now, preferences.data?.time_zone ?? "America/New_York")!
    );
  }).length;
  return (
    <section className="figma-panel space-y-5" data-design-screen="intelligence">
      <h1>Intelligence</h1>
      <p className="text-xs text-by-text-secondary">
        Your uploaded and connected calls share the same evidence library. Last {historyDays} days
        by call date.
      </p>
      <nav className="figma-tabs" aria-label="Intelligence view">
        {tabs.map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      {q.isPending ? (
        <p role="status">Loading workspace calls and evidence…</p>
      ) : q.error ? (
        <p role="alert">
          Workspace evidence could not load.{" "}
          <button className="underline" onClick={() => void q.refetch()}>
            Retry
          </button>{" "}
          <Link to="/app/crm/calls" className="underline">
            Open uploaded calls
          </Link>
        </p>
      ) : q.data && summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="figma-metric">
              <span>Calls this week</span>
              <strong>{weekStart ? weekCount : "Time zone needs review"}</strong>
              <small>
                {preferences.data?.time_zone ?? "America/New_York"} · week from {weekStart}
              </small>
            </div>
            <div className="figma-metric">
              <span>Uploaded / imported calls</span>
              <strong>{q.data.totalCalls}</strong>
            </div>
            <div className="figma-metric">
              <span>Retained analyses · {historyDays}d</span>
              <strong>{q.data.runs.length}</strong>
            </div>
            <div className="figma-metric">
              <span>Median call length</span>
              <strong>
                {summary.medianSeconds === null
                  ? "No recorded durations"
                  : `${Math.round(summary.medianSeconds)}s`}
              </strong>
              <small>{summary.knownDurations} measured calls</small>
            </div>
          </div>
          {!q.data.totalCalls ? (
            <div className="figma-empty">
              <p>No calls in this workspace yet.</p>
              <Link className="figma-button" to="/app/crm/calls" search={{ upload: true }}>
                Upload calls
              </Link>
              <Link className="figma-button" to="/app/integrations">
                Connect a source
              </Link>
            </div>
          ) : !q.data.runs.length ? (
            <div className="figma-empty">
              <p>
                {q.data.totalCalls} calls are already saved.{" "}
                {q.data.calls.length
                  ? "Analysis may still be processing or needs a retry."
                  : `The saved calls are outside this ${historyDays}-day period.`}
              </p>
              <Link className="figma-button" to="/app/crm/calls">
                Review saved calls
              </Link>
            </div>
          ) : !reviewReady ? (
            <p role={feedback.error ? "alert" : "status"}>
              {feedback.error
                ? "Review labels could not load. Findings are withheld until they can be checked."
                : "Checking manager reviews…"}
              <button className="underline ml-2" onClick={() => void feedback.refetch()}>
                Retry reviews
              </button>
            </p>
          ) : (
            <>
              {tab === "Methodology" ? (
                <div className="space-y-3">
                  {q.data.runs.map((run) => (
                    <article className="rounded-lg border p-3" key={run.id}>
                      <Link
                        to="/app/crm/calls"
                        search={{ callId: run.call_id, runId: run.id, tab: "methodology" }}
                        className="underline"
                      >
                        {names.get(run.rep_id ?? "") ?? "Rep"} ·{" "}
                        {run.analysis.execution?.playbook?.name ?? "No assigned playbook"}
                      </Link>
                      <p className="text-xs mt-2">
                        {run.analysis.execution?.items.filter((i) =>
                          ["followed", "adapted"].includes(i.status),
                        ).length ?? 0}{" "}
                        objectives fulfilled ·{" "}
                        {run.analysis.execution?.items.filter((i) => i.status === "not_observable")
                          .length ?? 0}{" "}
                        unknown · analysis-time version only
                      </p>
                    </article>
                  ))}
                </div>
              ) : tab === "Outcome patterns" ? (
                <div className="space-y-3">
                  <RecordedOutcomes />
                  <p className="text-xs">
                    Recorded end states are transcript observations or reported outcomes. They do
                    not establish policy placement, revenue or causation.
                  </p>
                  {q.data.runs.map((run) => (
                    <article className="rounded-lg border p-3 text-sm" key={run.id}>
                      <Link
                        className="underline"
                        to="/app/crm/calls"
                        search={{ callId: run.call_id, runId: run.id }}
                      >
                        {names.get(run.rep_id ?? "") ?? "Rep"} · {run.analysis.final_state.label}
                      </Link>
                      <p className="text-xs mt-2">
                        {run.analysis.final_state.verification.replaceAll("_", " ")}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {summary.families
                    .filter((g) => tab !== "Objections" || g.family === "objection_resolution")
                    .map((group) => (
                      <article
                        className="rounded-xl border border-by-border-engraved p-4"
                        key={group.family}
                      >
                        <h2>{BEHAVIOR_LABELS[group.family]}</h2>
                        <p className="mt-2 text-sm">
                          Concerns on {group.concernCalls} of {group.callCount} calls with retained
                          eligible observations · strengths on {group.strengthCalls} calls ·{" "}
                          {group.repCount} reps
                        </p>
                        <p className="mt-2 text-xs text-by-text-secondary">
                          {group.trend.state === "insufficient_evidence"
                            ? "Change: insufficient comparable reviewed evidence."
                            : `Observed change: ${group.trend.state}.`}{" "}
                          Counts describe this sample, not all opportunities or a causal effect.
                        </p>
                        <ul className="mt-3 space-y-3">
                          {group.events.slice(0, 6).map((event) => (
                            <li key={event.id} className="text-xs">
                              <Link
                                className="underline"
                                to="/app/crm/calls"
                                search={{
                                  callId: event.call_id,
                                  runId: event.run_id,
                                  ...(event.rep_id ? { repId: event.rep_id } : {}),
                                  eventId: event.id,
                                  turnId: event.evidence.rep[0]?.turn_id,
                                }}
                              >
                                {names.get(event.rep_id ?? "") ?? "Rep"} ·{" "}
                                {event.assessment.rep_behavior}
                              </Link>
                              <p className="mt-1">{event.assessment.buyer_reaction}</p>
                            </li>
                          ))}
                        </ul>
                        {!group.callCount && (
                          <p className="mt-2 text-xs">
                            No retained eligible observations for this area. This is not a positive
                            or negative performance judgment.
                          </p>
                        )}
                      </article>
                    ))}
                </div>
              )}
            </>
          )}
        </>
      ) : null}
    </section>
  );
}
