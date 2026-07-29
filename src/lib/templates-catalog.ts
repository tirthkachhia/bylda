// Shared template library — founder-type and operator-vertical presets.
// Templates reference existing catalog slugs; applying one pre-selects recommended
// tools/automations and surfaces "Recommended for your template" hints in the UI.
// Defined as static content (like academy-modules.ts / integrations-catalog.ts) —
// no admin CRUD system needed for v1.

export type TemplateAudience = "founder" | "operator";

export type FounderType = "agency" | "saas" | "info-product" | "local-service" | "ai-tool";

export type VerticalType = "medspa" | "home-improvement" | "agency-operator" | "service-business";

export type TemplateSlug = FounderType | VerticalType;

export interface AppTemplate {
  slug: TemplateSlug;
  name: string;
  description: string;
  audience: TemplateAudience;
  emoji: string;
  tags: string[];
  recommendedTools: string[];
  recommendedAutomations: string[];
  checklistFocus: Array<"domain" | "email" | "legal" | "banking" | "tools">;
}

export const TEMPLATES: AppTemplate[] = [
  // ─── Founder templates ────────────────────────────────────────────────────
  {
    slug: "agency",
    name: "Agency",
    description:
      "Service-based business selling outcomes to clients — web design, marketing, ops, consulting, or any other professional service.",
    audience: "founder",
    emoji: "🏢",
    tags: ["services", "clients", "proposals", "retainers"],
    recommendedTools: [
      "positioning-engine",
      "persona-builder",
      "pricing-calculator",
      "pitch-generator",
      "email-sequence",
      "first-10-customers-finder",
    ],
    recommendedAutomations: ["crm-automation", "ai-followup-sequences", "lead-qualification"],
    checklistFocus: ["email", "legal", "banking"],
  },
  {
    slug: "saas",
    name: "SaaS",
    description:
      "Software-as-a-service product with recurring subscription revenue — B2B tools, productivity apps, developer platforms.",
    audience: "founder",
    emoji: "⚙️",
    tags: ["product", "subscription", "B2B", "software"],
    recommendedTools: [
      "mvp-planner",
      "idea-validator",
      "positioning-engine",
      "niche-scorer",
      "competitor-scanner",
      "pricing-calculator",
      "landing-page-creator",
      "pitch-generator",
    ],
    recommendedAutomations: ["crm-automation", "ai-followup-sequences", "lead-qualification"],
    checklistFocus: ["domain", "email", "legal", "banking"],
  },
  {
    slug: "info-product",
    name: "Info Product",
    description:
      "Courses, digital downloads, memberships, newsletters, or community — packaged knowledge sold at scale.",
    audience: "founder",
    emoji: "📚",
    tags: ["courses", "content", "digital", "community"],
    recommendedTools: [
      "niche-scorer",
      "persona-builder",
      "pricing-calculator",
      "positioning-engine",
      "email-sequence",
      "landing-page-creator",
      "ad-copy",
    ],
    recommendedAutomations: ["ai-followup-sequences", "crm-automation"],
    checklistFocus: ["domain", "email", "banking", "tools"],
  },
  {
    slug: "local-service",
    name: "Local Service",
    description:
      "Location-based business serving a specific geography — trades, personal services, food & beverage, retail.",
    audience: "founder",
    emoji: "📍",
    tags: ["local", "geography", "brick-and-mortar", "trades"],
    recommendedTools: [
      "niche-scorer",
      "competitor-scanner",
      "first-10-customers-finder",
      "pricing-calculator",
      "positioning-engine",
    ],
    recommendedAutomations: ["sms-automation", "crm-automation", "ai-appointment-setting"],
    checklistFocus: ["legal", "banking", "tools"],
  },
  {
    slug: "ai-tool",
    name: "AI Tool",
    description:
      "AI-powered product — wrapper, agent, fine-tuned model, or AI-native workflow tool — typically developer-first or prosumer.",
    audience: "founder",
    emoji: "🤖",
    tags: ["AI", "developer", "automation", "LLM"],
    recommendedTools: [
      "mvp-planner",
      "idea-validator",
      "competitor-scanner",
      "positioning-engine",
      "niche-scorer",
      "landing-page-creator",
      "pitch-generator",
    ],
    recommendedAutomations: ["ai-followup-sequences", "lead-qualification"],
    checklistFocus: ["domain", "email", "legal", "banking"],
  },

  // ─── Operator / vertical templates ───────────────────────────────────────
  {
    slug: "medspa",
    name: "Med Spa",
    description:
      "Medical aesthetics practice — injectables, laser, body contouring, skincare. Drives revenue through appointment volume and memberships.",
    audience: "operator",
    emoji: "💆",
    tags: ["aesthetics", "appointments", "memberships", "healthcare"],
    recommendedTools: ["kpi-dashboard", "email-sequence", "ad-copy"],
    recommendedAutomations: [
      "ai-appointment-setting",
      "sms-automation",
      "crm-automation",
      "ai-followup-sequences",
    ],
    checklistFocus: ["email", "tools"],
  },
  {
    slug: "home-improvement",
    name: "Home Improvement",
    description:
      "Contracting, remodeling, HVAC, plumbing, landscaping, or any trade business that wins jobs through estimates and referrals.",
    audience: "operator",
    emoji: "🔨",
    tags: ["trades", "contractors", "estimates", "referrals"],
    recommendedTools: ["first-10-customers-finder", "pricing-calculator", "email-sequence"],
    recommendedAutomations: [
      "sms-automation",
      "crm-automation",
      "ai-followup-sequences",
      "lead-qualification",
    ],
    checklistFocus: ["email", "banking", "tools"],
  },
  {
    slug: "agency-operator",
    name: "Agency (Operator)",
    description:
      "Running an agency with multiple client accounts — need ops systems, reporting, approvals, and workflow automation at scale.",
    audience: "operator",
    emoji: "📊",
    tags: ["agency", "clients", "reporting", "ops"],
    recommendedTools: ["kpi-dashboard", "email-sequence"],
    recommendedAutomations: ["crm-automation", "ai-followup-sequences", "lead-qualification"],
    checklistFocus: ["email", "legal", "tools"],
  },
  {
    slug: "service-business",
    name: "Service Business",
    description:
      "General service operation — coaching, consulting, cleaning, beauty, fitness, or any people-powered service with recurring clients.",
    audience: "operator",
    emoji: "🤝",
    tags: ["services", "recurring", "scheduling", "follow-up"],
    recommendedTools: ["pricing-calculator", "first-10-customers-finder", "email-sequence"],
    recommendedAutomations: [
      "crm-automation",
      "ai-appointment-setting",
      "sms-automation",
      "ai-followup-sequences",
    ],
    checklistFocus: ["email", "banking", "tools"],
  },
];

export const TEMPLATE_BY_SLUG = Object.fromEntries(TEMPLATES.map((t) => [t.slug, t]));

export const FOUNDER_TEMPLATES = TEMPLATES.filter((t) => t.audience === "founder");
export const OPERATOR_TEMPLATES = TEMPLATES.filter((t) => t.audience === "operator");
