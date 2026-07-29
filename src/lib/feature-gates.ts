// Feature gating — client-side UI only.
// Critical enforcement is server-side in the run-tool edge function.
// Plan names match the subscriptions.plan enum: starter | launch | operate | scale.

export type Plan = "starter" | "launch" | "operate" | "scale";

export type FeatureKey =
  | "operator_chat"
  | "operator_unlimited"
  | "mission_engine"
  | "advanced_tools"
  | "gtm_strategy"
  | "business_plan"
  | "funding_score"
  | "first_10_customers"
  | "investor_emails"
  | "kill_my_idea"
  | "idea_vs_idea"
  | "bylda_systems"
  | "crm_pipeline"
  | "lead_capture"
  | "automation_workflows"
  | "follow_up_sequences"
  | "client_onboarding"
  | "reports_analytics"
  | "api_access"
  | "white_label"
  | "custom_integrations"
  | "priority_support";

interface FeatureConfig {
  plans: Plan[];
  limit?: number;
  label: string;
  upsell: string;
}

const FEATURE_GATES: Record<FeatureKey, FeatureConfig> = {
  operator_chat: {
    plans: ["starter", "launch", "operate", "scale"],
    label: "Operator Chat",
    upsell: "Upgrade to chat with your AI co-founder.",
  },
  operator_unlimited: {
    plans: ["launch", "operate", "scale"],
    label: "Unlimited Operator",
    upsell: "Upgrade to Launch for unlimited Operator messages.",
  },
  mission_engine: {
    plans: ["starter", "launch", "operate", "scale"],
    label: "Mission Engine",
    upsell: "Complete onboarding to access missions.",
  },
  advanced_tools: {
    plans: ["launch", "operate", "scale"],
    label: "Advanced Tools",
    upsell: "Upgrade to Launch to unlock advanced AI tools.",
  },
  gtm_strategy: {
    plans: ["starter", "launch", "operate", "scale"],
    label: "GTM Strategy",
    upsell: "Upgrade to access GTM Strategy.",
  },
  business_plan: {
    plans: ["launch", "operate", "scale"],
    label: "Business Plan",
    upsell: "Upgrade to Launch to generate business plans.",
  },
  funding_score: {
    plans: ["launch", "operate", "scale"],
    label: "Funding Score",
    upsell: "Upgrade to Launch to get your funding score.",
  },
  first_10_customers: {
    plans: ["starter", "launch", "operate", "scale"],
    label: "First 10 Customers",
    upsell: "Upgrade to access customer acquisition tools.",
  },
  investor_emails: {
    plans: ["launch", "operate", "scale"],
    label: "Investor Emails",
    upsell: "Upgrade to Launch to generate investor outreach.",
  },
  kill_my_idea: {
    plans: ["starter", "launch", "operate", "scale"],
    label: "Kill My Idea",
    upsell: "Upgrade to access idea stress-testing.",
  },
  idea_vs_idea: {
    plans: ["launch", "operate", "scale"],
    label: "Idea vs Idea",
    upsell: "Upgrade to Launch to compare ideas side by side.",
  },
  bylda_systems: {
    plans: ["starter", "launch", "operate", "scale"],
    label: "Bylda OS",
    upsell: "Upgrade to access Bylda OS systems.",
  },
  crm_pipeline: {
    plans: ["starter", "launch", "operate", "scale"],
    label: "CRM Pipeline",
    upsell: "Upgrade to access the CRM pipeline.",
  },
  lead_capture: {
    plans: ["starter", "launch", "operate", "scale"],
    label: "Lead Capture",
    upsell: "Upgrade to start capturing leads.",
  },
  automation_workflows: {
    plans: ["launch", "operate", "scale"],
    label: "Automation Workflows",
    upsell: "Upgrade to Launch to wire automations.",
  },
  follow_up_sequences: {
    plans: ["launch", "operate", "scale"],
    label: "Follow-Up Sequences",
    upsell: "Upgrade to Launch for automated follow-ups.",
  },
  client_onboarding: {
    plans: ["operate", "scale"],
    label: "Client Onboarding",
    upsell: "Upgrade to Operate for client onboarding flows.",
  },
  reports_analytics: {
    plans: ["launch", "operate", "scale"],
    label: "Reports & Analytics",
    upsell: "Upgrade to Launch for detailed reporting.",
  },
  api_access: {
    plans: ["operate", "scale"],
    label: "API Access",
    upsell: "Upgrade to Operate for API access.",
  },
  white_label: {
    plans: ["scale"],
    label: "White Label",
    upsell: "Upgrade to Scale for white-label options.",
  },
  custom_integrations: {
    plans: ["operate", "scale"],
    label: "Custom Integrations",
    upsell: "Upgrade to Operate for custom integrations.",
  },
  priority_support: {
    plans: ["operate", "scale"],
    label: "Priority Support",
    upsell: "Upgrade to Operate for priority support.",
  },
};

export interface GateResult {
  allowed: boolean;
  label: string;
  upsell: string;
  limit: number | null;
}

export function checkFeatureGate(feature: FeatureKey, plan: Plan = "starter"): GateResult {
  const config = FEATURE_GATES[feature];
  if (!config) return { allowed: false, label: feature, upsell: "Feature not found.", limit: null };
  return {
    allowed: config.plans.includes(plan),
    label: config.label,
    upsell: config.upsell,
    limit: config.limit ?? null,
  };
}

export function getAllowedFeatures(plan: Plan): FeatureKey[] {
  return (Object.entries(FEATURE_GATES) as [FeatureKey, FeatureConfig][])
    .filter(([, cfg]) => cfg.plans.includes(plan))
    .map(([key]) => key);
}

export function getBlockedFeatures(plan: Plan): FeatureKey[] {
  return (Object.entries(FEATURE_GATES) as [FeatureKey, FeatureConfig][])
    .filter(([, cfg]) => !cfg.plans.includes(plan))
    .map(([key]) => key);
}
