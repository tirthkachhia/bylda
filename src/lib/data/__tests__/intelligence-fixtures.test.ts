import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataCtx } from "../core/context";
import { setSourceOverride } from "../core/source";
import { loadInsights } from "../insights/hooks";
import {
  loadBehaviorDetail,
  loadBehaviors,
  loadObjectionStats,
  loadPatterns,
  loadRepScores,
  loadTeamBehaviors,
} from "../behaviors/hooks";
import { loadOutcomeAssociations } from "../outcomes/hooks";
import { BEHAVIOR_DETAILS } from "../mocks/intelligence";
import { MM_REP_IDS } from "../mocks/people";
import {
  OUTCOME_MIN_CLOSED,
  patternShowsConfidence,
  type BehaviorDetail,
  type GatedInsight,
} from "../types";

/**
 * Fixtures match Figma I1 Intelligence Home (27:298) and I3 Emerging Patterns (27:567) in row
 * count and variety. Where a frame draws fewer rows than its own total ("12 tracked · 5 shown"),
 * the fixture holds the total and the screen shows the slice.
 */
const DANA: DataCtx = {
  userId: "u_dana",
  orgId: "org_acme",
  workspaceId: "ws_acme",
  teamId: "team_mm",
  role: "manager",
};
const JORDAN: DataCtx = { ...DANA, userId: "u_jordan", role: "rep" };
const MIA: DataCtx = { ...DANA, userId: "u_mia", role: "rep" };

const idOf = (g: GatedInsight) => (g.state === "insight" ? g.insight.id : g.id);

beforeAll(() => setSourceOverride("mock"));
afterAll(() => setSourceOverride(null));

describe("I3 Emerging Patterns — the six drawn rows", () => {
  it("has the rows in Figma's order, with a name per row", async () => {
    const rows = await loadPatterns(DANA);
    expect(rows.map((p) => p.headline)).toEqual([
      "Defending price before diagnosing",
      "Demo before discovery",
      "Late economic-buyer contact",
      "Pausing after objections",
      "Monologues on ROI",
      "Talking over prospects in demos",
    ]);
    expect(new Set(rows.map((p) => p.id)).size).toBe(6);
  });

  it("matches the CALLS, CONF., FIRST SEEN and REPS columns", async () => {
    const rows = await loadPatterns(DANA);
    expect(rows.map((p) => p.sampleSize)).toEqual([34, 5, 7, 38, 4, 0]);
    expect(rows.map((p) => p.confidence)).toEqual([
      "high",
      "medium",
      "low",
      "high",
      "medium",
      "high",
    ]);
    expect(rows.map((p) => p.firstSeenAt)).toEqual([
      "2026-09-08",
      "2026-09-21",
      "2026-09-24",
      "2026-08-02",
      "2026-07-30",
      "2026-07-12",
    ]);
    expect(rows.map((p) => p.affectedRepIds)).toEqual([
      ["u_jordan", "u_alex", "u_mia"],
      ["u_mia"],
      ["u_sarah", "u_nina"],
      ["u_theo", "u_priya"],
      ["u_alex"],
      ["u_nina"],
    ]);
  });

  it("covers every confidence level and several scopes", async () => {
    const rows = await loadPatterns(DANA);
    expect(new Set(rows.map((p) => p.confidence))).toEqual(new Set(["low", "medium", "high"]));
    expect(new Set(rows.map((p) => p.scope))).toEqual(new Set(["team", "rep", "methodology"]));
    expect((await loadPatterns(DANA, "rep")).map((p) => p.id)).toEqual([
      "pat_demo_before_discovery",
      "pat_roi_monologue",
      "pat_talking_over_demo",
    ]);
  });

  it("every pattern points at a tracked behavior", async () => {
    const keys = new Set((await loadBehaviors(DANA)).map((b) => b.key));
    for (const p of await loadPatterns(DANA)) expect(keys.has(p.behaviorKey ?? "")).toBe(true);
  });

  it("is never served to a rep", async () => {
    await expect(loadPatterns(JORDAN)).rejects.toThrow();
  });
});

