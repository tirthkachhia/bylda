import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { repsQuery } from "@/lib/queries";
import type { RepReportRow } from "@/lib/coaching/types";
import { Inactive } from "@/components/app/FigmaPrimitives";
import { FigmaViewLink, FigmaViewPicker } from "@/components/app/FigmaPageViews";
export function ReportsIndex() {
  const { currentOrgId } = useAuth();
  const reps = useQuery({ ...repsQuery(currentOrgId ?? "", true), enabled: !!currentOrgId });
  const q = useQuery({
    queryKey: ["workspace-coaching-reports", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const reports: RepReportRow[] = [];
      for (let from = 0; ; from += 500) {
        const { data, error } = await supabase
          .from("coaching_reports" as never)
          .select("*")
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
  return (
    <section
      className="figma-surface figma-panel min-h-[calc(100dvh-72px)]"
      data-design-screen="reports-index"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1>Reports</h1>
          <p className="mt-2 text-xs text-by-text-secondary">
            Your saved coaching reports and source evidence.
          </p>
        </div>
        <Inactive>Schedule a report</Inactive>
      </div>
      <div className="figma-tabs" role="tablist" aria-label="Report type">
        <button role="tab" aria-selected="true">
          All {q.data?.length ?? ""}
        </button>
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
        <div className="overflow-x-auto">
          <table className="figma-table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Type</th>
                <th>For</th>
                <th>Period</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.data?.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link
                      className="underline underline-offset-4"
                      to="/app/crm/calls"
                      search={{ view: "report", repId: r.rep_id, reportId: r.id }}
                    >
                      {r.report?.headline ?? "Rep coaching report"}
                    </Link>
                  </td>
                  <td>Rep coaching</td>
                  <td>{reps.data?.find((p) => p.id === r.rep_id)?.name ?? "Rep unavailable"}</td>
                  <td className="whitespace-nowrap">
                    {r.period_start} – {r.period_end}
                  </td>
                  <td>{r.status}</td>
                  <td>
                    <Inactive>Share</Inactive>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!q.data?.length && (
            <p className="figma-empty mt-5">
              No reports yet. Select a rep to generate a report from analyzed calls.
            </p>
          )}
          <Link className="figma-button mt-6" to="/app/crm/calls" search={{ view: "report" }}>
            Generate a rep report
          </Link>
        </div>
      )}
    </section>
  );
}
