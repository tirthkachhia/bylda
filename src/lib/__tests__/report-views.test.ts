import { describe, expect, it } from "vitest";
import {
  comparableTrends,
  latestCompletedReport,
  reportPeriod,
  weeklyTeamReports,
  type SavedReport,
} from "../coaching/report-views";
import type { GuidelineTrend } from "../coaching/types";

function report(overrides: Partial<SavedReport> = {}): SavedReport {
  return {
    id: "rep-week",
    rep_id: "rep",
    period_start: "2026-11-06",
    period_end: "2026-11-13",
    created_at: "2026-11-13T12:00:00Z",
    call_count: 3,
    status: "completed",
    report: {
      headline: "Ask one follow-up",
      patterns: [],
      strength: null,
      drill: { focus: "", line_to_practice: "", guideline_code: null },
      since_last: null,
      strip: [],
    },
    ...overrides,
  };
}

describe("saved report views", () => {
  it("classifies only the existing one-day and seven-day report windows", () => {
    expect(reportPeriod(report({ period_start: "2026-11-12" }))).toBe("daily");
    expect(reportPeriod(report())).toBe("weekly");
    expect(reportPeriod(report({ period_start: "2026-10-14" }))).toBeUndefined();
  });

  it("keeps the latest completed period and revision despite a newer pending report", () => {
    const latest = report({ period_start: "2026-11-12" });
    const rows = [
      report({ status: "running", period_start: "2026-11-13", period_end: "2026-11-14" }),
      report({ period_start: "2026-11-11", period_end: "2026-11-12" }),
      latest,
      report({ period_start: "2026-11-12", created_at: "2026-11-13T10:00:00Z" }),
    ];
    expect(latestCompletedReport(rows)).toBe(latest);
  });

  it("keeps one completed revision per rep in the exact selected week", () => {
    const current = report();
    const teammate = report({ id: "teammate", rep_id: "teammate" });
    expect(
      weeklyTeamReports(
        [
          current,
          report({ id: "new-pending", status: "running", created_at: "2026-11-13T13:00:00Z" }),
          report({ id: "old-revision", created_at: "2026-11-13T10:00:00Z" }),
          teammate,
          report({ id: "other-period", period_start: "2026-11-05", period_end: "2026-11-12" }),
        ],
        "2026-11-06 – 2026-11-13",
      ),
    ).toEqual([current, teammate]);
  });

  it("uses saved comparisons only with a comparable window, sufficient samples and no limitation", () => {
    const trend: GuidelineTrend = {
      guideline_id: "ask",
      code: "G1",
      title: "Ask one follow-up",
      change: 0.5,
      current: { followed: 2, partial: 0, missed: 0, judged: 2 },
      previous: { followed: 1, partial: 0, missed: 1, judged: 2 },
    };
    const row = report();
    const since = {
      previous_period: { start: "2026-10-30", end: "2026-11-06" },
      calls: { previous: 3, current: 3 },
      moved: [trend],
      drill: null,
    };
    row.report!.since_last = since;
    expect(comparableTrends(row)).toEqual([trend]);
    row.report!.since_last = { ...since, limitation: "Insufficient coverage" };
    expect(comparableTrends(row)).toEqual([]);
    row.report!.since_last = {
      ...since,
      previous_period: { ...since.previous_period, end: "2026-11-07" },
    };
    expect(comparableTrends(row)).toEqual([]);
    row.report!.since_last = {
      ...since,
      moved: [{ ...trend, previous: { ...trend.previous, judged: 1 } }],
    };
    expect(comparableTrends(row)).toEqual([]);
  });
});
