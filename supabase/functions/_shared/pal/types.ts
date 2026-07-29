export type ProviderName =
  | "anthropic"
  | "openai"
  | "grok"
  | "deepseek"
  | "perplexity"
  | "gemini"
  | "openrouter"
  | "ollama";

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface PALMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PALCallOptions {
  systemPrompt: string;
  /** Single-turn: pass userPrompt. Multi-turn: pass messages (last must be user role). */
  userPrompt?: string;
  messages?: PALMessage[];
  tool?: ToolSchema;
  maxTokens?: number;
  /** Override the auto-selected model. */
  model?: string;
}

export interface PALResult {
  content: string;
  toolResult?: Record<string, unknown>;
  tokensIn: number;
  tokensOut: number;
  model: string;
  provider: ProviderName;
  latencyMs: number;
  /** Real USD cost calculated from ai_model_catalog rates. */
  actualCostUsd: number;
  /** Virtual credits consumed (weights output tokens 2x, minimum 1). */
  credits: number;
  /** Why this provider/model was selected — stored in usage_events.routing_reason. */
  routingReason?: string;
}
