// Curriculum engine — pure logic shared by generate-playbook (and future
// lesson-refresh functions). No I/O here: classification, delegation, and the
// per-business-model lesson templates.
//
// Vocabulary:
//   stage           Idea | Validate | Launch | Operate | Scale
//   output format   score-verdict | contrast | intelligence-report |
//                   step-plan | pipeline-snapshot | null (automation work)
//   business model  agency | consultant | service | sales-team | software

export type Stage = "Idea" | "Validate" | "Launch" | "Operate" | "Scale";
export type OutputFormat =
  | "score-verdict"
  | "contrast"
  | "intelligence-report"
  | "step-plan"
  | "pipeline-snapshot";
export type BusinessModel = "agency" | "consultant" | "service" | "sales-team" | "software";

export const STAGE_ORDER: Stage[] = ["Idea", "Validate", "Launch", "Operate", "Scale"];

export interface MentorDef {
  id: string;
  name: string;
  stages: Stage[];
  ownedFormat: OutputFormat | null;
}

// Must stay in sync with the `mentors` table seed
// (supabase/migrations/20260706000002_mentor_curriculum.sql).
export const MENTOR_DEFS: MentorDef[] = [
  { id: "maya-okafor", name: "Maya Okafor", stages: ["Idea", "Validate"], ownedFormat: "contrast" },
  {
    id: "dhruv-patel",
    name: "Dhruv Patel",
    stages: ["Idea", "Validate", "Launch", "Operate", "Scale"],
    ownedFormat: "score-verdict",
  },
  {
    id: "alex-chen",
    name: "Alex Chen",
    stages: ["Validate", "Launch"],
    ownedFormat: "intelligence-report",
  },
  {
    id: "james-rivera",
    name: "James Rivera",
    stages: ["Launch", "Operate"],
    ownedFormat: "step-plan",
  },
  {
    id: "priya-nair",
    name: "Priya Nair",
    stages: ["Launch", "Operate", "Scale"],
    ownedFormat: null,
  },
  {
    id: "mo-latif",
    name: "Mo Latif",
    stages: ["Launch", "Operate", "Scale"],
    ownedFormat: "pipeline-snapshot",
  },
];

/** Tool families → the output format their casefile renders as. */
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
  return null; // automation wiring (crm-automation, sms-automation, voice-ai, …)
}

/** True when accepting this tool's casefile should build the curriculum. */
export function isAcceptableCasefile(toolKey: string): boolean {
  return formatForTool(toolKey) === "score-verdict";
}

/**
 * Delegation: exactly one mentor per lesson, from stage + output format.
 * 1. Mentor whose stage range covers the stage AND who owns the format.
 * 2. Format has no owner in range (or lesson has no format): the automation
 *    mentor (no owned format) active at that stage.
 * 3. Fallbacks so no lesson is ever orphaned: format owner regardless of
 *    stage, then any mentor active at the stage.
 */
export function assignMentor(stage: Stage, format: OutputFormat | null): MentorDef {
  const inStage = MENTOR_DEFS.filter((m) => m.stages.includes(stage));
  if (format) {
    const exact = inStage.find((m) => m.ownedFormat === format);
    if (exact) return exact;
  } else {
    const automation = inStage.find((m) => m.ownedFormat === null);
    if (automation) return automation;
  }
  if (format) {
    const owner = MENTOR_DEFS.find((m) => m.ownedFormat === format);
    if (owner) return owner;
  }
  return inStage[0] ?? MENTOR_DEFS[0];
}

/** Classify the founder's business model from onboarding + context signals. */
export function classifyBusinessModel(signals: {
  monetization?: string | null;
  industry?: string | null;
  idea?: string | null;
  niche?: string | null;
}): BusinessModel {
  const text = [signals.monetization, signals.industry, signals.idea, signals.niche]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(agency|agencies|retainer|client work|done.for.you|dfy|marketing services)/.test(text))
    return "agency";
  if (/(consult|advisor|advisory|coach|coaching|fractional|freelanc)/.test(text))
    return "consultant";
  if (/(saas|software|app\b|platform|api\b|developer|subscription product|b2b tool)/.test(text))
    return "software";
  if (/(sales team|sdr|bdr|outbound team|cold call|closing team|commission)/.test(text))
    return "sales-team";
  if (/(service|local business|cleaning|landscap|plumb|salon|studio|shop|contractor)/.test(text))
    return "service";
  // Default: most founders here sell productized services.
  return "service";
}

// ── Lesson templates ────────────────────────────────────────────────────────
// One mechanism, five business models. Each lesson: stage, plain-language
// title the founder sees, the backend tool that produces it (never shown),
// and a first-person summary written in the assigned mentor's voice.

export interface LessonTemplate {
  stage: Stage;
  title: string;
  toolKey: string;
  summary: string;
}

