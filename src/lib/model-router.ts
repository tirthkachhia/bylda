// TASK-085 · Model routing
// Selects the appropriate Claude model based on the user's plan and task complexity.
// Higher plans get more capable models; complex reasoning tasks also escalate.
//
// Plan names match the canonical DB plan_tier enum: starter | launch | operate | scale.
// (Previously used growth/pro/accelerator — those were wrong and are fixed here.)

export type Plan = "starter" | "launch" | "operate" | "scale";
export type TaskComplexity = "simple" | "standard" | "complex" | "critical";
export type ProviderName =
  | "anthropic"
  | "openai"
  | "grok"
  | "deepseek"
  | "perplexity"
  | "gemini"
  | "openrouter"
  | "ollama";

export type ClaudeModel = "claude-haiku-4-5-20251001" | "claude-sonnet-4-6" | "claude-opus-4-7";

export interface ModelConfig {
  model: ClaudeModel;
  maxTokens: number;
  label: string;
}

export interface ProviderModelPair extends ModelConfig {
  provider: ProviderName;
}

const PLAN_MODELS: Record<Plan, ClaudeModel> = {
  starter: "claude-haiku-4-5-20251001",
  launch: "claude-sonnet-4-6",
  operate: "claude-sonnet-4-6",
  scale: "claude-sonnet-4-6",
};

const COMPLEXITY_ESCALATION: Record<TaskComplexity, number> = {
  simple: 0,
  standard: 0,
  complex: 1,
  critical: 2,
};

const MODEL_TIER: ClaudeModel[] = [
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-6",
  "claude-opus-4-7",
];

const MODEL_CONFIGS: Record<ClaudeModel, ModelConfig> = {
  "claude-haiku-4-5-20251001": {
    model: "claude-haiku-4-5-20251001",
    maxTokens: 1024,
    label: "Fast",
  },
  "claude-sonnet-4-6": { model: "claude-sonnet-4-6", maxTokens: 4096, label: "Balanced" },
  "claude-opus-4-7": { model: "claude-opus-4-7", maxTokens: 8192, label: "Expert" },
};

const COMPLEX_TOOL_KEYS = new Set([
  "generate-gtm-strategy",
  "business-plan",
  "business-plan-generator",
  "investor-emails",
  "investor-email-writer",
  "idea-vs-idea",
  "funding-score",
  "funding-readiness-score",
  "kill-my-idea",
]);

const CRITICAL_TOOL_KEYS = new Set(["operator-deep-analysis"]);

export function routeModel(
  plan: Plan = "starter",
  toolKey?: string,
  complexity?: TaskComplexity,
): ModelConfig {
  const baseTierIdx = MODEL_TIER.indexOf(PLAN_MODELS[plan]);

  let derivedComplexity: TaskComplexity = complexity ?? "standard";
  if (!complexity && toolKey) {
    if (CRITICAL_TOOL_KEYS.has(toolKey)) derivedComplexity = "critical";
    else if (COMPLEX_TOOL_KEYS.has(toolKey)) derivedComplexity = "complex";
  }

  const escalation = COMPLEXITY_ESCALATION[derivedComplexity];
  const targetIdx = Math.min(baseTierIdx + escalation, MODEL_TIER.length - 1);
  const model = MODEL_TIER[targetIdx];

  return MODEL_CONFIGS[model];
}

/** Returns model config plus the provider name. Phase 1: always Anthropic. */
export function routeModelWithProvider(
  plan: Plan = "starter",
  toolKey?: string,
  complexity?: TaskComplexity,
): ProviderModelPair {
  return { ...routeModel(plan, toolKey, complexity), provider: "anthropic" };
}

export function getModelForPlan(plan: Plan): ClaudeModel {
  return PLAN_MODELS[plan];
}

export function getModelConfig(model: ClaudeModel): ModelConfig {
  return MODEL_CONFIGS[model];
}