describe("I3 rulings over Figma", () => {
  it("tab counts come from the six drawn rows, not Figma's 11", async () => {
    const rows = await loadPatterns(DANA);
    const count = (s: string) => rows.filter((p) => p.status === s).length;
    expect({
      all: rows.length,
      emerging: count("emerging"),
      confirmed: count("confirmed"),
      fading: count("fading"),
      resolved: count("resolved"),
    }).toEqual({ all: 6, emerging: 2, confirmed: 2, fading: 1, resolved: 1 });
    // I1 "Emerging patterns 5" is the open ones
    expect(rows.filter((p) => p.status !== "resolved")).toHaveLength(5);
  });

  it("Confirmed rows have n ≥ 30 and Emerging rows n < 20, as the lifecycle legend says", async () => {
    for (const p of await loadPatterns(DANA)) {
      if (p.status === "confirmed") expect(p.sampleSize).toBeGreaterThanOrEqual(30);
      if (p.status === "emerging") expect(p.sampleSize).toBeLessThan(20);
    }
  });

  it("the Resolved row has 0 calls and shows no confidence; every other row does", async () => {
    const rows = await loadPatterns(DANA);
    const resolved = rows.find((p) => p.status === "resolved")!;
    expect(resolved.headline).toBe("Talking over prospects in demos");
    expect(resolved.sampleSize).toBe(0);
    expect(patternShowsConfidence(resolved)).toBe(false);
    expect(rows.filter((p) => !patternShowsConfidence(p))).toEqual([resolved]);
  });

  it("every row has its rule line, and only Demo before discovery has the selected panel", async () => {
    const rows = await loadPatterns(DANA);
    expect(rows.map((p) => p.rule)).toEqual([
      "Answers price objection < 1s, then discounts",
      "Screen share before 5 min, < 3 questions",
      "EB not on a call by stage 3",
      "≥ 1.5s before responding",
      "> 2 min rep speech on value",
      "Overlap > 300ms in demo stage",
    ]);
    expect(rows.filter((p) => p.selected).map((p) => p.id)).toEqual(["pat_demo_before_discovery"]);
    expect(rows[1].selected).toEqual({
      frequency: "5 of 7 Mia first calls · 1 of 38 rest of team",
      associatedOutcome: "Next step 40% vs team 74%",
      trend: "New this month",
    });
  });
});

describe("Interruptions is 0.9 everywhere", () => {
  it("I2 detail, I1/I7 row and the series all agree, and I2 still reads +18%", async () => {
    const detail = (await loadBehaviorDetail(DANA, "interrupting_during_objections"))!;
    const row = (await loadTeamBehaviors(DANA)).find(
      (r) => r.behaviorKey === "interrupting_during_objections",
    )!;
    expect(detail.teamValue).toBe(0.9);
    expect(row.teamValue).toBe(0.9);
    expect(row.valueLabel).toBe("0.9 / obj");
    const pts = detail.sparkline.points;
    expect(pts.at(-1)).toBe(0.9);
    // the lane derives I2's "TEAM TREND · 30D" from first → last
    expect(Math.round(((pts.at(-1)! - pts[0]) / pts[0]) * 100)).toBe(18);
    expect(row.changeLabel).toBe("+18%");
    expect(detail.projected.every((v) => v > 0.9)).toBe(true);
  });
});

