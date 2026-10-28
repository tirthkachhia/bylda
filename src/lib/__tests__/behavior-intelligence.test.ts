import { describe, expect, it } from "vitest";
import {
  attributePlaybook,
  BEHAVIOR_SYSTEM_PROMPT,
  chunkEvidence,
  mergeBehavior,
  normalizeBehavior,
  selectBehaviorMoments,
  sourceTurns,
  type Evidence,
} from "../../../supabase/functions/_shared/coaching/behavior-intelligence";
import { analyzeBehavior } from "../../../supabase/functions/_shared/coaching/analyze-behavior";

const source: Evidence[] = [
  { turn_id: 0, speaker: "customer", text: "I cannot afford that premium.", start_s: 1, end_s: 3 },
  {
    turn_id: 1,
    speaker: "rep",
    text: "Would a lower amount fit your budget?",
    start_s: 4,
    end_s: 6,
  },
  { turn_id: 2, speaker: "customer", text: "Yes", start_s: 7, end_s: 8 },
  { turn_id: 3, speaker: "rep", text: "The carrier approved it.", start_s: 9, end_s: 10 },
];
const event = {
  family: "objection_resolution",
  opportunity: "eligible",
  result: "strength",
  context: "Budget concern",
  rep_behavior: "Offers a lower amount after hearing the budget constraint.",
  buyer_reaction: "Agrees to discussing the lower amount.",
  observed_progression: "Preference clarified; purchase not established.",
  interpretation: "Adaptation addresses a stated constraint.",
  alternative_explanation: "Agreement may only be permission to discuss.",
  coaching_action: "Clarify the revised premium and what the buyer accepts.",
  resolution: "partial",
  limitations: [],
  context_turn_ids: [0],
  rep_turn_ids: [1],
  buyer_turn_ids: [2],
};
const output = () => ({
  context: {
    objective: "recommend",
    starting_state: "Budget concern",
    constraints: "Affordability",
    prior_history: "unknown",
    turn_ids: [0],
  },
  dimensions: {
    sales_effectiveness: {
      assessment: "positive",
      explanation: "Useful adaptation",
      turn_ids: [0, 1, 2],
    },
  },
  events: [event],
  final_state: { label: "Carrier approval", turn_ids: [3], verification: "transcript_observed" },
});

