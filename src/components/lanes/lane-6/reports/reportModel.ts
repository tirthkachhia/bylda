import {
  isInsightSufficient,
  type Brief,
  type BriefKind,
  type ReportListItem,
  type Viewer,
} from "@/lib/data";

export const reportTabs = [
  "All",
  "Daily briefs",
  "Weekly",
  "Team",
  "Behavior",
  "Shared with me",
] as const;
export type ReportTab = (typeof reportTabs)[number];
export const kindLabel: Record<BriefKind, string> = {
  daily_manager: "Daily",
  daily_rep: "Daily · rep",
  weekly_manager: "Weekly",
  weekly_rep: "Weekly · rep",
  team: "Team",
  behavior: "Behavior",
};
export function filterReports(rows: ReportListItem[], tab: ReportTab) {
  if (tab === "Daily briefs") return rows.filter((r) => r.kind.startsWith("daily_"));
  if (tab === "Weekly") return rows.filter((r) => r.kind.startsWith("weekly_"));
  if (tab === "Team") return rows.filter((r) => r.kind === "team");
  if (tab === "Behavior") return rows.filter((r) => r.kind === "behavior");
  return tab === "Shared with me" ? [] : rows;
}
export function reportsForViewer(rows: ReportListItem[], viewer: Viewer) {
  return viewer.role === "rep"
    ? rows.filter((r) => r.kind === "daily_rep" || r.kind === "weekly_rep")
    : rows;
}
export function isManagerBriefAllowed(viewer: Viewer) {
  return viewer.role !== "rep";
}
export function sectionId(index: number) {
  return `report-section-${index}`;
}
export function evidenceIn(brief: Brief) {
  return brief.sections.flatMap((s) =>
    s.insights.filter(isInsightSufficient).flatMap((i) => i.evidence),
  );
}
export function selectedReport(search: Record<string, unknown>, fallback: string) {
  return typeof search.reportId === "string" && search.reportId.trim() ? search.reportId : fallback;
}