describe("team behaviors list (I1 table)", () => {
  it("returns the 12 tracked behaviors, Figma's five first", async () => {
    const rows = await loadTeamBehaviors(DANA);
    expect(rows).toHaveLength(12);
    expect(new Set(rows.map((r) => r.behaviorKey)).size).toBe(12);
    expect(rows.slice(0, 5).map((r) => r.behaviorKey)).toEqual([
      "discovery_depth",
      "interrupting_during_objections",
      "next_step_booked",
      "talk_share",
      "economic_buyer_by_s3",
    ]);
    const tracked = (await loadBehaviors(DANA)).map((b) => b.key).sort();
    expect(rows.map((r) => r.behaviorKey).sort()).toEqual(tracked);
  });

  it("the five shown rows carry Figma's labels, change and direction", async () => {
    const rows = (await loadTeamBehaviors(DANA)).slice(0, 5);
    expect(rows.map((r) => [r.valueLabel, r.changeLabel, r.direction])).toEqual([
      ["2.6 / topic", "+0.4", "improving"],
      ["0.9 / obj", "+18%", "regressing"],
      ["74%", "+3 pts", "steady"],
      ["52 / 48", "−2 pts", "steady"],
      ["61% by stage 3", "—", "steady"],
    ]);
  });

  it("the shown rows are the same numbers as their details", async () => {
    for (const r of (await loadTeamBehaviors(DANA)).slice(0, 5)) {
      const d = BEHAVIOR_DETAILS[r.behaviorKey];
      expect([r.teamValue, r.unit, r.direction, r.sparkline]).toEqual([
        d.teamValue,
        d.unit,
        d.direction,
        d.sparkline,
      ]);
    }
  });

  it("every row has a sample size, a confidence and a fixed y-range its points sit inside", async () => {
    for (const r of await loadTeamBehaviors(DANA)) {
      expect(r.sampleSize).toBeGreaterThan(0);
      expect(["low", "medium", "high"]).toContain(r.confidence);
      expect(r.sparkline.yMax).toBeGreaterThan(r.sparkline.yMin);
      for (const p of r.sparkline.points) {
        expect(p).toBeGreaterThanOrEqual(r.sparkline.yMin);
        expect(p).toBeLessThanOrEqual(r.sparkline.yMax);
      }
    }
  });

  it("is never served to a rep", async () => {
    await expect(loadTeamBehaviors(JORDAN)).rejects.toThrow();
  });
});

describe("I3 selected pattern — Demo before discovery", () => {
  it("has the evidence quote, the Medium confidence and the coaching action for Mia", async () => {
    const mia = (await loadInsights(DANA)).find((g) => idOf(g) === "ins_mia_demo_first");
    if (mia?.state !== "insight") throw new Error("gated");
    const i = mia.insight;
    expect(i.confidence).toBe("medium");
    expect(i.sampleSize).toBe(7);
    expect(i.evidence).toHaveLength(1);
    expect(i.evidence[0]).toMatchObject({ timestamp: "04:10", speaker: "rep" });
    expect(i.action).toMatchObject({ type: "assign_coaching", repId: "u_mia" });
  });

  it("is Mia's own and nobody else's: a peer rep never sees it", async () => {
    const ids = (c: DataCtx) => loadInsights(c).then((r) => r.map(idOf));
    expect(await ids(MIA)).toContain("ins_mia_demo_first");
    expect(await ids(JORDAN)).not.toContain("ins_mia_demo_first");
  });
});

