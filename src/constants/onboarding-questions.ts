// Two-track onboarding question definitions.
// Track A (create): founders going idea → launch. Conversational, fast.
// Track B (operate): operators running a real business. Structured intake.
// Both tracks write the same canonical answer keys consumed by the
// complete-onboarding edge function and the Business Context Graph.

export type IntakeChipOption = { id: string; label: string; desc: string; emoji: string };

export type IntakeQuestion =
  | {
      key: string;
      type: "text";
      byldaText: string;
      placeholder: string;
      optional?: boolean;
      /**
       * Draft-before-type scaffold. When present, the field offers a "Draft it
       * for me" action (and doubles as the idle-user fallback) that pre-fills
       * this starter for the user to lightly edit — never a blank page. Kept as
       * a fill-in-the-blank template today; a draft-intake-field edge call can
       * replace the string later without any shape change.
       */
      suggestion?: string;
    }
  | {
      key: string;
      type: "chips";
      byldaText: string;
      options: IntakeChipOption[];
      /** Idle-user fallback: option id Bylda picks when the user taps "not sure". */
      recommend?: string;
    }
  | {
      key: string;
      type: "multi";
      byldaText: string;
      options: IntakeChipOption[];
      max?: number;
      /** Idle-user fallback: option ids Bylda picks when the user taps "not sure". */
      recommend?: string[];
    };

// ── Track detection — 3 quick signal questions ─────────────────────────────────
// These are asked BEFORE either track begins. The user never picks a track;
// resolveMode() computes it from these signals. Their answers are then merged
// into the session answers so they flow through to complete-onboarding.

export const DETECT_QUESTIONS: IntakeQuestion[] = [
  {
    key: "has_revenue",
    type: "chips",
    byldaText: "Before we dive in — where's the business today?",
    options: [
      { id: "none", label: "Not making money yet", desc: "Pre-revenue", emoji: "🌱" },
      { id: "some", label: "Some revenue", desc: "A little coming in", emoji: "🟡" },
      { id: "consistent", label: "Consistent revenue", desc: "Repeatable income", emoji: "🟢" },
    ],
  },
  {
    key: "team_size_detect",
    type: "chips",
    byldaText: "How big is the team right now?",
    options: [
      { id: "solo", label: "Just me", desc: "Solo", emoji: "🧍" },
      { id: "team", label: "2 or more people", desc: "There's a team", emoji: "👥" },
    ],
  },
  {
    key: "has_clients",
    type: "chips",
    byldaText: "Do you have active paying clients or customers today?",
    options: [
      { id: "no", label: "Not yet", desc: "No active clients", emoji: "⬜" },
      {
        id: "yes",
        label: "Yes, active clients",
        desc: "Real relationships to manage",
        emoji: "✅",
      },
    ],
  },
];

// Compute the track from detection signals. A user is on the CREATE track only
// when they're pre-revenue, solo, AND without active clients — otherwise there's
// a running business to operate.
export function resolveMode(a: Record<string, string | string[]>): "create" | "operate" {
  const noRevenue = a.has_revenue === "none";
  const solo = a.team_size_detect === "solo";
  const noClients = a.has_clients === "no";
  return noRevenue && solo && noClients ? "create" : "operate";
}

// ── Track A — CREATE A BUSINESS ────────────────────────────────────────────────

