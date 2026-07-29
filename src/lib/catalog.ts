import {
  Lightbulb,
  Skull,
  ScanSearch,
  GitCompare,
  FileText,
  Map,
  Users,
  Calculator,
  Megaphone,
  Presentation,
  Tv2,
  Mail,
  Globe,
  MailOpen,
  BarChart3,
  Search,
  CheckSquare,
  TrendingUp,
  BookOpen,
  Calendar,
  Workflow,
  MessageSquare,
  ListChecks,
  Phone,
  Layers,
  Crosshair,
  Gauge,
  type LucideIcon,
} from "lucide-react";

export type PlanTier = "0" | "49" | "149" | "299";

export interface LaunchPadTool {
  slug: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: "validate" | "plan" | "customers" | "launch" | "funding";
  plan: PlanTier; // minimum plan required
  phase: 1 | 2 | 3 | 4;
  step: number; // 1-18 in Launchpad Path
  estimatedMinutes: number;
  emoji: string;
  inputFields: Array<{
    key: string;
    label: string;
    type: "text" | "textarea" | "select";
    placeholder?: string;
    options?: string[];
    required?: boolean;
  }>;
}

export const LAUNCHPAD_TOOLS: LaunchPadTool[] = [
  // ─── PHASE 1: IGNITION (Free) ─────────────────────────────────────────────
  {
    slug: "idea-validator",
    name: "Idea Validator",
    description: "Scorecard across 8 dimensions. Get a GO/ITERATE/KILL verdict in 8 minutes.",
    icon: Lightbulb,
    category: "validate",
    plan: "0",
    phase: 1,
    step: 1,
    estimatedMinutes: 8,
    emoji: "💡",
    inputFields: [
      {
        key: "idea_description",
        label: "Describe your business idea",
        type: "textarea",
        placeholder: "What are you building? What problem does it solve?",
        required: true,
      },
      {
        key: "target_market",
        label: "Target market",
        type: "text",
        placeholder: "e.g. SaaS founders, home improvement contractors",
        required: true,
      },
      {
        key: "problem_being_solved",
        label: "Problem being solved",
        type: "textarea",
        placeholder: "The specific pain point your idea addresses",
      },
    ],
  },
  {
    slug: "kill-my-idea",
    name: "Kill My Idea",
    description: "Devil's advocate report. 10 reasons it'll fail + 3 pivots that could save it.",
    icon: Skull,
    category: "validate",
    plan: "0",
    phase: 1,
    step: 2,
    estimatedMinutes: 6,
    emoji: "💀",
    inputFields: [
      {
        key: "idea_description",
        label: "Your business idea",
        type: "textarea",
        placeholder: "Describe the idea you want stress-tested",
        required: true,
      },
      { key: "months_building", label: "Months spent on this", type: "text", placeholder: "0" },
      { key: "money_invested", label: "Money invested", type: "text", placeholder: "$0" },
    ],
  },
  {
    slug: "competitor-scanner",
    name: "Competitor Scanner",
    description: "Full competitive landscape in 3 tiers + 5 exploitable market gaps.",
    icon: ScanSearch,
    category: "validate",
    plan: "0",
    phase: 1,
    step: 3,
    estimatedMinutes: 7,
    emoji: "🔍",
    inputFields: [
      {
        key: "business_description",
        label: "Your business",
        type: "textarea",
        placeholder: "What you're building and how it works",
        required: true,
      },
      {
        key: "target_market",
        label: "Target market",
        type: "text",
        placeholder: "Who your customers are",
        required: true,
      },
      {
        key: "geography",
        label: "Geography",
        type: "text",
        placeholder: "US, Global, Europe, etc.",
      },
    ],
  },
  {
    slug: "gtm-strategy-builder",
    name: "GTM Strategy Builder",
    description: "Positioning, ICP, top 3 channels, 90-day roadmap, and KPIs.",
    icon: Map,
    category: "plan",
    plan: "0",
    phase: 1,
    step: 4,
    estimatedMinutes: 10,
    emoji: "🗺️",
    inputFields: [
      {
        key: "product_description",
        label: "Product/service",
        type: "textarea",
        placeholder: "What you're selling and how it works",
        required: true,
      },
      {
        key: "target_customer",
        label: "Target customer",
        type: "text",
        placeholder: "Be specific — job title, company type, situation",
        required: true,
      },
      {
        key: "price_point",
        label: "Price point",
        type: "text",
        placeholder: "$X/month or $X one-time",
      },
      {
        key: "stage",
        label: "Stage",
        type: "select",
        options: ["Idea", "Validating", "Launched", "Growing"],
      },
    ],
  },

  // ─── PHASE 2: LAUNCH ($49/mo) ─────────────────────────────────────────────
  {
    slug: "business-plan-generator",
    name: "Business Plan Generator",
    description: "1-page investor-ready business plan with TAM/SAM/SOM and revenue projections.",
    icon: FileText,
    category: "plan",
    plan: "49",
    phase: 2,
    step: 5,
    estimatedMinutes: 12,
    emoji: "📋",
    inputFields: [
      {
        key: "business_name",
        label: "Business name",
        type: "text",
        placeholder: "Your company name",
        required: true,
      },
      {
        key: "description",
        label: "What you do",
        type: "textarea",
        placeholder: "Product/service description",
        required: true,
      },
      { key: "target_market", label: "Target market", type: "text", required: true },
      {
        key: "revenue_model",
        label: "Revenue model",
        type: "text",
        placeholder: "Subscription, one-time, marketplace fee, etc.",
      },
      {
        key: "stage",
        label: "Stage",
        type: "select",
        options: ["Idea", "Validating", "Launched", "Growing"],
      },
    ],
  },
  {
    slug: "persona-builder",
    name: "Persona Builder",
    description: "3 ICP personas ranked by conversion potential with NEPQ-framed pain points.",
    icon: Users,
    category: "plan",
    plan: "49",
    phase: 2,
    step: 6,
    estimatedMinutes: 8,
    emoji: "👤",
    inputFields: [
      { key: "business_description", label: "Your business", type: "textarea", required: true },
      { key: "product_or_service", label: "Product/service offered", type: "text", required: true },
      { key: "pain_point", label: "Core pain point you solve", type: "textarea", required: true },
    ],
  },
  {
    slug: "pricing-calculator",
    name: "Pricing Calculator",
    description:
      "3 pricing strategies with exact numbers + revenue projections at 10/50/100 customers.",
    icon: Calculator,
    category: "plan",
    plan: "49",
    phase: 2,
    step: 7,
    estimatedMinutes: 6,
    emoji: "🧮",
    inputFields: [
      {
        key: "product_description",
        label: "What you're pricing",
        type: "textarea",
        required: true,
      },
      {
        key: "cost_to_deliver",
        label: "Cost to deliver (per unit/month)",
        type: "text",
        placeholder: "$X",
      },
      {
        key: "competitor_prices",
        label: "Competitor prices",
        type: "text",
        placeholder: "$X – $Y/month",
      },
      {
        key: "target_margin_percent",
        label: "Target gross margin %",
        type: "text",
        placeholder: "60",
      },
    ],
  },
  {
    slug: "first-10-customers-finder",
    name: "First 10 Customers Finder",
    description: "10-step playbook with full scripts to get your first paying customers.",
    icon: Megaphone,
    category: "customers",
    plan: "0",
    phase: 2,
    step: 8,
    estimatedMinutes: 10,
    emoji: "🎯",
    inputFields: [
      { key: "business_description", label: "Your business", type: "textarea", required: true },
      { key: "target_customer", label: "Target customer", type: "text", required: true },
      {
        key: "location_or_online",
        label: "Location or online",
        type: "text",
        placeholder: "Tampa FL, or Online",
      },
    ],
  },
  {
    slug: "pitch-generator",
    name: "Pitch Generator",
    description: "60-second verbal pitch + 10-slide investor narrative. Both formats included.",
    icon: Presentation,
    category: "customers",
    plan: "49",
    phase: 2,
    step: 9,
    estimatedMinutes: 8,
    emoji: "🎙️",
    inputFields: [
      { key: "business_name", label: "Business name", type: "text", required: true },
      {
        key: "one_sentence_description",
        label: "One-sentence description",
        type: "text",
        required: true,
      },
      {
        key: "traction",
        label: "Traction/metrics",
        type: "text",
        placeholder: "Revenue, users, growth rate, or pre-launch",
      },
      { key: "ask_type", label: "Pitch type", type: "select", options: ["funding", "sales"] },
    ],
  },
  {
    slug: "landing-page-creator",
    name: "Landing Page Creator",
    description: "Complete conversion-optimized landing page copy: hero, benefits, FAQ, CTA.",
    icon: Globe,
    category: "launch",
    plan: "49",
    phase: 2,
    step: 10,
    estimatedMinutes: 12,
    emoji: "🚀",
    inputFields: [
      { key: "product_name", label: "Product name", type: "text", required: true },
      { key: "target_customer", label: "Target customer", type: "text", required: true },
      { key: "primary_benefit", label: "Primary benefit/outcome", type: "text", required: true },
      { key: "price", label: "Price", type: "text", placeholder: "$X/month" },
      {
        key: "social_proof",
        label: "Social proof (testimonials, stats)",
        type: "textarea",
        placeholder: "Any reviews, case studies, or results",
      },
    ],
  },

  // ─── PHASE 3: OPERATE ($149/mo) ───────────────────────────────────────────
  {
    slug: "email-sequence",
    name: "Email Sequence Writer",
    description: "5-email sequence optimized for open rate and conversion. 4 types available.",
    icon: MailOpen,
    category: "launch",
    plan: "149",
    phase: 3,
    step: 11,
    estimatedMinutes: 8,
    emoji: "📧",
    inputFields: [
      { key: "business_name", label: "Business name", type: "text", required: true },
      { key: "product", label: "Product/service", type: "text", required: true },
      {
        key: "sequence_type",
        label: "Sequence type",
        type: "select",
        options: ["welcome", "nurture", "re-engagement", "post-sale"],
      },
    ],
  },
  {
    slug: "kpi-dashboard",
    name: "KPI Dashboard Builder",
    description: "10 custom KPIs for your business model with benchmarks and red flag thresholds.",
    icon: BarChart3,
    category: "launch",
    plan: "149",
    phase: 3,
    step: 12,
    estimatedMinutes: 10,
    emoji: "📊",
    inputFields: [
      {
        key: "business_model",
        label: "Business model",
        type: "select",
        options: ["SaaS", "agency", "ecommerce", "service", "marketplace"],
      },
      {
        key: "stage",
        label: "Stage",
        type: "select",
        options: ["Idea", "Launch", "Operate", "Scale"],
      },
      { key: "team_size", label: "Team size", type: "text", placeholder: "Solo, 2-5, 6-20, 20+" },
    ],
  },
  {
    slug: "seo-audit",
    name: "SEO Audit Tool",
    description:
      "Technical checklist, 10 target keywords, 5 content opportunities, 90-day roadmap.",
    icon: Search,
    category: "launch",
    plan: "149",
    phase: 3,
    step: 13,
    estimatedMinutes: 8,
    emoji: "🔎",
    inputFields: [
      {
        key: "website_url",
        label: "Website URL",
        type: "text",
        placeholder: "https://yoursite.com",
        required: true,
      },
      { key: "primary_keyword", label: "Primary keyword", type: "text", required: true },
      { key: "industry", label: "Industry", type: "text", required: true },
    ],
  },
  {
    slug: "launch-checklist",
    name: "Launch Checklist",
    description:
      "30/14/7/1-day countdown checklist across 6 categories with priorities and estimates.",
    icon: CheckSquare,
    category: "launch",
    plan: "149",
    phase: 3,
    step: 14,
    estimatedMinutes: 6,
    emoji: "✅",
    inputFields: [
      {
        key: "business_type",
        label: "Business type",
        type: "text",
        placeholder: "SaaS, agency, physical product, service",
        required: true,
      },
      { key: "launch_date", label: "Launch date", type: "text", placeholder: "Target launch date" },
      { key: "target_audience", label: "Target audience", type: "text", required: true },
      {
        key: "distribution_channels",
        label: "Distribution channels",
        type: "text",
        placeholder: "Email, social, paid ads, partnerships",
      },
    ],
  },

  // ─── PHASE 4: SCALE ($299/mo) ─────────────────────────────────────────────
  {
    slug: "ad-copy",
    name: "Ad Copy Generator",
    description: "5 complete ad variations across 5 psychological angles for any platform.",
    icon: Tv2,
    category: "customers",
    plan: "299",
    phase: 4,
    step: 15,
    estimatedMinutes: 8,
    emoji: "📢",
    inputFields: [
      { key: "product_description", label: "Product/service", type: "textarea", required: true },
      { key: "target_audience", label: "Target audience", type: "text", required: true },
      {
        key: "platform",
        label: "Platform",
        type: "select",
        options: ["Facebook", "Google", "TikTok", "LinkedIn", "Instagram"],
      },
      {
        key: "goal",
        label: "Campaign goal",
        type: "select",
        options: ["awareness", "leads", "sales"],
      },
    ],
  },
  {
    slug: "investor-email-writer",
    name: "Investor Email Writer",
    description: "3 cold investor email formats + 7-day follow-up sequences for each.",
    icon: Mail,
    category: "funding",
    plan: "299",
    phase: 4,
    step: 16,
    estimatedMinutes: 6,
    emoji: "💌",
    inputFields: [
      { key: "company_name", label: "Company name", type: "text", required: true },
      { key: "one_liner", label: "One-liner", type: "text", required: true },
      {
        key: "traction_metrics",
        label: "Traction metrics",
        type: "text",
        placeholder: "$X ARR, X% MoM growth, X customers",
      },
      { key: "funding_ask", label: "Funding ask", type: "text", placeholder: "$500K at $3M cap" },
      {
        key: "investor_type",
        label: "Investor type",
        type: "select",
        options: ["angel", "pre-seed VC", "seed VC", "strategic"],
      },
    ],
  },
  {
    slug: "funding-readiness-score",
    name: "Funding Readiness Score",
    description: "Investor-readiness score /100 across 8 dimensions with letter grade and roadmap.",
    icon: TrendingUp,
    category: "funding",
    plan: "299",
    phase: 4,
    step: 17,
    estimatedMinutes: 10,
    emoji: "📈",
    inputFields: [
      {
        key: "business_description",
        label: "Business description",
        type: "textarea",
        required: true,
      },
      { key: "monthly_revenue", label: "Monthly revenue", type: "text", placeholder: "$X MRR" },
      { key: "growth_rate", label: "Growth rate", type: "text", placeholder: "X% MoM" },
      { key: "team_size", label: "Team size", type: "text" },
      {
        key: "funding_target",
        label: "Funding target",
        type: "text",
        placeholder: "$X at $Y valuation",
      },
    ],
  },
  {
    slug: "business-plan",
    name: "Killer Business Plan",
    description:
      "Investor-grade business plan: full P&L, competitive analysis, funding ask, exit strategy.",
    icon: BookOpen,
    category: "funding",
    plan: "299",
    phase: 4,
    step: 18,
    estimatedMinutes: 15,
    emoji: "📖",
    inputFields: [
      { key: "company_name", label: "Company name", type: "text", required: true },
      { key: "description", label: "What you do", type: "textarea", required: true },
      { key: "market", label: "Market", type: "text", required: true },
      { key: "traction", label: "Traction", type: "text", placeholder: "Revenue, users, growth" },
      {
        key: "team",
        label: "Team",
        type: "textarea",
        placeholder: "Founder credentials and key team",
      },
      { key: "ask", label: "Funding ask", type: "text", placeholder: "$X at $Y valuation" },
    ],
  },
  // ─── Idea vs Idea (bonus tool, validate category) ─────────────────────────
  {
    slug: "idea-vs-idea",
    name: "Idea vs. Idea",
    description:
      "Head-to-head comparison across 8 axes. Clear winner declared with 90-day fast path.",
    icon: GitCompare,
    category: "validate",
    plan: "49",
    phase: 2,
    step: 0, // not in main path — bonus tool
    estimatedMinutes: 8,
    emoji: "⚡",
    inputFields: [
      { key: "idea_one", label: "Idea A", type: "textarea", required: true },
      { key: "idea_two", label: "Idea B", type: "textarea", required: true },
      { key: "founder_background", label: "Your background", type: "text" },
      {
        key: "available_capital",
        label: "Available capital",
        type: "text",
        placeholder: "$X or Bootstrap",
      },
    ],
  },

  // ─── BONUS TOOLS (not in main path — step 0) ─────────────────────────────
  {
    slug: "positioning-engine",
    name: "Positioning Engine",
    description:
      "A defensible market position in one sitting — statement, frame, and proof points.",
    icon: Crosshair,
    category: "plan",
    plan: "0",
    phase: 1,
    step: 0,
    estimatedMinutes: 9,
    emoji: "🎯",
    inputFields: [
      {
        key: "product_description",
        label: "Product/service",
        type: "textarea",
        placeholder: "What you're building and how it works",
        required: true,
      },
      {
        key: "audience",
        label: "Target audience",
        type: "text",
        placeholder: "Who this is for — be specific",
        required: true,
      },
      {
        key: "alternatives",
        label: "What they use today instead",
        type: "textarea",
        placeholder: 'Competitors, workarounds, status quo, "doing nothing"',
      },
      {
        key: "differentiator",
        label: "Your differentiator",
        type: "textarea",
        placeholder: "The one thing that makes you different — even a hunch is fine",
      },
    ],
  },
  {
    slug: "niche-scorer",
    name: "Niche Scorer",
    description: "Score any niche across audience, competition, and monetization — out of 100.",
    icon: Gauge,
    category: "validate",
    plan: "0",
    phase: 1,
    step: 0,
    estimatedMinutes: 6,
    emoji: "📊",
    inputFields: [
      {
        key: "niche_description",
        label: "Describe the niche",
        type: "textarea",
        placeholder: "Who it serves, what problem it solves, and where you'd find them",
        required: true,
      },
      {
        key: "audience_size",
        label: "Audience size signal",
        type: "select",
        options: ["Small (under 10k)", "Medium (10k–100k)", "Large (100k+)", "Not sure"],
      },
      {
        key: "competition_level",
        label: "Competition level",
        type: "select",
        options: ["Low — few real players", "Medium — some players", "High — crowded", "Not sure"],
      },
      {
        key: "monetization_signal",
        label: "How would you monetize it?",
        type: "text",
        placeholder: "e.g. subscription, one-time purchase, services, ads",
      },
    ],
  },
  {
    slug: "mvp-planner",
    name: "MVP / Build Planner",
    description:
      "Cut your idea down to a buildable MVP — scope, cut list, sequence, and milestones.",
    icon: Layers,
    category: "plan",
    plan: "49",
    phase: 2,
    step: 0,
    estimatedMinutes: 11,
    emoji: "🧱",
    inputFields: [
      {
        key: "problem",
        label: "The problem you're solving",
        type: "textarea",
        placeholder: "What pain point does this address, and for whom?",
        required: true,
      },
      {
        key: "target_user",
        label: "Target user",
        type: "text",
        placeholder: "Who will use this first?",
        required: true,
      },
      {
        key: "core_feature_hypothesis",
        label: "Core feature hypothesis",
        type: "textarea",
        placeholder: "The ONE thing your MVP must prove works",
      },
      {
        key: "build_resources",
        label: "Build resources",
        type: "select",
        options: ["Solo, no-code", "Solo + some code", "Solo developer", "Small team (2-4)"],
      },
      {
        key: "timeline",
        label: "Target timeline",
        type: "text",
        placeholder: "e.g. 4 weeks, 2 months",
      },
    ],
  },
];