describe("I1 Intelligence Home", () => {
  it("has three Important-today cards that clear the gate, one per tone", async () => {
    const all = await loadInsights(DANA);
    const cards = ["ins_discovery_outcome", "ins_price_discount_losses", "ins_call_length"].map(
      (id) => all.find((g) => idOf(g) === id),
    );
    for (const g of cards) expect(g?.state).toBe("insight");
    const ins = cards.map((g) => (g?.state === "insight" ? g.insight : null));
    expect(ins.map((i) => i?.confidence)).toEqual(["high", "medium", "medium"]);
    expect(ins.map((i) => i?.tone)).toEqual(["info", "regress", "neutral"]);
    expect(ins.map((i) => i?.sampleLabel)).toEqual([
      "n = 19 won · 23 lost · 142 discovery calls",
      "n = 20 deals",
      "n = 486 calls",
    ]);
    expect(ins.map((i) => i?.action?.type ?? null)).toEqual(["review_calls", null, null]);
  });

  it("every insight carries a sample size, and none is causal", async () => {
    for (const g of await loadInsights(DANA)) {
      if (g.state !== "insight") continue;
      expect(g.insight.sampleSize).toBeGreaterThan(0);
      expect(g.insight.causalTested).toBe(false);
      expect(g.insight.headline).not.toMatch(/\bcaus/i);
    }
  });

  it("a rep sees none of the team cards", async () => {
    const seen = (await loadInsights(JORDAN)).map(idOf);
    for (const id of ["ins_discovery_outcome", "ins_price_discount_losses", "ins_call_length"])
      expect(seen).not.toContain(id);
  });

  it("tracks 12 behaviors, all enabled, and 6 objection types", async () => {
    const b = await loadBehaviors(DANA);
    expect(b).toHaveLength(12);
    expect(b.every((x) => x.enabled)).toBe(true);
    expect(new Set(b.map((x) => x.key)).size).toBe(12);
    expect(await loadObjectionStats(DANA)).toHaveLength(6);
  });

  it("the 5 shown behaviors differ: both directions, three shapes, a fixed range each", async () => {
    const shown = [
      "discovery_depth",
      "interrupting_during_objections",
      "next_step_booked",
      "talk_share",
      "economic_buyer_by_s3",
    ];
    const rows = await Promise.all(shown.map((k) => loadBehaviorDetail(DANA, k)));
    const d = rows.map((r) => r!);
    expect(d.map((r) => r.behavior.key)).toEqual(shown);
    expect(d.map((r) => r.direction)).toEqual([
      "improving",
      "regressing",
      "steady",
      "steady",
      "steady",
    ]);
    const first = (r: (typeof d)[number]) => r.sparkline.points[0];
    const last = (r: (typeof d)[number]) => r.sparkline.points.at(-1)!;
    expect(last(d[0])).toBeGreaterThan(first(d[0])); // discovery rises
    expect(last(d[1])).toBeGreaterThan(first(d[1])); // interruptions rise
    expect(last(d[3])).toBeLessThan(first(d[3])); // talk share falls
    expect(last(d[4])).toBe(first(d[4])); // economic buyer ends where it began
    for (const r of d) {
      for (const p of r.sparkline.points) {
        expect(p).toBeGreaterThanOrEqual(r.sparkline.yMin);
        expect(p).toBeLessThanOrEqual(r.sparkline.yMax);
      }
      expect(r.byRep.length).toBeGreaterThan(1);
    }
    // two different behaviors never share one fixture any more
    expect(new Set(d.map((r) => r.teamValue)).size).toBe(5);
  });

  it("each shown behavior has an outcome association that clears the n ≥ 30 floor", async () => {
    for (const key of [
      "discovery_depth",
      "interrupting_during_objections",
      "next_step_booked",
      "talk_share",
      "economic_buyer_by_s3",
    ]) {
      const rows = await loadOutcomeAssociations(DANA, key);
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) expect(r.nClosed).toBeGreaterThanOrEqual(OUTCOME_MIN_CLOSED);
    }
    expect((await loadOutcomeAssociations(DANA, "discovery_depth")).map((r) => r.outcome)).toEqual([
      "won",
      "advanced",
    ]);
  });
});

