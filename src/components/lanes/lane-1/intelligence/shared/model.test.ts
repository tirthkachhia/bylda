import { describe, expect, it } from "vitest";
import {
  ForbiddenForRoleError,
  type GatedInsight,
  Insight,
  OutcomeAssociation,
  Pattern,
} from "@/lib/data";
import {
  associatedWith,
  confidenceCell,
  countByStatus,
  importantToday,
  insightForPattern,
  isForbidden,
  isOpenPattern,
  repInitials,
  shortDate,
} from "./model";

const insight = (over: Partial<Insight>): Insight => ({
  id: "i",
  kind: "pattern",
  headline: "h",
  body: null,
  confidence: "medium",
  sampleSize: 60,
  sampleLabel: null,
  callsAnalyzed: 486,
  affectedRepIds: [],
  evidence: [],
  action: null,
  causalTested: false,
  tone: "info",
  tag: null,
  createdAt: "2026-09-30T08:00:00Z",
  ...over,
});
const ok = (i: Insight): GatedInsight => ({ state: "insight", insight: i });

const assoc = (over: Partial<OutcomeAssociation>): OutcomeAssociation => ({
  behaviorKey: "b",
  behaviorName: "B",
  outcome: "advanced",
  withRate: 0.6,
  withoutRate: 0.3,
  nWith: 100,
  nWithout: 100,
  nClosed: 200,
  confidence: "high",
  confounders: [],
  ...over,
});

const pattern = (over: Partial<Pattern>): Pattern => ({
  id: "p",
  scope: "team",
  headline: "P",
  confidence: "medium",
  sampleSize: 10,
  firstSeenAt: "2026-09-08",
  behaviorKey: "k",
  affectedRepIds: ["u_mia"],
  ...over,
});

describe("importantToday", () => {
  it("drops insufficient and single-rep insights, ranks by confidence then recency", () => {
    const list: GatedInsight[] = [
      ok(insight({ id: "old_med", createdAt: "2026-09-29T08:00:00Z" })),
      ok(insight({ id: "new_med", createdAt: "2026-09-30T08:00:00Z" })),
      ok(insight({ id: "high", confidence: "high", createdAt: "2026-09-28T08:00:00Z" })),
      ok(insight({ id: "one_rep", confidence: "high", affectedRepIds: ["u_jordan"] })),
      {
        state: "insufficient",
        id: "x",
        kind: "pattern",
        scope: "team",
        callsAnalyzed: 3,
        callsNeeded: 50,
      },
    ];
    expect(importantToday(list).map((i) => i.id)).toEqual(["high", "new_med", "old_med"]);
    expect(importantToday(list, 2)).toHaveLength(2);
  });
});

describe("patterns", () => {
  it("treats a row with no status as open, and a resolved one as closed", () => {
    expect(isOpenPattern({})).toBe(true);
    expect(isOpenPattern({ status: "fading" })).toBe(true);
    expect(isOpenPattern({ status: "resolved" })).toBe(false);
  });
  it("counts by status and ignores status-less rows", () => {
    const c = countByStatus([
      pattern({ status: "emerging" }),
      pattern({ status: "emerging" }),
      pattern({}),
      pattern({ status: "resolved" }),
    ]);
    expect(c).toEqual({ emerging: 2, confirmed: 0, fading: 0, resolved: 1 });
  });
  it("shows no confidence for a resolved or zero-call pattern", () => {
    expect(confidenceCell(pattern({ confidence: "high" }))).toBe("High");
    expect(confidenceCell(pattern({ status: "resolved" }))).toBe("—");
    expect(confidenceCell(pattern({ sampleSize: 0 }))).toBe("—");
  });
  it("matches the explaining insight by behavior and the same reps", () => {
    const i = insight({
      id: "mia",
      affectedRepIds: ["u_mia"],
      action: { type: "assign_coaching", label: "x", repId: "u_mia", behaviorKey: "k" },
    });
    expect(insightForPattern(pattern({}), [ok(i)])?.id).toBe("mia");
    expect(insightForPattern(pattern({ behaviorKey: "other" }), [ok(i)])).toBeNull();
    expect(insightForPattern(pattern({ affectedRepIds: ["u_x"] }), [ok(i)])).toBeNull();
  });
  it("builds initials and a UTC short date", () => {
    const names = new Map([
      ["a", "Mia Kowalski"],
      ["b", "Nina"],
    ]);
    expect(repInitials(["a", "b", "zz"], names)).toEqual(["MK", "N"]);
    expect(shortDate("2026-09-08")).toBe("Sep 8");
  });
});

describe("isForbidden", () => {
  it("is true only for a role refusal, not for any other error", () => {
    expect(isForbidden({ error: new ForbiddenForRoleError("team patterns", "rep") })).toBe(true);
    expect(isForbidden({ error: new Error("boom") }, { error: null })).toBe(false);
  });
});

describe("associatedWith", () => {
  it("names every strong outcome, in association language", () => {
    expect(
      associatedWith([assoc({}), assoc({ outcome: "won", withRate: 0.5, withoutRate: 0.2 })]),
    ).toBe("Stage advanced, Won");
    // …whatever order the rows arrive in.
    expect(
      associatedWith([assoc({ outcome: "won", withRate: 0.5, withoutRate: 0.2 }), assoc({})]),
    ).toBe("Stage advanced, Won");
  });
  it("says the negative direction when with < without", () => {
    expect(
      associatedWith([assoc({ outcome: "next_step_booked", withRate: 0.5, withoutRate: 0.8 })]),
    ).toBe("No next step");
  });
  it("calls a near-zero gap or low confidence a weak signal", () => {
    expect(associatedWith([assoc({ withRate: 0.47, withoutRate: 0.45 })])).toBe("Weak signal");
    expect(associatedWith([assoc({ confidence: "low" })])).toBe("Weak signal");
  });
  it("hides associations under n_closed 30", () => {
    expect(associatedWith([assoc({ nClosed: 29 })])).toBe("Not enough data");
    expect(associatedWith([])).toBe("Not enough data");
  });
});
