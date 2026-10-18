import { describe, expect, it } from "vitest";
import type { Block, Exchange } from "../../../supabase/functions/_shared/coaching/exchanges";
import {
  coachingValue,
  findLearningMoments,
  qualityScore,
  summarize,
  withDeltas,
  type ExchangeScore,
} from "../../../supabase/functions/_shared/coaching/trajectory";

const block = (speaker: Block["speaker"]): Block => ({
  speaker,
  turnIndexes: [0],
  text: "…",
  toneLabels: ["neutral"],
  start_s: 0,
  end_s: 1,
  overlap: false,
});
const ex = (index: number, hasRep = true): Exchange => ({
  index,
  rep: hasRep ? block("rep") : null,
  customer: block("customer"),
  start_s: index * 10,
  end_s: index * 10 + 7,
});

const level = (score: number, confidence = 0.9) => ({
  score,
  probabilities: { "0": 0, "1": 0, "2": 0, "3": 0 },
  confidence,
});

const scored = (
  index: number,
  temp: number,
  extra: Partial<ExchangeScore> = {},
  confidence = 0.9,
): ExchangeScore => ({
  exchange_index: index,
  temperature: level(temp, confidence),
  truncated: false,
  ...extra,
});

describe("withDeltas", () => {
  it("adds null for the first exchange and signed deltas after, sorted by index", () => {
    const out = withDeltas([scored(2, 0.5), scored(0, 1.0), scored(1, 2.0)]);
    expect(out.map((s) => s.exchange_index)).toEqual([0, 1, 2]);
    expect(out.map((s) => s.delta)).toEqual([null, 1, -1.5]);
  });
});

describe("findLearningMoments", () => {
  const exchanges = [ex(0, false), ex(1), ex(2), ex(3), ex(4)];

  it("ranks a confident Hot-to-Cold drop after a weak move first", () => {
    const scores = withDeltas([
      scored(0, 1.0),
      scored(1, 2.0, { rep_move: level(2.5) }),
      scored(2, 2.6, { rep_move: level(2.8) }),
      scored(3, 0.4, { rep_move: level(0.5), risk: { probability: 0.1 } }),
      scored(4, 0.5, { rep_move: level(1.8) }),
    ]);
    const moments = findLearningMoments(scores, exchanges);
    expect(moments[0]).toMatchObject({
      exchange_index: 3,
      type: "temperature_drop",
      delta: -2.2,
      low_confidence: false,
      rep_move: 0.5,
    });
    expect(moments[0].score).toBeGreaterThan(2);
  });

  it("flags risk on its own and never counts a rep-less baseline exchange", () => {
    const scores = withDeltas([
      scored(0, 2.5),
      scored(1, 0.2, { rep_move: level(2.0), risk: { probability: 0.95 } }),
    ]);
    const baselineDrop = findLearningMoments(scores, [ex(0, false), ex(1, false)]);
    expect(baselineDrop).toEqual([]);
    const risk = findLearningMoments(
      withDeltas([
        scored(0, 1.5),
        scored(1, 1.6, { rep_move: level(2.2), risk: { probability: 0.8 } }),
      ]),
      [ex(0, false), ex(1)],
    );
    expect(risk).toHaveLength(1);
    expect(risk[0]).toMatchObject({ type: "risk_flag", exchange_index: 1, score: 0.5 });
  });

  it("weights a drop by the confidence of its own exchange, not the one before", () => {
    // Exchange 0 is an uncertain reading; exchange 1 is a clear drop. The drop must
    // not be buried by the earlier uncertainty.
    const scores = withDeltas([
      scored(0, 2.0, {}, 0.3),
      scored(1, 0.5, { rep_move: level(1.5) }, 0.9),
      scored(2, 0.4, { rep_move: level(0.2) }),
      scored(3, 0.3, { rep_move: level(0.4) }),
    ]);
    const exchanges = [ex(0, false), ex(1), ex(2), ex(3)];
    const all = findLearningMoments(scores, exchanges);
    expect(all).toHaveLength(3);
    const drop = all.find((m) => m.exchange_index === 1)!;
    expect(drop.type).toBe("temperature_drop");
    expect(drop.low_confidence).toBe(false);
    expect(drop.confidence).toBe(0.9);
    expect(all.map((m) => m.exchange_index)).toEqual([1, 2, 3]);
    expect(findLearningMoments(scores, exchanges, 2).map((m) => m.exchange_index)).toEqual([1, 2]);
  });

  it("marks and down-weights a drop whose own reading is uncertain", () => {
    const scores = withDeltas([
      scored(0, 2.0, {}, 0.9),
      scored(1, 0.5, { rep_move: level(1.5) }, 0.3),
      scored(2, 0.4, { rep_move: level(0.2) }),
      scored(3, 0.3, { rep_move: level(0.4) }),
    ]);
    const exchanges = [ex(0, false), ex(1), ex(2), ex(3)];
    const all = findLearningMoments(scores, exchanges);
    const drop = all.find((m) => m.exchange_index === 1)!;
    expect(drop.low_confidence).toBe(true);
    expect(drop.confidence).toBe(0.3);
    // A -1.5 drop at confidence 0.3 scores below the two confident weak moves, by design.
    expect(all.map((m) => m.exchange_index)).toEqual([2, 3, 1]);
  });

  it("returns nothing on a flat, clean call", () => {
    const scores = withDeltas([scored(0, 1.5), scored(1, 1.6, { rep_move: level(2.5) })]);
    expect(findLearningMoments(scores, [ex(0, false), ex(1)])).toEqual([]);
  });
});