describe("Behavior detail — one fixture per behavior, never another's", () => {
  it("every one of the 12 tracked behaviors resolves to its own detail", async () => {
    const behaviors = await loadBehaviors(DANA);
    expect(behaviors).toHaveLength(12);
    const details = await Promise.all(behaviors.map((b) => loadBehaviorDetail(DANA, b.key)));
    details.forEach((d, i) => {
      expect(d?.behavior.key).toBe(behaviors[i].key);
      expect(d?.byRep.length).toBeGreaterThan(1);
    });
    // no two behaviors share a by-rep list
    const shapes = details.map((d) => JSON.stringify(d!.byRep));
    expect(new Set(shapes).size).toBe(12);
  });

  it("a behavior with no detail fixture returns null, not a borrowed one", async () => {
    const key = "pause_after_objection";
    const saved = BEHAVIOR_DETAILS[key];
    delete BEHAVIOR_DETAILS[key];
    try {
      expect(await loadBehaviorDetail(DANA, key)).toBeNull();
    } finally {
      BEHAVIOR_DETAILS[key] = saved;
    }
    expect((await loadBehaviorDetail(DANA, key))?.behavior.key).toBe(key);
  });

  it("every team-behaviors row is the same numbers as its detail", async () => {
    for (const r of await loadTeamBehaviors(DANA)) {
      const d = (await loadBehaviorDetail(DANA, r.behaviorKey))!;
      expect([r.name, r.teamValue, r.unit, r.direction, r.confidence, r.sampleSize]).toEqual([
        d.behavior.name,
        d.teamValue,
        d.unit,
        d.direction,
        d.confidence,
        d.sampleSize,
      ]);
      expect(r.sparkline).toEqual(d.sparkline);
    }
  });

  it("by-rep entries are real Mid-Market reps, each once", async () => {
    for (const b of await loadBehaviors(DANA)) {
      const ids = (await loadBehaviorDetail(DANA, b.key))!.byRep.map((r) => r.repId);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(MM_REP_IDS).toContain(id);
    }
  });
});

describe("I7 Team behaviors — BEST / NEEDS WORK", () => {
  /** I7 reads these as the extremes of `value` through `higherIsBetter`, not by list position. */
  const bestAndWorst = (d: BehaviorDetail) => {
    const sorted = [...d.byRep].sort((a, b) =>
      d.behavior.higherIsBetter ? b.value - a.value : a.value - b.value,
    );
    const first = (name: string) => name.split(" ")[0];
    return [first(sorted[0].repName), first(sorted.at(-1)!.repName)];
  };

  it("matches the nine rows Figma 51:1420 draws", async () => {
    const drawn: [string, string, string][] = [
      ["discovery_depth", "Theo", "Mia"],
      ["pause_after_objection", "Theo", "Jordan"],
      ["interrupting_during_objections", "Theo", "Jordan"],
      ["early_discounting", "Priya", "Jordan"],
      ["next_step_booked", "Priya", "Sarah"],
      ["talk_share", "Theo", "Jordan"],
      ["monologue_over_2min", "Nina", "Alex"],
      ["economic_buyer_by_s3", "Theo", "Sarah"],
      // Figma's BEST is "Dana's team", not a rep (GAP) — Priya is best among reps
      ["recap_before_pricing", "Priya", "Marcus"],
    ];
    for (const [key, best, worst] of drawn) {
      const d = (await loadBehaviorDetail(DANA, key))!;
      expect([key, ...bestAndWorst(d)]).toEqual([key, best, worst]);
      // no tie at either end, so BEST / NEEDS WORK is never a coin flip
      const vals = d.byRep.map((r) => r.value);
      const ends = [Math.max(...vals), Math.min(...vals)];
      for (const v of ends) expect(vals.filter((x) => x === v)).toHaveLength(1);
    }
  });

  it("the pause distribution puts all nine reps in Figma's buckets, around the 1.1s team value", async () => {
    const d = (await loadBehaviorDetail(DANA, "pause_after_objection"))!;
    expect(d.byRep).toHaveLength(9);
    expect(new Set(d.byRep.map((r) => r.repId))).toEqual(new Set(MM_REP_IDS));
    const bucket = (v: number) =>
      v < 0.5 ? "<0.5" : v < 1 ? "0.5-1" : v <= 1.5 ? "1-1.5" : ">1.5";
    const by = (b: string) =>
      d.byRep
        .filter((r) => bucket(r.value) === b)
        .map((r) => r.repName.split(" ")[0])
        .sort();
    expect(by("<0.5")).toEqual(["Jordan", "Sarah"]);
    expect(by("0.5-1")).toEqual(["Leo", "Mia"]); // Figma's "Luis" is the fixture's Leo
    expect(by("1-1.5")).toEqual(["Alex", "Marcus", "Nina"]);
    expect(by(">1.5")).toEqual(["Priya", "Theo"]);
    const vals = d.byRep.map((r) => r.value).sort((a, b) => a - b);
    expect(vals[4]).toBe(d.teamValue);
  });

  it("pause has one fixed y-range, whose quarters are Figma's 0.5s bands", async () => {
    const d = (await loadBehaviorDetail(DANA, "pause_after_objection"))!;
    const row = (await loadTeamBehaviors(DANA)).find(
      (r) => r.behaviorKey === "pause_after_objection",
    )!;
    const mine = (await loadRepScores(JORDAN, "u_jordan")).find(
      (s) => s.behaviorKey === "pause_after_objection",
    )!;
    for (const s of [d.sparkline, row.sparkline, mine.sparkline])
      expect([s.yMin, s.yMax]).toEqual([0, 2]);
    for (const r of d.byRep) expect(r.value).toBeLessThanOrEqual(d.sparkline.yMax);
  });

  it("Jordan's by-rep pause is his own R2 score", async () => {
    const d = (await loadBehaviorDetail(DANA, "pause_after_objection"))!;
    expect(d.byRep.find((r) => r.repId === "u_jordan")).toMatchObject({ value: 0.4, n: 41 });
  });
});

