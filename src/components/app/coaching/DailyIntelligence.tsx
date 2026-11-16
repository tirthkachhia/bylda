import { Link } from "@tanstack/react-router";
import { latestCompletedReport, reportPeriod } from "@/lib/coaching/report-views";
import { CoachingReportView } from "./CoachingReportView";
import { useSavedReports } from "./use-saved-reports";

export function DailyIntelligence() {
  const { access, query } = useSavedReports();
  if (access.pending || query.isLoading) return <p role="status">Loading daily report…</p>;
  if (access.error || query.error)
    return (
      <p role="alert">
        Daily reports could not load.{" "}
        <button
          className="figma-button"
          onClick={() => void (access.error ? access.retry() : query.refetch())}
        >
          Retry
        </button>
      </p>
    );

  const rows = access.rep ? (query.data ?? []).filter((row) => reportPeriod(row) === "daily") : [];
  const latest = latestCompletedReport(rows);
  return (
    <div className="page30-final page30-final-report" data-report-period="daily">
      {latest ? (
        <CoachingReportView key={latest.id} rows={[latest]} period="daily" />
      ) : (
        <section className="page30-final-card">
          <h1>Daily Rep Report</h1>
          <p>
            {!access.rep
              ? "Ask your manager to link your account to a rep profile."
              : rows.some((row) => row.status === "running")
                ? "Your daily report is being prepared."
                : "No completed daily report is available yet."}
          </p>
          <Link className="figma-button" to="/app/crm/calls">
            Open Calls
          </Link>
        </section>
      )}
      {access.rep && (
        <div className="page30-final-actions">
          <Link className="figma-button" to="/app/reports" search={{ period: "daily" }}>
            Daily report history
          </Link>
          <Link className="figma-button" to="/app/coaching" search={{ view: "progress" }}>
            My coaching progress
          </Link>
          <Link className="figma-button" to="/app" search={{ view: "coaching" }}>
            Coaching activity
          </Link>
        </div>
      )}
    </div>
  );
}
