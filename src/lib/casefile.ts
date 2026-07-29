/**
 * Founder Casefile mapping helpers — pure so the tool → format and verdict →
 * tone mappings are unit-testable and stay consistent.
 */

export type VerdictCategory = "danger" | "success" | "warning" | "neutral";

/** The seven semantic render shapes the Casefile renderer routes on. */
export type OutputShape =
  | "score_verdict"
  | "comparison"
  | "report"
  | "memo"
  | "plan_with_steps"
  | "pipeline_snapshot"
  | "session_summary";

const OUTPUT_SHAPE_EXPLICIT: Record<string, OutputShape> = {
  "validate-idea": "score_verdict",
  "idea-validator": "score_verdict",
  "kill-my-idea": "score_verdict",
  "funding-readiness-score": "score_verdict",
  "funding-readiness": "score_verdict",
  "score-idea": "score_verdict",
  validate: "score_verdict",
  "pricing-strategy": "comparison",
  "pricing-calculator": "comparison",
  "competitor-scanner": "comparison",
  "competitor-analysis": "comparison",
  compare: "comparison",
  "business-plan": "report",
  "generate-gtm-strategy": "report",
  "gtm-strategy-builder": "report",
  positioning: "report",
  research: "report",
  "market-research": "report",
  "analyze-website": "report",
  "generate-offer": "report",
  "generate-pitch": "report",
  "investor-emails": "report",
  decision: "memo",
  "pricing-memo": "memo",
  "first-10-customers": "plan_with_steps",
  "first-10-customers-finder": "plan_with_steps",
  "generate-followup-sequence": "plan_with_steps",
  "launch-plan": "plan_with_steps",
  "90-day-plan": "plan_with_steps",
  "action-plan": "plan_with_steps",
  "generate-gtm-plan": "plan_with_steps",
  "pipeline-snapshot": "pipeline_snapshot",
  "crm-snapshot": "pipeline_snapshot",
  forecast: "pipeline_snapshot",
  "forecast-rollup": "pipeline_snapshot",
  "mentor-session": "session_summary",
  "session-summary": "session_summary",
  "coaching-session": "session_summary",
};

/**
 * Client-side safety net for output_shape. The DB column is authoritative;
 * this only runs when a row predates the column or a tool wasn't forward-filled.
 * Returns null for genuinely unmapped tools so the renderer can surface them.
 * Kept in sync with public.tool_output_shape() and toolOutputShape() (edge).
 */
export function deriveOutputShape(toolKey: string): OutputShape | null {
  if (OUTPUT_SHAPE_EXPLICIT[toolKey]) return OUTPUT_SHAPE_EXPLICIT[toolKey];
  const k = toolKey.toLowerCase();
  if (/(valid|readiness|assess)/.test(k)) return "score_verdict";
  if (/(pric|compar|competitor|versus)/.test(k)) return "comparison";
  if (/(pipeline|forecast|snapshot)/.test(k)) return "pipeline_snapshot";
  if (/(mentor|session|coaching)/.test(k)) return "session_summary";
  if (/(sequence|customers|outreach|roadmap|steps|plan)/.test(k)) return "plan_with_steps";
  if (/(report|research|analy|strateg|gtm|positioning|pitch|offer)/.test(k)) return "report";
  return null;
}

/** Format label shown in the casefile command header, by tool family. */
export function formatLabel(toolKey: string): string {
  if (
    ["validate-idea", "idea-validator", "kill-my-idea", "funding-readiness-score"].includes(toolKey)
  )
    return "Investment Assessment";
  if (["generate-offer", "positioning", "persona-builder"].includes(toolKey))
    return "Founder Review";
  if (
    ["generate-gtm-strategy", "gtm-strategy-builder", "competitor-scanner", "research"].includes(
      toolKey,
    )
  )
    return "Viability Brief";
  if (["pricing-calculator", "decision"].includes(toolKey)) return "Decision Memo";
  return "Founder Casefile";
}

/** Classify a verdict string into a semantic tone. */
export function verdictCategory(v: string): VerdictCategory {
  const s = (v || "").toLowerCase();
  if (/(kill|lost|fail|no-go|reject)/.test(s)) return "danger";
  if (/(go|pass|won|strong|proceed|fundable|yes)/.test(s)) return "success";
  if (/(conditional|maybe|caution|revise|pivot)/.test(s)) return "warning";
  return "neutral";
}

/** Pick the headline score from a tool_run output, if any. */
export function pickScore(out: Record<string, unknown>): number | null {
  const n = out.total_score ?? out.viabilityScore ?? out.score ?? null;
  if (typeof n === "number") return n;
  if (n != null && !Number.isNaN(Number(n))) return Number(n);
  return null;
}

/* ── Casefile output readers (shared by the layout components) ──── */

export type CasefileRun = {
  id: string;
  tool_key: string;
  title: string | null;
  status: string;
  output: Record<string, unknown> | null;
  output_shape?: string | null;
  model: string | null;
  created_at: string;
};

export type NextAction = { type?: string; label?: string; reason?: string; target?: string };

export type CasefileCore = {
  out: Record<string, unknown>;
  score: number | null;
  verdict: string;
  scores: Record<string, number>;
  strengths: string[];
  proof: string[];
  nextActions: NextAction[];
  byldaTake: string;
  recommendation: string;
  fullReport: string;
};

/** Coerce a mixed array of strings/objects into display strings. */
export function asArray(v: unknown): string[] {
  if (Array.isArray(v))
    return v.map((x) =>
      typeof x === "string"
        ? x
        : ((x as { label?: string; text?: string })?.label ??
          (x as { text?: string })?.text ??
          JSON.stringify(x)),
    );
  return [];
}

/** Read a tool_run output into the fields every Casefile layout shares. */
export function readCore(run: CasefileRun): CasefileCore {
  const out = (run.output ?? {}) as Record<string, unknown>;
  return {
    out,
    score: pickScore(out),
    verdict: String(out.verdict ?? "").trim(),
    scores: (out.scores && typeof out.scores === "object" ? out.scores : {}) as Record<
      string,
      number
    >,
    strengths: asArray(out.strengths ?? out.confirmed_strengths),
    proof: asArray(out.weaknesses ?? out.reasons_to_fail ?? out.what_needs_proof ?? out.risks),
    nextActions: (Array.isArray(out.recommended_next_actions)
      ? out.recommended_next_actions
      : []) as NextAction[],
    byldaTake: String(
      out.rationale ?? out.recommendation ?? out.fatal_flaw ?? out.summary ?? "",
    ).slice(0, 1200),
    recommendation: String(out.recommendation ?? out.next_step ?? "").slice(0, 400),
    fullReport: String(out.full_report ?? out.report ?? "").trim(),
  };
}
