/**
 * Server-side AI tool runner — calls the run-tool Supabase edge function.
 * The Anthropic API key lives in the edge function environment only.
 * No API key is ever exposed to the browser.
 */

import { invokeEdge } from "./invokeEdge";
import { saveToMemory } from "./saveToMemory";

const AI_TIMEOUT_MS = 120_000;

interface RunToolResponse {
  output?: Record<string, unknown>;
  run_id?: string;
  error?: string;
}

export interface RunToolOptions {
  /** A prior tool_runs.id whose output should be injected as context server-side. */
  fromRunId?: string;
}

export async function runTool(
  toolKey: string,
  input: Record<string, unknown>,
  context: { orgId: string | null; userId?: string | undefined },
  options?: RunToolOptions,
): Promise<{ output: Record<string, unknown>; run_id?: string }> {
  if (!context.orgId) throw new Error("Not signed in to an organization.");

  // Derive the primary user input for memory indexing
  const primaryInput = (
    (input.idea ||
      input.product ||
      input.topic ||
      input.context ||
      input.niche_idea ||
      input.process_description ||
      input.product_summary ||
      input.business_description ||
      input.business ||
      input.url ||
      "") as string
  ).slice(0, 500);

  // analyze-website has a dedicated function with live URL fetching — route it directly.
  const data =
    toolKey === "analyze-website"
      ? await invokeEdge<RunToolResponse>(
          "analyze-website",
          { url: ((input.url || input.context || input.idea || "") as string).trim() },
          { timeoutMs: AI_TIMEOUT_MS },
        )
      : await invokeEdge<RunToolResponse>(
          "run-tool",
          {
            toolKey,
            input,
            organizationId: context.orgId,
            fromRunId: options?.fromRunId,
          },
          { timeoutMs: AI_TIMEOUT_MS },
        );

  if (!data?.output) throw new Error("No output returned from AI. Please try again.");

  const result = {
    output: data.output as Record<string, unknown>,
    run_id: data.run_id as string | undefined,
  };

  // run-tool indexes memory server-side (full content). The client write
  // remains only for analyze-website, which doesn't go through that wrapper.
  if (toolKey === "analyze-website" && context.orgId && context.userId) {
    saveToMemory({
      orgId: context.orgId,
      userId: context.userId,
      toolName: toolKey,
      input: primaryInput,
      output: JSON.stringify(result.output, null, 2),
    });
  }

  return result;
}

/**
 * Always returns true — tools are server-side, no local key needed.
 * Kept for interface compatibility with existing imports.
 */
export function hasLocalAiKey(): boolean {
  return true;
}
