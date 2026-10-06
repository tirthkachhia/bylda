import { describe, expect, it } from "vitest";
import type { BehaviorDetail, Methodology, Pattern, TeamBehaviorRow } from "@/lib/data";
import {
  bestAndNeedsWork,
  detailFor,
  distribution,
  distributionTarget,
  firstName,
  methodologyRows,
  repSummaries,
} from "./tabsModel";

const detail = (over: Partial<BehaviorDetail> = {}, higherIsBetter = true): BehaviorDetail => ({
  behavior: {
    key: "k",
    name: "K",
    definition: "",
    rule: {},
    methodologyId: "m",
    enabled: true,
    higherIsBetter,
  },
  teamValue: 1,
  unit: "seconds",
  direction: "steady",
  confidence: "high",
  sampleSize: 40,
  sparkline: { points: [1, 1], yMin: 0, yMax: 2 },
  byRep: [
    { repId: "a", repName: "Theo Brandt", value: 1.8, n: 9, vsBaseline: null },
    { repId: "b", repName: "Jordan Reyes", value: 0.3, n: 12, vsBaseline: null },
    { repId: "c", repName: "Mia Kowalski", value: 1.1, n: 7, vsBaseline: null },
  ],
  evidence: [],
  callsWithBehavior: null,
  teamSize: 9,
  repSparklines: {},
  projected: [],
  examples: { avoid: null, copy: null },
  recommendedChange: null,
  affectedCalls: [],
  ...over,
});

const row = (key: string, direction: TeamBehaviorRow["direction"]): TeamBehaviorRow => ({
  behaviorKey: key,
  name: key,
  teamValue: 1,
  unit: "count",
  valueLabel: "1",
  changeLabel: "—",
  direction,
  sparkline: { points: [1], yMin: 0, yMax: 2 },
  confidence: "high",
  sampleSize: 50,
});

describe("I7 BEST / NEEDS WORK", () => {
  it("ranks by the behavior's own direction", () => {
    expect(bestAndNeedsWork(detail())).toEqual({ best: "Theo", needsWork: "Jordan" });
    expect(bestAndNeedsWork(detail({}, false))).toEqual({ best: "Jordan", needsWork: "Theo" });
  });

  it("says nothing with fewer than two reps", () => {
    expect(bestAndNeedsWork(detail({ byRep: detail().byRep.slice(0, 1) }))).toBeNull();
    expect(bestAndNeedsWork(null)).toBeNull();
  });

  it("never uses another behavior's detail (the mock loader's fallback)", () => {
    expect(detailFor(detail(), "other_key")).toBeNull();
    expect(detailFor(detail(), "k")).not.toBeNull();
  });
});

describe("I7 distribution", () => {
  it("bands reps across the fixed y-range, keeping empty bands", () => {
    const bands = distribution(detail());
    expect(bands.map((b) => b.label)).toEqual(["< 0.5s", "0.5s–1s", "1s–1.5s", "> 1.5s"]);
    expect(bands.map((b) => b.reps)).toEqual([["Jordan"], [], ["Mia"], ["Theo"]]);
  });

  it("clamps values outside the range into the end bands", () => {
    const d = detail({
      byRep: [
        { repId: "a", repName: "A", value: -1, n: 1, vsBaseline: null },
        { repId: "b", repName: "B", value: 9, n: 1, vsBaseline: null },
      ],
    });
    const bands = distribution(d);
    expect(bands[0].reps).toEqual(["A"]);
    expect(bands[3].reps).toEqual(["B"]);
  });

  it("picks the first regressing behavior, else the first row", () => {
    expect(distributionTarget([row("a", "steady"), row("b", "regressing")])?.behaviorKey).toBe("b");
    expect(distributionTarget([row("a", "steady")])?.behaviorKey).toBe("a");
    expect(distributionTarget([])).toBeNull();
  });
});

describe("I8 required behaviors", () => {
  it("keeps the methodology's enabled behaviors that are measured, in the team order", () => {
    const m = {
      behaviors: [
        { ...detail().behavior, key: "b" },
        { ...detail().behavior, key: "a" },
        { ...detail().behavior, key: "off", enabled: false },
      ],
    } as Methodology;
    const out = methodologyRows(m, [
      row("a", "steady"),
      row("x", "steady"),
      row("b", "steady"),
      row("off", "steady"),
    ]);
    expect(out.map((r) => r.behaviorKey)).toEqual(["a", "b"]);
  });
});

describe("I10 BY REP", () => {
  const p = (id: string, reps: string[], status?: Pattern["status"]): Pattern => ({
    id,
    scope: "rep",
    headline: id,
    confidence: "medium",
    sampleSize: 12,
    firstSeenAt: "2026-09-01",
    behaviorKey: null,
    affectedRepIds: reps,
    status,
  });

  it("names each rep's most pressing status, emerging first", () => {
    const out = repSummaries([
      p("1", ["mia"], "fading"),
      p("2", ["mia"], "emerging"),
      p("3", ["nina"], "resolved"),
      p("4", ["alex"]),
    ]);
    expect(out).toEqual([
      { repId: "mia", count: 1, status: "emerging", label: "1 emerging", tone: "attention" },
      { repId: "nina", count: 1, status: "resolved", label: "1 resolved", tone: "improve" },
      { repId: "alex", count: 1, status: null, label: "1 pattern", tone: "neutral" },
    ]);
  });

  it("uses first names", () => {
    expect(firstName("Theo Brandt")).toBe("Theo");
    expect(firstName("  Priya ")).toBe("Priya");
  });
});
