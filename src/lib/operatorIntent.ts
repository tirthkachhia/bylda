/**
 * Operator intent parser.
 *
 * Pure, presentational helper: maps a free-text user prompt to a
 * {tool slug + prefilled fields + label} suggestion. No backend logic.
 *
 * Returns at most one structured "Action" suggestion. The Operator
 * component still shows static Tools/Pages and recent runs alongside it.
 */

export type OperatorIntent = {
  /** Launchpad tool slug, e.g. "idea-validator" */
  toolSlug: string;
  /** Pretty action label shown in the palette */
  label: string;
  /** Short hint shown under the label */
  hint: string;
  /** Search params to forward to the tool route */
  search: { context?: string; title?: string };
};

type Pattern = {
  /** Tool slug to route to */
  slug: string;
  /** Pretty label prefix, e.g. "Validate idea" */
  verb: string;
  /** Patterns that capture an optional context (group 1) */
  matchers: RegExp[];
  /** Trigger words alone (no context) — still routes, no prefill */
  bareTriggers: RegExp[];
};

const PATTERNS: Pattern[] = [
  {
    slug: "idea-validator",
    verb: "Validate idea",
    matchers: [
      /^validat(?:e|ion)\s+(?:my\s+|the\s+|an?\s+|this\s+)?(?:idea\s+(?:for\s+|about\s+)?)?(.+)$/i,
      /^(?:test|pressure[- ]test|critique|stress[- ]test)\s+(?:my\s+|the\s+|an?\s+|this\s+)?(?:idea\s+(?:for\s+|about\s+)?)?(.+)$/i,
      /^(?:i\s+have\s+an?\s+idea\s+(?:for\s+|about\s+)?)(.+)$/i,
      /^(?:idea\s+for\s+)(.+)$/i,
    ],
    bareTriggers: [/^validate$/i, /^idea$/i, /^test\s+idea$/i],
  },
  {
    slug: "pitch-generator",
    verb: "Generate pitch",
    matchers: [
      /^(?:generate|create|write|build|draft|make)\s+(?:a\s+|an\s+|my\s+)?(?:investor\s+)?pitch\s+(?:for\s+|about\s+)?(.+)$/i,
      /^pitch\s+(?:for\s+|about\s+)(.+)$/i,
    ],
    bareTriggers: [/^pitch$/i, /^pitch\s+(?:me|generator)$/i, /^investor\s+pitch$/i],
  },
  {
    slug: "gtm-strategy",
    verb: "Build GTM strategy",
    matchers: [
      /^(?:generate|create|write|build|draft|make|plan)\s+(?:a\s+|an\s+|my\s+)?(?:gtm|go[- ]to[- ]market)\s+(?:strategy\s+|plan\s+)?(?:for\s+|about\s+)?(.+)$/i,
      /^(?:gtm|go[- ]to[- ]market)\s+(?:for\s+|about\s+)(.+)$/i,
    ],
    bareTriggers: [/^gtm$/i, /^go[- ]to[- ]market$/i, /^build\s+(?:my\s+)?gtm$/i, /^strategy$/i],
  },
  {
    slug: "offer",
    verb: "Build offer",
    matchers: [
      /^(?:generate|create|write|build|draft|make)\s+(?:an?\s+|my\s+)?offer\s+(?:for\s+|about\s+)?(.+)$/i,
      /^offer\s+(?:for\s+)(.+)$/i,
    ],
    bareTriggers: [/^offer$/i, /^build\s+(?:an?\s+)?offer$/i, /^pricing$/i],
  },
  {
    slug: "ops-plan",
    verb: "Generate ops plan",
    matchers: [
      /^(?:generate|create|write|build|draft|make|plan)\s+(?:an?\s+|my\s+)?(?:ops|operations)\s+(?:plan\s+)?(?:for\s+|about\s+)?(.+)$/i,
      /^(?:automate|operationalize)\s+(.+)$/i,
    ],
    bareTriggers: [/^ops$/i, /^operations$/i, /^ops\s+plan$/i, /^automate$/i],
  },
  {
    slug: "followup",
    verb: "Write follow-up sequence",
    matchers: [
      /^(?:generate|create|write|build|draft|make)\s+(?:a\s+)?(?:follow[- ]up|email)\s+(?:sequence\s+)?(?:for\s+|about\s+)?(.+)$/i,
      /^follow\s+up\s+(?:with\s+)(.+)$/i,
    ],
    bareTriggers: [/^follow[- ]?up$/i, /^email\s+sequence$/i, /^sequence$/i],
  },
  {
    slug: "website-audit",
    verb: "Audit website",
    matchers: [
      /^(?:audit|analyze|analyse|review|check)\s+(?:my\s+|the\s+)?(?:website|site|landing\s+page|url)\s*[:-]?\s*(.+)$/i,
      /^(?:website|site)\s+(?:audit|review|analysis)\s+(?:for\s+)?(.+)$/i,
      /^(https?:\/\/\S+)$/i,
    ],
    bareTriggers: [/^audit$/i, /^website\s+audit$/i, /^seo$/i],
  },
  {
    slug: "first-10-customers",
    verb: "Plan first 10 customers",
    matchers: [
      /^(?:get|find|win|acquire|plan)\s+(?:my\s+)?first\s+(?:10|ten)\s+customers\s+(?:for\s+|about\s+)?(.+)$/i,
      /^(?:first\s+(?:10|ten)\s+customers\s+for\s+)(.+)$/i,
    ],
    bareTriggers: [/^first\s+(?:10|ten)(?:\s+customers)?$/i, /^acquisition$/i],
  },
];

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "for",
  "about",
  "my",
  "our",
  "this",
  "that",
  "to",
  "of",
]);

function deriveTitle(context: string, max = 60): string {
  const words = context.trim().split(/\s+/).filter(Boolean);
  // Skip leading stop-words
  while (words.length && STOP_WORDS.has(words[0].toLowerCase())) words.shift();
  const joined = words.slice(0, 8).join(" ");
  return joined.length > max ? joined.slice(0, max - 1).trimEnd() + "…" : joined;
}

/**
 * Try to extract a structured Operator intent from a free-text prompt.
 * Returns null if nothing confidently matches.
 */
export function parseOperatorIntent(raw: string): OperatorIntent | null {
  const q = raw.trim();
  if (!q) return null;

  for (const p of PATTERNS) {
    // Pattern with captured context wins first (gives us prefill)
    for (const re of p.matchers) {
      const m = q.match(re);
      if (m && m[1]) {
        const ctx = m[1].trim().replace(/[.,;:!?]+$/, "");
        if (ctx.length > 0) {
          return {
            toolSlug: p.slug,
            label: `${p.verb}: ${ctx}`,
            hint: "Opens the tool with this context prefilled",
            search: { context: ctx, title: deriveTitle(ctx) },
          };
        }
      }
    }
    // Bare trigger ("validate", "pitch") — route without prefill
    for (const re of p.bareTriggers) {
      if (re.test(q)) {
        return {
          toolSlug: p.slug,
          label: `Open ${p.verb.replace(/^(Generate|Build|Write|Audit|Plan|Validate)\s+/, "").replace(/^./, (c) => c.toUpperCase())}`,
          hint: `Jump to ${p.verb.toLowerCase()}`,
          search: {},
        };
      }
    }
  }

  return null;
}
