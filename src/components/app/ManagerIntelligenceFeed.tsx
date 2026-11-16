import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  CircleCheck,
  FileStack,
  Info,
  MessageCircleQuestionMark,
  PhoneCall,
  RefreshCw,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { managerHomeQuery, repsQuery } from "@/lib/queries";
import { initials } from "@/lib/coaching/calls";
import { coachingAssignmentsQuery } from "@/lib/coaching/collaboration";
import { DashboardStat } from "./coaching/CoachingReportView";

const processing = (stage: string | null) =>
  ["queued", "transcribing", "scoring", "analyzing"].includes(stage ?? "");

export function ManagerIntelligenceFeed() {
  const { currentOrgId, currentOrg } = useAuth();
  const org = currentOrgId ?? "";
  const home = useQuery(managerHomeQuery(org));
  const reps = useQuery({ ...repsQuery(org), enabled: !!org });
  const assignments = useQuery(coachingAssignmentsQuery(org));
  const [expanded, setExpanded] = useState(false);
  const data = home.data;
  const calls = new Map(data?.calls.map((call) => [call.id, call]));
  const insightByCall = new Map<string, NonNullable<typeof data>["insights"][number]>();
  for (const insight of data?.insights ?? []) {
    if (!insightByCall.has(insight.call_id)) insightByCall.set(insight.call_id, insight);
  }
  const active = (assignments.data ?? []).filter((item) => item.status === "active");
  const names = new Map(reps.data?.map((rep) => [rep.id, rep.name]));
  const latest = data?.reports.find((row) => row.status === "completed" && row.report);
  const priority = latest?.report?.patterns?.find((pattern) => pattern.cited.length);
  const strength = latest?.report?.strength;
  const priorityCited = new Set(priority?.cited.map((citation) => citation.call_id)).size;
  const attention = [
    ...active.map((item) => ({
      id: item.id,
      title: item.focus,
      subtitle: names.get(item.rep_id) ?? "Coaching assignment",
      label: "Follow-up",
      icon: CalendarClock,
      link: { to: "/app/coaching" as const, search: { assignment: item.id } },
    })),
    ...(data?.reports ?? [])
      .filter((row) => row.status === "failed")
      .map((row) => ({
        id: row.id,
        title: "Report needs retry",
        subtitle: names.get(row.rep_id) ?? "Coaching report",
        label: "Report",
        icon: Info,
        link: {
          to: "/app/crm/calls" as const,
          search: { view: "report" as const, reportId: row.id, repId: row.rep_id },
        },
      })),
    ...(data?.insights ?? [])
      .filter((row) => Boolean(row.summary))
      .map((row) => ({
        id: row.id,
        title: calls.get(row.call_id)?.contactName ?? "Call review",
        subtitle: row.summary,
        label: "Review",
        icon: MessageCircleQuestionMark,
        link: {
          to: "/app/crm/calls" as const,
          search: { callId: row.call_id, repId: calls.get(row.call_id)?.rep_id ?? undefined },
        },
      })),
  ];
  const sourceLink = latest
    ? { view: "report" as const, reportId: latest.id, repId: latest.rep_id }
    : undefined;
  return (
    <section
      className="page30-final page30-final-feed"
      data-design-screen="manager-intelligence-feed"
    >
      <header className="page30-final-top">
        <div>
          <h1>Intelligence</h1>
          <p className="page30-final-muted">{currentOrg?.name ?? "Workspace"} · Manager overview</p>
        </div>
        <button
          type="button"
          className="figma-button"
          disabled={!org || home.isFetching || reps.isFetching || assignments.isFetching}
          onClick={() => void Promise.all([home.refetch(), reps.refetch(), assignments.refetch()])}
        >
          <RefreshCw size={15} aria-hidden="true" /> Refresh
        </button>
      </header>
      {!org && <p className="page30-final-card">Select a workspace to see team intelligence.</p>}
      {home.isLoading && <p role="status">Loading intelligence…</p>}
      {(home.isError || reps.isError || assignments.isError) && (
        <p role="alert" className="page30-final-card">
          Some workspace intelligence could not load. Use Refresh to retry.
        </p>
      )}
      <div className="page30-final-feed-grid">
        <div className="page30-final-stack">
          <div className="page30-final-stats page30-final-team-stats">
            <DashboardStat
              icon={PhoneCall}
              value={data?.analyzedCalls ?? "—"}
              label="Calls analyzed"
            />
            <DashboardStat icon={Users} value={reps.data?.length ?? "—"} label="Active reps" />
            <DashboardStat icon={FileStack} value={data?.importedCalls ?? "—"} label="Recordings" />
          </div>
          <section>
            <div className="page30-final-top">
              <h2>
                Needs Your Attention{" "}
                {attention.length > 0 && (
                  <span className="page30-final-pill" data-tone="red">
                    {attention.length}
                  </span>
                )}
              </h2>
              {attention.length > 3 && (
                <button
                  type="button"
                  className="page30-source-link"
                  aria-expanded={expanded}
                  onClick={() => setExpanded((value) => !value)}
                >
                  {expanded ? "Show less" : "View all"}
                </button>
              )}
            </div>
            <div className="page30-final-card page30-final-list">
              {attention.length ? (
                attention
                  .slice(0, expanded ? undefined : 3)
                  .map(({ id, title, subtitle, icon: Icon, label, link }) => (
                    <Link key={id} {...link} className="page30-final-row">
                      <span className="page30-final-icon">
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <span>
                        <strong>{title}</strong>
                        {subtitle && (
                          <span className="page30-final-muted page30-final-row-copy">
                            {subtitle}
                          </span>
                        )}
                      </span>
                      <span className="page30-final-pill">{label}</span>
                      <ChevronRight size={16} aria-hidden="true" />
                    </Link>
                  ))
              ) : (
                <p className="page30-final-muted">
                  {home.isLoading || assignments.isLoading
                    ? "Checking for coaching items…"
                    : "No coaching items are available."}
                </p>
              )}
              {data?.calls.some((call) => processing(call.coachingStage)) && (
                <Link
                  className="page30-source-link"
                  to="/app/crm/calls"
                  search={{ view: "status" }}
                >
                  Check recording status <ArrowUpRight size={14} />
                </Link>
              )}
            </div>
          </section>
          <section>
            <div className="page30-final-top">
              <h2>Priority insight</h2>
              <Link className="page30-source-link" to="/app" search={{ view: "brief" }}>
                Manager brief <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="page30-final-card page30-final-priority">
              <span className="page30-final-icon">
                <MessageCircleQuestionMark size={21} aria-hidden="true" />
              </span>
              <div>
                <h3>{priority?.title ?? "No cited priority yet"}</h3>
                <p>
                  {priority?.what_happened ??
                    "A coaching priority appears when a saved report includes supporting call evidence."}
                </p>
                {priority && (
                  <p className="page30-final-muted">
                    {priorityCited} cited {priorityCited === 1 ? "call" : "calls"}
                  </p>
                )}
              </div>
              {priority && (
                <Link
                  to="/app/crm/calls"
                  search={sourceLink}
                  className="figma-button page30-primary"
                >
                  Review evidence <ArrowUpRight size={14} />
                </Link>
              )}
            </div>
          </section>
          <section>
            <div className="page30-final-top">
              <h2>Recent calls</h2>
              <Link className="page30-source-link" to="/app/crm/calls">
                View all <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="page30-final-card page30-final-list">
              {data?.recentCallIds.length ? (
                data.recentCallIds.map((id) => {
                  const call = calls.get(id);
                  if (!call) return null;
                  return (
                    <Link
                      key={id}
                      to="/app/crm/calls"
                      search={{ callId: id, repId: call.rep_id ?? undefined }}
                      className="page30-final-row"
                    >
                      <span className="page30-final-icon">
                        <PhoneCall size={18} aria-hidden="true" />
                      </span>
                      <span>
                        <strong>{call.contactName}</strong>
                        {insightByCall.get(id)?.summary && (
                          <span className="page30-final-muted page30-final-row-copy">
                            {insightByCall.get(id)?.summary}
                          </span>
                        )}
                      </span>
                      <span className="page30-final-pill">
                        {processing(call.coachingStage)
                          ? "Processing"
                          : insightByCall.has(id)
                            ? "Review"
                            : "Recording"}
                      </span>
                      <ChevronRight size={16} aria-hidden="true" />
                    </Link>
                  );
                })
              ) : (
                <div className="page30-final-actions">
                  <p className="page30-final-muted">No recent recordings.</p>
                  <Link className="figma-button" to="/app/crm/calls" search={{ upload: true }}>
                    Upload a recording
                  </Link>
                  <Link className="figma-button" to="/app/integrations">
                    Connect calls
                  </Link>
                </div>
              )}
            </div>
          </section>
        </div>
        <aside className="page30-final-stack">
          <section className="page30-final-card">
            <div className="page30-final-top">
              <h2>Team at a glance</h2>
              <Link className="page30-source-link" to="/app/people">
                Open team <ArrowUpRight size={14} />
              </Link>
            </div>
            {reps.data?.length ? (
              <div className="page30-final-list">
                {reps.data.slice(0, 5).map((rep) => (
                  <Link
                    className="page30-final-row"
                    key={rep.id}
                    to="/app/crm/calls"
                    search={{ view: "people", repId: rep.id }}
                  >
                    <span className="page30-final-pill">{initials(rep.name)}</span>
                    <strong>{rep.name}</strong>
                    {active.some((item) => item.rep_id === rep.id) && (
                      <span className="page30-final-pill" data-tone="green">
                        Coaching focus
                      </span>
                    )}
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="page30-final-muted">No active reps to show.</p>
            )}
            <Link className="page30-source-link" to="/app/settings" search={{ tab: "teams" }}>
              Manage my agents <ArrowUpRight size={14} />
            </Link>
          </section>
          <section className="page30-final-card">
            <div className="page30-final-top">
              <h2>Key findings</h2>
              <Link className="page30-source-link" to="/app/insights">
                Browse patterns <ArrowUpRight size={14} />
              </Link>
            </div>
            {latest ? (
              <>
                <p className="page30-final-muted">
                  Latest saved rep report · {names.get(latest.rep_id) ?? "Team member"}
                </p>
                <div className="page30-final-list">
                  {[
                    ...(strength ? [{ ...strength, positive: true }] : []),
                    ...(latest.report?.patterns ?? []).map((pattern) => ({
                      ...pattern,
                      positive: false,
                    })),
                  ].map((finding, index) => {
                    const Icon = finding.positive ? CircleCheck : MessageCircleQuestionMark;
                    return (
                      <Link
                        key={index}
                        className="page30-final-row"
                        to="/app/crm/calls"
                        search={sourceLink}
                      >
                        <span className="page30-final-icon">
                          <Icon size={18} aria-hidden="true" />
                        </span>
                        <span>
                          <strong>{finding.title}</strong>
                          <span className="page30-final-muted page30-final-row-copy">
                            {finding.what_happened}
                          </span>
                        </span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="page30-final-muted">No saved findings are available.</p>
            )}
            <Link className="page30-source-link" to="/app/reports" search={{ period: "weekly" }}>
              Weekly reports <ArrowUpRight size={14} />
            </Link>
          </section>
        </aside>
      </div>
    </section>
  );
}