const SHARED_SPINE: LessonTemplate[] = [
  {
    stage: "Validate",
    title: "Say what you sell in one sentence",
    toolKey: "offer",
    summary:
      "Maya here. Before anything else, we lock the sentence: who it's for, what they get, what it costs. Two framings, we pick the sharper one.",
  },
  {
    stage: "Validate",
    title: "Put a price on it you can defend",
    toolKey: "pricing-calculator",
    summary:
      "Dhruv. Let's run your numbers — cost, margin, price floor. You'll leave with a price and the math to defend it.",
  },
  {
    stage: "Validate",
    title: "Map where your customers actually are",
    toolKey: "gtm-strategy-builder",
    summary:
      "Alex. We build your customer map this week: which channel, what message, what we test first. One move, then the plan.",
  },
  {
    stage: "Launch",
    title: "Line up your first ten conversations",
    toolKey: "first-10-customers-finder",
    summary:
      "Mo here. Ten real people, names in the pipeline, a reason to talk to each. We start conversations, not campaigns.",
  },
  {
    stage: "Launch",
    title: "Never let a warm lead go cold",
    toolKey: "email-sequence",
    summary:
      "Mo again. Most deals close on touch five to eight. We write the follow-up cadence once, so no one slips.",
  },
  {
    stage: "Launch",
    title: "Your launch week, step by step",
    toolKey: "launch-checklist",
    summary:
      "James. One numbered list for launch week. You only ever look at the current step — I'll keep the rest out of your way.",
  },
  {
    stage: "Operate",
    title: "Hand your busywork to the machine",
    toolKey: "automation",
    summary:
      "Priya. Pick one task you do by hand every week and we wire it to run itself. That's hours back, every week, forever.",
  },
  {
    stage: "Operate",
    title: "Know your numbers every Monday",
    toolKey: "kpi-dashboard",
    summary:
      "Dhruv. Three numbers that tell you the truth about the business, refreshed weekly. We decide from data, not vibes.",
  },
  {
    stage: "Scale",
    title: "Check the business is worth backing",
    toolKey: "funding-readiness-score",
    summary:
      "Dhruv. Whether or not you ever raise, we score the business like an investor would. The gaps it finds are your growth list.",
  },
];

const MODEL_OPENERS: Record<BusinessModel, LessonTemplate[]> = {
  agency: [
    {
      stage: "Validate",
      title: "Pick the niche you'll own",
      toolKey: "niche-scorer",
      summary:
        "Dhruv. Agencies die from serving everyone. We score your niche options and commit to the one with money in it.",
    },
    {
      stage: "Validate",
      title: "Package your service like a product",
      toolKey: "persona-builder",
      summary:
        "Maya. We define exactly who hires you and turn 'we do marketing' into a package with edges — scope, deliverable, price.",
    },
  ],
  consultant: [
    {
      stage: "Validate",
      title: "Turn your expertise into an offer",
      toolKey: "positioning-engine",
      summary:
        "Maya. You're the product, so positioning is everything. We contrast two ways to frame your expertise and keep the one clients pay premium for.",
    },
    {
      stage: "Validate",
      title: "Decide who you will not work with",
      toolKey: "persona-builder",
      summary:
        "Maya again. A consultant's calendar is the whole inventory. We define your ideal client — and the ones you'll decline.",
    },
  ],
  service: [
    {
      stage: "Validate",
      title: "Sharpen who you serve",
      toolKey: "persona-builder",
      summary:
        "Maya. Service businesses win on specificity. We name your exact customer, their exact problem, and the words they use for it.",
    },
    {
      stage: "Launch",
      title: "Make your service bookable",
      toolKey: "landing-page-creator",
      summary:
        "James. One page, one clear promise, one way to book you. We build it step by step this week.",
    },
  ],
  "sales-team": [
    {
      stage: "Validate",
      title: "Define who your team sells to",
      toolKey: "persona-builder",
      summary:
        "Maya. Before scripts and quotas: one page on exactly who the buyer is, so every rep tells the same story.",
    },
    {
      stage: "Launch",
      title: "Qualify leads before they waste your week",
      toolKey: "sales-script",
      summary:
        "Mo. We set the rules for what a real lead looks like, so your pipeline stops filling with maybes.",
    },
  ],
  software: [
    {
      stage: "Validate",
      title: "Scope the smallest version worth shipping",
      toolKey: "mvp-planner",
      summary:
        "James. We cut your build to the smallest thing a customer would pay for, in numbered steps with a shipping date.",
    },
    {
      stage: "Validate",
      title: "Know exactly who you're up against",
      toolKey: "competitor-scanner",
      summary:
        "Alex. Full intelligence report on your competitors — where they're weak is where you launch.",
    },
  ],
};

export interface BuiltLesson extends LessonTemplate {
  mentorId: string;
  outputFormat: OutputFormat | null;
  position: number;
  status: "active" | "locked";
}

/**
 * Build the ordered, delegated lesson set for one founder.
 * Lessons at or before the founder's current stage start unlocked with the
 * first one active; later stages stay locked until reached.
 */
export function buildLessons(model: BusinessModel, currentStage: Stage): BuiltLesson[] {
  const merged = [...MODEL_OPENERS[model], ...SHARED_SPINE].sort(
    (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage),
  );

  const stageIdx = STAGE_ORDER.indexOf(currentStage);
  let activeAssigned = false;

  return merged.map((tpl, i) => {
    const format = formatForTool(tpl.toolKey);
    const mentor = assignMentor(tpl.stage, format);
    const reachable = STAGE_ORDER.indexOf(tpl.stage) <= Math.max(stageIdx, 1);
    const status: "active" | "locked" = reachable && !activeAssigned ? "active" : "locked";
    if (status === "active") activeAssigned = true;
    return { ...tpl, mentorId: mentor.id, outputFormat: format, position: i, status };
  });
}
