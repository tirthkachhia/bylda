import { useWorkspaceView } from "@/lib/workspace-view";
import { AgentReportsIndex } from "./AgentReportsIndex";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { coachingManagerPermissionQuery, repsQuery } from "@/lib/queries";
import type { RepReportRow } from "@/lib/coaching/types";
import { FigmaViewLink, FigmaViewPicker } from "@/components/app/FigmaPageViews";
import { useState } from "react";
import { toast } from "sonner";
import { ReportSchedules } from "./ReportSchedules";
function ManagerReportsIndex() {
  const { currentOrgId, user } = useAuth();
  const permission = useQuery(coachingManagerPermissionQuery(currentOrgId ?? "", user?.id ?? ""));
  const [scheduling, setScheduling] = useState(false),
    [share, setShare] = useState(""),
    [repFilter, setRepFilter] = useState<string | null>(null),
    [period, setPeriod] = useState("");
  const reps = useQuery({ ...repsQuery(currentOrgId ?? "", true), enabled: !!currentOrgId });
  const q = useQuery({
    queryKey: ["workspace-coaching-reports", currentOrgId],
    enabled: !!currentOrgId,
    refetchInterval: (query) =>
      query.state.data?.some((report) => report.status === "running") ? 10_000 : false,
    queryFn: async () => {
      const reports: RepReportRow[] = [];
      for (let from = 0; ; from += 500) {
        const { data, error } = await supabase
          .from("coaching_reports" as never)
          .select("id,rep_id,period_start,period_end,call_count,status,report,created_at")
          .eq("organization_id", currentOrgId!)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, from + 499);
        if (error) throw error;
        const rows = data as unknown as RepReportRow[];
        if (!Array.isArray(rows)) throw new Error("Report history unavailable");
        reports.push(...rows);
        if (rows.length < 500) return reports;
      }
    },
  });
  const email = user?.email?.toLowerCase();
  const ownRep = email ? reps.data?.find((rep) => rep.email?.toLowerCase() === email) : undefined;
  const selectedRep = repFilter ?? (permission.data === false ? ownRep?.id : undefined) ?? "";
  const scoped = (q.data ?? []).filter((report) => !selectedRep || report.rep_id === selectedRep);
  const periods = [
    ...new Set(scoped.map((report) => `${report.period_start} – ${report.period_end}`)),
  ];
  const selectedPeriod = periods.includes(period) ? period : "";
  const rows = scoped.filter(
    (report) =>
      !selectedPeriod || `${report.period_start} – ${report.period_end}` === selectedPeriod,
  );
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
          <p className="page30-label">
            {permission.data === true ? "Manager workspace" : "Saved analysis"}
          </p>
          <h1>
            {ownRep && selectedRep === ownRep.id
              ? "My reports"
              : permission.data
                ? "Team reports"
                : "Reports"}
          </h1>
          <p className="mt-2 text-xs text-by-text-secondary">
            Your saved coaching reports and source evidence.
          </p>
        </div>
        <button className="figma-button" onClick={() => setScheduling((v) => !v)}>
          Schedule a report
        </button>
      </div>
      {scheduling && <ReportSchedules />}
      {share && (
        <section className="rounded border p-3 text-xs">
          <p>Workspace membership is required to open this report.</p>
          <input
            readOnly
            aria-label="Report share link"
            className="w-full my-2 border p-2"
            value={share}
            onFocus={(e) => e.target.select()}
          />
          <button
            className="figma-button"
            onClick={() =>
              void navigator.clipboard.writeText(share).then(
                () => toast.success("Link copied"),
                () => toast.error("Select and copy the link above."),
              )
            }
          >
            Copy link
          </button>
          <button className="figma-button ml-2" onClick={() => setShare("")}>
            Close
          </button>
        </section>
      )}
      <div className="page30-library-filters page30-glass">
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
        <label>
          <span>Period</span>
          <select value={selectedPeriod} onChange={(event) => setPeriod(event.target.value)}>
            <option value="">All periods</option>
            {periods.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <div className="figma-tabs" aria-label="Report views">
          {[
            ["daily-manager-brief", "Daily briefs"],
            ["weekly-manager-report", "Weekly manager"],
            ["team-report", "Team"],
            ["behavior-report", "Behavior"],
          ].map(([key, title]) => (
            <FigmaViewLink key={key} screen={key} className="">
              {title}
            </FigmaViewLink>
          ))}
        </div>
      </div>
      <FigmaViewPicker group="reports" />
      {q.isPending ? (
        <p role="status">Loading reports…</p>
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
                  <tr key={r.id}>
                    <td>
                      <Link
                        className="underline underline-offset-4"
                        to="/app/crm/calls"
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

export function ReportsIndex() {
  return useWorkspaceView() === "manager" ? <ManagerReportsIndex /> : <AgentReportsIndex />;
}
