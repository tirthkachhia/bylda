import { describe, expect, it } from "vitest";
import { normalizeConduct } from "../../../supabase/functions/_shared/observable-conduct";

describe("observable conduct evidence validation", () => {
  const transcript = "Buyer: Please send the proposal tomorrow.";
  it("keeps evidence-backed commitment language", () => {
    const result = normalizeConduct([{ metric: "commitment_language", observation: "Requested a proposal", evidence_quote: "Please send the proposal tomorrow." }], transcript);
    expect(result.observations).toHaveLength(1);
    expect(result.unavailable).toHaveLength(2);
  });
  it("rejects fabricated evidence and emotion metrics", () => {
    expect(normalizeConduct([
      { metric: "emotion", observation: "Excited", evidence_quote: "Please send the proposal tomorrow." },
      { metric: "attendance", observation: "CEO attended", evidence_quote: "I am the CEO" },
    ], transcript).observations).toEqual([]);
  });
  it("handles missing and malformed output without invented observations", () => {
    expect(normalizeConduct(null, transcript).observations).toEqual([]);
    expect(normalizeConduct([null, {}, "bad"], transcript).observations).toEqual([]);
  });
});
