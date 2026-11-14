export type AskSource = {
  id: string;
  call_id: string;
  run_id: string;
  turn_id: number;
  speaker: string;
  text: string;
  start_s: number | null;
};
export const askAnswerTool = {
  name: "answer_from_call_evidence",
  description: "Answer with source-linked statements or abstain.",
  parameters: {
    type: "object",
    properties: {
      segments: {
        type: "array",
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            source_ids: { type: "array", items: { type: "string" } },
          },
          required: ["text", "source_ids"],
        },
      },
    },
    required: ["segments"],
  },
};
export function normalizeAskAnswer(raw: unknown, sources: AskSource[]) {
  const segments = (raw as { segments?: unknown } | null)?.segments;
  if (!Array.isArray(segments) || !segments.length || segments.length > 6) return null;
  const lookup = new Map(sources.map((source) => [source.id, source]));
  const citations = new Map<string, AskSource>();
  const paragraphs: string[] = [];
  for (const segment of segments) {
    if (
      !segment ||
      typeof segment.text !== "string" ||
      !segment.text.trim() ||
      !Array.isArray(segment.source_ids) ||
      !segment.source_ids.length ||
      segment.source_ids.some((id: unknown) => typeof id !== "string" || !lookup.has(id))
    )
      return null;
    for (const id of segment.source_ids) citations.set(id, lookup.get(id)!);
    paragraphs.push(`${segment.text.trim().slice(0, 2000)} [${segment.source_ids.join(", ")}]`);
  }
  return { answer: paragraphs.join("\n\n"), citations: [...citations.values()] };
}