describe("summarize", () => {
  const exchanges = [ex(0, false), ex(1), ex(2), ex(3), ex(4), ex(5), ex(6), ex(7), ex(8)];
  const curve = withDeltas([
    scored(0, 0.8),
    scored(1, 1.4, { rep_move: level(2.0), playbook_step: { choice: "g1", confidence: 0.9 } }),
    scored(2, 2.1, { rep_move: level(2.6), playbook_step: { choice: "g2", confidence: 0.8 } }),
    scored(3, 2.7, { rep_move: level(2.9), playbook_step: { choice: "g2", confidence: 0.7 } }),
    scored(4, 1.2, {
      rep_move: level(0.6),
      risk: { probability: 0.9 },
      playbook_step: { choice: "none", confidence: 0.9 },
    }),
    scored(5, 1.0, { rep_move: level(1.5), playbook_step: { choice: "g3", confidence: 0.3 } }),
    scored(6, 0.9, { rep_move: level(1.9) }),
    scored(7, 0.8, { rep_move: level(2.0) }),
    scored(8, 0.7, { rep_move: level(2.1) }),
  ]);

  it("computes peak, final, biggest drop, coverage, risks, and labels a lost warm call high", () => {
    const summary = summarize(curve, exchanges, 4, 1500);
    expect(summary.exchange_count).toBe(9);
    expect(summary.peak_temperature).toBe(2.7);
    expect(summary.final_temperature).toBe(0.7);
    expect(summary.biggest_drop).toBe(-1.5);
    expect(summary.biggest_drop_exchange_index).toBe(4);
    expect(summary.playbook_coverage).toBe(0.5); // g1, g2 confident; g3 below floor; none excluded
    expect(summary.risk_count).toBe(1);
    expect(summary.rep_move_average).toBeCloseTo(1.95, 2);
    expect(summary.coaching_value_label).toBe("high");
    expect(summary.coaching_value_score).toBeGreaterThan(50);
    expect(summary.coaching_value_score).toBeLessThanOrEqual(100);
    expect(summary.quality_score).toBeGreaterThan(0);
    expect(summary.quality_score).toBeLessThanOrEqual(100);
    expect(summary.features.loss).toBe(2);
  });

  it("returns null coverage without guidelines and handles an empty call", () => {
    expect(summarize(curve, exchanges, 0, null).playbook_coverage).toBeNull();
    const empty = summarize([], [], 0, null);
    expect(empty).toMatchObject({
      exchange_count: 0,
      peak_temperature: 0,
      final_temperature: 0,
      biggest_drop: 0,
      biggest_drop_exchange_index: null,
      coaching_value_label: "low",
    });
  });
});

describe("coachingValue and qualityScore", () => {
  it("labels the three archetypes", () => {
    expect(
      coachingValue({
        exchangeCount: 2,
        durationSeconds: 60,
        peak: 0.3,
        final: 0.2,
        biggestDrop: -0.1,
        biggestDropConfident: true,
      }).label,
    ).toBe("low");
    expect(
      coachingValue({
        exchangeCount: 12,
        durationSeconds: 900,
        peak: 1.2,
        final: 1.0,
        biggestDrop: -0.4,
        biggestDropConfident: true,
      }).label,
    ).toBe("medium");
    expect(
      coachingValue({
        exchangeCount: 12,
        durationSeconds: 900,
        peak: 2.4,
        final: 0.9,
        biggestDrop: -0.8,
        biggestDropConfident: true,
      }).label,
    ).toBe("high");
    expect(
      coachingValue({
        exchangeCount: 6,
        durationSeconds: 900,
        peak: 1.4,
        final: 1.3,
        biggestDrop: -1.2,
        biggestDropConfident: false,
      }).label,
    ).toBe("medium");
  });

  it("keeps scores within 0..100 and rewards good moves, coverage, low risk, warm finish", () => {
    const strong = qualityScore({
      repMoveAverage: 2.8,
      playbookCoverage: 0.9,
      riskRate: 0,
      finalTemperature: 2.6,
    });
    const weak = qualityScore({
      repMoveAverage: 0.6,
      playbookCoverage: 0.1,
      riskRate: 0.5,
      finalTemperature: 0.3,
    });
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBeLessThanOrEqual(100);
    expect(weak).toBeGreaterThanOrEqual(0);
    expect(
      qualityScore({
        repMoveAverage: null,
        playbookCoverage: null,
        riskRate: 0,
        finalTemperature: 0,
      }),
    ).toBe(50);
  });
});

describe("coachingValue with compliance risk", () => {
  it("rates a flat call with many risky statements as high, and lets risk lift a cold short call", () => {
    const base = {
      exchangeCount: 20,
      durationSeconds: 900,
      peak: 1.0,
      final: 0.9,
      biggestDrop: -0.2,
      biggestDropConfident: true,
    };
    expect(coachingValue({ ...base, riskCount: 0 }).label).toBe("medium");
    expect(coachingValue({ ...base, riskCount: 5 }).label).toBe("high");
    expect(coachingValue({ ...base, riskCount: 5 }).score).toBeGreaterThan(
      coachingValue({ ...base, riskCount: 0 }).score,
    );
    // short, cold, but risky: not "low"
    expect(
      coachingValue({
        ...base,
        exchangeCount: 6,
        durationSeconds: 120,
        peak: 0.4,
        final: 0.3,
        riskCount: 2,
      }).label,
    ).toBe("medium");
  });
});
