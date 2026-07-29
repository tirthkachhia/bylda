// TASK-055 · Lane Classification Engine
// Maps onboarding answers (stage + challenge) to one of four user lanes.
// Lanes determine first mission assignment and tool recommendations.

export type Lane = "Idea" | "Offer" | "Customer" | "Systems";

export type BusinessStage = "Idea" | "Validate" | "Launch" | "Operate" | "Scale";

export type Challenge = "fundraising" | "customers" | "product" | "marketing" | string;

// Ordered specificity: most specific conditions first.
const RULES: Array<{
  stages: string[];
  challenges: string[];
  lane: Lane;
}> = [
  // Systems — operating founders who need process/scale
  { stages: ["Operate", "Scale"], challenges: ["fundraising", "product"], lane: "Systems" },
  // Systems — Launch-stage founder raising capital needs pitch + systems
  { stages: ["Launch"], challenges: ["fundraising"], lane: "Systems" },
  // Customer — revenue-stage founders growing their customer base
  {
    stages: ["Launch", "Operate", "Scale"],
    challenges: ["customers", "marketing"],
    lane: "Customer",
  },
  // Offer — builders who need to define or refine what they're selling
  {
    stages: ["Validate", "Launch"],
    challenges: ["product", "customers", "marketing"],
    lane: "Offer",
  },
  // Idea — early founders still shaping the concept
  {
    stages: ["Idea", "Validate"],
    challenges: ["fundraising", "product", "customers", "marketing"],
    lane: "Idea",
  },
];

export function classifyLane(stage: string, challenge: string): Lane {
  for (const rule of RULES) {
    if (rule.stages.includes(stage) && rule.challenges.includes(challenge)) {
      return rule.lane;
    }
  }
  return "Idea";
}

// Human-readable label and description for each lane (used in UI)
export const LANE_META: Record<Lane, { label: string; description: string; color: string }> = {
  Idea: {
    label: "Idea Explorer",
    description:
      "You're shaping a concept. Bylda will help you validate, stress-test, and sharpen your idea into something real.",
    color: "#8b5cf6",
  },
  Offer: {
    label: "Offer Builder",
    description:
      "You're defining what you sell. Bylda will help you package, price, and position your core offer.",
    color: "#3b82f6",
  },
  Customer: {
    label: "Customer Hunter",
    description:
      "You're ready to acquire. Bylda will help you land your first customers and build repeatable outreach.",
    color: "#06b6d4",
  },
  Systems: {
    label: "Systems Operator",
    description:
      "You're scaling what works. Bylda will help you automate, delegate, and build leverage.",
    color: "#22c55e",
  },
};
