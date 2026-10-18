import { describe, expect, it, vi } from "vitest";
import type { Block, Exchange } from "../../../supabase/functions/_shared/coaching/exchanges";
import type { JevResponse } from "../../../supabase/functions/_shared/coaching/jev-client";
import {
  answersToScore,
  buildScoreArtifacts,
  scoreExchanges,
} from "../../../supabase/functions/_shared/coaching/score-call";

const block = (speaker: Block["speaker"], text: string): Block => ({
  speaker,
  turnIndexes: [0],
  text,
  toneLabels: ["neutral"],
  start_s: 0,
  end_s: 1,
  overlap: false,
});
const ex = (index: number, rep: string | null, customer: string | null): Exchange => ({
  index,
  rep: rep ? block("rep", rep) : null,
  customer: customer ? block("customer", customer) : null,
  start_s: index * 10,
  end_s: index * 10 + 7,
});

const exchanges = [
  ex(0, null, "Hello?"),
  ex(1, "Hi, this is Ethan.", "Who?"),
  ex(2, "From Acme, about coverage.", "Oh. What's it cost?"),
  ex(3, "Fifty a month.", "Too much."),
];

const scoreAnswer = (score: number, confidence = 0.8) => ({
  type: "score" as const,
  score,
  probabilities: {},
  confidence,
});

/** Fake Jev: temperature from a table, rep answers only when asked. */
function fakeAsk(temps: number[], opts: { failAt?: number[] } = {}) {
  return vi.fn(async (state: unknown, questions: Record<string, unknown>): Promise<JevResponse> => {
    const k = (state as { latest_exchange_number: number }).latest_exchange_number - 1;
    if (opts.failAt?.includes(k)) throw new Error("boom");
    const answers: JevResponse["answers"] = { customer_temperature: scoreAnswer(temps[k]) };
    if ("rep_move" in questions) answers.rep_move = scoreAnswer(k === 3 ? 0.5 : 2.5);
    if ("rep_introduced_risk" in questions)
      answers.rep_introduced_risk = { type: "noul", noul: k === 3 ? 0.9 : 0.05 };
    if ("playbook_step" in questions)
      answers.playbook_step = {
        type: "choice",
        choice: k === 1 ? "g1" : "none",
        probabilities: {},
        confidence: 0.9,
      };
    return { model: "jev-1.13.0", answers, usage: { input_tokens: 100 * (k + 1) } };
  });
}

describe("answersToScore", () => {
  it("maps all four answers and clamps to the level range", () => {
    const score = answersToScore(
      2,
      {
        model: "m",
        usage: {},
        answers: {
          customer_temperature: scoreAnswer(4.6),
          rep_move: scoreAnswer(-0.2),
          playbook_step: { type: "choice", choice: "g2", probabilities: {}, confidence: 0.7 },
          rep_introduced_risk: { type: "noul", noul: 1.2 },
        },
      },
      true,
    );
    expect(score).toMatchObject({
      exchange_index: 2,
      truncated: true,
      temperature: { score: 4 },
      rep_move: { score: 0 },
      playbook_step: { choice: "g2", confidence: 0.7 },
      risk: { probability: 1 },
    });
  });

  it("returns null without a usable temperature answer", () => {
    expect(answersToScore(0, { model: "m", usage: {}, answers: {} }, false)).toBeNull();
    expect(
      answersToScore(
        0,
        { model: "m", usage: {}, answers: { customer_temperature: { type: "noul", noul: 0.5 } } },
        false,
      ),
    ).toBeNull();
  });
});

