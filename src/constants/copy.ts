// TASK-012 · Lane copy
// TASK-013 · Stage copy
// TASK-014 · Mission copy
// Marketing and UI copy for each lane, stage, and mission template.

// ── Lane copy ──────────────────────────────────────────────────────────────

export const LANE_COPY = {
  Idea: {
    headline: "Turn your idea into a validated opportunity",
    subheadline:
      "Validate market fit, stress-test assumptions, and build the case before you build the product.",
    tagline: "From concept to conviction",
    emptyState: "You haven't validated an idea yet. Start with the Idea Validator.",
    ctaLabel: "Validate your idea",
    ctaPath: "/app/launchpad/idea-validator",
    color: "#6366f1",
  },
  Offer: {
    headline: "Build an offer your market can't ignore",
    subheadline:
      "Define your positioning, price, promise, and unique mechanism — all in one structured output.",
    tagline: "From idea to irresistible offer",
    emptyState: "You haven't built your core offer yet. Run the Offer Builder to get started.",
    ctaLabel: "Build your offer",
    ctaPath: "/app/launchpad/offer",
    color: "#8b5cf6",
  },
  Customer: {
    headline: "Get your first 10 paying customers",
    subheadline:
      "A step-by-step outreach playbook, ICP definition, and conversion script — built for your specific offer.",
    tagline: "From offer to revenue",
    emptyState: "No customers yet. Run First 10 Customers to build your acquisition playbook.",
    ctaLabel: "Find your first customers",
    ctaPath: "/app/launchpad/first-10-customers",
    color: "#10b981",
  },
  Systems: {
    headline: "Automate your business, reclaim your time",
    subheadline:
      "Wire automations, systematise delivery, and build a business that runs without you.",
    tagline: "From operator to owner",
    emptyState: "No automations live yet. Start with your first workflow.",
    ctaLabel: "Set up automations",
    ctaPath: "/app/bylda/workflows",
    color: "#06b6d4",
  },
} as const;

// ── Stage copy ─────────────────────────────────────────────────────────────

export const STAGE_COPY = {
  Idea: {
    label: "Idea Stage",
    description: "You're exploring a business concept and haven't validated it yet.",
    milestone: "Validate your first idea",
    successMetric: "Idea Validator score ≥ 65",
    nextStage: "Validate",
    tips: [
      "Start with the problem, not the solution",
      "Talk to 5 potential customers before building anything",
      "Use the Kill My Idea tool to expose blind spots",
    ],
  },
  Validate: {
    label: "Validate Stage",
    description: "You have an idea and are actively testing assumptions in the market.",
    milestone: "Complete market validation",
    successMetric: "≥ 3 prospect conversations completed",
    nextStage: "Launch",
    tips: [
      "Focus on signal over vanity metrics",
      "Pre-sell before you build — intent beats surveys",
      "Build a pitch deck, not a product",
    ],
  },
  Launch: {
    label: "Launch Stage",
    description: "You have a validated offer and are going to market for the first time.",
    milestone: "Close your first paying customer",
    successMetric: "First revenue received",
    nextStage: "Operate",
    tips: [
      "Launch to your existing network first",
      "Don't optimise — ship and learn",
      "Capture every lead, even the maybes",
    ],
  },
  Operate: {
    label: "Operate Stage",
    description: "You have customers and are delivering your product or service.",
    milestone: "Build repeatable delivery",
    successMetric: "5+ active customers or $5k MRR",
    nextStage: "Scale",
    tips: [
      "Document everything you do more than twice",
      "Automate before you hire",
      "Customer feedback is product roadmap",
    ],
  },
  Scale: {
    label: "Scale Stage",
    description: "You have a proven model and are growing it.",
    milestone: "Predictable revenue growth",
    successMetric: "Month-over-month revenue growth",
    nextStage: null,
    tips: [
      "Only scale what's already working",
      "Hire to your weaknesses",
      "Systems compound — invest in them now",
    ],
  },
} as const;

// ── Mission copy ───────────────────────────────────────────────────────────

export const MISSION_COPY: Record<
  string,
  {
    title: string;
    description: string;
    why: string;
    successCriteria: string;
    estimatedTime: string;
  }
> = {
  "validate-your-idea": {
    title: "Validate Your Idea",
    description:
      "Run your business idea through the Idea Validator, review the market signal score, and identify the top 3 risks to address.",
    why: "Most ideas fail not from bad execution but from bad assumptions. Validate before you build.",
    successCriteria: "Idea Validator score received and top risks documented",
    estimatedTime: "20–30 minutes",
  },
  "build-your-core-offer": {
    title: "Build Your Core Offer",
    description:
      "Define your headline, target buyer, price point, promise, and unique mechanism using the Offer Builder.",
    why: "A muddy offer is the #1 reason founders can't sell. This mission locks in your positioning.",
    successCriteria: "Offer Builder completed and offer saved",
    estimatedTime: "30–45 minutes",
  },
  "map-your-go-to-market": {
    title: "Map Your Go-to-Market",
    description:
      "Generate your GTM strategy: ICP, primary channel, messaging, and first 30-day outreach plan.",
    why: "The best offer in the world fails without a distribution plan.",
    successCriteria: "GTM Strategy generated and channel selected",
    estimatedTime: "30 minutes",
  },
  "generate-your-pitch": {
    title: "Generate Your Pitch",
    description:
      "Create an investor-ready pitch deck outline and elevator pitch you can send this week.",
    why: "Even if you're not raising, a pitch forces clarity on your value proposition.",
    successCriteria: "Pitch Generator completed and pitch saved",
    estimatedTime: "25 minutes",
  },
  "find-first-customers": {
    title: "Find Your First Customers",
    description:
      "Run the First 10 Customers tool and generate a personalised outreach playbook with specific names, channels, and scripts.",
    why: "Revenue is the only validation that matters. Get your first paying customer this week.",
    successCriteria: "First 10 Customers plan generated and first outreach sent",
    estimatedTime: "45 minutes",
  },
  "capture-first-lead": {
    title: "Capture Your First Lead",
    description:
      "Add at least one qualified prospect to your CRM pipeline and send your first outreach message.",
    why: "A pipeline with one lead is infinitely better than ideas in your head.",
    successCriteria: "Lead added to CRM and first contact attempted",
    estimatedTime: "15 minutes",
  },
  "wire-first-automation": {
    title: "Wire Your First Automation",
    description: "Set up one automated follow-up sequence so no lead goes cold.",
    why: "Consistency in follow-up beats talent in selling. Automate it.",
    successCriteria: "Automation workflow active and tested",
    estimatedTime: "60 minutes",
  },
  "close-first-deal": {
    title: "Close Your First Deal",
    description: "Move at least one lead to Won in your CRM pipeline.",
    why: "First revenue is the inflection point. Everything changes when someone pays you.",
    successCriteria: "First paying customer confirmed",
    estimatedTime: "Ongoing",
  },
};

// ── Onboarding step copy ───────────────────────────────────────────────────

export const ONBOARDING_COPY = {
  step1: {
    heading: "Let's start with you",
    subheading: "What's your name and what are you building?",
  },
  step2: {
    heading: "Where are you right now?",
    subheading: "This helps us give you the right missions for your stage.",
  },
  step3: {
    heading: "What's your biggest challenge?",
    subheading: "We'll tailor your Bylda experience to solve this first.",
  },
  complete: {
    heading: "Your workspace is ready.",
    subheading: "Your first mission has been assigned. Let's build.",
  },
} as const;
