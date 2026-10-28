/**
 * Report contract — what the model is told, what it must return, and how its
 * answer is checked before it is stored. Pure; shared by the edge function,
 * the browser (types), and vitest.
 *
 * The product rule: one short page. A one-line read, at most three patterns
 * each anchored to real moments with a line the rep could have said, one
 * strength, one drill. Anything the model cites that is not in the input is
 * dropped, so the report can only point at tape the manager can go and hear.
 */
import type { CitedMoment, ReportInput, ReportTheme } from "./report-input.ts";
import type { SinceLast, StripRow } from "./report-trend.ts";

export type ReportCitation = CitedMoment;

export type ReportPattern = {
  title: string;
  guideline: string | null;
  what_happened: string;
  say_instead: string;
  cited: ReportCitation[];
};

export type RepReport = {
  headline: string;
  patterns: ReportPattern[];
  strength: { title: string; what_happened: string; cited: ReportCitation[] } | null;
  drill: {
    focus: string;
    line_to_practice: string;
    /** The guideline code this drill practices (from the checklist), or null. */
    guideline_code: string | null;
  };
  /** Code-computed comparison with the previous period. Null when there is none. */
  since_last: SinceLast | null;
  /** Code-computed call-by-call strip for the period. */
  strip: StripRow[];
};

export const REPORT_LIMITS = {
  patterns: 3,
  citationsPerPattern: 2,
  headlineChars: 220,
  sentenceChars: 400,
} as const;

export function buildReportSystemPrompt(
  playbook: { name: string; version: number; content: string } | null,
): string {
  const parts = [
    "You are a sales coaching manager writing a one-page coaching note about one rep, for the rep's manager to use in a 15-minute coaching conversation.",
    "Rules:",
    "- Be succinct. The whole note is read in under two minutes. Plain language, no filler, no praise sandwiches.",
    "- Every pattern must cite moments from the MOMENTS list by call_id and exchange_index. You may not invent moments, quotes, or numbers. Cite only what is listed.",
    "- A pattern is something seen across calls or clearly costly. General sales behavior and successful adaptation matter independently of playbook execution. A guideline link is optional. Do not equate a deviation with a weakness or adherence with effectiveness. Say what the rep did, what it cost, and give one concrete line the rep could have said instead, in the rep's voice, ready to say on the next call.",
    "- The drill is one thing to practice this week, stated as the exact line to practice, and tied to one guideline code when a checklist is given. If SINCE LAST REPORT shows the last drill was not yet followed on most calls, keep it as the drill rather than moving on.",
    "- SINCE LAST REPORT facts are computed from the data; quote them as given and never recompute or round them.",
    "- If the material is thin, return fewer patterns rather than padding.",
    "- Quote the rep's words only as they appear in the MOMENTS list.",
  ];
  if (playbook?.content.trim()) {
    parts.push(
      "",
      `<sales_playbook name="${playbook.name.replace(/"/g, "'")}" version="${playbook.version}">`,
      playbook.content.trim(),
      "</sales_playbook>",
      "Use this version only to judge applicable process objectives. General effectiveness is independent of execution. Do not invent product, coverage, eligibility or approval promises in coaching lines. Outcomes reported by the rep are not externally verified.",
    );
  }
  return parts.join("\n");
}

const fmt = (v: number | null, suffix = "") => (v === null ? "n/a" : `${v}${suffix}`);

function renderTheme(theme: ReportTheme, index: number): string {
  const lines = [
    `Theme ${index + 1}: ${theme.guideline} [${theme.source === "playbook" ? "playbook" : "general rule"}] — ${theme.call_count} call(s), ${theme.moment_count} moment(s)`,
  ];
  for (const m of theme.moments) {
    lines.push(`  - call_id ${m.call_id} exchange_index ${m.exchange_index} (at ${m.at})`);
    lines.push(`    Rep: ${m.rep_text}`);
    if (m.customer_text) lines.push(`    Customer: ${m.customer_text}`);
    if (m.why_it_matters) lines.push(`    Why it mattered: ${m.why_it_matters}`);
    if (m.what_to_say_instead) lines.push(`    Suggested line: ${m.what_to_say_instead}`);
  }
  return lines.join("\n");
}

/** The user prompt body: period stats, themes with citable moments, adherence tallies. */
export function renderReportInput(
  input: ReportInput,
  rep: { name: string },
  period: { start: string; end: string },
): string {
  const c = input.calls;
  const out = [
    `REP: ${rep.name}`,
    `PERIOD: ${period.start} to ${period.end}`,
    "",
    "PERIOD STATS",
    `- Calls scored: ${c.total} (${c.high_value} worth reviewing)`,
    "- Composite scores are not an effectiveness verdict; use source-linked behavior and buyer responses.",
    `- Average rep move (0 pushed past … 3 advanced and asked): ${fmt(c.avg_rep_move)}`,
    `- Legacy exchange flags (may repeat one incident; not verified violations): ${c.risk_flags}`,
    `- Legacy temperature declines (not verified lost sales): ${c.lost_warm_customers}`,
    "",
    input.themes.length
      ? `MOMENTS (cite by call_id and exchange_index; use the exact keys, do not renumber; negative keys identify source-linked behavior moments)\n${input.themes.map(renderTheme).join("\n")}`
      : "MOMENTS: none explained yet.",
  ];
  if (input.adherence.length) {
    out.push(
      "",
      "PLAYBOOK ADHERENCE ACROSS CALLS (followed / partial / missed)",
      ...input.adherence.map((a) => `- ${a.guideline}: ${a.followed} / ${a.partial} / ${a.missed}`),
    );
  }
  if (input.unexplained_moments)
    out.push("", `${input.unexplained_moments} moment(s) are not yet explained and are omitted.`);
  return out.join("\n");
}

