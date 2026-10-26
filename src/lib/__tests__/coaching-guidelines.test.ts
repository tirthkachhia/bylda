import { describe, expect, it } from "vitest";
import {
  GUIDELINE_LIMITS,
  GUIDELINES_SYSTEM_PROMPT,
  guidelinesTool,
  normalizeGuidelines,
  renderGuidelines,
} from "../../../supabase/functions/_shared/coaching/guidelines";

const item = (
  title: string,
  phase = "discovery",
  detail = "Counts when asked before any price.",
) => ({
  title,
  detail,
  phase,
});

describe("normalizeGuidelines", () => {
  it("assigns codes in order, dedupes titles, coerces phase, drops empties", () => {
    const out = normalizeGuidelines({
      guidelines: [
        item("Confirm the customer's date of birth", "opening"),
        item("Ask about monthly income before quoting"),
        item("  Ask about monthly income before quoting!  "),
        item("", "close"),
        item("Dig into why they requested information", "nonsense", ""),
        item("Offer the bank discount only after the base rate", "presentation"),
        { title: 7 },
        null,
      ],
    });
    expect(out).not.toBeNull();
    expect(out!.map((g) => [g.code, g.position, g.phase, g.detail === null])).toEqual([
      ["G1", 1, "opening", false],
      ["G2", 2, "discovery", false],
      ["G3", 3, "other", true],
      ["G4", 4, "presentation", false],
    ]);
    expect(out![0].title).toBe("Confirm the customer's date of birth");
  });

  it("returns null below the minimum and caps at the maximum", () => {
    expect(normalizeGuidelines({ guidelines: [item("a"), item("b"), item("c")] })).toBeNull();
    expect(normalizeGuidelines(null)).toBeNull();
    expect(normalizeGuidelines({ guidelines: "nope" })).toBeNull();
    const many = Array.from({ length: 30 }, (_, i) => item(`Rule number ${i}`));
    expect(normalizeGuidelines({ guidelines: many })).toHaveLength(GUIDELINE_LIMITS.max);
  });
});

describe("prompt and rendering", () => {
  it("states the behavior rule and the count range", () => {
    expect(GUIDELINES_SYSTEM_PROMPT).toContain("observable rep behaviors");
    expect(GUIDELINES_SYSTEM_PROMPT).toContain(
      `between ${GUIDELINE_LIMITS.min} and ${GUIDELINE_LIMITS.max}`,
    );
    expect(guidelinesTool.parameters.required).toEqual(["guidelines"]);
  });

  it("renders one citable line per guideline", () => {
    const out = normalizeGuidelines({
      guidelines: [item("A", "opening"), item("B", "close", ""), item("C"), item("D")],
    })!;
    expect(renderGuidelines(out).split("\n")).toEqual([
      "G1 [opening] A — Counts when asked before any price.",
      "G2 [close] B",
      "G3 [discovery] C — Counts when asked before any price.",
      "G4 [discovery] D — Counts when asked before any price.",
    ]);
  });
});
