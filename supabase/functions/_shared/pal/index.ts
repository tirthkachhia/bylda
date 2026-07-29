// Provider Abstraction Layer — Phase 1
// Routes all AI calls through a single interface. Currently Anthropic-only; the
// provider/model selection is plan-based and extends the existing model-router logic.
// Phase 2 will add OpenAI, Grok, and DeepSeek adapters behind the same interface.

import { CLAUDE_HAIKU_MODEL, CLAUDE_MODEL } from "../config.ts";
import type { PALCallOptions, PALResult, ProviderName } from "./types.ts";

// ─── Cost rates (mirrors ai_model_catalog seed data) ──────────────────────
// Cost in USD per 1 000 tokens.
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.0008, output: 0.004 },
  "claude-sonnet-4-6": { input: 0.003, output: 0.015 },
  "claude-opus-4-7": { input: 0.015, output: 0.075 },
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "grok-2": { input: 0.002, output: 0.01 },
  "deepseek-chat": { input: 0.00014, output: 0.00028 },
  "gemini-2.0-flash": { input: 0.000075, output: 0.0003 },
};

// Tool keys that warrant a more capable model tier.
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
  "competitor-scanner",
  "persona-builder",
  "pricing-calculator",
  "pitch-generator",
]);

const CRITICAL_TOOL_KEYS = new Set(["operator-deep-analysis", "operator"]);

// Map canonical plan names to base model tier.
function planBaseModel(plan: string): string {
  switch (plan) {
    case "starter":
      return CLAUDE_HAIKU_MODEL;
    case "launch":
      return CLAUDE_MODEL;
    case "operate":
      return CLAUDE_MODEL;
    case "scale":
      return CLAUDE_MODEL;
    default:
      return CLAUDE_MODEL;
  }
}

const MODEL_TIER = [CLAUDE_HAIKU_MODEL, CLAUDE_MODEL, "claude-opus-4-7"] as const;

/**
 * Estimates input complexity from the raw text. Returns 0-2 escalation steps.
 * Escalation triggers:
 *   +1  message > 300 chars (detailed context = needs reasoning)
 *   +1  message > 800 chars (long-form analysis)
 *   +1  contains strategy/financial keywords (complex domain)
 */
function estimateInputComplexity(input?: string): number {
  if (!input) return 0;
  const len = input.length;
  let score = 0;
  if (len > 300) score += 1;
  if (len > 800) score += 1;
  const complexTerms =
    /\b(strateg|financ|invest|revenue|competi|market\s+size|valuat|fundr|pitch\s+deck|unit\s+econom|gtm|go-to-market)\b/i;
  if (complexTerms.test(input)) score += 1;
  return Math.min(score, 2);
}

function selectModel(plan: string, toolKey?: string, rawInput?: string): string {
  const base = planBaseModel(plan);
  const baseIdx = MODEL_TIER.indexOf(base as (typeof MODEL_TIER)[number]);

  // Tool-based escalation takes priority over input-based.
  let escalation = 0;
  if (toolKey && CRITICAL_TOOL_KEYS.has(toolKey)) escalation = 2;
  else if (toolKey && COMPLEX_TOOL_KEYS.has(toolKey)) escalation = 1;
  else escalation = estimateInputComplexity(rawInput);

  return MODEL_TIER[Math.min(baseIdx + escalation, MODEL_TIER.length - 1)];
}

function calcCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const rates = MODEL_COSTS[model] ?? MODEL_COSTS["claude-sonnet-4-6"];
  return (tokensIn / 1000) * rates.input + (tokensOut / 1000) * rates.output;
}

// Virtual credits: output weighted 2x (costs more to generate), minimum 1.
function calcCredits(tokensIn: number, tokensOut: number): number {
  return Math.max(1, Math.ceil((tokensIn + tokensOut * 2) / 1000));
}

// ─── Anthropic adapter ────────────────────────────────────────────────────

