import { describe, expect, it } from "vitest";
import type { Brief, Insight, ReportListItem, Viewer } from "@/lib/data";
import {
  evidenceIn,
  filterReports,
  isManagerBriefAllowed,
  reportsForViewer,
  selectedReport,
} from "./reportModel";

// Synthetic contract inputs for tests only; never used to override shared demo data.
const rows: ReportListItem[] = [
  "daily_manager",
  "weekly_manager",
  "weekly_rep",
  "team",
  "behavior",
].map((kind, i) => ({
  id: `${i}`,
  kind,
  title: kind,
  period: "test",
  generatedAt: "2026-09-30T08:00:00Z",
})) as ReportListItem[];
const viewer = (role: Viewer["role"]) => ({ role }) as Viewer;
describe("Lane 6 report selection and privacy", () => {
  it("derives category counts without changing source rows", () => {
    expect(filterReports(rows, "All")).toBe(rows);
    expect(filterReports(rows, "Daily briefs")).toHaveLength(1);
    expect(filterReports(rows, "Weekly")).toHaveLength(2);
    expect(filterReports(rows, "Team")[0].kind).toBe("team");
    expect(filterReports(rows, "Behavior")[0].kind).toBe("behavior");
    expect(filterReports(rows, "Shared with me")).toEqual([]);
    expect(rows).toHaveLength(5);
  });
  it("reps cannot open manager documents or see manager/team index entries", () => {
    expect(isManagerBriefAllowed(viewer("rep"))).toBe(false);
    expect(reportsForViewer(rows, viewer("rep")).map((r) => r.kind)).toEqual(["weekly_rep"]);
    expect(isManagerBriefAllowed(viewer("manager"))).toBe(true);
    expect(reportsForViewer(rows, viewer("manager"))).toBe(rows);
  });
  it("uses the selected report ID rather than silently loading a different report", () => {
    expect(selectedReport({ reportId: "actual-id" }, "daily_manager")).toBe("actual-id");
    for (const value of [undefined, "", "  ", 42])
      expect(selectedReport({ reportId: value }, "daily_manager")).toBe("daily_manager");
  });
  it("does not expose evidence from below-threshold rep or team statements", () => {
    const insight = (kind: Insight["kind"], callsAnalyzed: number, id: string): Insight =>
      ({ id, kind, callsAnalyzed, affectedRepIds: ["rep"], evidence: [{ callId: id }] }) as Insight;
    const brief = {
      sections: [
        {
          insights: [
            insight("regression", 9, "hidden-rep"),
            insight("regression", 10, "rep"),
            insight("pattern", 49, "hidden-team"),
            insight("pattern", 50, "team"),
          ],
        },
      ],
    } as Brief;
    expect(evidenceIn(brief).map((e) => e.callId)).toEqual(["rep", "team"]);
    expect(brief.sections[0].insights).toHaveLength(4);
  });
});
