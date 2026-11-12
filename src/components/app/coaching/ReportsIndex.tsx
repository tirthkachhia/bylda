import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { repsQuery } from "@/lib/queries";
import type { RepReportRow } from "@/lib/coaching/types";
import { FigmaViewLink, FigmaViewPicker } from "@/components/app/FigmaPageViews";
import { useEffect, useRef, useState } from "react";
import { useCoachingWorkspaceAccess } from "@/lib/coaching/workspace-access";
import { canTransitionPage30 } from "@/lib/coaching/page30-motion";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ReportSchedules } from "./ReportSchedules";
export function ReportsIndex({ focusId }: { focusId?: string } = {}) {
  const { currentOrgId } = useAuth();
  const access = useCoachingWorkspaceAccess();
  const focusLink = useRef<HTMLAnchorElement>(null);
  const [scheduling, setScheduling] = useState(false),
    [share, setShare] = useState(""),
    [repFilter, setRepFilter] = useState<string | null>(null),
    [period, setPeriod] = useState("");
  const reps = useQuery({ ...repsQuery(currentOrgId ?? "", true), enabled: !!currentOrgId });
  const q = useQuery({
    queryKey: ["workspace-coaching-reports", currentOrgId, access.rep?.id],
    enabled: !!currentOrgId && Boolean(access.manager || access.rep),
    refetchInterval: (query) =>
      query.state.data?.some((report) => report.status === "running") ? 10_000 : false,
    queryFn: async () => {
      const reports: RepReportRow[] = [];
      for (let from = 0; ; from += 500) {
        let query = supabase
          .from("coaching_reports" as never)
          .select("id,rep_id,period_start,period_end,call_count,status,report,created_at")
          .eq("organization_id", currentOrgId!)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, from + 499);
        if (access.rep) query = query.eq("rep_id", access.rep.id);
        const { data, error } = await query;
        if (error) throw error;
        const rows = data as unknown as RepReportRow[];
        if (!Array.isArray(rows)) throw new Error("Report history unavailable");
        reports.push(...rows);
        if (rows.length < 500) return reports;
      }
    },
  });
  const ownRep = access.rep;
  const selectedRep = access.manager ? (repFilter ?? "") : (ownRep?.id ?? "");
  const scoped = (q.data ?? []).filter((report) => !selectedRep || report.rep_id === selectedRep);
  const periods = [
    ...new Set(scoped.map((report) => `${report.period_start} – ${report.period_end}`)),
  ];
  const selectedPeriod = periods.includes(period) ? period : "";
  const rows = scoped.filter(
    (report) =>
      !selectedPeriod || `${report.period_start} – ${report.period_end}` === selectedPeriod,
  );
  useEffect(() => {
    if (focusId && focusLink.current) focusLink.current.focus();
  }, [focusId, q.isLoading]);
  const latest = rows.find((report) => report.status === "completed" && report.report);
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
    <section className="page30-library space-y-4" data-design-screen="reports-index">
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
      <div className="page30-library-filters page30-glass">
        {access.manager && (
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
            <option value="">All periods</option>
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
              ["weekly-manager-report", "Weekly manager"],
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
          {latest?.report && (
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
