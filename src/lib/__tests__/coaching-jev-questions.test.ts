import { describe, expect, it } from "vitest";
import type { Exchange, Block } from "../../../supabase/functions/_shared/coaching/exchanges";
import {
  buildJevRequest,
  DEFAULT_CALL_GOAL,
  fitToBudget,
  guidelinesFromPlaybook,
  REP_MOVE_QUESTION,
  selectWindow,
  TEMPERATURE_LEVELS,
  TEMPERATURE_MAX,
  TEMPERATURE_QUESTION,
  type RenderedExchange,
} from "../../../supabase/functions/_shared/coaching/jev-questions";

const block = (speaker: Block["speaker"], text: string, start_s = 0): Block => ({
  speaker,
  turnIndexes: [0],
  text,
  toneLabels: ["neutral"],
  start_s,
  end_s: start_s + 2,
  overlap: false,
});

const exchange = (index: number, rep: string | null, customer: string | null): Exchange => ({
  index,
  rep: rep ? block("rep", rep, index * 10) : null,
  customer: customer ? block("customer", customer, index * 10 + 5) : null,
  start_s: index * 10,
  end_s: index * 10 + 7,
});

const exchanges = [
  exchange(0, null, "Hello?"),
  exchange(1, "Hi Verna, this is Ethan with Acme.", "Who is this?"),
  exchange(2, "We spoke last week about your coverage.", "Oh right. What does it cost?"),
  exchange(3, "Fifty a month. Can we set up a time Thursday?", null),
];

describe("question definitions", () => {
  it("temperature has five ordered levels and rep_move four, each with summary and signals", () => {
    for (const q of [TEMPERATURE_QUESTION, REP_MOVE_QUESTION]) {
      expect(q.type).toBe("score");
      for (const level of q.criteria) {
        expect(level.summary.length).toBeGreaterThan(10);
        expect(level.signals.length).toBeGreaterThanOrEqual(2);
      }
    }
    expect(REP_MOVE_QUESTION.criteria).toHaveLength(4);
    expect(TEMPERATURE_QUESTION.criteria).toHaveLength(TEMPERATURE_LEVELS.length);
    expect(TEMPERATURE_MAX).toBe(4);
    expect(TEMPERATURE_QUESTION.criteria[0].summary).toMatch(/^Cold/);
    expect(TEMPERATURE_QUESTION.criteria[3].summary).toMatch(/^Critical/);
    expect(TEMPERATURE_QUESTION.criteria[4].summary).toMatch(/^Committed/);
  });
});

describe("guidelinesFromPlaybook", () => {
  it("splits lines, strips list markers, drops short lines, caps count and length", () => {
    const content = [
      "Our process:",
      "1. Open by confirming the customer's name.",
      "2) Discovery before pitching.",
      "- Never cite regulations without naming them.",
      "• Close with a specific next step.",
      "ok",
      "",
      "x".repeat(400),
    ].join("\n");
    const out = guidelinesFromPlaybook(content);
    expect(out[0]).toBe("Our process:");
    expect(out[1]).toBe("Open by confirming the customer's name.");
    expect(out[2]).toBe("Discovery before pitching.");
    expect(out[3]).toBe("Never cite regulations without naming them.");
    expect(out[4]).toBe("Close with a specific next step.");
    expect(out).not.toContain("ok");
    expect(out[5]).toHaveLength(200);
    expect(guidelinesFromPlaybook(Array(40).fill("A guideline line").join("\n"))).toHaveLength(20);
    expect(guidelinesFromPlaybook(null)).toEqual([]);
  });
});

