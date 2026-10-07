export const conductMetrics = {
  question_quality: "Question quality and discovery depth",
  framework_execution: "Framework execution",
  attendance: "Who attended (explicit introductions only)",
  commitment_language: "Commitment language",
  resistance_language: "Resistance language",
  pitch_pricing_sequence: "Pitch and pricing relative to discovery",
} as const;

export const conductTool = {
  type: "array",
  description:
    "Observable conduct only. For each supported category, give a factual observation and a verbatim transcript quote. Question quality means relevance and follow-up specificity, not personality. Do not infer emotions, intent, honesty, engagement or internal states. Do not infer attendance from CRM contacts. Describe framework steps only if the framework was supplied. No scores or invented measurements.",
  items: {
    type: "object",
    properties: {
      metric: { type: "string", enum: Object.keys(conductMetrics) },
      observation: { type: "string" },
      evidence_quote: { type: "string" },
    },
    required: ["metric", "observation", "evidence_quote"],
  },
};

export function normalizeConduct(value: unknown, transcript: string) {
  const items = Array.isArray(value) ? value : [];
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  const source = normalize(transcript);
  return {
    version: 1,
    observations: items
      .filter(
        (item) =>
          item &&
          typeof item.metric === "string" &&
          Object.hasOwn(conductMetrics, item.metric) &&
          typeof item.observation === "string" &&
          item.observation.trim() &&
          typeof item.evidence_quote === "string" &&
          normalize(item.evidence_quote).length >= 8 &&
          source.includes(normalize(item.evidence_quote)),
      )
      .slice(0, 18)
      .map((item) => ({
        metric: item.metric as keyof typeof conductMetrics,
        observation: item.observation.slice(0, 1200),
        evidence_quote: item.evidence_quote.slice(0, 1000),
      })),
    unavailable: [
      "Question count: requires validated speaker attribution and complete transcript.",
      "Discovery duration, interruptions, listening ratio, speaking pace and objection-response latency: require reliable speaker-level timing; not estimated from plain text.",
    ],
  };
}