const citationSchema = {
  type: "object",
  properties: {
    call_id: { type: "string" },
    exchange_index: { type: "integer" },
  },
  required: ["call_id", "exchange_index"],
};

export function buildRepReportTool(codes: string[] = []) {
  return {
    name: "write_rep_report",
    description: "Write the one-page coaching note for this rep.",
    parameters: {
      type: "object",
      properties: {
        headline: {
          type: "string",
          description:
            "One sentence, under 30 words: the manager's read on this rep for the period.",
        },
        patterns: {
          type: "array",
          maxItems: REPORT_LIMITS.patterns,
          description: "Up to three patterns, most costly first.",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Under 10 words." },
              guideline: {
                type: "string",
                description:
                  "The playbook guideline this breaks, quoted from the playbook, or empty.",
              },
              what_happened: {
                type: "string",
                description: "One or two sentences: what the rep did and what it cost.",
              },
              say_instead: {
                type: "string",
                description: "One line in the rep's voice, ready to say on the next call.",
              },
              cited: {
                type: "array",
                maxItems: REPORT_LIMITS.citationsPerPattern,
                items: citationSchema,
              },
            },
            required: ["title", "guideline", "what_happened", "say_instead", "cited"],
          },
        },
        strength: {
          type: "object",
          description: "One thing the rep does well, with a cited moment, or omit.",
          properties: {
            title: { type: "string" },
            what_happened: { type: "string" },
            cited: { type: "array", maxItems: 1, items: citationSchema },
          },
          required: ["title", "what_happened", "cited"],
        },
        drill: {
          type: "object",
          properties: {
            focus: { type: "string", description: "Under 12 words: what to practice this week." },
            line_to_practice: { type: "string", description: "The exact line to rehearse." },
            ...(codes.length
              ? {
                  guideline_code: {
                    type: "string",
                    enum: [...codes, "none"],
                    description:
                      "The guideline code this drill practices; 'none' only if no listed guideline fits.",
                  },
                }
              : {}),
          },
          required: ["focus", "line_to_practice", ...(codes.length ? ["guideline_code"] : [])],
        },
      },
      required: ["headline", "patterns", "drill"],
    },
  };
}
export const repReportTool = buildRepReportTool();

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Map of citable moments from the input, keyed by call and exchange. */
function citable(input: ReportInput): Map<string, CitedMoment> {
  const map = new Map<string, CitedMoment>();
  for (const theme of input.themes)
    for (const m of theme.moments) map.set(`${m.call_id}#${m.exchange_index}`, m);
  return map;
}

function resolveCitations(
  value: unknown,
  lookup: Map<string, CitedMoment>,
  max: number,
): ReportCitation[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: ReportCitation[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const key = `${c.call_id}#${c.exchange_index}`;
    const found = lookup.get(key);
    if (!found || seen.has(key)) continue;
    seen.add(key);
    out.push(found);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Validate the model's answer against the input. Patterns without a surviving
 * citation are dropped; a report with no patterns and no strength is rejected
 * (returns null) so the caller can fail loudly instead of storing an empty page.
 */
export function normalizeRepReport(
  value: unknown,
  input: ReportInput,
  codes: string[] = [],
): RepReport | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const lookup = citable(input);
  const L = REPORT_LIMITS;

  const patterns: ReportPattern[] = [];
  if (Array.isArray(v.patterns)) {
    for (const raw of v.patterns) {
      if (!raw || typeof raw !== "object") continue;
      const p = raw as Record<string, unknown>;
      const cited = resolveCitations(p.cited, lookup, L.citationsPerPattern);
      const title = str(p.title, 120);
      const what = str(p.what_happened, L.sentenceChars);
      if (!cited.length || !title || !what) continue;
      patterns.push({
        title,
        guideline: str(p.guideline, 300) || null,
        what_happened: what,
        say_instead: str(p.say_instead, L.sentenceChars),
        cited,
      });
      if (patterns.length >= L.patterns) break;
    }
  }

  let strength: RepReport["strength"] = null;
  if (v.strength && typeof v.strength === "object") {
    const s = v.strength as Record<string, unknown>;
    const cited = resolveCitations(s.cited, lookup, 1);
    const title = str(s.title, 120);
    const what = str(s.what_happened, L.sentenceChars);
    if (title && what) strength = { title, what_happened: what, cited };
  }

  if (!patterns.length && !strength) return null;

  const drillRaw =
    v.drill && typeof v.drill === "object" ? (v.drill as Record<string, unknown>) : {};
  return {
    headline: str(v.headline, L.headlineChars),
    patterns,
    strength,
    drill: {
      focus: str(drillRaw.focus, 160),
      line_to_practice: str(drillRaw.line_to_practice, L.sentenceChars),
      guideline_code:
        typeof drillRaw.guideline_code === "string" && codes.includes(drillRaw.guideline_code)
          ? drillRaw.guideline_code
          : null,
    },
    since_last: null,
    strip: [],
  };
}