describe("source-grounded behavioral intelligence", () => {
  it("hydrates original text, speakers and timestamps instead of trusting generated quotations", () => {
    const result = normalizeBehavior(output(), source);
    expect(result.events[0].rep_evidence).toEqual([source[1]]);
    expect(result.events[0].buyer_evidence).toEqual([source[2]]);
    expect(result.events[0].buyer_evidence[0].text).toBe("Yes");
  });
  it("rejects a customer turn misattributed to the rep, fabricated IDs and reactions before the action", () => {
    for (const bad of [{ rep_turn_ids: [0] }, { buyer_turn_ids: [999] }, { buyer_turn_ids: [0] }]) {
      const result = normalizeBehavior({ ...output(), events: [{ ...event, ...bad }] }, source);
      expect(result.events).toEqual([]);
      expect(result.rejected).toBe(1);
    }
  });
  it("does not turn missing response into resolution or successful progression", () => {
    const result = normalizeBehavior(
      { ...output(), events: [{ ...event, buyer_turn_ids: [], resolution: "resolved" }] },
      source,
    );
    expect(result.events[0]).toMatchObject({
      result: "unobservable",
      resolution: "unknown",
      buyer_reaction: "No observable response.",
    });
  });
  it("cannot upgrade a rep-reported approval to verified activation", () => {
    expect(normalizeBehavior(output(), source).final_state.verification).toBe("rep_reported");
  });
  it("requires both sides for effectiveness and customer speech for buyer state", () => {
    const raw = output();
    const result = normalizeBehavior(
      {
        ...raw,
        dimensions: {
          sales_effectiveness: { assessment: "positive", turn_ids: [1] },
          buyer_state: { assessment: "positive", turn_ids: [3] },
        },
      },
      source,
    );
    expect(result.dimensions.sales_effectiveness.assessment).toBe("unknown");
    expect(result.dimensions.buyer_state.assessment).toBe("unknown");
  });
  it("retains deduplicated incidents and admits positive moments without a playbook", () => {
    const result = normalizeBehavior({ ...output(), events: [event, event] }, source);
    expect(result.events).toHaveLength(1);
    expect(selectBehaviorMoments(result.events)[0].result).toBe("strength");
    expect(result.dimensions.playbook_execution.assessment).toBe("unknown");
  });
  it("keeps a meaningful strength even when concern candidates fill the display budget", () => {
    const strength = normalizeBehavior(output(), source).events[0];
    const concerns = Array.from({ length: 8 }, (_, i) => ({
      ...strength,
      result: "concern" as const,
      occurrence_key: `${i}`,
      rep_evidence: [{ ...source[1], turn_id: 10 + i * 5 }],
    }));
    expect(
      selectBehaviorMoments([...concerns, strength], 3).some((e) => e.result === "strength"),
    ).toBe(true);
  });
  it("covers every turn including the ending and fails oversized input explicitly", () => {
    const chunks = chunkEvidence(source, 200);
    expect(chunks.flat()).toEqual(source);
    expect(() => chunkEvidence([{ ...source[0], text: "x".repeat(400_001) }])).toThrow(/budget/);
  });
  it("does not invent actor identity or timestamps for legacy plain text", () => {
    expect(sourceTurns(null, "Rep: hello")[0]).toMatchObject({ speaker: "unknown", start_s: null });
  });
  it("keeps conflicting chunk judgments separate from a single positive verdict", () => {
    const a = normalizeBehavior(output(), source),
      b = normalizeBehavior(output(), source);
    b.dimensions.sales_effectiveness.assessment = "concern";
    expect(mergeBehavior([a, b], source).dimensions.sales_effectiveness.assessment).toBe("mixed");
  });
  it("does not send playbook instructions or prior analyzer opinions into independent evaluation", async () => {
    let input = "";
    const result = await analyzeBehavior(source, async (options) => {
      input = options.userPrompt;
      return { model: "fixture", tokensIn: 10, tokensOut: 20, toolResult: output() };
    });
    expect(input).not.toContain("Gold");
    expect(result.analysis.coverage.ending_analyzed).toBe(true);
    expect(result.tokensIn).toBe(10);
    expect(BEHAVIOR_SYSTEM_PROMPT).toContain("independently of any script");
  });
  it("a model failure cannot be persisted as a complete behavioral run", async () => {
    await expect(
      analyzeBehavior(source, async () => {
        throw new Error("provider unavailable");
      }),
    ).rejects.toThrow("provider unavailable");
  });
  it("withholds malformed model contracts instead of calling them complete", async () => {
    await expect(
      analyzeBehavior(source, async () => ({
        model: "fixture",
        tokensIn: 0,
        tokensOut: 0,
        toolResult: {},
      })),
    ).rejects.toThrow(/incomplete/);
  });
  it("attaches only exact quotations from supplied approved policy versions", () => {
    const policy = {
      id: "approved",
      title: "Expectation setting",
      version: 2,
      content: "Do not promise approval before the carrier decision.",
      source_url: null,
    };
    const raw = {
      ...output(),
      dimensions: {
        risk_review: {
          assessment: "concern",
          explanation: "Review the approval statement.",
          turn_ids: [3],
          policy_source_id: "approved",
          policy_quote: policy.content,
        },
      },
    };
    expect(
      normalizeBehavior(raw, source, [policy]).dimensions.risk_review.policy_reference?.version,
    ).toBe(2);
    expect(normalizeBehavior(raw, source).dimensions.risk_review.policy_reference).toBeUndefined();
    raw.dimensions.risk_review.policy_quote = "An invented legal requirement.";
    expect(
      normalizeBehavior(raw, source, [policy]).dimensions.risk_review.policy_reference,
    ).toBeUndefined();
  });
  it("does not declare full compliance when a model labels risk positive", () => {
    expect(
      normalizeBehavior(
        {
          ...output(),
          dimensions: {
            risk_review: { assessment: "positive", explanation: "Safe", turn_ids: [3] },
          },
        },
        source,
      ).dimensions.risk_review.assessment,
    ).toBe("unknown");
  });
  it("does not establish complete objection resolution from a short acknowledgment", () => {
    const result = normalizeBehavior(
      { ...output(), events: [{ ...event, resolution: "resolved" }] },
      source,
    );
    expect(result.events[0].resolution).toBe("partial");
    expect(result.events[0].observed_progression).toContain("requires further confirmation");
  });
  it("cannot treat buyer words, ambiguous quotations or clipped omissions as playbook failure/success", () => {
    const items = [
      { status: "followed", evidence_quote: source[0].text, note: "" },
      { status: "missed", evidence_quote: "", note: "" },
    ];
    expect(attributePlaybook(items, source, true).every((i) => i.status === "not_observable")).toBe(
      true,
    );
    const repeated = [...source, { ...source[1], turn_id: 4 }];
    expect(
      attributePlaybook(
        [{ status: "followed", evidence_quote: source[1].text, note: "" }],
        repeated,
        false,
      )[0].status,
    ).toBe("not_observable");
  });
});