export const FOUNDER_QUESTIONS: IntakeQuestion[] = [
  {
    key: "idea",
    type: "text",
    byldaText:
      "Let's build this business.\n\nI'll set up a workspace tuned to exactly where you are. Takes about two minutes.\n\nFirst: what's the business you want to build?",
    placeholder: "Describe your idea in a sentence or two…",
    suggestion:
      "I'm building a [product or service] that helps [who it's for] to [the outcome they want]. Right now they struggle with [the problem].",
  },
  {
    key: "industry",
    type: "chips",
    byldaText: "Got it.\n\nWhich of these is closest to what you're building?",
    options: [
      {
        id: "SaaS / software",
        label: "SaaS / software",
        desc: "Web or mobile product",
        emoji: "🧩",
      },
      {
        id: "Services / agency",
        label: "Services / agency",
        desc: "Done-for-you work",
        emoji: "🛠️",
      },
      { id: "E-commerce", label: "E-commerce", desc: "Physical or digital products", emoji: "📦" },
      {
        id: "Content / creator",
        label: "Content / creator",
        desc: "Audience-first business",
        emoji: "🎬",
      },
      {
        id: "Local business",
        label: "Local business",
        desc: "Serving a physical area",
        emoji: "📍",
      },
      {
        id: "Marketplace / other",
        label: "Something else",
        desc: "Marketplace, hardware, other",
        emoji: "🧭",
      },
    ],
  },
  {
    key: "target_customer",
    type: "chips",
    byldaText: "Who are you building this for?",
    options: [
      {
        id: "Small businesses",
        label: "Small businesses",
        desc: "Local shops, agencies, SMBs",
        emoji: "🏢",
      },
      { id: "Consumers", label: "Consumers", desc: "Everyday people (B2C)", emoji: "👤" },
      {
        id: "Freelancers/Creators",
        label: "Freelancers / Creators",
        desc: "Solopreneurs, creators",
        emoji: "✏️",
      },
      {
        id: "Enterprises",
        label: "Enterprises",
        desc: "Mid-market or large companies",
        emoji: "🏦",
      },
    ],
  },
  {
    key: "stage",
    type: "chips",
    byldaText: "Where are you at with it right now?",
    options: [
      { id: "Idea", label: "Just an idea", desc: "Haven't started building yet", emoji: "💡" },
      {
        id: "Validate",
        label: "Validating it",
        desc: "Testing whether people want it",
        emoji: "🧪",
      },
      { id: "Launch", label: "Building / launching", desc: "Creating the real thing", emoji: "🔨" },
    ],
  },
  {
    key: "assets",
    type: "multi",
    byldaText: "What do you already have? Pick everything that's true.",
    max: 6,
    options: [
      { id: "nothing", label: "Nothing yet", desc: "Starting from zero", emoji: "⬜" },
      { id: "landing_page", label: "Landing page", desc: "A page is live", emoji: "🌐" },
      { id: "audience", label: "Audience / waitlist", desc: "People are watching", emoji: "📣" },
      { id: "prototype", label: "Prototype / MVP", desc: "Something works", emoji: "⚙️" },
      { id: "first_users", label: "First users", desc: "People are using it", emoji: "👥" },
      { id: "first_revenue", label: "First revenue", desc: "Someone has paid", emoji: "💵" },
    ],
  },
  {
    key: "monetization",
    type: "chips",
    byldaText: "How do you plan to make money?",
    recommend: "Not sure yet",
    options: [
      { id: "Subscription", label: "Subscription", desc: "Recurring monthly revenue", emoji: "🔁" },
      { id: "One-time sales", label: "One-time sales", desc: "Pay once, own it", emoji: "🛒" },
      {
        id: "Services / retainer",
        label: "Services / retainer",
        desc: "Billed for work",
        emoji: "🧾",
      },
      {
        id: "Not sure yet",
        label: "Not sure yet",
        desc: "Bylda will help you decide",
        emoji: "🤔",
      },
    ],
  },
  {
    key: "goal",
    type: "chips",
    byldaText: "What's your number one goal for the next 90 days?",
    options: [
      {
        id: "Get first customers",
        label: "Get first customers",
        desc: "Land paying customers ASAP",
        emoji: "🎯",
      },
      {
        id: "Validate before building",
        label: "Validate first",
        desc: "Prove demand before building",
        emoji: "🧪",
      },
      {
        id: "Launch publicly",
        label: "Launch publicly",
        desc: "Get the real thing live",
        emoji: "🚀",
      },
      {
        id: "Raise funding",
        label: "Raise funding",
        desc: "Secure investment capital",
        emoji: "💸",
      },
    ],
  },
  {
    key: "challenge",
    type: "chips",
    byldaText: "What's your biggest blocker right now?",
    options: [
      {
        id: "Finding customers",
        label: "Finding customers",
        desc: "Lead gen and acquisition",
        emoji: "🔍",
      },
      {
        id: "Building product",
        label: "Building the product",
        desc: "Product development speed",
        emoji: "⚙️",
      },
      { id: "Marketing", label: "Marketing & content", desc: "Getting visibility", emoji: "📣" },
      { id: "Fundraising", label: "Raising capital", desc: "Getting funded", emoji: "💰" },
    ],
  },
  {
    key: "time_constraint",
    type: "chips",
    byldaText: "How much time can you actually give this?",
    options: [
      { id: "Side project", label: "Nights & weekends", desc: "Around a day job", emoji: "🌙" },
      { id: "Part-time", label: "Part-time", desc: "A few days a week", emoji: "⏳" },
      { id: "Full-time", label: "Full-time", desc: "This is the job", emoji: "🔥" },
    ],
  },
  {
    key: "experience",
    type: "chips",
    byldaText: "Last one — have you built a business before?",
    options: [
      { id: "First business", label: "First business", desc: "This is the first one", emoji: "🌱" },
      {
        id: "Built before",
        label: "Built before",
        desc: "Started something previously",
        emoji: "🔁",
      },
      {
        id: "Exited before",
        label: "Exited before",
        desc: "Sold or scaled one already",
        emoji: "🏆",
      },
    ],
  },
];

