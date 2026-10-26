import { describe, expect, it } from "vitest";
import {
  buildCallStrip,
  buildSinceLast,
  followRate,
  renderSinceLast,
  tallyByGuideline,
  type AdherenceRow,
} from "../../../supabase/functions/_shared/coaching/report-trend";
import type { ReportCall } from "../../../supabase/functions/_shared/coaching/report-input";

const row = (
  call_id: string,
  guideline_id: string,
  status: AdherenceRow["status"],
): AdherenceRow => ({
  call_id,
  guideline_id,
  status,
});
const G = [
  { id: "g1", code: "G1", title: "Confirm DOB" },
  { id: "g2", code: "G2", title: "Ask about income before quoting" },
  { id: "g3", code: "G3", title: "Explain MIB process" },
];

describe("tallyByGuideline and followRate", () => {
  it("counts judged statuses and ignores not_applicable", () => {
    const t = tallyByGuideline([
      row("c1", "g1", "followed"),
      row("c2", "g1", "partial"),
      row("c3", "g1", "missed"),
      row("c4", "g1", "not_applicable"),
    ]);
    expect(t.get("g1")).toEqual({ followed: 1, partial: 1, missed: 1, judged: 3 });
    expect(followRate(t.get("g1")!)).toBe(0.5);
    expect(followRate({ followed: 0, partial: 0, missed: 0, judged: 0 })).toBeNull();
  });
});

describe("buildSinceLast", () => {
  const previous = [
    row("p1", "g2", "missed"),
    row("p2", "g2", "missed"),
    row("p3", "g2", "followed"),
    row("p1", "g1", "followed"),
    row("p2", "g1", "followed"),
    row("p1", "g3", "followed"),
    row("p2", "g3", "followed"),
  ];
  const current = [
    row("c1", "g2", "followed"),
    row("c2", "g2", "followed"),
    row("c3", "g2", "partial"),
    row("c1", "g1", "followed"),
    row("c2", "g1", "followed"),
    row("c1", "g3", "missed"),
    row("c2", "g3", "missed"),
  ];

  it("reports the drill separately and ranks real movements, improvement first", () => {
    const s = buildSinceLast({
      guidelines: G,
      current,
      previous,
      currentCalls: 3,
      previousCalls: 3,
      previousPeriod: { start: "2026-10-01", end: "2026-10-08" },
      drillGuidelineId: "g2",
    });
    expect(s.drill?.code).toBe("G2");
    expect(s.drill?.current).toEqual({ followed: 2, partial: 1, missed: 0, judged: 3 });
    expect(s.drill?.change).toBeCloseTo(0.5, 2);
    // G1 is flat and excluded; G3 slipped from 2/2 to 0/2.
    expect(s.moved.map((t) => [t.code, t.change])).toEqual([["G3", -1]]);
    const text = renderSinceLast(s);
    expect(text).toContain(
      'Last drill G2 "Ask about income before quoting": now 2+1 partial of 3, before 1 of 3.',
    );
    expect(text).toContain('G3 "Explain MIB process": slipped, now 0 of 2, before 2 of 2.');
  });

  it("requires enough judged calls on both sides before calling something a movement", () => {
    const s = buildSinceLast({
      guidelines: G,
      current: [row("c1", "g3", "missed")],
      previous: [row("p1", "g3", "followed"), row("p2", "g3", "followed")],
      currentCalls: 1,
      previousCalls: 2,
      previousPeriod: null,
      drillGuidelineId: null,
    });
    expect(s.moved).toEqual([]);
    expect(renderSinceLast(s)).toContain("No guideline moved meaningfully");
  });

  it("says so when there is nothing to compare against", () => {
    const s = buildSinceLast({
      guidelines: G,
      current,
      previous: [],
      currentCalls: 3,
      previousCalls: 0,
      previousPeriod: null,
      drillGuidelineId: null,
    });
    expect(s.moved).toEqual([]);
    expect(renderSinceLast(s)).toContain("no earlier period to compare against");
  });
});

describe("buildCallStrip", () => {
  it("orders calls by time and attaches the drilled guideline's status", () => {
    const calls: ReportCall[] = [
      {
        call_id: "c2",
        started_at: "2026-10-12T10:00:00Z",
        duration_seconds: 600,
        coaching_value_label: "low",
        quality_score: 70,
        risk_count: 0,
        peak_temperature: 1,
        final_temperature: 1,
        rep_move_average: 2,
      },
      {
        call_id: "c1",
        started_at: "2026-10-10T10:00:00Z",
        duration_seconds: 900,
        coaching_value_label: "high",
        quality_score: 40,
        risk_count: 2,
        peak_temperature: 2,
        final_temperature: 1,
        rep_move_average: 1.5,
      },
    ];
    const strip = buildCallStrip(
      calls,
      [row("c1", "g2", "missed"), row("c2", "g1", "followed")],
      "g2",
    );
    expect(strip.map((s) => [s.call_id, s.quality_score, s.drill_status])).toEqual([
      ["c1", 40, "missed"],
      ["c2", 70, null],
    ]);
    expect(buildCallStrip(calls, [], null)[0].drill_status).toBeNull();
  });
});
