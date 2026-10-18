/**
 * Guidelines — the behavior vocabulary for a playbook version. A playbook is
 * usually a script; this turns it into a short checklist of things a rep either
 * does or does not do on a call, each with a stable code. Pure: the prompt and
 * tool the edge function sends, the normalizer that checks the answer, and the
 * renderer other prompts use to cite guidelines by code.
 */

export const GUIDELINE_PHASES = [
  "opening",
  "discovery",
  "presentation",
  "objections",
  "close",
  "compliance",
  "other",
] as const;
export type GuidelinePhase = (typeof GUIDELINE_PHASES)[number];

export type Guideline = {
  position: number;
  code: string;
  title: string;
  detail: string | null;
  phase: GuidelinePhase;
};

export const GUIDELINE_LIMITS = { min: 4, max: 20, titleChars: 120, detailChars: 300 } as const;

export const GUIDELINES_SYSTEM_PROMPT = [
  "You turn a sales playbook or call script into a checklist of observable rep behaviors for call review.",
  "Rules:",
  "- Each guideline is one thing a reviewer can hear the rep do or not do on a recording. Not a value, not a goal, not a feeling.",
  "- Title is an imperative under 12 words, e.g. 'Ask about monthly income before quoting a price'. Detail says what counts as done, in one or two sentences, and may quote the script's words.",
  "- Keep the playbook's own order and language. Do not add best practices the playbook does not contain.",
  `- Return between ${GUIDELINE_LIMITS.min} and ${GUIDELINE_LIMITS.max} guidelines. Merge near-duplicates. Skip pure logistics (hold music, transfer codes) unless the playbook makes them a rule.`,
  "- phase: opening, discovery, presentation, objections, close, compliance, or other.",
].join("\n");

export const guidelinesTool = {
  name: "list_guidelines",
  description: "Return the playbook as a checklist of observable rep behaviors.",
  parameters: {
    type: "object",
    properties: {
      guidelines: {
        type: "array",
        maxItems: GUIDELINE_LIMITS.max,
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            detail: { type: "string" },
            phase: { type: "string", enum: [...GUIDELINE_PHASES] },
          },
          required: ["title", "detail", "phase"],
        },
      },
    },
    required: ["guidelines"],
  },
};

const key = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");

/**
 * Check the model's list: trim, drop empties and near-duplicate titles, coerce
 * phase, cap the count, and assign codes G1..Gn in order. Returns null when fewer
 * than the minimum survive, so the caller fails loudly instead of storing a stub.
 */
export function normalizeGuidelines(value: unknown): Guideline[] | null {
  const raw =
    value && typeof value === "object" ? (value as Record<string, unknown>).guidelines : null;
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: Guideline[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const g = item as Record<string, unknown>;
    const title =
      typeof g.title === "string" ? g.title.trim().slice(0, GUIDELINE_LIMITS.titleChars) : "";
    if (!title) continue;
    const k = key(title);
    if (seen.has(k)) continue;
    seen.add(k);
    const detail =
      typeof g.detail === "string" ? g.detail.trim().slice(0, GUIDELINE_LIMITS.detailChars) : "";
    const phase = (GUIDELINE_PHASES as readonly string[]).includes(String(g.phase))
      ? (g.phase as GuidelinePhase)
      : "other";
    out.push({
      position: out.length + 1,
      code: `G${out.length + 1}`,
      title,
      detail: detail || null,
      phase,
    });
    if (out.length >= GUIDELINE_LIMITS.max) break;
  }
  return out.length >= GUIDELINE_LIMITS.min ? out : null;
}

/** One line per guideline, for prompts that must cite by code. */
export function renderGuidelines(guidelines: Guideline[]): string {
  return guidelines
    .map((g) => `${g.code} [${g.phase}] ${g.title}${g.detail ? ` — ${g.detail}` : ""}`)
    .join("\n");
}
