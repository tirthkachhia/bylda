import { describe, it, expect } from "vitest";
import {
  formatLabel,
  verdictCategory,
  pickScore,
  deriveOutputShape,
  asArray,
  readCore,
} from "@/lib/casefile";

describe("formatLabel", () => {
  it("maps validation/kill/funding tools to Investment Assessment", () => {
    expect(formatLabel("validate-idea")).toBe("Investment Assessment");
    expect(formatLabel("kill-my-idea")).toBe("Investment Assessment");
    expect(formatLabel("funding-readiness-score")).toBe("Investment Assessment");
  });
  it("maps offer/positioning tools to Founder Review", () => {
    expect(formatLabel("generate-offer")).toBe("Founder Review");
  });
  it("maps GTM/research tools to Viability Brief", () => {
    expect(formatLabel("generate-gtm-strategy")).toBe("Viability Brief");
    expect(formatLabel("competitor-scanner")).toBe("Viability Brief");
  });
  it("maps pricing/decision tools to Decision Memo", () => {
    expect(formatLabel("pricing-calculator")).toBe("Decision Memo");
  });
  it("falls back to Founder Casefile for unknown tools", () => {
    expect(formatLabel("some-new-tool")).toBe("Founder Casefile");
  });
});

describe("verdictCategory", () => {
  it("classifies negative verdicts as danger", () => {
    expect(verdictCategory("KILL")).toBe("danger");
    expect(verdictCategory("Lost")).toBe("danger");
    expect(verdictCategory("no-go")).toBe("danger");
  });
  it("classifies positive verdicts as success", () => {
    expect(verdictCategory("GO")).toBe("success");
    expect(verdictCategory("Fundable")).toBe("success");
    expect(verdictCategory("strong")).toBe("success");
  });
  it("classifies hedged verdicts as warning", () => {
    expect(verdictCategory("CONDITIONAL")).toBe("warning");
    expect(verdictCategory("pivot")).toBe("warning");
  });
  it("defaults unknown/empty verdicts to neutral", () => {
    expect(verdictCategory("")).toBe("neutral");
    expect(verdictCategory("review pending")).toBe("neutral");
  });
});

describe("deriveOutputShape", () => {
  it("maps known scoring tools to score_verdict", () => {
    expect(deriveOutputShape("validate-idea")).toBe("score_verdict");
    expect(deriveOutputShape("kill-my-idea")).toBe("score_verdict");
  });
  it("maps pricing/competitor tools to comparison", () => {
    expect(deriveOutputShape("pricing-strategy")).toBe("comparison");
    expect(deriveOutputShape("competitor-scanner")).toBe("comparison");
  });
  it("maps report-family tools to report", () => {
    expect(deriveOutputShape("business-plan")).toBe("report");
    expect(deriveOutputShape("generate-offer")).toBe("report");
  });
  it("maps sequence/customer tools to plan_with_steps", () => {
    expect(deriveOutputShape("first-10-customers")).toBe("plan_with_steps");
    expect(deriveOutputShape("generate-followup-sequence")).toBe("plan_with_steps");
  });
  it("maps pipeline/mentor tools to their shapes", () => {
    expect(deriveOutputShape("forecast-rollup")).toBe("pipeline_snapshot");
    expect(deriveOutputShape("mentor-session")).toBe("session_summary");
  });
  it("falls back via heuristics for unmapped-but-similar tools", () => {
    expect(deriveOutputShape("new-idea-validator-v2")).toBe("score_verdict");
    expect(deriveOutputShape("competitor-deep-dive")).toBe("comparison");
  });
  it("returns null for genuinely unknown tools so they get surfaced", () => {
    expect(deriveOutputShape("totally-unknown-tool")).toBeNull();
  });
});

describe("asArray", () => {
  it("passes strings through", () => {
    expect(asArray(["a", "b"])).toEqual(["a", "b"]);
  });
  it("reads label/text from objects and stringifies the rest", () => {
    expect(asArray([{ label: "L" }, { text: "T" }])).toEqual(["L", "T"]);
    expect(asArray([{ x: 1 }])).toEqual(['{"x":1}']);
  });
  it("returns [] for non-arrays", () => {
    expect(asArray(undefined)).toEqual([]);
    expect(asArray("nope")).toEqual([]);
  });
});

describe("readCore", () => {
  const base = {
    id: "abc",
    tool_key: "validate-idea",
    title: null,
    status: "succeeded",
    model: null,
    created_at: "2026-01-01",
    output: null,
  };
  it("is defensive on null output", () => {
    const core = readCore({ ...base });
    expect(core.score).toBeNull();
    expect(core.verdict).toBe("");
    expect(core.strengths).toEqual([]);
  });
  it("extracts the shared fields from a scoring output", () => {
    const core = readCore({
      ...base,
      output: {
        total_score: 72,
        verdict: "GO",
        rationale: "Strong signal.",
        scores: { market: 8 },
        strengths: ["clear ICP"],
        recommended_next_actions: [{ label: "Ship it" }],
      },
    });
    expect(core.score).toBe(72);
    expect(core.verdict).toBe("GO");
    expect(core.byldaTake).toBe("Strong signal.");
    expect(core.scores).toEqual({ market: 8 });
    expect(core.strengths).toEqual(["clear ICP"]);
    expect(core.nextActions[0].label).toBe("Ship it");
  });
});

describe("pickScore", () => {
  it("prefers total_score", () => {
    expect(pickScore({ total_score: 28, viabilityScore: 40 })).toBe(28);
  });
  it("falls back to viabilityScore then score", () => {
    expect(pickScore({ viabilityScore: 40 })).toBe(40);
    expect(pickScore({ score: 71 })).toBe(71);
  });
  it("coerces numeric strings", () => {
    expect(pickScore({ total_score: "55" })).toBe(55);
  });
  it("returns null when there is no score", () => {
    expect(pickScore({})).toBeNull();
    expect(pickScore({ total_score: "n/a" })).toBeNull();
  });
});
