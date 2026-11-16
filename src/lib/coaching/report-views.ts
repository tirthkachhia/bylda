import type { GuidelineTrend, RepReportRow } from "./types";

export type ReportPeriod = "daily" | "weekly";
export type SavedReport = Pick<
  RepReportRow,
  | "id"
  | "rep_id"
  | "period_start"
  | "period_end"
  | "call_count"
  | "status"
  | "report"
  | "created_at"
> &
  Pick<RepReportRow, "adherence">;

function daysBetween(start: string, end: string) {
  return (Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86_400_000;
}

export function reportPeriod(row: SavedReport): ReportPeriod | undefined {
  const days = daysBetween(row.period_start, row.period_end);
  if (days === 1) return "daily";
  if (days === 7) return "weekly";
}

export function savedPeriod(row: SavedReport) {
  return row.period_start + " – " + row.period_end;
}

export function completedReport(row: SavedReport) {
  return row.status === "completed" && Boolean(row.report);
}

export function latestCompletedReport(rows: SavedReport[]) {
  return rows.filter(completedReport).reduce<SavedReport | undefined>((best, row) => {
    if (
      !best ||
      row.period_end > best.period_end ||
      (row.period_end === best.period_end && row.created_at > best.created_at)
    )
      return row;
    return best;
  }, undefined);
}

export function weeklyTeamReports(rows: SavedReport[], period: string) {
  const byRep = new Map<string, SavedReport>();
  for (const row of rows) {
    if (reportPeriod(row) !== "weekly" || savedPeriod(row) !== period || !completedReport(row))
      continue;
    const previous = byRep.get(row.rep_id);
    if (!previous || row.created_at > previous.created_at) byRep.set(row.rep_id, row);
  }
  return [...byRep.values()];
}

export function comparableTrends(row: SavedReport): GuidelineTrend[] {
  const since = row.report?.since_last;
  const previous = since?.previous_period;
  if (
    since?.limitation ||
    !previous ||
    previous.end > row.period_start ||
    daysBetween(previous.start, previous.end) !== daysBetween(row.period_start, row.period_end)
  )
    return [];
  return [...(since.moved ?? []), ...(since.drill ? [since.drill] : [])].filter(
    (trend) =>
      trend.change !== null &&
      Number.isFinite(trend.change) &&
      trend.current.judged >= 2 &&
      trend.previous.judged >= 2,
  );
}