describe("I9 Outcome patterns / I11 Prospect patterns", () => {
  it("I9 has the hero and the two cards, in Figma's order", async () => {
    const rows = await loadPatterns(DANA, "outcome");
    expect(rows.map((p) => [p.headline, p.confidence, p.sampleSize])).toEqual([
      [
        "Won deals contain more second-level discovery questions — 3.4 per call vs 1.6 in losses.",
        "high",
        42,
      ],
      ["Deals with a mutual plan by call 3 closed 11 days faster.", "low", 14],
      ["4 of 6 stalled deals stalled right after an unhandled price objection.", "medium", 6],
    ]);
  });

  it("I11 has the five prospect-signal rows, with WHAT FOLLOWS, in Figma's order", async () => {
    const rows = await loadPatterns(DANA, "prospect");
    expect(
      rows.map((p) => [p.headline, p.sampleSize, p.confidence, p.selected?.associatedOutcome]),
    ).toEqual([
      ["CFO on the call", 22, "medium", "Rollout-risk objection by min 20 (68%)"],
      ["“We already use Gong”", 31, "medium", "Asks for integration detail next (55%)"],
      ["Prospect talk share > 55% in discovery", 104, "high", "Next step booked 81% vs 58%"],
      ["Multiple stakeholders (3+)", 46, "low", "Longer cycle, higher close rate"],
      ["Board / budget freeze language", 3, "low", null],
    ]);
    expect(rows.at(-1)!.selected?.trend).toBe("New — watching");
  });

  it("both are aggregates: no rep named, no causal wording, every behavior key tracked", async () => {
    const keys = new Set((await loadBehaviors(DANA)).map((b) => b.key));
    const rows = [
      ...(await loadPatterns(DANA, "outcome")),
      ...(await loadPatterns(DANA, "prospect")),
    ];
    expect(new Set(rows.map((p) => p.id)).size).toBe(rows.length);
    for (const p of rows) {
      expect(p.affectedRepIds).toEqual([]);
      expect(p.sampleSize).toBeGreaterThan(0);
      expect(p.headline).not.toMatch(/\bcaus/i);
      if (p.behaviorKey) expect(keys.has(p.behaviorKey)).toBe(true);
    }
  });

  it("stay out of the unscoped list, so I1 and I3 are unchanged", async () => {
    const all = await loadPatterns(DANA);
    expect(all).toHaveLength(6);
    expect(all.some((p) => p.scope === "outcome" || p.scope === "prospect")).toBe(false);
  });

  it("are never served to a rep", async () => {
    await expect(loadPatterns(JORDAN, "outcome")).rejects.toThrow();
    await expect(loadPatterns(JORDAN, "prospect")).rejects.toThrow();
  });
});
