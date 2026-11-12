import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useGuest } from "@/lib/guest";
import { managerHomeQuery, repsQuery } from "@/lib/queries";
import { coachingCallQuery, formatWhen, initials, segmentLines } from "@/lib/coaching/calls";
import { coachingAssignmentsQuery } from "@/lib/coaching/collaboration";

export function TodayBrief({
  personal = false,
  briefOnly = false,
}: {
  personal?: boolean;
  briefOnly?: boolean;
}) {
  const { currentOrgId, currentOrg, user } = useAuth();
  const [attentionOpen, setAttentionOpen] = useState(false);
  const { isGuest } = useGuest();
  const reps = useQuery({ ...repsQuery(currentOrgId ?? ""), enabled: !!currentOrgId && !isGuest });
  const assignments = useQuery(coachingAssignmentsQuery(currentOrgId ?? ""));
  const repNames = new Map((reps.data ?? []).map((rep) => [rep.id, rep.name]));
  const ownRep = user?.id ? reps.data?.find((rep) => rep.user_id === user.id) : undefined;
  const brief = useQuery(
    managerHomeQuery(currentOrgId ?? "", personal ? (ownRep?.id ?? null) : undefined),
  );
  const data = brief.data;
  const activity = (assignments.data ?? []).filter(
    (assignment) => !personal || assignment.rep_id === ownRep?.id,
  );
  const active = activity.filter((assignment) => assignment.status === "active");
  const calls = new Map((data?.calls ?? []).map((call) => [call.id, call]));
  const insights = data?.insights ?? [];
  const reports = data?.reports ?? [];
  const latest = reports.find((item) => item.status === "completed" && item.report);
  const latestFocus = latest?.report?.drill?.focus || latest?.report?.headline;
  const assignment = active[0];
  const processing = data?.calls.some((call) =>
    ["queued", "transcribing", "scoring", "analyzing"].includes(call.coachingStage ?? ""),
  );
  const hasWork = !!(insights.length || reports.length || assignment);
  const state =
    isGuest || !currentOrgId
      ? "setup"
      : brief.isError || (personal && reps.isError)
        ? "error"
        : brief.isLoading || (personal && reps.isPending)
          ? "loading"
          : personal && !ownRep
            ? "unlinked"
            : hasWork
              ? "ready"
              : processing
                ? "processing"
                : data?.importedCalls
                  ? "no-results"
                  : "first-use";

  return (
    <section
      className="page30-home"
      data-design-screen={briefOnly ? "manager-brief" : personal ? "rep-home" : "manager-home"}
    >
      <header className="page30-section-header">
        <div>
          <p className="page30-label">{personal ? "Personal workspace" : "Manager workspace"}</p>
          <h1>
            {briefOnly ? "Daily manager brief" : personal ? "My intelligence" : "Team intelligence"}
          </h1>
          {currentOrg?.name && <p className="page30-muted">{currentOrg.name}</p>}
          {!personal && (
            <Link className="figma-button mt-3" to="/app/settings" search={{ tab: "teams" }}>
              Manage my agents
            </Link>
          )}
        </div>
        <button
          type="button"
          disabled={brief.isFetching || isGuest || !currentOrgId || (personal && !ownRep)}
          onClick={() => void brief.refetch()}
          aria-label={personal ? "Refresh my intelligence" : "Refresh manager home"}
          className="figma-button"
        >
          <RefreshCw size={15} className={brief.isFetching ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="page30-home-grid">
        <div className="page30-home-main">
          {state === "loading" ? (
            <p role="status">Reading your workspace…</p>
          ) : state === "error" ? (
            <p role="alert">Intelligence could not load. Refresh to retry.</p>
          ) : state !== "ready" ? (
            <section className="page30-glass page30-priority">
              <p className="page30-label">
                {state === "processing" ? "Awaiting feedback" : "Getting started"}
              </p>
              <h2>
                {state === "setup"
                  ? "Let’s get Bylda ready"
                  : state === "unlinked"
                    ? "Link a rep profile to see your calls and coaching."
                    : state === "processing"
                      ? "Recordings are saved. Review their status in Calls."
                      : state === "no-results"
                        ? "No coaching findings are available yet."
                        : personal
                          ? "Your first insight appears once a call is reviewed."
                          : "Your first team brief appears once calls are reviewed."}
              </h2>
              <div className="page30-home-actions">
                <Link
                  className="figma-button page30-primary"
                  to="/app/crm/calls"
                  search={{ upload: true }}
                >
                  Upload a recording
                </Link>
                <Link className="figma-button" to="/app/integrations">
                  Connect calls
                </Link>
                <Link
                  className="figma-button"
                  to="/app/crm/calls"
                  search={{ view: state === "processing" ? "status" : "calls" }}
                >
                  {state === "processing" ? "Recording status" : "Open Calls"}
                </Link>
              </div>
            </section>
          ) : (
            <>
              <section className="page30-glass page30-priority">
                <p className="page30-label">
                  {assignment
                    ? "Today’s coaching focus"
                    : latestFocus
                      ? "Latest coaching report"
                      : "Recent call evidence"}
                </p>
                <h2>
                  {assignment?.focus ||
                    latestFocus ||
                    insights[0]?.summary ||
                    "Review your saved coaching activity"}
                </h2>
                <div className="page30-priority-detail">
                  {assignment ? (
                    <div>
                      <h3>
                        {personal
                          ? "Your check-in"
                          : (repNames.get(assignment.rep_id) ?? "Rep check-in")}
                      </h3>
                      <p>{formatWhen(assignment.check_in_at)}</p>
                      {assignment.note && <p>{assignment.note}</p>}
                    </div>
                  ) : latest?.report?.patterns?.[0] ? (
                    <>
                      <div>
                        <h3>Why it matters</h3>
                        <p>{latest.report.patterns[0].what_happened}</p>
                      </div>
                      {latest.report.drill.line_to_practice && (
                        <div>
                          <h3>Try this next time</h3>
                          <p>{latest.report.drill.line_to_practice}</p>
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
                <div className="page30-home-actions">
                  <Link
                    className="figma-button page30-primary"
                    to={assignment ? "/app/coaching" : "/app/crm/calls"}
                    search={assignment ? { assignment: assignment.id } : undefined}
                  >
                    {assignment ? "Open coaching focus" : "Open calls library"}
                  </Link>
                  {latest && (
                    <Link
                      className="figma-button"
                      to="/app/crm/calls"
                      search={{ view: "report", repId: latest.rep_id, reportId: latest.id }}
                    >
                      View report
                    </Link>
                  )}
                </div>
              </section>
              <div className="page30-evidence-grid">
                {insights.slice(0, 2).map((insight) => {
                  const call = calls.get(insight.call_id);
                  return (
                    <article key={insight.id} className="page30-glass page30-report-card">
                      <p className="page30-label">{formatWhen(insight.created_at)}</p>
                      <h3>{call?.contactName ?? "Call evidence"}</h3>
                      <p>{insight.summary || "Review the retained call analysis."}</p>
                      {currentOrgId && (
                        <IntelligenceEvidence
                          organizationId={currentOrgId}
                          callId={insight.call_id}
                          repId={personal ? ownRep?.id : undefined}
                        />
                      )}

                      <Link
                        className="page30-source-link"
                        to="/app/crm/calls"
                        search={{ callId: insight.call_id, repId: call?.rep_id ?? undefined }}
                      >
                        Open call review <ArrowUpRight size={13} />
                      </Link>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          <section className="page30-attention">
            <header className="page30-section-header">
              <h2>{personal ? "Coaching progress" : "Needs your attention"}</h2>
              {personal ? (
                <Link className="figma-button" to="/app/coaching" search={{ view: "progress" }}>
                  My coaching progress
                </Link>
              ) : (
                <Dialog open={attentionOpen} onOpenChange={setAttentionOpen}>
                  <DialogTrigger asChild>
                    <button className="figma-button" type="button">
                      View queue
                    </button>
                  </DialogTrigger>
                  <DialogContent
                    className="page30-dialog max-h-[85dvh] max-w-3xl overflow-auto"
                    aria-describedby={undefined}
                  >
                    <DialogTitle>Needs your attention</DialogTitle>
                    <ul className="page30-home-list">
                      {active.map((item) => (
                        <li key={item.id}>
                          <Link
                            to="/app/coaching"
                            search={{ assignment: item.id }}
                            onClick={() => setAttentionOpen(false)}
                          >
                            {item.focus}
                          </Link>
                          <span className="page30-chip">Follow-up</span>
                        </li>
                      ))}
                      {reports.map((report) => (
                        <li key={report.id}>
                          <Link
                            to="/app/crm/calls"
                            search={{ view: "report", repId: report.rep_id, reportId: report.id }}
                            onClick={() => setAttentionOpen(false)}
                          >
                            {report.report?.headline || "Coaching report"}
                          </Link>
                          <span className="page30-chip">{report.status}</span>
                        </li>
                      ))}
                      {insights.map((insight) => (
                        <li key={insight.id}>
                          <Link
                            to="/app/crm/calls"
                            search={{ callId: insight.call_id }}
                            onClick={() => setAttentionOpen(false)}
                          >
                            {calls.get(insight.call_id)?.contactName ?? "Call review"}
                          </Link>
                          <span className="page30-chip">Review call</span>
                        </li>
                      ))}
                      {processing && (
                        <li>
                          <Link
                            to="/app/crm/calls"
                            search={{ view: "status" }}
                            onClick={() => setAttentionOpen(false)}
                          >
                            Recordings processing
                          </Link>
                        </li>
                      )}
                    </ul>
                    {!active.length && !reports.length && !insights.length && !processing && (
                      <p className="page30-muted">No coaching items are in the queue yet.</p>
                    )}
                  </DialogContent>
                </Dialog>
              )}
            </header>
            {assignments.error ? (
              <p role="alert">
                Assignments could not load.{" "}
                <button className="underline" onClick={() => void assignments.refetch()}>
                  Retry
                </button>
              </p>
            ) : assignments.isPending ? (
              <p role="status">Loading coaching focus…</p>
            ) : active.length ? (
              <ul className="page30-home-list">
                {active.slice(0, 4).map((item) => (
                  <li key={item.id}>
                    <Link to="/app/coaching" search={{ assignment: item.id }}>
                      {repNames.get(item.rep_id) ?? "Rep"} · {item.focus}
                    </Link>
                    <span className="page30-muted">Check-in {formatWhen(item.check_in_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="page30-muted">No active coaching assignments.</p>
            )}
            {reports.length > 0 && (
              <ul className="page30-home-list">
                {reports.map((report) => (
                  <li key={report.id}>
                    <Link
                      to="/app/crm/calls"
                      search={{ view: "report", repId: report.rep_id, reportId: report.id }}
                    >
                      {report.status === "completed"
                        ? report.report?.headline || "Coaching report ready"
                        : report.status === "running"
                          ? "Coaching report is being prepared"
                          : "Report generation needs retry"}
                    </Link>
                    <span className="page30-muted">{repNames.get(report.rep_id) ?? "Rep"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <aside className="page30-home-aside">
          {!personal && (
            <section>
              <h2>Workspace coverage</h2>
              <dl className="page30-coverage">
                <div>
                  <dd>{data?.importedCalls ?? "—"}</dd>
                  <dt>Recordings</dt>
                </div>
                <div>
                  <dd>{data?.analyzedCalls ?? "—"}</dd>
                  <dt>Calls analyzed</dt>
                </div>
                <div>
                  <dd>{reps.data?.length ?? "—"}</dd>
                  <dt>Active reps</dt>
                </div>
              </dl>
              <div className="mt-4 space-y-2">
                <h3 className="font-semibold">Latest report findings</h3>
                {latest?.report?.strength && <p>{latest.report.strength.title}</p>}
                {latest?.report?.patterns?.[0] && <p>{latest.report.patterns[0].title}</p>}
                <Link className="page30-source-link" to="/app/insights">
                  Browse behavior patterns <ArrowUpRight size={13} />
                </Link>
              </div>
              <div className="mt-4">
                <h3 className="font-semibold">Change over time</h3>
                {latest?.report?.since_last?.moved?.length ? (
                  <p className="page30-muted">
                    Compare judged calls in the latest coaching report.
                  </p>
                ) : (
                  <p className="page30-muted">No comparable change appears in the latest report.</p>
                )}
              </div>
            </section>
          )}
          <section>
            <h2>Saved coaching reports</h2>
            {!personal && !briefOnly && (
              <Link className="page30-source-link block" to="/app" search={{ view: "brief" }}>
                Daily manager brief <ArrowUpRight size={13} />
              </Link>
            )}
            <Link className="page30-source-link" to="/app/reports">
              Browse reports <ArrowUpRight size={13} />
            </Link>
          </section>
          {!personal && (
            <section>
              <h2>Team</h2>
              {reps.isError ? (
                <p role="alert">Rep list unavailable.</p>
              ) : (
                <ul className="page30-home-list">
                  {reps.data?.map((rep) => (
                    <li key={rep.id}>
                      <Link
                        className="flex items-center gap-2"
                        to="/app/crm/calls"
                        search={{ view: "people", repId: rep.id }}
                      >
                        <span className="page30-chip">{initials(rep.name)}</span>
                        {rep.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link className="page30-source-link" to="/app/people">
                Open team <ArrowUpRight size={13} />
              </Link>
            </section>
          )}
          {activity.length > 0 && (
            <section>
              <h2>Recent coaching activity</h2>
              <ul className="page30-home-list">
                {activity.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <Link to="/app/coaching" search={{ assignment: item.id }}>
                      {item.focus}
                    </Link>
                    <span className="page30-muted">
                      {item.status} · {formatWhen(item.updated_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h2>Recent calls</h2>
            <ul className="page30-home-list">
              {data?.recentCallIds.map((id) => {
                const call = calls.get(id);
                if (!call) return null;
                return (
                  <li key={id}>
                    <Link
                      to="/app/crm/calls"
                      search={{ callId: id, repId: call.rep_id ?? undefined }}
                    >
                      {call.contactName}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link className="page30-source-link" to="/app/crm/calls">
              Open calls <ArrowUpRight size={13} />
            </Link>
          </section>
        </aside>
      </div>
    </section>
  );
}

function IntelligenceEvidence({
  organizationId,
  callId,
  repId,
}: {
  organizationId: string;
  callId: string;
  repId?: string;
}) {
  const [open, setOpen] = useState(false);
  const q = useQuery(coachingCallQuery(organizationId, open ? callId : null, repId));
  const excerpt = q.data
    ? segmentLines(q.data)
        .filter((line) => line.speaker !== "Call")
        .slice(0, 2)
    : [];
  return (
    <details
      className="page30-disclosure page30-spring-disclosure"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Preview call evidence</summary>
      {open &&
        (q.isLoading ? (
          <p role="status" className="page30-pending">
            Loading evidence…
          </p>
        ) : q.error ? (
          <p role="alert">
            Call evidence could not load.{" "}
            <button className="underline" onClick={() => void q.refetch()}>
              Retry
            </button>
          </p>
        ) : excerpt.length ? (
          <dl className="page30-quote">
            {excerpt.map((line) => (
              <div key={line.key}>
                <dt>{line.time}</dt>
                <dd>
                  <strong>{line.speaker}</strong> · {line.text}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="page30-muted">A timed transcript excerpt is unavailable.</p>
        ))}
    </details>
  );
}