// ─── Automation systems spec ───────────────────────────────────────────────

export interface AutomationSystem {
  slug: string;
  name: string;
  description: string;
  plan: PlanTier;
  trigger: string;
  action: string;
  output: string;
  configFields: Array<{
    key: string;
    label: string;
    type: "text" | "textarea" | "select" | "toggle";
    options?: string[];
    placeholder?: string;
  }>;
}

export const AUTOMATION_SYSTEMS: AutomationSystem[] = [
  {
    slug: "ai-appointment-setting",
    name: "AI Appointment Setting",
    description:
      "Automatically reaches out to new contacts via email or SMS and books calls — 24/7.",
    plan: "49",
    trigger: "New contact added",
    action: "Generate personalized outreach → send → follow up",
    output: "Booked appointments",
    configFields: [
      { key: "business_name", label: "Business name", type: "text" },
      {
        key: "cta_link",
        label: "Booking link (Calendly, etc.)",
        type: "text",
        placeholder: "https://calendly.com/you",
      },
      {
        key: "tone",
        label: "Outreach tone",
        type: "select",
        options: ["professional", "casual", "direct"],
      },
      {
        key: "channel",
        label: "Preferred channel",
        type: "select",
        options: ["email", "sms", "both"],
      },
    ],
  },
  {
    slug: "crm-automation",
    name: "CRM Automation",
    description:
      "Automatically scores leads, tags them, and routes to the right follow-up sequence.",
    plan: "49",
    trigger: "Form submission or manual import",
    action: "Score lead → tag → route to sequence",
    output: "Scored CRM record + notification",
    configFields: [
      { key: "icp_description", label: "ICP description (for AI scoring)", type: "textarea" },
      { key: "notification_email", label: "Notification email", type: "text" },
      {
        key: "pipeline_stages",
        label: "Pipeline stage names",
        type: "text",
        placeholder: "New, Contacted, Qualified, Closed",
      },
    ],
  },
  {
    slug: "ai-followup-sequences",
    name: "AI Follow-Up Sequences",
    description: "5-touch follow-up sequences automatically generated and sent per contact.",
    plan: "49",
    trigger: "Webhook from platform or CRM",
    action: "Generate 5-touch sequence → execute → stop on reply",
    output: "Replied or completed sequence",
    configFields: [
      {
        key: "sequence_type",
        label: "Default sequence type",
        type: "select",
        options: ["cold outreach", "warm follow-up", "re-engagement", "post-demo"],
      },
      {
        key: "urgency_level",
        label: "Urgency level",
        type: "select",
        options: ["low", "medium", "high"],
      },
    ],
  },
  {
    slug: "sms-automation",
    name: "SMS Automation",
    description: "AI-powered SMS outreach with intent detection and intelligent reply routing.",
    plan: "49",
    trigger: "Webhook trigger",
    action: "Generate TCPA-compliant SMS → send → interpret replies",
    output: "Engaged contact or opt-out logged",
    configFields: [
      { key: "twilio_account_sid", label: "Twilio Account SID", type: "text" },
      {
        key: "twilio_phone",
        label: "Twilio phone number",
        type: "text",
        placeholder: "+1XXXXXXXXXX",
      },
      { key: "opt_out_keyword", label: "Opt-out keyword", type: "text", placeholder: "STOP" },
      {
        key: "sending_hours",
        label: "Business sending hours",
        type: "text",
        placeholder: "9am-6pm EST",
      },
    ],
  },
  {
    slug: "lead-qualification",
    name: "Lead Qualification AI",
    description:
      "Sends BANT qualification questions, scores responses, routes to appointment or nurture.",
    plan: "149",
    trigger: "New contact or manual trigger",
    action: "Send BANT questions → parse responses → score → route",
    output: "Qualified or nurture lead",
    configFields: [
      {
        key: "budget_minimum",
        label: "Budget minimum threshold",
        type: "text",
        placeholder: "$1,000/mo",
      },
      {
        key: "decision_maker_required",
        label: "Decision maker required?",
        type: "select",
        options: ["yes", "no"],
      },
      {
        key: "disqualification_rules",
        label: "Disqualification rules",
        type: "textarea",
        placeholder: "Disqualify if budget < $X, or not decision maker",
      },
    ],
  },
  {
    slug: "voice-ai",
    name: "Voice AI Receptionist",
    description:
      "Answers inbound calls 24/7, books appointments, answers FAQs, escalates to human when needed.",
    plan: "299",
    trigger: "Inbound phone call",
    action: "Greet → understand intent → book / answer / escalate",
    output: "Booked call, answered question, or escalation alert",
    configFields: [
      {
        key: "greeting_script",
        label: "Greeting script",
        type: "textarea",
        placeholder: "Hello! You've reached [business name]...",
      },
      { key: "booking_link", label: "Booking link or calendar ID", type: "text" },
      { key: "escalation_phone", label: "Escalation phone number", type: "text" },
      {
        key: "business_hours",
        label: "Business hours",
        type: "text",
        placeholder: "Mon-Fri 9am-6pm EST",
      },
    ],
  },
];

