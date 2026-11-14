import type { BehaviorAnalysis, Evidence } from "./behavior-intelligence.ts";

export const evidenceReviewTool = {
  name: "review_behavior_evidence",
  description:
    "Independently check each proposed claim against the transcript, including contradictory turns.",
  parameters: {
    type: "object",
    properties: {
      reviews: {
        type: "array",
        items: {
          type: "object",
          properties: {
            claim_id: { type: "string" },
            verdict: { type: "string", enum: ["supported", "contradicted", "insufficient"] },
            quotes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  turn_id: { type: "integer" },
                  quote: { type: "string" },
                },
                required: ["turn_id", "quote"],
              },
            },
          },
          required: ["claim_id", "verdict", "quotes"],
        },
      },
    },
    required: ["reviews"],
  },
};

export function behaviorClaims(analysis: BehaviorAnalysis) {
  return [
    ...analysis.events.map((event) => ({ claim_id: event.occurrence_key, claim: event })),
    ...Object.entries(analysis.dimensions)
      .filter(([, finding]) => finding.assessment !== "unknown")
      .map(([dimension, finding]) => ({ claim_id: `dimension:${dimension}`, claim: finding })),
    ...(analysis.final_state.verification !== "unknown"
      ? [{ claim_id: "final_state", claim: analysis.final_state }]
      : []),
  ];
}

/** Missing, duplicate or invented review evidence never passes the gate. */
export function applyEvidenceReview(analysis: BehaviorAnalysis, raw: unknown, source: Evidence[]) {
  const reviews = (raw as { reviews?: unknown } | null)?.reviews;
  if (!Array.isArray(reviews)) throw new Error("Evidence review returned an incomplete result.");
  const supported = (id: string) => {
    const matches = reviews.filter((row) => row?.claim_id === id);
    if (matches.length !== 1) return false;
    const review = matches[0];
    return (
      review.verdict === "supported" &&
      Array.isArray(review.quotes) &&
      review.quotes.length > 0 &&
      review.quotes.every(
        (q: { turn_id?: unknown; quote?: unknown }) =>
          Number.isInteger(q?.turn_id) &&
          typeof q.quote === "string" &&
          q.quote.trim().length > 0 &&
          source.some(
            (turn) => turn.turn_id === q.turn_id && turn.text.includes(q.quote as string),
          ),
      )
    );
  };
  const accepted = analysis.events.filter((event) => supported(event.occurrence_key));
  analysis.rejected += analysis.events.length - accepted.length;
  analysis.events = accepted;
  for (const [dimension, finding] of Object.entries(analysis.dimensions)) {
    if (finding.assessment !== "unknown" && !supported(`dimension:${dimension}`)) {
      finding.assessment = "unknown";
      finding.explanation = "The evidence review did not establish this claim.";
    }
  }
  if (!supported("final_state"))
    analysis.final_state = { label: "Unknown", evidence: [], verification: "unknown" };
  return analysis;
}
