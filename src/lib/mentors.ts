/**
 * The six mentors — the faces of Launchpad. Every lesson in a founder's
 * curriculum is delegated to exactly one mentor by stage + output format;
 * the founder never picks a mentor and never sees a tool name.
 *
 * Mirrors supabase/functions/_shared/curriculum.ts and the `mentors` table
 * seed (20260706000002_mentor_curriculum.sql). Keep the three in sync.
 */

export type CurriculumStage = "Idea" | "Validate" | "Launch" | "Operate" | "Scale";
export type OutputFormat =
  | "score-verdict"
  | "contrast"
  | "intelligence-report"
  | "step-plan"
  | "pipeline-snapshot";
export type BusinessModel = "agency" | "consultant" | "service" | "sales-team" | "software";

export const CURRICULUM_STAGES: CurriculumStage[] = [
  "Idea",
  "Validate",
  "Launch",
  "Operate",
  "Scale",
];

export interface Mentor {
  id: string;
  name: string;
  /** First name, for "Maya's up next" copy. */
  first: string;
  domain: string;
  stages: CurriculumStage[];
  ownedFormat: OutputFormat | null;
  /** Written-voice descriptor; keeps each mentor's copy distinct. */
  voice: string;
  /** Avatar accent (design token reference, resolved in CSS). */
  hue: string;
  /** Conversation openers phrased in this mentor's voice. */
  prompts: string[];
}

export const MENTOR_ROSTER: Mentor[] = [
  {
    id: "maya-okafor",
    name: "Maya Okafor",
    first: "Maya",
    domain: "Offer & positioning",
    stages: ["Idea", "Validate"],
    ownedFormat: "contrast",
    voice:
      "Warm but exacting. Speaks in sharp either/or contrasts and pushes you to say the uncomfortably specific thing instead of the safely vague one.",
    hue: "var(--purple, var(--primary))",
    prompts: [
      "Give me two ways to frame my offer — which one wins?",
      "Is my offer too vague? Say it back to me sharper.",
      "Who exactly should I serve first, and who should I turn away?",
    ],
  },
  {
    id: "dhruv-patel",
    name: "Dhruv Patel",
    first: "Dhruv",
    domain: "Finance & monetization",
    stages: ["Idea", "Validate", "Launch", "Operate", "Scale"],
    ownedFormat: "score-verdict",
    voice:
      "Direct and numerate. Every opinion arrives with a number attached. Calm about bad news, allergic to hand-waving. Also covers investor readiness.",
    hue: "var(--cyan, var(--primary))",
    prompts: [
      "Run my numbers — is this price defensible?",
      "Score this business the way an investor would.",
      "Where is my margin actually going?",
    ],
  },
  {
    id: "alex-chen",
    name: "Alex Chen",
    first: "Alex",
    domain: "Go-to-market & growth",
    stages: ["Validate", "Launch"],
    ownedFormat: "intelligence-report",
    voice:
      "Energetic field-commander tone. Talks in channels, angles, and weekly experiments — and always names the single next move before the grand plan.",
    hue: "var(--success, var(--primary))",
    prompts: [
      "What's the one channel I should attack this week?",
      "Brief me on my competitors — where are they weak?",
      "What do I test first to prove people want this?",
    ],
  },
  {
    id: "james-rivera",
    name: "James Rivera",
    first: "James",
    domain: "Operations & delivery",
    stages: ["Launch", "Operate"],
    ownedFormat: "step-plan",
    voice:
      "Calm and methodical. Turns chaos into numbered steps and never assigns two things at once — the current step is the only step.",
    hue: "var(--warning, var(--primary))",
    prompts: [
      "Break my launch week into numbered steps.",
      "What's my current step — just the one?",
      "Turn my delivery mess into a checklist.",
    ],
  },
  {
    id: "priya-nair",
    name: "Priya Nair",
    first: "Priya",
    domain: "AI & automation",
    stages: ["Launch", "Operate", "Scale"],
    ownedFormat: null,
    voice:
      "Quietly futuristic and practical. Frames every automation as hours handed back, and prefers wiring one small thing today over designing a big system tomorrow.",
    hue: "var(--pink, var(--primary))",
    prompts: [
      "Which one task should stop being manual this week?",
      "What's already running by itself — and what should be next?",
      "Wire my follow-up so it happens without me.",
    ],
  },
  {
    id: "mo-latif",
    name: "Mo Latif",
    first: "Mo",
    domain: "Revenue & pipeline",
    stages: ["Launch", "Operate", "Scale"],
    ownedFormat: "pipeline-snapshot",
    voice:
      "Upbeat closer energy, grounded in the live pipeline. Talks about real deals by name, follow-up timing, and what money is stuck where.",
    hue: "var(--primary)",
    prompts: [
      "Which deal in my pipeline needs a push today?",
      "Who's gone quiet that I should follow up with?",
      "Where is money stuck in my pipeline right now?",
    ],
  },
];

