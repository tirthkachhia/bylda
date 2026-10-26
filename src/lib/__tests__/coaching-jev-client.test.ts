// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  askJev,
  isChoiceAnswer,
  isNoulAnswer,
  isScoreAnswer,
  JEV_ENDPOINT,
  jevCostUsd,
  JevRequestError,
  noulConfidence,
} from "../../../supabase/functions/_shared/coaching/jev-client";
import { JEV_MODEL } from "../../../supabase/functions/_shared/coaching/jev-questions";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function fetchSequence(responses: Response[]) {
  const queue = [...responses];
  return vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error("fetch called more times than expected");
    return next;
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

const answers = {
  customer_temperature: {
    type: "score",
    score: 1.8,
    probabilities: { "0": 0.05, "1": 0.2, "2": 0.65, "3": 0.1 },
    confidence: 0.7,
    legend: { "0": "Cold", "1": "Warm", "2": "Hot", "3": "Critical" },
  },
  playbook_step: {
    type: "choice",
    choice: "g2",
    probabilities: { g1: 0.1, g2: 0.85, none: 0.05 },
    confidence: 0.8,
  },
  rep_introduced_risk: { type: "noul", noul: 0.12 },
};

describe("askJev", () => {
  it("posts model, state, and questions with the bearer and parses answers", async () => {
    const f = fetchSequence([
      json({ model: "jev-1.13.0", answers, usage: { input_tokens: 900, output_tokens: 20 } }),
    ]);
    const res = await askJev({ a: 1 }, { q: { type: "noul", instructions: "x" } }, "KEY", f);
    expect(res.model).toBe("jev-1.13.0");
    expect(res.usage.input_tokens).toBe(900);
    expect(isScoreAnswer(res.answers.customer_temperature)).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(JEV_ENDPOINT);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer KEY");
    expect(JSON.parse(init.body as string)).toEqual({
      model: JEV_MODEL,
      state: { a: 1 },
      questions: { q: { type: "noul", instructions: "x" } },
    });
  });

  it("retries on 429 with backoff, then succeeds", async () => {
    const f = fetchSequence([
      new Response("slow down", { status: 429 }),
      json({ answers, usage: {} }),
    ]);
    const sleep = vi.fn(async () => {});
    const res = await askJev({}, {}, "KEY", f, { sleep });
    expect(isNoulAnswer(res.answers.rep_introduced_risk)).toBe(true);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(500);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("gives up after the retry limit and reports the status", async () => {
    const f = fetchSequence([
      new Response("x", { status: 529 }),
      new Response("y", { status: 529 }),
      new Response("z", { status: 529 }),
    ]);
    await expect(askJev({}, {}, "KEY", f, { sleep: async () => {} })).rejects.toMatchObject({
      name: "JevRequestError",
      status: 529,
    });
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("does not retry a 422 and surfaces the body", async () => {
    const f = fetchSequence([
      new Response('{"error":"criteria must have at least 2 levels"}', { status: 422 }),
    ]);
    const err = (await askJev({}, {}, "KEY", f).catch((e: unknown) => e)) as JevRequestError;
    expect(err).toBeInstanceOf(JevRequestError);
    expect(err.message).toMatch(/422 .*at least 2 levels/);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("rejects a 200 without answers", async () => {
    await expect(askJev({}, {}, "KEY", fetchSequence([json({ model: "x" })]))).rejects.toThrow(
      /no answers/,
    );
  });
});

describe("answer guards and helpers", () => {
  it("accept the right shapes and reject the others", () => {
    expect(isScoreAnswer(answers.customer_temperature)).toBe(true);
    expect(isChoiceAnswer(answers.playbook_step)).toBe(true);
    expect(isNoulAnswer(answers.rep_introduced_risk)).toBe(true);
    expect(isScoreAnswer(answers.playbook_step)).toBe(false);
    expect(isChoiceAnswer(answers.rep_introduced_risk)).toBe(false);
    expect(isNoulAnswer({ type: "noul", noul: "0.5" })).toBe(false);
    expect(isScoreAnswer({ type: "score", score: NaN, probabilities: {}, confidence: 1 })).toBe(
      false,
    );
    expect(isScoreAnswer(undefined)).toBe(false);
  });

  it("derives Noul confidence and prices input tokens", () => {
    expect(noulConfidence(0.5)).toBe(0);
    expect(noulConfidence(0.9)).toBeCloseTo(0.8);
    expect(noulConfidence(0)).toBe(1);
    expect(jevCostUsd(1_000_000)).toBeCloseTo(0.042);
    expect(jevCostUsd(0)).toBe(0);
  });
});