async function callAnthropic(
  model: string,
  opts: PALCallOptions,
  apiKey: string,
): Promise<PALResult> {
  const t0 = Date.now();

  const messages = opts.messages ? [...opts.messages] : [];
  if (opts.userPrompt) messages.push({ role: "user", content: opts.userPrompt });

  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens ?? 8192,
    system: opts.systemPrompt,
    messages,
  };

  if (opts.tool) {
    body.tools = [
      {
        name: opts.tool.name,
        description: opts.tool.description,
        input_schema: opts.tool.parameters,
      },
    ];
    body.tool_choice = { type: "tool", name: opts.tool.name };
  }

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    if (resp.status === 429) throw new Error("RATE_LIMIT");
    if (resp.status === 402) throw new Error("PAYMENT_REQUIRED");
    const text = await resp.text();
    throw new Error(`Anthropic API ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as {
    content: Array<{ type: string; text?: string; input?: Record<string, unknown> }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  const latencyMs = Date.now() - t0;
  const tokensIn = data.usage.input_tokens;
  const tokensOut = data.usage.output_tokens;

  if (opts.tool) {
    const toolBlock = data.content.find((b) => b.type === "tool_use");
    if (!toolBlock?.input) throw new Error("No tool_use block in Anthropic response");
    return {
      content: "",
      toolResult: toolBlock.input,
      tokensIn,
      tokensOut,
      model,
      provider: "anthropic",
      latencyMs,
      actualCostUsd: calcCostUsd(model, tokensIn, tokensOut),
      credits: calcCredits(tokensIn, tokensOut),
    };
  }

  const textBlock = data.content.find((b) => b.type === "text");
  return {
    content: textBlock?.text ?? "",
    tokensIn,
    tokensOut,
    model,
    provider: "anthropic",
    latencyMs,
    actualCostUsd: calcCostUsd(model, tokensIn, tokensOut),
    credits: calcCredits(tokensIn, tokensOut),
  };
}

// ─── Ollama adapter ───────────────────────────────────────────────────────
// Uses Ollama's OpenAI-compatible /v1/chat/completions endpoint.
// Tool_use is NOT supported — only conversational routes reach this adapter.

async function callOllama(
  model: string,
  opts: PALCallOptions,
  baseUrl: string,
): Promise<PALResult> {
  const t0 = Date.now();

  // Build messages array: system message first, then history/user prompt.
  const messages: { role: string; content: string }[] = [];
  if (opts.systemPrompt) messages.push({ role: "system", content: opts.systemPrompt });
  if (opts.messages) {
    for (const m of opts.messages) messages.push({ role: m.role, content: m.content });
  } else if (opts.userPrompt) {
    messages.push({ role: "user", content: opts.userPrompt });
  }

  const url = `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts.maxTokens ?? 800,
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Ollama ${resp.status}: ${text}`);
    }

    const data = (await resp.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content = data.choices?.[0]?.message?.content ?? "";
    const tokensIn = data.usage?.prompt_tokens ?? 0;
    const tokensOut = data.usage?.completion_tokens ?? 0;

    return {
      content,
      tokensIn,
      tokensOut,
      model,
      provider: "ollama",
      latencyMs: Date.now() - t0,
      actualCostUsd: 0, // local inference — zero cost
      credits: 1, // always minimum 1 credit
      routingReason: "ollama_private",
    };
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// ─── Main PAL entry point ─────────────────────────────────────────────────

export async function callPAL(
  opts: PALCallOptions,
  env: { ANTHROPIC_API_KEY?: string },
  plan = "starter",
  toolKey?: string,
  rawInput?: string,
  ollamaEndpoint?: string,
  ollamaModel?: string,
): Promise<PALResult> {
  // Derive raw text for complexity scoring: prefer explicit rawInput, else last user message.
  const inputText =
    rawInput ?? opts.userPrompt ?? opts.messages?.filter((m) => m.role === "user").at(-1)?.content;

  // ── Ollama private routing: org-configured endpoint, no tool_use required ──
  // Try Ollama first; fall back to Anthropic silently on any error.
  if (ollamaEndpoint && !opts.tool) {
    const model = ollamaModel ?? "llama3.2";
    try {
      return await callOllama(model, opts, ollamaEndpoint);
    } catch {
      // Ollama unreachable or returned an error — fall through to Anthropic
    }
  }

  const model = opts.model ?? selectModel(plan, toolKey, inputText);
  const provider: ProviderName = "anthropic"; // Phase 1 cloud default

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  // Retry with Haiku fallback on rate-limit or transient errors.
  const models = model === CLAUDE_HAIKU_MODEL ? [CLAUDE_HAIKU_MODEL] : [model, CLAUDE_HAIKU_MODEL];

  let lastError: Error | null = null;
  for (const m of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 800 * attempt));
        return await callAnthropic(m, opts, apiKey);
      } catch (e) {
        lastError = e as Error;
        if ((e as Error).message === "PAYMENT_REQUIRED") throw e; // never retry
      }
    }
  }
  throw lastError ?? new Error("AI call failed");
}

// ─── Credit helper ────────────────────────────────────────────────────────

/** Build credit_ledger + usage_events rows from a PALResult. Call fire-and-forget. */
export function buildUsageRows(
  result: PALResult,
  opts: {
    userId: string;
    orgId: string | null;
    workspaceId: string | null;
    eventType: string;
    resourceKey: string;
  },
): {
  creditRow: Record<string, unknown>;
  usageRow: Record<string, unknown> | null;
} {
  const creditRow = {
    user_id: opts.userId,
    tool: opts.resourceKey,
    cost: result.credits,
    status: "confirmed",
    actual_cost_usd: result.actualCostUsd,
    provider_name: result.provider,
    model_id: result.model,
    meta: {
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
      latency_ms: result.latencyMs,
    },
  };

  const usageRow = opts.orgId
    ? {
        user_id: opts.userId,
        workspace_id: opts.workspaceId,
        organization_id: opts.orgId,
        event_type: opts.eventType,
        resource_key: opts.resourceKey,
        credits_used: result.credits,
        tokens_in: result.tokensIn,
        tokens_out: result.tokensOut,
        model: result.model,
        duration_ms: result.latencyMs,
        status: "succeeded",
        provider_name: result.provider,
        actual_cost_usd: result.actualCostUsd,
        routing_reason: result.routingReason ?? "plan_default",
      }
    : null;

  return { creditRow, usageRow };
}
