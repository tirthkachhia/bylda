import { describe, expect, it } from "vitest";
import { coachingGroups, normalizeCoaching } from "../../../supabase/functions/_shared/coaching-signals";

const transcript = "Rep: What happens when a follow-up is missed? Buyer: We lose two hours each week. Rep: Can we meet Tuesday?";
const moment = {
  category: "discovery", signal: "Impact question", evidence_quote: "What happens when a follow-up is missed?",
  context: "The rep asks about impact.", rep_quote: "What happens when a follow-up is missed?",
  buyer_quote: "We lose two hours each week.", interpretation: "The question is followed by a quantified impact statement.",
  practice: "Ask a follow-up about the current process.",
};
describe("coaching evidence contract", () => {
  it("covers the 16 sections without an emotion-scoring category", () => {
    expect(coachingGroups).toHaveLength(16);
    expect(new Set(coachingGroups.map(g => g.key)).size).toBe(16);
    expect(coachingGroups.some(g => String(g.key) === "emotion")).toBe(false);
  });
  it("keeps a supported moment and its before/after quotes", () => {
    const result = normalizeCoaching([moment], transcript);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].source_offset).toBe(5);
    expect(result.basis).toBe("transcript");
    expect(result.limitations).toHaveLength(3);
  });
  it("rejects invented evidence or reactions", () => {
    expect(normalizeCoaching([{ ...moment, buyer_quote: "I will sign today." }], transcript).signals).toEqual([]);
    expect(normalizeCoaching([{ ...moment, evidence_quote: "This is made up." }], transcript).signals).toEqual([]);
  });
  it("handles malformed output and unknown categories", () => {
    expect(normalizeCoaching([null, {}, "bad", { ...moment, category: "nervousness" }], transcript).signals).toEqual([]);
    expect(normalizeCoaching(undefined, transcript).signals).toEqual([]);
  });
  it("deduplicates without converting missing evidence into zeros", () => {
    expect(normalizeCoaching([moment, moment], transcript).signals).toHaveLength(1);
    expect(normalizeCoaching([], transcript).signals).toEqual([]);
  });
  it("ignores model-invented timing and confidence values", () => {
    const result = normalizeCoaching([{ ...moment, timestamp: 100, confidence: 1 }], transcript);
    expect(result.signals[0]).not.toHaveProperty("timestamp");
    expect(result.signals[0]).not.toHaveProperty("confidence");
  });
});