describe("buildJevRequest", () => {
  const guidelines = ["Open by confirming who you are", "Discovery before pitching"];

  it("asks only temperature for a baseline exchange with no rep", () => {
    const req = buildJevRequest({ guidelines, exchanges, k: 0 });
    expect(Object.keys(req.questions)).toEqual(["customer_temperature"]);
    expect(req.state.exchanges).toEqual([{ n: 1, rep: null, customer: "Hello?" }]);
    expect(req.state.latest_exchange_number).toBe(1);
    expect(req.state.call_goal).toBe(DEFAULT_CALL_GOAL);
    expect(req.truncated).toBe(false);
  });

  it("asks all four questions for a rep exchange when guidelines exist", () => {
    const req = buildJevRequest({ guidelines, exchanges, k: 2, goal: "Book a demo." });
    expect(Object.keys(req.questions).sort()).toEqual(
      ["customer_temperature", "playbook_step", "rep_introduced_risk", "rep_move"].sort(),
    );
    expect(req.state.call_goal).toBe("Book a demo.");
    expect(req.state.playbook_guidelines).toEqual({ g1: guidelines[0], g2: guidelines[1] });
    expect(req.state.exchanges.map((e: RenderedExchange) => e.n)).toEqual([1, 2, 3]);
    const step = req.questions.playbook_step as { type: string; criteria: Record<string, unknown> };
    expect(step.type).toBe("choice");
    expect(Object.keys(step.criteria)).toEqual(["g1", "g2", "none"]);
    expect(step.criteria.g1).toEqual({ what: guidelines[0] });
  });

  it("omits playbook_step without guidelines and still asks rep questions", () => {
    const req = buildJevRequest({ guidelines: [], exchanges, k: 3 });
    expect(Object.keys(req.questions).sort()).toEqual(
      ["customer_temperature", "rep_introduced_risk", "rep_move"].sort(),
    );
    expect(req.state.exchanges[3]).toEqual({
      n: 4,
      rep: "Fifty a month. Can we set up a time Thursday?",
      customer: null,
    });
  });

  it("throws for an out-of-range exchange index", () => {
    expect(() => buildJevRequest({ guidelines, exchanges, k: 9 })).toThrow(/No exchange/);
  });
});

describe("fitToBudget", () => {
  const rendered: RenderedExchange[] = Array.from({ length: 40 }, (_, i) => ({
    n: i + 1,
    rep: `rep ${i} ${"words ".repeat(20)}`,
    customer: `customer ${i} ${"words ".repeat(20)}`,
  }));

  it("returns everything when under budget", () => {
    expect(fitToBudget(rendered, 1_000_000)).toEqual({ kept: rendered, omitted: 0 });
  });

  it("keeps the first two and the most recent exchanges, reporting the gap", () => {
    const { kept, omitted } = fitToBudget(rendered, 600);
    expect(kept[0].n).toBe(1);
    expect(kept[1].n).toBe(2);
    expect(kept[kept.length - 1].n).toBe(40);
    expect(omitted).toBe(40 - kept.length);
    expect(omitted).toBeGreaterThan(0);
    // middle is contiguous: n values after the head strictly increase by 1
    const tail = kept.slice(2).map((e) => e.n);
    expect(tail).toEqual(tail.map((_, i) => tail[0] + i));
  });

  it("marks truncation on the request", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      exchange(i, `rep ${"long words ".repeat(30)}`, `cust ${"long words ".repeat(30)}`),
    );
    const req = buildJevRequest({ guidelines: [], exchanges: many, k: 59, budgetTokens: 2000 });
    expect(req.truncated).toBe(true);
    expect(req.state.earlier_exchanges_omitted).toBeGreaterThan(0);
    expect(req.state.exchanges[req.state.exchanges.length - 1].n).toBe(60);
  });
});

describe("selectWindow", () => {
  const rendered: RenderedExchange[] = Array.from({ length: 20 }, (_, i) => ({
    n: i + 1,
    rep: `r${i}`,
    customer: `c${i}`,
  }));

  it("keeps everything when the call fits the anchor plus window", () => {
    expect(selectWindow(rendered.slice(0, 14), 12)).toEqual({
      kept: rendered.slice(0, 14),
      omitted: 0,
    });
    expect(selectWindow(rendered, 0).omitted).toBe(0);
  });

  it("keeps the first two and the last N, counting the gap", () => {
    const { kept, omitted } = selectWindow(rendered, 5);
    expect(kept.map((e) => e.n)).toEqual([1, 2, 16, 17, 18, 19, 20]);
    expect(omitted).toBe(13);
  });

  it("is applied by buildJevRequest and reported as truncation", () => {
    const many = Array.from({ length: 20 }, (_, i) => exchange(i, `rep ${i}`, `cust ${i}`));
    const req = buildJevRequest({ guidelines: [], exchanges: many, k: 19, windowSize: 4 });
    expect(req.state.exchanges.map((e) => e.n)).toEqual([1, 2, 17, 18, 19, 20]);
    expect(req.state.earlier_exchanges_omitted).toBe(14);
    expect(req.truncated).toBe(true);
    // window disabled keeps the full prefix
    const full = buildJevRequest({ guidelines: [], exchanges: many, k: 19, windowSize: 0 });
    expect(full.state.exchanges).toHaveLength(20);
  });
});
