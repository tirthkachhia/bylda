import { describe, expect, it } from "vitest";
import type { ObjectionStat, OutcomeAssociation } from "@/lib/data";
import {
  buildMatrix,
  cellTone,
  gapPoints,
  matrixHasValues,
  pointsLabel,
  strongestAssociation,
  summarizeObjections,
} from "./outcomes";

const assoc = (over: Partial<OutcomeAssociation> = {}): OutcomeAssociation => ({
  behaviorKey: "b",
  behaviorName: "Behavior",
  outcome: "won",
  withRate: 0.5,
  withoutRate: 0.3,
  nWith: 30,
  nWithout: 30,
  nClosed: 60,
  confidence: "medium",
  confounders: [],
  ...over,
});

const stat = (over: Partial<ObjectionStat> = {}): ObjectionStat => ({
  label: "Price",
  count: 100,
  callCount: 50,
  handledWellRate: 0.5,
  trend: "steady",
  sampleSize: 100,
  confidence: "high",
  ...over,
});

describe("matrix cells", () => {
  it("gap is with minus without, in whole points", () => {
    expect(gapPoints({ withRate: 0.41, withoutRate: 0.18 })).toBe(23);
    expect(pointsLabel(23)).toBe("+23 pts");
    expect(pointsLabel(-9)).toBe("−9 pts");
    expect(pointsLabel(0)).toBe("0 pts");
  });

  it("hides the number under 30 closed outcomes (§4)", () => {
    const [row] = buildMatrix([assoc({ nClosed: 29 })]);
    expect(row.cells[2]).toEqual({ kind: "insufficient", nClosed: 29 });
    expect(matrixHasValues([row])).toBe(false);
  });

  it("shows it at exactly 30", () => {
    const [row] = buildMatrix([assoc({ nClosed: 30 })]);
    expect(row.cells[2]).toMatchObject({ kind: "value", points: 20, label: "+20 pts" });
  });

  it("marks a pair with no row as none, and keeps funnel column order", () => {
    const [row] = buildMatrix([assoc({ outcome: "advanced" })]);
    expect(row.cells.map((c) => c.kind)).toEqual(["none", "value", "none", "none"]);
  });

  it("never colours low confidence or a gap under 5 points", () => {
    expect(cellTone(20, "low", false)).toBe("neutral");
    expect(cellTone(4, "high", false)).toBe("neutral");
    expect(cellTone(-4, "high", false)).toBe("neutral");
  });

  it("colours by direction, and reads closed-lost the other way round", () => {
    expect(cellTone(12, "medium", false)).toBe("improve");
    expect(cellTone(-12, "medium", false)).toBe("regress");
    expect(cellTone(-12, "medium", true)).toBe("improve");
    expect(cellTone(12, "medium", true)).toBe("regress");
  });

  it("keeps the row with more closed outcomes when a pair repeats", () => {
    const [row] = buildMatrix([
      assoc({ nClosed: 40, withRate: 0.6 }),
      assoc({ nClosed: 90, withRate: 0.4 }),
    ]);
    expect(row.cells[2]).toMatchObject({ kind: "value", nClosed: 90, points: 10 });
  });

  it("carries confidence and n on every value cell", () => {
    const [row] = buildMatrix([assoc({ confidence: "high", nClosed: 77 })]);
    expect(row.cells[2]).toMatchObject({ confidence: "high", nClosed: 77 });
  });
});

describe("I6 live edge", () => {
  it("picks the biggest gap among sufficient, Medium+ rows", () => {
    const best = strongestAssociation([
      assoc({ behaviorKey: "small", withRate: 0.55 }),
      assoc({ behaviorKey: "big", withRate: 0.8 }),
      assoc({ behaviorKey: "thin", withRate: 0.99, nClosed: 7 }),
      assoc({ behaviorKey: "unsure", withRate: 0.99, confidence: "low" }),
    ]);
    expect(best?.behaviorKey).toBe("big");
  });

  it("is null when nothing qualifies", () => {
    expect(strongestAssociation([assoc({ nClosed: 5 }), assoc({ withRate: 0.31 })])).toBeNull();
    expect(strongestAssociation([])).toBeNull();
  });
});

describe("objection summary", () => {
  it("works the numbers out from the rows", () => {
    const s = summarizeObjections(
      [
        stat({ label: "Price", count: 300, handledWellRate: 0.4 }),
        stat({ label: "Timing", count: 100, handledWellRate: 0.8 }),
        stat({ label: "Unclassified", count: 100, handledWellRate: null }),
      ],
      250,
    );
    expect(s.total).toBe(500);
    expect(s.perCall).toBe(2);
    expect(s.handledOf).toBe(400);
    expect(s.handledRate).toBeCloseTo(0.5);
    expect(s.top).toEqual({ label: "Price", share: 0.6 });
  });

  it("says nothing it can't know: no analyzed count, no rated rows, no rows", () => {
    expect(summarizeObjections([stat({ handledWellRate: null })], null)).toMatchObject({
      perCall: null,
      handledRate: null,
      handledOf: 0,
    });
    expect(summarizeObjections([], 10)).toMatchObject({ total: 0, perCall: 0, top: null });
  });
});
