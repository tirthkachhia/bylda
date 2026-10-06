import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadRepScores } from "../behaviors/hooks";
import {
  gateTeamMedian,
  mapBehaviorScore,
  MIN_REPS_FOR_TEAM_MEDIAN,
  type BehaviorScoreRow,
} from "../behaviors/map";
import type { DataCtx } from "../core/context";
import { setSourceOverride } from "../core/source";
import { loadMyProgress, loadRepComparison, loadRepHome, loadRepSummary } from "../team/hooks";

/**
 * CLAUDE.md §4 / §13.6: a rep may see the team median only as an anonymous
 * aggregate, and only when the team has at least 8 reps. Below that the data
 * layer returns `null`, so no screen can ever receive the number.
 */
const row = (team_size: number | null): BehaviorScoreRow => ({
  subject_type: "rep",
  subject_id: "u_jordan",
  behavior_key: "pause_after_objection",
  behavior_name: "Pause after objection",
  unit: "seconds",
  value: 0.4,
  team_median: 1.3,
  team_size,
  direction: "regressing",
  confidence: "high",
  sample_size: 41,
  series: [0.9, 0.7, 0.6, 0.4],
  y_min: 0,
  y_max: 3,
  period_start: "2026-09-28",
});

const JORDAN: DataCtx = {
  userId: "u_jordan",
  orgId: "org_acme",
  workspaceId: "ws_acme",
  teamId: "team_mm",
  role: "rep",
};

/** Exactly the BehaviorScore fields — nothing that could carry per-rep values. */
const SCORE_KEYS = [
  "behaviorKey",
  "confidence",
  "direction",
  "name",
  "sampleSize",
  "sparkline",
  "teamMedian",
  "unit",
  "value",
];

describe("team median gate", () => {
  it("threshold is 8 reps", () => {
    expect(MIN_REPS_FOR_TEAM_MEDIAN).toBe(8);
  });

  it("team of 7 → null", () => {
    expect(mapBehaviorScore(row(7)).teamMedian).toBeNull();
  });

  it("team of 8 → value", () => {
    expect(mapBehaviorScore(row(8)).teamMedian).toBe(1.3);
  });

  it("fails closed: unknown team size or a non-finite median → null", () => {
    expect(mapBehaviorScore(row(null)).teamMedian).toBeNull();
    expect(gateTeamMedian(Number.NaN, 12)).toBeNull();
    expect(gateTeamMedian(null, 12)).toBeNull();
    expect(gateTeamMedian(undefined, undefined)).toBeNull();
  });
});

describe("rep-scoped hooks never expose per-rep values", () => {
  beforeAll(() => setSourceOverride("mock"));
  afterAll(() => setSourceOverride(null));

  it("scores carry only the rep's own value + one anonymous median", async () => {
    const own = await loadRepScores(JORDAN, "u_jordan");
    const askedForPeer = await loadRepScores(JORDAN, "u_alex");
    expect(own.length).toBeGreaterThan(0);
    // a rep asking for a peer still gets their own numbers, never the peer's
    expect(askedForPeer).toEqual(own);
    for (const s of own) {
      expect(Object.keys(s).sort()).toEqual(SCORE_KEYS);
      expect(s.teamMedian === null || typeof s.teamMedian === "number").toBe(true);
    }
    // Jordan's Mid-Market AE team has 9 reps → the median is allowed
    expect(own.every((s) => typeof s.teamMedian === "number")).toBe(true);
  });

  it("summary / home / progress expose the same shape, and no peer arrays", async () => {
    const summary = await loadRepSummary(JORDAN, "u_alex");
    const home = await loadRepHome(JORDAN);
    const progress = await loadMyProgress(JORDAN);
    const all = [
      ...(summary?.strengths ?? []),
      ...(summary?.leaks ?? []),
      ...(home?.scores ?? []),
      ...progress.scores,
    ];
    expect(all.length).toBeGreaterThan(0);
    for (const s of all) expect(Object.keys(s).sort()).toEqual(SCORE_KEYS);
    expect(JSON.stringify([summary, home, progress])).not.toMatch(/"values"|"repIds"|u_alex/);
  });

  it("the per-rep comparison is refused outright", async () => {
    await expect(loadRepComparison(JORDAN, "team_mm")).rejects.toThrow(/FORBIDDEN_FOR_ROLE/);
  });
});
