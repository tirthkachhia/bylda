import { describe, expect, it } from "vitest";
import {
  sourceTurns,
  normalizeBehavior,
} from "../../../supabase/functions/_shared/coaching/behavior-intelligence";
import { applyEvidenceReview } from "../../../supabase/functions/_shared/coaching/evidence-review";
import { turnsFromSegments } from "../../../supabase/functions/_shared/coaching/segment-provenance";
import {
  normalizeAskAnswer,
  type AskSource,
} from "../../../supabase/functions/_shared/coaching/ask-evidence";
import {
  behaviorTrend,
  type BehaviorSample,
} from "../../../supabase/functions/_shared/coaching/behavior-trends";

describe("audit evidence regressions", () => {
  it("preserves provider roles and times without guessing names, channels or tone", () => {
    const turns = turnsFromSegments([
      { text: "Hello", speaker: "Alex", speaker_side: "close-user", start: 0, end: 2 },
      { text: "I object", role: "customer", start: 2, end: 4 },
      { text: "Unattributed", speaker: "1", start: "unknown" },
    ])!;
    expect(turns.map((turn) => turn.speaker)).toEqual(["rep", "customer", "unknown"]);
    expect(turns.map((turn) => turn.start_s)).toEqual([0, 2, null]);
    expect(turns.every((turn) => turn.tone.label === "unknown")).toBe(true);
  });
  const source = sourceTurns(
    null,
    "Rep: Can we agree on Friday?\nCustomer: No, I do not agree to that.\nUnlabelled speech",
  );
  const proposal = {
    events: [
      {
        family: "commitment_next_step",
        opportunity: "eligible",
        result: "strength",
        rep_behavior: "Obtains Friday commitment",
        coaching_action: "Repeat this close",
        resolution: "resolved",
        rep_turn_ids: [0],
        buyer_turn_ids: [1],
        context_turn_ids: [],
      },
    ],
    dimensions: { buyer_state: { assessment: "positive", explanation: "Agreed", turn_ids: [1] } },
    final_state: { label: "Friday agreed", turn_ids: [1], verification: "transcript_observed" },
  };
  it("preserves explicit role labels and leaves other speech and all times unknown", () => {
    expect(source.map((turn) => turn.speaker)).toEqual(["rep", "customer", "unknown"]);
    expect(source.every((turn) => turn.start_s === null && turn.end_s === null)).toBe(true);
  });
  it("rejects a claimed commitment against explicit buyer refusal", () => {
    expect(normalizeBehavior(proposal, source).events).toHaveLength(0);
  });
  it("withholds contradicted and unreviewed prose even when source IDs exist", () => {
    const analysis = normalizeBehavior(proposal, source);
    const reviewed = applyEvidenceReview(
      analysis,
      {
        reviews: [
          {
            claim_id: "final_state",
            verdict: "contradicted",
            quotes: [{ turn_id: 1, quote: source[1].text }],
          },
        ],
      },
      source,
    );
    expect(reviewed.final_state.verification).toBe("unknown");
    expect(reviewed.dimensions.buyer_state.assessment).toBe("unknown");
    expect(() => applyEvidenceReview(analysis, {}, source)).toThrow("incomplete");
  });
  const citations: AskSource[] = [
    {
      id: "1",
      call_id: "call",
      run_id: "run",
      turn_id: 1,
      speaker: "customer",
      text: source[1].text,
      start_s: null,
    },
  ];
  it("resolves Ask citations from server sources and rejects uncited or fabricated source IDs", () => {
    expect(
      normalizeAskAnswer(
        { segments: [{ text: "The buyer declined.", source_ids: ["1"] }] },
        citations,
      )?.citations,
    ).toEqual(citations);
    for (const source_ids of [[], ["999"]])
      expect(
        normalizeAskAnswer({ segments: [{ text: "Agreed", source_ids }] }, citations),
      ).toBeNull();
  });
  const now = Date.parse("2026-11-13T12:00:00Z");
  const samples = (current: number, previous: number): BehaviorSample[] =>
    Array.from({ length: 5 }, (_, i) => [
      {
        id: `c${i}`,
        call_id: `c${i}`,
        occurred_at: new Date(now - 86400000 * 10).toISOString(),
        scope: "same",
        cohort: "rep",
        eligible: true,
        reviewed: true,
        result: i < current ? ("strength" as const) : ("concern" as const),
      },
      {
        id: `p${i}`,
        call_id: `p${i}`,
        occurred_at: new Date(now - 86400000 * 40).toISOString(),
        scope: "same",
        cohort: "rep",
        eligible: true,
        reviewed: true,
        result: i < previous ? ("strength" as const) : ("concern" as const),
      },
    ]).flat();
  it("classifies exact 20-point boundaries in both directions consistently", () => {
    expect(behaviorTrend(samples(3, 2), now).state).toBe("improving");
    expect(behaviorTrend(samples(2, 3), now).state).toBe("degrading");
  });
  it("withholds comparisons when the rep cohort changes", () => {
    expect(
      behaviorTrend(
        samples(5, 0).map((sample) => ({
          ...sample,
          cohort: sample.id.startsWith("c") ? "new-rep" : "old-rep",
        })),
        now,
      ).state,
    ).toBe("insufficient_evidence");
  });
});