// ── Track B — OPERATE A BUSINESS ───────────────────────────────────────────────

export const OPERATOR_QUESTIONS: IntakeQuestion[] = [
  {
    key: "business_name",
    type: "text",
    byldaText:
      "Let's get your operation on the grid.\n\nI'll map how your business runs today — model, motion, bottlenecks — and build your ops cockpit from it. About three minutes.\n\nFirst: what's the business called?",
    placeholder: "Business name…",
  },
  {
    key: "business_description",
    type: "text",
    byldaText: "And in one or two sentences — what does it do, and for whom?",
    placeholder: "e.g. We run paid ads for dental clinics in Texas…",
    suggestion:
      "We help [who it's for] with [what you do], so they can [the outcome]. We're different because [what sets you apart].",
  },
  {
    key: "company_type",
    type: "chips",
    byldaText: "Which best describes the business?",
    options: [
      {
        id: "Agency / services",
        label: "Agency / services",
        desc: "Client work, retainers",
        emoji: "🛠️",
      },
      {
        id: "SaaS / software",
        label: "SaaS / software",
        desc: "Product subscriptions",
        emoji: "🧩",
      },
      { id: "E-commerce", label: "E-commerce", desc: "Selling products online", emoji: "📦" },
      {
        id: "Local / brick-and-mortar",
        label: "Local business",
        desc: "Physical location(s)",
        emoji: "📍",
      },
      { id: "Consulting", label: "Consulting", desc: "Expertise, advisory", emoji: "🎓" },
      {
        id: "Content / media",
        label: "Content / media",
        desc: "Audience and attention",
        emoji: "🎬",
      },
    ],
  },
  {
    key: "service_model",
    type: "chips",
    byldaText: "What do you actually sell?",
    options: [
      {
        id: "Productized service",
        label: "Productized service",
        desc: "Fixed scope, fixed price",
        emoji: "📐",
      },
      { id: "Custom services", label: "Custom services", desc: "Scoped per client", emoji: "✍️" },
      { id: "Software", label: "Software", desc: "Subscriptions or licenses", emoji: "💻" },
      {
        id: "Physical products",
        label: "Physical products",
        desc: "Inventory and shipping",
        emoji: "📦",
      },
    ],
  },
  {
    key: "revenue_band",
    type: "chips",
    byldaText: "Roughly where is monthly revenue today?",
    options: [
      { id: "$0-5k", label: "$0 – $5k / mo", desc: "Finding repeatability", emoji: "🟡" },
      { id: "$5-20k", label: "$5k – $20k / mo", desc: "Working, needs systems", emoji: "🟠" },
      { id: "$20-100k", label: "$20k – $100k / mo", desc: "Scaling the machine", emoji: "🟢" },
      { id: "$100k+", label: "$100k+ / mo", desc: "Optimizing at scale", emoji: "💎" },
    ],
  },
  {
    key: "team_size",
    type: "chips",
    byldaText: "How big is the team?",
    options: [
      { id: "Solo", label: "Just me", desc: "Solo operator", emoji: "🧍" },
      { id: "2-5", label: "2 – 5 people", desc: "Small core team", emoji: "👥" },
      { id: "6-15", label: "6 – 15 people", desc: "Real org forming", emoji: "🏢" },
      { id: "16+", label: "16+ people", desc: "Departments exist", emoji: "🏟️" },
    ],
  },
  {
    key: "tool_stack",
    type: "multi",
    byldaText: "Which tools does the business already run on? Pick all that apply.",
    max: 9,
    options: [
      { id: "Stripe", label: "Stripe", desc: "Payments", emoji: "💳" },
      { id: "Shopify", label: "Shopify", desc: "Store", emoji: "🛍️" },
      { id: "CRM", label: "A CRM", desc: "HubSpot, Pipedrive…", emoji: "📇" },
      { id: "Notion", label: "Notion", desc: "Docs & ops", emoji: "📓" },
      { id: "Slack", label: "Slack", desc: "Team comms", emoji: "💬" },
      { id: "QuickBooks", label: "QuickBooks", desc: "Accounting", emoji: "📒" },
      { id: "Google Workspace", label: "Google Workspace", desc: "Email, docs", emoji: "📧" },
      { id: "Paid ads", label: "Meta / Google Ads", desc: "Paid acquisition", emoji: "📈" },
      { id: "None of these", label: "None of these", desc: "Mostly manual today", emoji: "📝" },
    ],
  },
  {
    key: "bottlenecks",
    type: "multi",
    byldaText: "Where does the business slow down most? Pick up to 3.",
    max: 3,
    options: [
      { id: "Lead flow", label: "Lead flow", desc: "Not enough prospects", emoji: "🔍" },
      { id: "Sales conversion", label: "Sales conversion", desc: "Leads don't close", emoji: "🤝" },
      {
        id: "Fulfillment / delivery",
        label: "Fulfillment",
        desc: "Delivery eats all time",
        emoji: "🚚",
      },
      { id: "Hiring / team", label: "Hiring & team", desc: "People bottleneck", emoji: "🧑‍🤝‍🧑" },
      {
        id: "Reporting / visibility",
        label: "Reporting",
        desc: "Flying blind on numbers",
        emoji: "📊",
      },
      { id: "Churn / retention", label: "Churn", desc: "Customers leave", emoji: "🚪" },
      {
        id: "Founder time",
        label: "Founder time",
        desc: "Everything routes through you",
        emoji: "⏰",
      },
    ],
  },
  {
    key: "channels",
    type: "multi",
    byldaText: "How do new customers find you today? Pick all that apply.",
    max: 6,
    options: [
      { id: "Referrals", label: "Referrals", desc: "Word of mouth", emoji: "🗣️" },
      { id: "Outbound", label: "Outbound", desc: "Cold email / DMs / calls", emoji: "📤" },
      { id: "Paid ads", label: "Paid ads", desc: "Meta, Google, TikTok", emoji: "💰" },
      {
        id: "SEO / content",
        label: "SEO / content",
        desc: "They find you organically",
        emoji: "📝",
      },
      { id: "Social", label: "Social", desc: "Audience-driven", emoji: "📱" },
      {
        id: "Partnerships",
        label: "Partnerships",
        desc: "Other businesses send you work",
        emoji: "🤝",
      },
    ],
  },
  {
    key: "sales_maturity",
    type: "chips",
    byldaText: "How developed is your sales process?",
    options: [
      {
        id: "No defined process",
        label: "No real process",
        desc: "Deals happen ad hoc",
        emoji: "🎲",
      },
      { id: "Founder-led", label: "Founder-led", desc: "You close everything", emoji: "🧍" },
      { id: "Documented process", label: "Documented", desc: "Steps written down", emoji: "📋" },
      { id: "Sales team", label: "Sales team", desc: "Others close deals", emoji: "🏢" },
    ],
  },
  {
    key: "reporting_gaps",
    type: "multi",
    byldaText: "Which numbers do you NOT see clearly every week?",
    max: 6,
    options: [
      { id: "Revenue", label: "Revenue", desc: "True monthly picture", emoji: "💵" },
      { id: "Pipeline", label: "Pipeline", desc: "Deals in motion", emoji: "🔄" },
      { id: "CAC", label: "Acquisition cost", desc: "Cost per customer", emoji: "🧮" },
      { id: "Churn", label: "Churn", desc: "Who's leaving and why", emoji: "🚪" },
      { id: "Margins", label: "Margins", desc: "What you actually keep", emoji: "📉" },
      { id: "Team utilization", label: "Team utilization", desc: "Where hours go", emoji: "⏱️" },
    ],
  },
  {
    key: "automation_appetite",
    type: "chips",
    byldaText: "How do you feel about automation?",
    options: [
      {
        id: "Already automate",
        label: "Already automating",
        desc: "Have live workflows",
        emoji: "🤖",
      },
      {
        id: "Want suggestions",
        label: "Show me what's possible",
        desc: "Ready to deploy",
        emoji: "💡",
      },
      { id: "Skeptical", label: "Skeptical — prove it", desc: "Show ROI first", emoji: "🧐" },
    ],
  },
  {
    key: "scale_goal",
    type: "chips",
    byldaText: "Last one — what does winning look like in 12 months?",
    options: [
      { id: "2x revenue", label: "2x revenue", desc: "Grow the top line", emoji: "📈" },
      {
        id: "Same revenue, less founder time",
        label: "Buy back my time",
        desc: "Same revenue, less of you",
        emoji: "🕊️",
      },
      { id: "New product line", label: "New product line", desc: "Expand the offer", emoji: "🧩" },
      { id: "Prepare to sell", label: "Prepare to sell", desc: "Make it acquirable", emoji: "🏷️" },
      { id: "Build the team", label: "Build the team", desc: "Hire and delegate", emoji: "🧑‍🤝‍🧑" },
    ],
  },
];
