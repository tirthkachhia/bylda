import { FigmaViewLink } from "@/components/app/FigmaPageViews";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useGuest } from "@/lib/guest";
import { managerHomeQuery, repsQuery } from "@/lib/queries";
import { formatWhen, initials } from "@/lib/coaching/calls";

export function TodayBrief() {
  const { profile, currentOrgId } = useAuth();
  const { isGuest } = useGuest();
  const brief = useQuery(managerHomeQuery(currentOrgId ?? ""));
  const reps = useQuery({ ...repsQuery(currentOrgId ?? ""), enabled: !!currentOrgId && !isGuest });
  const data = brief.data;
  const calls = new Map((data?.calls ?? []).map((c) => [c.id, c]));
  const repNames = new Map((reps.data ?? []).map((r) => [r.id, r.name]));
  const loading = brief.isPending;
  return (
    <div
      className="grid min-h-[calc(100dvh-112px)] gap-2 xl:grid-cols-[minmax(0,1fr)_344px]"
      data-design-screen="manager-home"
    >
      <section className="rounded-xl border border-by-border-engraved bg-by-surface-raised p-5 shadow-by-card sm:p-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl">
              Good to see you, {profile?.full_name?.split(" ")[0] || "there"}.
            </h1>
            <p className="mt-1 text-[13px] text-by-text-secondary">
              Your team’s conversations, evidence and coaching reports.
            </p>
          </div>
          <button
            type="button"
            disabled={brief.isFetching || isGuest || !currentOrgId}
            onClick={() => void brief.refetch()}
            aria-label="Refresh manager home"
            className="rounded-md border border-by-border-control p-2 disabled:opacity-40"
          >
            <RefreshCw size={15} className={brief.isFetching ? "animate-spin" : ""} />
          </button>
        </header>
        <nav
          aria-label="Manager views"
          className="my-5 inline-flex flex-wrap gap-1 rounded-xl border border-by-border-engraved bg-by-surface-hover p-1 text-[13px]"
        >
          <span
            aria-current="page"
            className="flex items-center gap-2 rounded-md border border-by-border-engraved bg-white px-3 py-2"
          >
            <img src="/figma/home.svg" alt="" />
            For You
          </span>
          <Link
            to="/app/crm/calls"
            className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-white"
          >
            <img src="/figma/calls.svg" alt="" />
            Calls
          </Link>
          <Link
            to="/app/crm/calls"
            search={{ view: "report" } as never}
            className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-white"
          >
            <img src="/figma/reports.svg" alt="" />
            Reports
          </Link>
          <FigmaViewLink screen="manager-team-updates" className="px-3 py-2">
            Team updates
          </FigmaViewLink>
          <FigmaViewLink screen="manager-coaching" className="px-3 py-2">
            Coaching
          </FigmaViewLink>
          <FigmaViewLink screen="manager-mentions" className="px-3 py-2">
            Mentions
          </FigmaViewLink>
        </nav>
        {isGuest || !currentOrgId ? (
          <EmptyHome
            title="Let’s get Bylda ready"
            body="Select a workspace and connect your calls to see real conversation insights."
          />
        ) : brief.isError ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
          >
            Your team’s updates could not load. Refresh to retry.
          </div>
        ) : loading ? (
          <p role="status" className="py-10 text-sm text-by-text-secondary">
            Reading your workspace…
          </p>
        ) : !data?.insights.length && !data?.reports.length ? (
          <EmptyHome
            title="Let’s get Bylda ready"
            body="Your feed fills with calls and evidence once your first conversations are analyzed."
          />
        ) : (
          <div className="space-y-3">
            {(data?.insights ?? []).map((insight, index) => {
              const call = calls.get(insight.call_id);
              const name = repNames.get(call?.rep_id ?? "") ?? "Unassigned rep";
              return (
                <article
                  key={insight.id}
                  className={`rounded-xl border border-by-border-engraved ${index === 0 ? "bg-by-surface-hover p-5 shadow-sm" : "p-4"}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-by-surface-control-dark">
                      <img src="/figma/intelligence.svg" alt="" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <strong>BYLDA</strong>
                        <span className="rounded border border-by-border-engraved bg-by-surface-sidebar px-1.5 py-0.5">
                          CALL ANALYSIS
                        </span>
                        <time className="text-by-text-tertiary">
                          {formatWhen(insight.created_at)}
                        </time>
                      </div>
                      <h2 className="mt-3 text-base leading-6">
                        {insight.summary ||
                          "Conversation analyzed. Open the review to read its evidence."}
                      </h2>
                      <p className="mt-3 text-xs text-by-text-secondary">
                        {name} · {call?.contactName ?? "Source call"}
                      </p>
                      <Link
                        to="/app/crm/calls"
                        search={
                          {
                            callId: insight.call_id,
                            repId: call?.rep_id ?? undefined,
                            view: "calls",
                          } as never
                        }
                        className="mt-4 inline-flex rounded-md border border-by-border-control bg-white px-3 py-2 text-xs font-medium"
                      >
                        Open call review →
                      </Link>
                    </div>
                    <span className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-by-avatar-metal text-xs sm:flex">
                      {initials(name)}
                    </span>
                  </div>
                </article>
              );
            })}
            {(data?.reports ?? []).map((report) => (
              <article
                key={report.id}
                className="flex items-start gap-3 rounded-xl border border-by-border-engraved p-4 text-[13px]"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-by-surface-sidebar">
                  <img src="/figma/file.svg" alt="" />
                </span>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-wide text-by-text-tertiary">
                    Report · {report.status}
                  </span>
                  <p className="mt-1">
                    {report.status === "completed"
                      ? report.report?.headline || "Coaching report ready"
                      : report.status === "running"
                        ? "Coaching report is being prepared"
                        : "Report generation needs retry"}
                  </p>
                  <Link
                    to="/app/crm/calls"
                    search={{ view: "report", repId: report.rep_id, reportId: report.id } as never}
                    className="mt-2 inline-block text-xs underline underline-offset-4"
                  >
                    {repNames.get(report.rep_id) ?? "Rep"} · View report
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <aside className="space-y-7 px-1 py-3 text-[13px]">
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide">
            Workspace at a glance
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Imported calls", data?.importedCalls],
              ["Analyzed calls", data?.analyzedCalls],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-by-border-engraved bg-white/40 p-3"
              >
                <p className="text-xl tabular-nums">{typeof value === "number" ? value : "—"}</p>
                <p className="mt-1 text-xs text-by-text-secondary">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-by-text-tertiary">All time · current workspace</p>
        </section>
        <section>
          <h2 className="mb-3 text-xs uppercase">Coach today</h2>
          <div className="figma-empty !min-h-20">Not available yet</div>
        </section>
        <section>
          <h2 className="mb-3 text-xs uppercase">Team activity</h2>
          <div className="figma-empty !min-h-20">Not available yet</div>
        </section>
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide">Your reps</h2>
          {reps.isError ? (
            <p className="text-xs text-red-700">Rep list unavailable.</p>
          ) : (reps.data ?? []).length ? (
            <ul className="space-y-3">
              {reps.data?.map((rep) => (
                <li key={rep.id}>
                  <Link
                    to="/app/crm/calls"
                    search={{ view: "report", repId: rep.id } as never}
                    className="flex items-center gap-2"
                  >
                    <span className="flex size-7 items-center justify-center rounded-full bg-by-avatar-metal text-[10px]">
                      {initials(rep.name)}
                    </span>
                    <span>{rep.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-by-text-secondary">Add your first rep from Calls.</p>
          )}
        </section>
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide">Recent calls</h2>
          <ul className="space-y-3">
            {data?.recentCallIds.map((id) => {
              const call = calls.get(id);
              if (!call) return null;
              return (
                <li key={id}>
                  <Link
                    to="/app/crm/calls"
                    search={{ callId: id, repId: call.rep_id ?? undefined } as never}
                    className="flex items-center gap-2"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-by-surface-control-dark">
                      <img src="/figma/play.svg" alt="" />
                    </span>
                    <span className="truncate">{call.contactName}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {!data?.recentCallIds.length && (
            <p className="text-xs text-by-text-secondary">Your imported calls will appear here.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
function EmptyHome({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-xl border border-by-border-engraved p-8">
      <span className="mb-5 flex size-11 items-center justify-center rounded-xl bg-by-surface-sidebar">
        <img src="/figma/rail-insights.svg" alt="" />
      </span>
      <h2 className="text-xl">{title}</h2>
      <p className="mt-3 max-w-lg text-sm leading-6 text-by-text-secondary">{body}</p>
      <Link
        to="/app/integrations"
        className="mt-6 inline-flex rounded-md bg-by-surface-control-dark px-4 py-2.5 text-sm text-white"
      >
        Connect calls
      </Link>
    </section>
  );
}
