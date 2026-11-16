import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { teamsQuery } from "@/lib/coaching/workspace";
import { repsQuery } from "@/lib/queries";
import { FigmaViewLink, FigmaViewPicker } from "@/components/app/FigmaPageViews";
import { useEffect, useRef, useState } from "react";
import { canTransitionPage30 } from "@/lib/coaching/page30-motion";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ReportSchedules } from "./ReportSchedules";
import { CoachingReportView } from "./CoachingReportView";
import { useSavedReports } from "./use-saved-reports";
import {
  completedReport,
  latestCompletedReport,
  reportPeriod,
  savedPeriod,
  weeklyTeamReports,
  type ReportPeriod,
} from "@/lib/coaching/report-views";
export function ReportsIndex({
  focusId,
  cadence,
  reportId,
}: {
  focusId?: string;
  cadence?: ReportPeriod;
  reportId?: string;
} = {}) {
  const { currentOrgId } = useAuth();
  const { access, query: q } = useSavedReports();
  const focusLink = useRef<HTMLAnchorElement>(null);
  const [scheduling, setScheduling] = useState(false),
    [share, setShare] = useState(""),
    [repFilter, setRepFilter] = useState<string | null>(null),
    [teamFilter, setTeamFilter] = useState(""),
    [period, setPeriod] = useState("");
  const reps = useQuery({ ...repsQuery(currentOrgId ?? "", true), enabled: !!currentOrgId });
  const ownRep = access.rep;
  const selectedRep = access.manager ? (repFilter ?? "") : (ownRep?.id ?? "");
  const teamWeekly = access.manager && cadence === "weekly";
  const teams = useQuery({
    ...teamsQuery(currentOrgId ?? ""),
    enabled: Boolean(currentOrgId && teamWeekly),
  });
  const selectedTeam = teams.data?.find((team) => team.id === teamFilter);
  const scoped = (q.data ?? []).filter(
    (row) =>
      (!cadence || reportPeriod(row) === cadence) &&
      (teamWeekly
        ? !selectedTeam || selectedTeam.rep_ids.includes(row.rep_id)
        : !selectedRep || row.rep_id === selectedRep),
  );
  const periods = [...new Set(scoped.map(savedPeriod))].sort((a, b) => b.localeCompare(a));
  const latestCompletedPeriod = periods.find((value) =>
    scoped.some((row) => savedPeriod(row) === value && completedReport(row)),
  );
  const selectedPeriod = periods.includes(period)
    ? period
    : teamWeekly
      ? (latestCompletedPeriod ?? periods[0] ?? "")
      : "";
  const rows = scoped.filter((row) => !selectedPeriod || savedPeriod(row) === selectedPeriod);
  const team = teamWeekly ? weeklyTeamReports(rows, selectedPeriod) : [];
  const selected =
    cadence && reportId
      ? rows.find((row) => row.id === reportId && completedReport(row))
      : undefined;
  const reportNames = new Map(reps.data?.map((rep) => [rep.id, rep.name]));
  useEffect(() => {
    if (focusId && focusLink.current) focusLink.current.focus();
  }, [focusId, q.isLoading]);
  const latest = latestCompletedReport(rows);
  const shown = reportId ? selected : latest;
  const running = rows.some((report) => report.status === "running");
  const citedCalls = latest?.report
    ? new Set(
        [
          ...latest.report.patterns.flatMap((pattern) => pattern.cited),
          ...(latest.report.strength?.cited ?? []),
        ].map((citation) => citation.call_id),
      ).size
    : 0;
  return (
    <section
      className="page30-library page30-final"
      data-report-period={cadence}
      data-design-screen="reports-index"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="page30-label">{access.manager ? "Manager workspace" : "Saved analysis"}</p>
          <h1>
            {ownRep && selectedRep === ownRep.id
              ? "My reports"
              : access.manager
                ? "Team reports"
                : "Reports"}
          </h1>
          <p className="mt-2 text-xs text-by-text-secondary">
            Your saved coaching reports and source evidence.
          </p>
        </div>
        {access.manager && (
          <button className="figma-button" onClick={() => setScheduling(true)}>
            Schedule a report
          </button>
        )}
      </div>
      <Dialog open={scheduling} onOpenChange={setScheduling}>
        <DialogContent
          className="page30-dialog max-h-[85dvh] overflow-auto"
          aria-describedby={undefined}
        >
          <DialogTitle>Report schedules</DialogTitle>
          <ReportSchedules />
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(share)}
        onOpenChange={(open) => {
          if (!open) setShare("");
        }}
      >
        <DialogContent className="page30-dialog">
          <DialogTitle>Share report</DialogTitle>
          <DialogDescription>Members with access can open this coaching report.</DialogDescription>
          <input
            readOnly
            aria-label="Report share link"
            value={share}
            onFocus={(event) => event.target.select()}
          />
          <button
            className="figma-button page30-primary"
            onClick={() =>
              void navigator.clipboard.writeText(share).then(
                () => toast.success("Link copied"),
                () => toast.error("Select and copy the link above."),
              )
            }
          >
            Copy link
          </button>
        </DialogContent>
      </Dialog>
      <nav className="page30-final-toggle" aria-label="Report history">
        <Link to="/app/reports" aria-current={!cadence ? "page" : undefined}>
          All reports
        </Link>
        <Link
          to="/app/reports"
          search={{ period: "daily" }}
          aria-current={cadence === "daily" ? "page" : undefined}
        >
          Daily Reports
        </Link>
        <Link
          to="/app/reports"
          search={{ period: "weekly" }}
          aria-current={cadence === "weekly" ? "page" : undefined}
        >
          Weekly Reports
        </Link>
      </nav>
      <div className="page30-library-filters page30-glass">
        {teamWeekly && teams.data?.length ? (
          <label>
            <span>Team</span>
            <select
              value={selectedTeam?.id ?? ""}
              onChange={(event) => {
                setTeamFilter(event.target.value);
                setPeriod("");
              }}
            >
              <option value="">All accessible teams</option>
              {teams.data.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {access.manager && !teamWeekly && (
          <label>
            <span>Representative</span>
            <select
              value={selectedRep}
              onChange={(event) => {
                setRepFilter(event.target.value);
                setPeriod("");
              }}
            >
              <option value="">All</option>
              {reps.data?.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>Period</span>
          <select value={selectedPeriod} onChange={(event) => setPeriod(event.target.value)}>
            {!teamWeekly && <option value="">All periods</option>}
            {periods.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        {access.manager && (
          <div className="figma-tabs" aria-label="Report views">
            <Link to="/app" search={{ view: "brief" }}>
              Daily briefs
            </Link>
            {[
              ["team-report", "Team"],
              ["behavior-report", "Behavior"],
            ].map(([key, title]) => (
              <FigmaViewLink key={key} screen={key} className="">
                {title}
              </FigmaViewLink>
            ))}
          </div>
        )}
      </div>
      {access.manager && <FigmaViewPicker group="reports" />}
      {access.error ? (
        <p role="alert">
          Workspace access could not load.{" "}
          <button className="underline" onClick={() => void access.retry()}>
            Retry
          </button>
        </p>
      ) : access.pending || q.isLoading ? (
        <p role="status" className="page30-pending">
          Loading reports…
        </p>
      ) : !access.manager && !ownRep ? (
        <p>Ask your manager to link your account to a rep profile to see your reports.</p>
      ) : q.error ? (
        <p role="alert">
          Reports could not load.{" "}
          <button className="underline" onClick={() => void q.refetch()}>
            Retry
          </button>
        </p>
      ) : (
        <>
          {teamWeekly &&
            (team.length ? (
              <CoachingReportView
                key={teamFilter + ":" + selectedPeriod}
                rows={team}
                period="weekly"
                team
                names={reportNames}
                headingLevel={2}
              />
            ) : (
              <p className="page30-final-card">
                No completed team reports are available for this period.
              </p>
            ))}
          {cadence && !teamWeekly && shown && (
            <CoachingReportView key={shown.id} rows={[shown]} period={cadence} headingLevel={2} />
          )}
          {cadence && reportId && !teamWeekly && !selected && (
            <p role="status" className="page30-final-card">
              This report is unavailable in the selected view.
            </p>
          )}
          {running && (
            <section className="page30-glass page30-priority" role="status">
              <p className="page30-label">Report processing</p>
              <h2>A coaching report is being prepared.</h2>
              {latest && (
                <Link
                  className="figma-button page30-primary"
                  to="/app/crm/calls"
                  search={{ view: "report", repId: latest.rep_id, reportId: latest.id }}
                >
                  Open last saved report
                </Link>
              )}
            </section>
          )}
          <div className="page30-glass overflow-x-auto">
            <table className="figma-table">
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Period</th>
                  <th>Calls reviewed</th>
                  <th>Review status</th>
                  <th>Main takeaway</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    data-report-card={r.id}
                    style={r.id === focusId ? { viewTransitionName: "bylda-report" } : undefined}
                  >
                    <td>
                      {cadence && !teamWeekly && completedReport(r) ? (
                        <Link
                          ref={r.id === focusId ? focusLink : undefined}
                          className="underline underline-offset-4"
                          to="/app/reports"
                          search={{ period: cadence, report: r.id }}
                        >
                          {reportNames.get(r.rep_id) ?? ownRep?.name ?? "Rep unavailable"} ·{" "}
                          {cadence === "daily" ? "Daily report" : "Weekly report"}
                        </Link>
                      ) : (
                        <Link
                          ref={r.id === focusId ? focusLink : undefined}
                          className="underline underline-offset-4"
                          to="/app/crm/calls"
                          viewTransition
                          onClick={(event) => {
                            if (
                              !canTransitionPage30() ||
                              event.metaKey ||
                              event.ctrlKey ||
                              event.shiftKey ||
                              event.altKey
                            )
                              return;
                            const row = event.currentTarget.closest("tr");
                            const previous = row
                              ?.closest("tbody")
                              ?.querySelector<HTMLElement>('[style*="view-transition-name"]');
                            if (previous && previous !== row)
                              previous.style.removeProperty("view-transition-name");
                            row?.style.setProperty("view-transition-name", "bylda-report");
                          }}
                          search={{ view: "report", repId: r.rep_id, reportId: r.id }}
                        >
                          {reps.data?.find((p) => p.id === r.rep_id)?.name ?? "Rep unavailable"} ·
                          Coaching report
                        </Link>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      {r.period_start} – {r.period_end}
                    </td>
                    <td>{r.call_count}</td>
                    <td>
                      <span className="page30-chip">
                        {r.status === "completed"
                          ? "Saved"
                          : r.status === "running"
                            ? "Processing"
                            : "Needs retry"}
                      </span>
                    </td>
                    <td>{r.report?.headline ?? "—"}</td>
                    <td>
                      <button
                        className="figma-button"
                        onClick={() => {
                          const url = new URL("/app/crm/calls", window.location.origin);
                          url.searchParams.set("view", "report");
                          url.searchParams.set("repId", r.rep_id);
                          url.searchParams.set("reportId", r.id);
                          setShare(url.toString());
                        }}
                      >
                        Share
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <p className="page30-glass page30-report-card">
              {q.data?.length
                ? "No reports match these filters."
                : "No reports yet. Select a rep to generate a report from analyzed calls."}
            </p>
          )}
          {!cadence && latest?.report && (
            <section className="page30-glass page30-priority">
              <p className="page30-label">Latest report takeaway</p>
              <h2>{latest.report.headline}</h2>
              <p>
                {latest.call_count} calls reviewed · {citedCalls} with cited evidence
              </p>
              <Link
                className="figma-button page30-primary mt-3"
                to="/app/crm/calls"
                search={{ view: "report", repId: latest.rep_id, reportId: latest.id }}
              >
                Open report
              </Link>
            </section>
          )}
          <Link className="figma-button" to="/app/crm/calls" search={{ view: "report" }}>
            Generate a rep report
          </Link>
        </>
      )}
    </section>
  );
}
