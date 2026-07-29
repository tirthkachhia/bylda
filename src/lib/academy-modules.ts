export type ModuleState = "locked" | "available" | "active" | "complete" | "mastered";

export interface AcademyModule {
  id: string;
  title: string;
  description: string;
  learnContent: string;
  outcome: string;
  tools: string[];
  xpReward: number;
  requiredStage: string;
  planet: string;
  emoji: string;
  color: string;
}

export const ACADEMY_MODULES: AcademyModule[] = [
  {
    id: "idea-validation",
    title: "Idea Validation",
    description:
      "Test your idea before building anything. Get a ruthless assessment and a clear GO/ITERATE/KILL verdict.",
    learnContent:
      "Every successful business starts with a validated problem. Before writing a single line of code or creating any product, you need to pressure-test your idea against real market signals. This module gives you three powerful lenses to evaluate your idea: a structured scorecard, a brutal devil's advocate analysis, and a head-to-head comparison.",
    outcome: "Validated idea with GO/ITERATE/KILL verdict + market score",
    tools: ["idea-validator", "kill-my-idea", "idea-vs-idea", "competitor"],
    xpReward: 280,
    requiredStage: "Idea",
    planet: "validation",
    emoji: "💡",
    color: "#7DD3FC",
  },
  {
    id: "offer-creation",
    title: "Offer Creation",
    description:
      "Build an irresistible offer. Define your pricing, create your pitch, and validate with real customers.",
    learnContent:
      "The offer is the core of your business. It's not just what you sell — it's the transformation you deliver. A strong offer has a clear promise, a defined outcome, and a price that feels like a no-brainer for the right customer. In this module, you'll build and validate your complete offer from scratch.",
    outcome: "Validated offer with pricing, pitch, and customer promise",
    tools: ["pitch-generator", "pricing", "gtm-strategy"],
    xpReward: 320,
    requiredStage: "Validate",
    planet: "branding",
    emoji: "🎯",
    color: "#A78BFA",
  },
  {
    id: "branding",
    title: "Brand & Messaging",
    description: "Create your brand voice, messaging framework, and first content assets.",
    learnContent:
      "Your brand is the emotional context around your offer. It's how people feel when they interact with your company. In this module, you'll define your brand voice, create your core messaging, and launch your first content presence.",
    outcome: "Brand identity, messaging framework, and initial content",
    tools: ["landing-page", "blog"],
    xpReward: 220,
    requiredStage: "Validate",
    planet: "branding",
    emoji: "✨",
    color: "#F59E0B",
  },
  {
    id: "website",
    title: "Launch Website",
    description:
      "Build a high-converting landing page that captures leads and communicates your offer.",
    learnContent:
      "Your website is your 24/7 sales rep. It needs to communicate your offer clearly, capture leads, and build trust in under 8 seconds. This module helps you create landing page copy that converts visitors into prospects.",
    outcome: "Live landing page with clear CTA and lead capture",
    tools: ["landing-page"],
    xpReward: 180,
    requiredStage: "Validate",
    planet: "website",
    emoji: "🌐",
    color: "#34D399",
  },
  {
    id: "lead-generation",
    title: "Lead Generation",
    description: "Build your pipeline. Find your first 10 customers and create an outreach system.",
    learnContent:
      "Revenue solves almost every startup problem. Getting to your first customers isn't about having a perfect product — it's about finding people who have the problem you solve and are willing to pay for the solution. This module gives you the playbook for finding and converting your first 10 paying customers.",
    outcome: "10 qualified prospects + outreach system + email sequences",
    tools: ["first-10-customers", "investor-emails"],
    xpReward: 350,
    requiredStage: "Launch",
    planet: "marketing",
    emoji: "🚀",
    color: "#FB923C",
  },
  {
    id: "automation",
    title: "Automation Setup",
    description:
      "Build your automation stack. Set up follow-up sequences, lead capture, and CRM workflows.",
    learnContent:
      "Manual processes don't scale. Once you have initial traction, automation becomes your unfair advantage. In this module, you'll build the core automation systems that let you serve more customers without proportionally more work.",
    outcome: "Automated follow-up system + CRM pipeline + lead capture",
    tools: ["gtm-strategy"],
    xpReward: 280,
    requiredStage: "Launch",
    planet: "automation",
    emoji: "⚡",
    color: "#5EEAD4",
  },
  {
    id: "sales",
    title: "Sales System",
    description:
      "Build a repeatable sales process. Create your sales scripts, objection handlers, and close framework.",
    learnContent:
      "Sales is a skill, not a talent. With the right framework, scripts, and objection handlers, you can consistently convert prospects into customers. This module gives you the complete sales system that top founders use.",
    outcome: "Sales script + objection handlers + closing framework",
    tools: ["pitch-generator", "gtm-strategy"],
    xpReward: 300,
    requiredStage: "Launch",
    planet: "sales",
    emoji: "💰",
    color: "#F5A623",
  },
  {
    id: "scaling",
    title: "Scale & Growth",
    description:
      "Build for scale. Create your business plan, revenue projections, and funding strategy.",
    learnContent:
      "Scaling requires systems, capital, and clarity. In this module, you'll build the foundational documents and strategies needed to take your business to the next level — whether through organic growth, team expansion, or external funding.",
    outcome: "Business plan + revenue projections + funding readiness assessment",
    tools: ["business-plan", "revenue-projector", "funding-score"],
    xpReward: 420,
    requiredStage: "Operate",
    planet: "scaling",
    emoji: "📈",
    color: "#FF6B1A",
  },
];

export function getModuleById(id: string): AcademyModule | undefined {
  return ACADEMY_MODULES.find((m) => m.id === id);
}

export function getModuleState(
  module: AcademyModule,
  completedToolSlugs: Set<string>,
  orgStage: string,
): ModuleState {
  const STAGE_ORDER = ["Idea", "Validate", "Launch", "Operate", "Scale"];
  const moduleStageIdx = STAGE_ORDER.indexOf(module.requiredStage);
  const userStageIdx = STAGE_ORDER.indexOf(orgStage);

  if (userStageIdx < moduleStageIdx - 1) return "locked";

  const completedTools = module.tools.filter((t) => completedToolSlugs.has(t));
  const allComplete = completedTools.length >= module.tools.length;
  const someComplete = completedTools.length > 0;

  if (allComplete) return "complete";
  if (someComplete) return "active";
  if (userStageIdx >= moduleStageIdx - 1) return "available";
  return "locked";
}