describe("scoreExchanges", () => {
  it("asks once per exchange prefix, sums tokens, and skips rep questions on the baseline", async () => {
    const ask = fakeAsk([0.5, 1.2, 2.4, 0.6]);
    const result = await scoreExchanges(exchanges, ["Open warmly", "Discover first"], ask, {
      concurrency: 2,
      skip: false,
    });
    expect(ask).toHaveBeenCalledTimes(4);
    expect(result.scores.map((s) => s.exchange_index)).toEqual([0, 1, 2, 3]);
    expect(result.scores[0].rep_move).toBeUndefined();
    expect(result.scores[1].playbook_step?.choice).toBe("g1");
    expect(result.scores[3].risk?.probability).toBe(0.9);
    expect(result.totalInputTokens).toBe(100 + 200 + 300 + 400);
    expect(result.model).toBe("jev-1.13.0");
    expect(result.failed).toEqual([]);
    // the state for k=2 contains exactly exchanges 1..3
    const [state] = ask.mock.calls.find(
      ([s]) => (s as { latest_exchange_number: number }).latest_exchange_number === 3,
    )!;
    expect((state as { exchanges: unknown[] }).exchanges).toHaveLength(3);
  });

  it("skips a single failed exchange but throws when too many fail", async () => {
    const one = await scoreExchanges(exchanges, [], fakeAsk([0.5, 1, 2, 1], { failAt: [2] }), {
      skip: false,
    });
    expect(one.failed).toEqual([2]);
    expect(one.scores.map((s) => s.exchange_index)).toEqual([0, 1, 3]);
    await expect(
      scoreExchanges(exchanges, [], fakeAsk([0.5, 1, 2, 1], { failAt: [1, 2] }), { skip: false }),
    ).rejects.toThrow(/failed for 2 of 4/);
  });

  it("handles an empty call", async () => {
    const result = await scoreExchanges([], [], fakeAsk([]));
    expect(result).toEqual({
      scores: [],
      totalInputTokens: 0,
      model: null,
      failed: [],
      skipped: [],
    });
  });

  it("skips back-channel exchanges by default, always scores the last one, and reports progress", async () => {
    // Exchange 0: baseline "Hello?" (1 word) → skipped. 1: "Who?" + 4-word rep → skipped.
    // 2: customer says 4 words → scored. 3: last → scored regardless.
    const ask = fakeAsk([0.5, 1.2, 2.4, 0.6]);
    const seen: number[] = [];
    const result = await scoreExchanges(exchanges, [], ask, {
      onScore: (s) => {
        seen.push(s.exchange_index);
      },
    });
    expect(ask).toHaveBeenCalledTimes(2);
    expect(result.skipped).toEqual([0, 1]);
    expect(result.scores.map((s) => s.exchange_index)).toEqual([2, 3]);
    expect(seen.sort()).toEqual([2, 3]);
  });

  it("windows the state by default so late requests stay small", async () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      ex(i, `rep says many words here number ${i}`, `customer replies with several words ${i}`),
    );
    const ask = fakeAsk(Array(30).fill(1.5));
    await scoreExchanges(many, [], ask, { windowSize: 5 });
    const last = ask.mock.calls.find(
      ([s]) => (s as { latest_exchange_number: number }).latest_exchange_number === 30,
    )!;
    const state = last[0] as { exchanges: Array<{ n: number }>; earlier_exchanges_omitted: number };
    expect(state.exchanges.map((e) => e.n)).toEqual([1, 2, 26, 27, 28, 29, 30]);
    expect(state.earlier_exchanges_omitted).toBe(23);
  });
});

describe("buildScoreArtifacts", () => {
  it("produces deltas, a summary, and moments from scores", async () => {
    const { scores } = await scoreExchanges(
      exchanges,
      ["g1", "g2"],
      fakeAsk([0.5, 1.2, 2.4, 0.6]),
      {
        skip: false,
      },
    );
    const artifacts = buildScoreArtifacts(scores, exchanges, 2, 600);
    expect(artifacts.scored.map((s) => s.delta)).toEqual([null, 0.7, 1.2, -1.8]);
    expect(artifacts.summary.peak_temperature).toBe(2.4);
    expect(artifacts.summary.biggest_drop_exchange_index).toBe(3);
    expect(artifacts.summary.playbook_coverage).toBe(0.5);
    expect(artifacts.summary.risk_count).toBe(1);
    expect(artifacts.moments[0]).toMatchObject({ exchange_index: 3, type: "temperature_drop" });
  });
});

describe("eligibleIndexes and chunked scoring", () => {
  it("lets a caller score a subset of the eligible plan", async () => {
    const { eligibleIndexes } =
      await import("../../../supabase/functions/_shared/coaching/score-call");
    const plan = eligibleIndexes(exchanges);
    expect(plan.eligible).toEqual([2, 3]);
    expect(plan.skipped).toEqual([0, 1]);
    const ask = fakeAsk([0.5, 1.2, 2.4, 0.6]);
    const result = await scoreExchanges(exchanges, [], ask, { indexes: [3] });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(result.scores.map((s) => s.exchange_index)).toEqual([3]);
    expect(result.skipped).toEqual([]);
    // out-of-range indexes are ignored rather than crashing
    const none = await scoreExchanges(exchanges, [], fakeAsk([]), { indexes: [9] });
    expect(none.scores).toEqual([]);
  });
});
