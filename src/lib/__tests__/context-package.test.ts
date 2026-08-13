import { describe, expect, it } from "vitest";
import {
  compactContextValue,
  estimateTokens,
  normalizePhone,
  rankAndBudgetEvidence,
  splitContextText,
} from "../../../supabase/functions/_shared/context-package.ts";

describe("context package utilities", () => {
  it("normalizes phone numbers for deterministic entity matching", () => {
    expect(normalizePhone("+1 (404) 555-0101")).toBe("14045550101");
    expect(normalizePhone("  ")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });

  it("estimates a non-zero token cost", () => {
    expect(estimateTokens("12345678")).toBe(2);
    expect(estimateTokens("")).toBe(1);
  });

  it("chunks long transcripts with bounded overlap", () => {
    const transcript = Array.from(
      { length: 80 },
      (_, index) => `Speaker ${index % 2}: This is transcript sentence ${index}.`,
    ).join("\n\n");
    const chunks = splitContextText(transcript, { maxChars: 700, overlapChars: 80 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 700)).toBe(true);
    expect(chunks.join(" ")).toContain("transcript sentence 0");
    expect(chunks.join(" ")).toContain("transcript sentence 79");
  });

  it("deduplicates, ranks, and budgets evidence", () => {
    const now = new Date("2026-08-13T12:00:00Z").getTime();
    const recent = {
      id: "recent",
      source_type: "call_transcript",
      source_id: "call-1",
      content: "Recent customer commitment.",
      occurred_at: "2026-08-13T11:00:00Z",
      importance: 0.8,
    };
    const result = rankAndBudgetEvidence(
      [
        recent,
        { ...recent, id: "duplicate" },
        {
          id: "old",
          source_type: "call_transcript",
          source_id: "call-2",
          content: "Older background information.",
          occurred_at: "2025-01-01T00:00:00Z",
          importance: 0.2,
        },
      ],
      10,
      0,
      now,
    );

    expect(result.included[0]?.id).toBe("recent");
    expect(result.included.filter((item) => item.source_id === "call-1")).toHaveLength(1);
    expect(result.tokenEstimate).toBeLessThanOrEqual(10);
  });

  it("reports evidence omitted by the token budget", () => {
    const result = rankAndBudgetEvidence(
      [
        {
          id: "large",
          source_type: "document",
          source_id: "doc-1",
          content: "x".repeat(400),
        },
      ],
      20,
    );
    expect(result.included).toHaveLength(0);
    expect(result.omitted).toEqual(["document:doc-1:token_budget"]);
  });

  it("compacts nested structured context without producing malformed values", () => {
    const compacted = compactContextValue(
      {
        notes: "x".repeat(500),
        activities: Array.from({ length: 20 }, (_, index) => ({ index, value: "ok" })),
      },
      { maxStringChars: 60, maxArrayItems: 3, maxObjectKeys: 5 },
    ) as { notes: string; activities: unknown[] };

    expect(compacted.notes.length).toBe(60);
    expect(compacted.activities).toHaveLength(3);
    expect(() => JSON.parse(JSON.stringify(compacted))).not.toThrow();
  });
});
