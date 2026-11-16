import { createFileRoute } from "@tanstack/react-router";
import { ReportsIndex } from "@/components/app/coaching/ReportsIndex";
import type { ReportPeriod } from "@/lib/coaching/report-views";

export const Route = createFileRoute("/app/reports")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { focus?: string; period?: ReportPeriod; report?: string } => ({
    focus: typeof search.focus === "string" ? search.focus : undefined,
    period: search.period === "daily" || search.period === "weekly" ? search.period : undefined,
    report: typeof search.report === "string" ? search.report : undefined,
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { focus, period, report } = Route.useSearch();
  return <ReportsIndex key={period} focusId={focus} cadence={period} reportId={report} />;
}
