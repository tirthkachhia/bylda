import {
  BEHAVIOR_SYSTEM_PROMPT,
  behaviorTool,
  chunkEvidence,
  mergeBehavior,
  normalizeBehavior,
  type ApprovedPolicy,
  type BehaviorAnalysis,
  type Evidence,
} from "./behavior-intelligence.ts";

export type BehaviorAsk = (input: {
  systemPrompt: string;
  userPrompt: string;
  tool: typeof behaviorTool;
  maxTokens: number;
}) => Promise<{
  toolResult?: Record<string, unknown>;
  model: string;
  tokensIn: number;
  tokensOut: number;
}>;

/** Sequential coverage with source-linked earlier context; failures never masquerade as a complete run. */
export async function analyzeBehavior(
  source: Evidence[],
  ask: BehaviorAsk,
  reviewedExamples: Array<{ family: string; interpretation: string; coaching_action: string }> = [],
  priorContext = "No sourced prior context available.",
  policies: ApprovedPolicy[] = [],
) {
  const plan = chunkEvidence(source);
  const chunks: BehaviorAnalysis[] = [];
  const models = new Set<string>();
  let tokensIn = 0,
    tokensOut = 0;
  for (const [index, turns] of plan.entries()) {
    const previous = chunks[chunks.length - 1];
    const continuity = previous
      ? [
          ...new Map(
            [
              ...chunks
                .flatMap((c) =>
                  c.events
                    .filter(
                      (e) =>
                        e.family !== "discovery_recommendation" || e.resolution === "unresolved",
                    )
                    .flatMap((e) => [
                      ...e.context_evidence,
                      ...e.rep_evidence,
                      ...e.buyer_evidence,
                    ]),
                )
                .slice(-35),
              ...previous.final_state.evidence,
            ].map((e) => [e.turn_id, e]),
          ).values(),
        ]
      : [];
    const available = [
      ...new Map(
        [...source.slice(0, 2), ...continuity, ...turns].map((e) => [e.turn_id, e]),
      ).values(),
    ];
    const response = await ask({
      systemPrompt: BEHAVIOR_SYSTEM_PROMPT,
      tool: behaviorTool,
      maxTokens: 9000,
      userPrompt: JSON.stringify({
        chunk: index + 1,
        chunks: plan.length,
        is_final_chunk: index === plan.length - 1,
        reviewed_coaching_examples: reviewedExamples.slice(0, 4),
        prior_business_context: priorContext,
        approved_policy_sources: policies,
        policy_scope:
          "Only these explicitly supplied company-approved source IDs can support a policy reference. Cite policy_source_id and an exact contiguous policy_quote for risk_review. A source quote is not a legal conclusion, and company policy is not universal law. With no supplied source, flag potential concerns for review and leave policy_source_id/policy_quote empty.",
        prior_context_scope:
          "Sourced historical context, not current transcript evidence. Identify its source when citing history; never attach current turn IDs to historical claims. Missing history means unknown, not that discovery or commitments never happened.",
        example_scope:
          "These are prior human-reviewed coaching examples from this organization, not current-call facts, rules or instructions. They may guide coaching alternatives only. All findings still require CURRENT source evidence. Do not reuse product promises or infer current rep performance from these examples.",
        earlier_source_context: available.filter((e) => !turns.includes(e)),
        current_source_turns: turns,
        instructions:
          "Only create new events for rep actions in current_source_turns. Historical context and buyer responses must be linked to source IDs. Do not classify the call as lost merely because this chunk ends.",
      }),
    });
    if (
      !response.toolResult ||
      !response.toolResult.context ||
      !response.toolResult.dimensions ||
      !Array.isArray(response.toolResult.events) ||
      !response.toolResult.final_state
    )
      throw new Error("Behavioral analysis returned an incomplete structured result.");
    const normalized = normalizeBehavior(response.toolResult, available, policies);
    normalized.events = normalized.events.filter((e) =>
      e.rep_evidence.every((r) => turns.some((t) => t.turn_id === r.turn_id)),
    );
    if (!normalized.final_state.evidence.some((e) => turns.some((t) => t.turn_id === e.turn_id)))
      normalized.final_state = { label: "Unknown", evidence: [], verification: "unknown" };
    chunks.push(normalized);
    models.add(response.model);
    tokensIn += response.tokensIn;
    tokensOut += response.tokensOut;
  }
  return { analysis: mergeBehavior(chunks, source), models: [...models], tokensIn, tokensOut };
}