export function mentorById(id: string | null | undefined): Mentor | null {
  return MENTOR_ROSTER.find((m) => m.id === id) ?? null;
}

export function mentorInitials(m: Pick<Mentor, "name">): string {
  return m.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Tool families → output format. Backend plumbing; never shown to founders. */
const FORMAT_BY_TOOL: Array<[OutputFormat, string[]]> = [
  [
    "score-verdict",
    [
      "idea-validator",
      "validate-idea",
      "kill-my-idea",
      "funding-readiness-score",
      "pricing-calculator",
      "niche-scorer",
      "idea-vs-idea",
    ],
  ],
  ["contrast", ["generate-offer", "offer", "positioning-engine", "positioning", "persona-builder"]],
  [
    "intelligence-report",
    [
      "gtm-strategy-builder",
      "gtm-strategy",
      "generate-gtm-strategy",
      "competitor-scanner",
      "research",
      "seo-audit",
      "business-plan-generator",
      "business-plan",
      "pitch-generator",
      "investor-email-writer",
      "ad-copy",
    ],
  ],
  [
    "step-plan",
    ["generate-ops-plan", "operations", "mvp-planner", "launch-checklist", "landing-page-creator"],
  ],
  [
    "pipeline-snapshot",
    [
      "first-10-customers-finder",
      "first-10-customers",
      "followup",
      "generate-followup-sequence",
      "email-sequence",
      "ai-followup-sequences",
      "lead-qualification",
      "sales-script",
      "ai-appointment-setting",
    ],
  ],
];

export function formatForTool(toolKey: string): OutputFormat | null {
  for (const [format, keys] of FORMAT_BY_TOOL) {
    if (keys.includes(toolKey)) return format;
  }
  return null;
}

/** Accepting a score-verdict casefile is what builds the curriculum. */
export function isAcceptableCasefile(toolKey: string): boolean {
  return formatForTool(toolKey) === "score-verdict";
}

/**
 * Delegation — exactly one mentor per lesson from stage + format, with
 * fallbacks so no lesson is ever orphaned. Mirrors the server logic.
 */
export function assignMentor(stage: CurriculumStage, format: OutputFormat | null): Mentor {
  const inStage = MENTOR_ROSTER.filter((m) => m.stages.includes(stage));
  if (format) {
    const exact = inStage.find((m) => m.ownedFormat === format);
    if (exact) return exact;
  } else {
    const automation = inStage.find((m) => m.ownedFormat === null);
    if (automation) return automation;
  }
  if (format) {
    const owner = MENTOR_ROSTER.find((m) => m.ownedFormat === format);
    if (owner) return owner;
  }
  return inStage[0] ?? MENTOR_ROSTER[0];
}

/** Mentors who teach in a given stage (for the curriculum map). */
export function mentorsForStage(stage: CurriculumStage): Mentor[] {
  return MENTOR_ROSTER.filter((m) => m.stages.includes(stage));
}

export const BUSINESS_MODEL_LABELS: Record<BusinessModel, string> = {
  agency: "Agency",
  consultant: "Consulting practice",
  service: "Service business",
  "sales-team": "Sales team",
  software: "Software business",
};

/** A row from playbook_lessons, as the frontend consumes it. */
export interface Lesson {
  id: string;
  playbook_id: string;
  mentor_id: string;
  stage: CurriculumStage;
  title: string;
  tool_key: string;
  output_format: OutputFormat | null;
  status: "locked" | "active" | "completed" | "skipped";
  position: number;
  summary: string | null;
  tool_run_id: string | null;
}

export interface Playbook {
  id: string;
  organization_id: string;
  casefile_run_id: string | null;
  business_model: BusinessModel;
  stage: CurriculumStage;
}

/** Module label per stage — curriculum language, not checklist language. */
export const STAGE_MODULE_LABELS: Record<CurriculumStage, string> = {
  Idea: "Clarify the idea",
  Validate: "Offer & proof",
  Launch: "First customers",
  Operate: "Run the machine",
  Scale: "Compound growth",
};
