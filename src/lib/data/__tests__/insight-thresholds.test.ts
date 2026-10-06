import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataCtx } from "../core/context";
import { setSourceOverride } from "../core/source";
import { loadHomeFeed, loadInsights } from "../insights/hooks";
import { INSIGHTS } from "../mocks/intelligence";
import { loadBrief, loadReports } from "../reports/hooks";
import { loadRoomInsights } from "../rooms/hooks";
import {
  REP_INSIGHT_MIN_CALLS,
  TEAM_PATTERN_MIN_CALLS,
  gateInsight,
  isInsightSufficient,
  type Insight,
} from "../types";

/**
 * CLAUDE.md §13.13: a rep insight needs ≥ 10 analyzed calls, a team pattern ≥ 50.
 * Below that the data layer returns the "insufficient" state — never the insight.
 */
const DANA: DataCtx = {
  userId: "u_dana",
  orgId: "org_acme",
  workspaceId: "ws_acme",
  teamId: "team_mm",
  role: "manager",
};
const JORDAN: DataCtx = { ...DANA, userId: "u_jordan", role: "rep" };

const repInsight = (callsAnalyzed: number): Insight => ({
  ...INSIGHTS[0],
  kind: "regression",
  affectedRepIds: ["u_jordan"],
  callsAnalyzed,
});
const teamPattern = (callsAnalyzed: number): Insight => ({
  ...INSIGHTS[1],
  kind: "pattern",
  affectedRepIds: [],
  callsAnalyzed,
});

beforeAll(() => setSourceOverride("mock"));
afterAll(() => setSourceOverride(null));

describe("insight thresholds", () => {
  it("thresholds are 10 (rep) and 50 (team)", () => {
    expect(REP_INSIGHT_MIN_CALLS).toBe(10);
    expect(TEAM_PATTERN_MIN_CALLS).toBe(50);
  });

  it("rep insight: 9 calls → insufficient, 10 → insight", () => {
    expect(gateInsight(repInsight(9))).toEqual({
      state: "insufficient",
      id: INSIGHTS[0].id,
      kind: "regression",
      scope: "rep",
      callsAnalyzed: 9,
      callsNeeded: 10,
    });
    const ok = gateInsight(repInsight(10));
    expect(ok.state).toBe("insight");
    expect(ok.state === "insight" && ok.insight.headline).toBe(INSIGHTS[0].headline);
  });

  it("team pattern: 49 calls → insufficient, 50 → pattern", () => {
    const low = gateInsight(teamPattern(49));
    expect(low.state).toBe("insufficient");
    expect(low.state === "insufficient" && [low.scope, low.callsNeeded]).toEqual(["team", 50]);
    expect(gateInsight(teamPattern(50)).state).toBe("insight");
  });

  it("an insufficient item carries no headline or body", () => {
    const g = gateInsight(repInsight(3));
    expect(g).not.toHaveProperty("insight");
    expect(g).not.toHaveProperty("headline");
    expect(g).not.toHaveProperty("body");
  });

  it("useInsights gates every item", async () => {
    const gated = await loadInsights(DANA);
    for (const g of gated) {
      if (g.state === "insight") expect(isInsightSufficient(g.insight)).toBe(true);
    }
    expect(gated.some((g) => g.state === "insufficient")).toBe(true);
  });

  it("home feed and briefs never carry a below-threshold insight", async () => {
    const feed = await loadHomeFeed(DANA);
    expect(feed.items.every((i) => isInsightSufficient(i.insight))).toBe(true);
    for (const r of await loadReports(DANA)) {
      const b = await loadBrief(DANA, r.id);
      for (const s of b?.sections ?? []) expect(s.insights.every(isInsightSufficient)).toBe(true);
    }
  });

  it("O3 #objection-watch fixtures meet the thresholds", async () => {
    const gated = await loadRoomInsights(DANA, "objection-watch");
    expect(gated.length).toBe(4);
    expect(gated.every((g) => g.state === "insight")).toBe(true);
  });

  it("a rep sees no named peer in the room insights", async () => {
    const gated = await loadRoomInsights(JORDAN, "objection-watch");
    for (const g of gated) {
      if (g.state === "insight") expect(g.insight.affectedRepIds).toEqual(["u_jordan"]);
    }
  });
});