// ─── Bylda OS systems (automation systems with display icons) ────────────────

export interface ByldaSystem {
  slug: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  output: string;
  icon: LucideIcon;
}

const BYLDA_SYSTEM_ICONS: Record<string, LucideIcon> = {
  "ai-appointment-setting": Calendar,
  "crm-automation": Workflow,
  "ai-followup-sequences": Mail,
  "sms-automation": MessageSquare,
  "lead-qualification": ListChecks,
  "voice-ai": Phone,
};

export const BYLDA_SYSTEMS: ByldaSystem[] = AUTOMATION_SYSTEMS.map((sys) => ({
  slug: sys.slug,
  name: sys.name,
  description: sys.description,
  trigger: sys.trigger,
  action: sys.action,
  output: sys.output,
  icon: BYLDA_SYSTEM_ICONS[sys.slug] ?? Workflow,
}));

// ─── Mentor specs ──────────────────────────────────────────────────────────

export const MENTORS = [
  {
    id: "strategist",
    name: "The Strategist",
    specialty: "Market positioning, competitive moats, fundraising strategy",
    plan: "149" as PlanTier,
    emoji: "♟️",
  },
  {
    id: "operator",
    name: "The Operator",
    specialty: "Systems, SOPs, hiring playbooks, operational leverage",
    plan: "149" as PlanTier,
    emoji: "⚙️",
  },
  {
    id: "growth-hacker",
    name: "The Growth Hacker",
    specialty: "Acquisition channels, virality, retention loops, CAC reduction",
    plan: "149" as PlanTier,
    emoji: "📈",
  },
  {
    id: "builder",
    name: "The Builder",
    specialty: "Product strategy, MVP scoping, technical architecture, AI integration",
    plan: "149" as PlanTier,
    emoji: "🔨",
  },
  {
    id: "closer",
    name: "The Closer",
    specialty: "Sales strategy, NEPQ, objection handling, pricing psychology",
    plan: "149" as PlanTier,
    emoji: "🤝",
  },
] as const;

export type MentorId = (typeof MENTORS)[number]["id"];

// ─── Helpers ───────────────────────────────────────────────────────────────

export function getToolBySlug(slug: string): LaunchPadTool | undefined {
  return LAUNCHPAD_TOOLS.find((t) => t.slug === slug);
}

export function getToolsByPhase(phase: 1 | 2 | 3 | 4): LaunchPadTool[] {
  return LAUNCHPAD_TOOLS.filter((t) => t.phase === phase && t.step > 0).sort(
    (a, b) => a.step - b.step,
  );
}

export function getToolsByCategory(category: LaunchPadTool["category"]): LaunchPadTool[] {
  return LAUNCHPAD_TOOLS.filter((t) => t.category === category);
}

export function canAccessTool(userPlan: PlanTier, toolPlan: PlanTier): boolean {
  const order: PlanTier[] = ["0", "49", "149", "299"];
  return order.indexOf(userPlan) >= order.indexOf(toolPlan);
}

export function canAccessAutomation(userPlan: PlanTier, automationPlan: PlanTier): boolean {
  return canAccessTool(userPlan, automationPlan);
}
