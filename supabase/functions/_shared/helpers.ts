// Shared helpers for AI edge functions
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import { CLAUDE_MODEL } from "./config.ts";
import { callPAL, buildUsageRows } from "./pal/index.ts";
import type { PALResult } from "./pal/types.ts";
import { assembleContext } from "./context.ts";
import { fetchResearch } from "./perplexity.ts";
import { getResearchConfig } from "./tool-research-map.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export type AuthCtx = {
  supabase: SupabaseClient;
  userId: string;
  organizationId: string;
  plan: string;
  allowedTools: string[];
  monthlyLimit: number | null;
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function authenticateAndAuthorize(
  req: Request,
  toolKey: string,
): Promise<AuthCtx | Response> {
  const auth = req.headers.get("Authorization");
  if (!auth) return jsonResponse({ error: "Missing auth" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return jsonResponse({ error: "Invalid token" }, 401);
  const userId = userData.user.id;

  // Resolve org
  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!member) return jsonResponse({ error: "No organization" }, 403);
  const organizationId = member.organization_id as string;

  // Subscription + entitlements
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const plan = (sub?.plan as string) || "starter";

  // Query plan_tier_limits (the canonical entitlements table)
  const { data: ent } = await supabase
    .from("plan_tier_limits")
    .select("allowed_tools, monthly_generation_limit")
    .eq("plan", plan)
    .maybeSingle();

  const allowedTools = (ent?.allowed_tools as string[]) || [];
  const monthlyLimit = (ent?.monthly_generation_limit as number | null) ?? null;

  if (!allowedTools.includes(toolKey)) {
    return jsonResponse(
      { error: `Tool '${toolKey}' not available on '${plan}' plan`, code: "PLAN_GATE" },
      403,
    );
  }

  // Atomic quota consumption — check + count in one advisory-locked function
  // so concurrent runs can never both squeeze past a nearly-exhausted limit.
  // Failed runs hand the credit back via refundQuota in the catch paths.
  const { data: allowed, error: quotaErr } = await supabase.rpc("consume_quota", {
    p_organization_id: organizationId,
    p_tool_key: toolKey,
    p_monthly_limit: monthlyLimit,
  });
  if (quotaErr) {
    // Legacy soft check if the RPC isn't deployed yet — never block on infra lag.
    console.error("[consume_quota] rpc failed, soft-checking:", quotaErr.message);
    if (monthlyLimit !== null) {
      const period = new Date().toISOString().slice(0, 7);
      const { data: usageRows } = await supabase
        .from("usage_tracking")
        .select("count")
        .eq("organization_id", organizationId)
        .eq("period", period);
      const total = (usageRows || []).reduce((s, r) => s + (r.count as number), 0);
      if (total >= monthlyLimit) {
        return jsonResponse(
          { error: `Monthly limit reached (${monthlyLimit})`, code: "QUOTA" },
          429,
        );
      }
    }
    await incrementUsageLegacy(supabase, organizationId, toolKey);
  } else if (allowed === false) {
    return jsonResponse({ error: `Monthly limit reached (${monthlyLimit})`, code: "QUOTA" }, 429);
  }

  return { supabase, userId, organizationId, plan, allowedTools, monthlyLimit };
}

/** Give the quota credit back when a run fails after consume_quota counted it. */
export async function refundQuota(ctx: AuthCtx, toolKey: string): Promise<void> {
  await ctx.supabase
    .rpc("refund_quota", { p_organization_id: ctx.organizationId, p_tool_key: toolKey })
    .then(
      () => {},
      (e: unknown) => console.error("[refund_quota] non-fatal:", e),
    );
}

async function incrementUsageLegacy(
  supabase: SupabaseClient,
  organizationId: string,
  toolKey: string,
) {
  const period = new Date().toISOString().slice(0, 7);
  const { data: existing } = await supabase
    .from("usage_tracking")
    .select("id, count")
    .eq("organization_id", organizationId)
    .eq("period", period)
    .eq("tool_key", toolKey)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("usage_tracking")
      .update({ count: (existing.count as number) + 1, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("usage_tracking").insert({
      organization_id: organizationId,
      period,
      tool_key: toolKey,
      count: 1,
    });
  }
}

/**
 * @deprecated Quota is now consumed atomically inside authenticateAndAuthorize
 * (consume_quota RPC). Kept as a no-op-compatible export so existing function
 * code keeps compiling; calling it would double-count.
 */
export async function incrementUsage(_ctx: AuthCtx, _toolKey: string) {
  // intentionally empty — counting happens in consume_quota
}

// ─── callClaude (legacy — kept for feedback-loop, memory-query) ───────────

export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  schema: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  },
): Promise<Record<string, unknown>> {
  const result = await callPAL(
    { systemPrompt, userPrompt, tool: schema },
    { ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY") },
  );
  if (!result.toolResult) throw new Error("No tool_use block in response");
  return result.toolResult;
}

// ─── callClaudeTracked — returns PALResult with usage info ────────────────

export async function callClaudeTracked(
  systemPrompt: string,
  userPrompt: string,
  schema: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  },
  plan = "starter",
  toolKey?: string,
): Promise<PALResult> {
  return callPAL(
    { systemPrompt, userPrompt, tool: schema },
    { ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY") },
    plan,
    toolKey,
    userPrompt, // raw input for complexity scoring
  );
}

// ─── writeUsage — persists credit_ledger + usage_events ──────────────────

export async function writeUsage(
  admin: SupabaseClient,
  result: PALResult,
  opts: {
    userId: string;
    orgId: string | null;
    workspaceId: string | null;
    eventType: string;
    resourceKey: string;
  },
): Promise<void> {
  const { creditRow, usageRow } = buildUsageRows(result, opts);

  await Promise.allSettled([
    admin.from("credit_ledger").insert(creditRow),
    usageRow ? admin.from("usage_events").insert(usageRow) : Promise.resolve(),
  ]);
}

// ─── runTool — central tool execution wrapper ─────────────────────────────

// Appended to every tool schema: the output contract that makes results
// auditable (context receipt) and actionable (structured next actions).
function withOutputContract(schema: {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}) {
  const params = schema.parameters as { properties?: Record<string, unknown> };
  return {
    ...schema,
    parameters: {
      ...schema.parameters,
      properties: {
        ...(params.properties ?? {}),
        context_used: {
          type: "array",
          items: { type: "string" },
          description:
            "The specific facts from FOUNDER CONTEXT that shaped this output (verbatim short phrases). Empty array only if no context was provided.",
        },
        recommended_next_actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["tool", "manual"] },
              target: {
                type: "string",
                description: "Tool key when type=tool (e.g. 'gtm-strategy-builder'), else empty",
              },
              label: { type: "string", description: "Short imperative action label" },
              reason: {
                type: "string",
                description: "Why this is the next move for THIS business",
              },
            },
            required: ["type", "label", "reason"],
          },
          description: "1-3 concrete next actions ranked by leverage for this specific business.",
        },
      },
    },
  };
}

/**
 * Canonical tool_key -> Casefile output_shape mapping. Kept in sync with
 * public.tool_output_shape() (migration) and deriveOutputShape() in
 * src/lib/casefile.ts. Returns null for unmapped tools so the frontend can
 * surface them rather than silently defaulting to a memo.
 */
export function toolOutputShape(toolKey: string): string | null {
  const EXPLICIT: Record<string, string> = {
    "validate-idea": "score_verdict",
    "idea-validator": "score_verdict",
    "kill-my-idea": "score_verdict",
    "funding-readiness-score": "score_verdict",
    "funding-readiness": "score_verdict",
    "score-idea": "score_verdict",
    validate: "score_verdict",
    "pricing-strategy": "comparison",
    "pricing-calculator": "comparison",
    "competitor-scanner": "comparison",
    "competitor-analysis": "comparison",
    compare: "comparison",
    "business-plan": "report",
    "generate-gtm-strategy": "report",
    "gtm-strategy-builder": "report",
    positioning: "report",
    research: "report",
    "market-research": "report",
    "analyze-website": "report",
    "generate-offer": "report",
    "generate-pitch": "report",
    "investor-emails": "report",
    decision: "memo",
    "pricing-memo": "memo",
    "first-10-customers": "plan_with_steps",
    "first-10-customers-finder": "plan_with_steps",
    "generate-followup-sequence": "plan_with_steps",
    "launch-plan": "plan_with_steps",
    "90-day-plan": "plan_with_steps",
    "action-plan": "plan_with_steps",
    "generate-gtm-plan": "plan_with_steps",
    "pipeline-snapshot": "pipeline_snapshot",
    "crm-snapshot": "pipeline_snapshot",
    forecast: "pipeline_snapshot",
    "forecast-rollup": "pipeline_snapshot",
    "mentor-session": "session_summary",
    "session-summary": "session_summary",
    "coaching-session": "session_summary",
  };
  if (EXPLICIT[toolKey]) return EXPLICIT[toolKey];
  const k = toolKey.toLowerCase();
  if (/(valid|readiness|assess)/.test(k)) return "score_verdict";
  if (/(pric|compar|competitor|versus)/.test(k)) return "comparison";
  if (/(pipeline|forecast|snapshot)/.test(k)) return "pipeline_snapshot";
  if (/(mentor|session|coaching)/.test(k)) return "session_summary";
  if (/(sequence|customers|outreach|roadmap|steps|plan)/.test(k)) return "plan_with_steps";
  if (/(report|research|analy|strateg|gtm|positioning|pitch|offer)/.test(k)) return "report";
  return null;
}

// ── Guidance contract (research-enriched tools only) ─────────────────────────
// Applied on top of each tool's existing prompt + schema — never replacing
// them. Turns conclusions into a direction plus an ordered, launchable plan.
const GUIDANCE_CONTRACT_PROMPT = `

## STRUCTURED GUIDANCE RULES
Also populate the structured presentation fields (verdict, chips, drawers, guidance, nextTool):
- verdict.label: the call in <=6 words; verdict.detail: 1-2 sentences; verdict.score 0-100 with scoreType.
- chips: 2-4 glanceable stats a founder reads in 3 seconds, each with a tone.
- drawers: the depth, grouped (strengths / risks / evidence), collapsed by default in the UI.
- guidance.direction: ONE sentence — the single clear move this whole answer points to.
- guidance.steps: 3-5 ordered, imperative next moves that execute the direction. Each step is a real
  action in sequence, specific to THIS founder's context and the research findings — never generic.
  Step 1 MUST include a launch object pointing at the right next Launchpad tool. Later steps include
  launch only when a tool genuinely does that work; manual steps omit it.
- Ground every number and named competitor in the provided research; do not invent sources.`;

function withGuidanceContract(schema: {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}) {
  const params = schema.parameters as { properties?: Record<string, unknown> };
  return {
    ...schema,
    parameters: {
      ...schema.parameters,
      properties: {
        ...(params.properties ?? {}),
        verdict: {
          type: "object",
          properties: {
            label: { type: "string", description: "<=6 words" },
            detail: { type: "string", description: "1-2 sentences" },
            score: { type: "number", description: "0-100" },
            scoreType: { type: "string", enum: ["confidence", "threat", "opportunity"] },
          },
        },
        chips: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              value: { type: "string" },
              tone: { type: "string", enum: ["neutral", "good", "warning", "bad"] },
            },
          },
        },
        drawers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              icon: { type: "string", enum: ["trophy", "alert-triangle", "target-arrow"] },
              title: { type: "string" },
              tone: { type: "string", enum: ["good", "warning", "accent"] },
              items: { type: "array", items: { type: "string" } },
            },
          },
        },
        guidance: {
          type: "object",
          properties: {
            direction: {
              type: "string",
              description: "1 sentence — the single clear move this answer points to",
            },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  n: { type: "number" },
                  title: { type: "string", description: "imperative" },
                  detail: { type: "string", description: "1 sentence how" },
                  launch: {
                    type: "object",
                    properties: {
                      slug: { type: "string", description: "Launchpad tool slug" },
                      label: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
        longform: { type: "string", description: "optional markdown prose" },
        nextTool: {
          type: "object",
          properties: { slug: { type: "string" }, label: { type: "string" } },
        },
      },
    },
  };
}

const CONTEXT_CONTRACT_PROMPT = `

## CONTEXT RULES
- A FOUNDER CONTEXT block may precede the task input. Treat it as verified fact about THIS business. Reference its specifics (name, niche, stage, numbers) in your first two sentences.
- If your recommendation contradicts a prior Bylda output included in context, name the contradiction explicitly and justify the change.
- If context is missing a fact you need, state the single most important missing fact instead of generalizing.
- Always populate context_used with the exact context facts you relied on, and recommended_next_actions with 1-3 ranked, concrete moves (use type "tool" + the tool key when a Launchpad tool is the right move).`;

export async function runTool(opts: {
  req: Request;
  toolKey: string;
  systemPrompt: string;
  buildUserPrompt: (input: Record<string, unknown>) => string;
  schema: { name: string; description: string; parameters: Record<string, unknown> };
  assetCategory: string;
  assetTitle: (input: Record<string, unknown>, output: Record<string, unknown>) => string;
  preloadedInput?: Record<string, unknown>;
  /** Prior run to chain from — its output is injected into context. */
  fromRunId?: string;
}) {
  if (opts.req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authResult = await authenticateAndAuthorize(opts.req, opts.toolKey);
  if (authResult instanceof Response) return authResult;
  const ctx = authResult;

  let input: Record<string, unknown>;
  if (opts.preloadedInput !== undefined) {
    input = opts.preloadedInput;
  } else {
    try {
      input = await opts.req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }
  }

  // Insert running tool_run
  const { data: run, error: runErr } = await ctx.supabase
    .from("tool_runs")
    .insert({
      organization_id: ctx.organizationId,
      user_id: ctx.userId,
      surface: (opts as { surface?: string }).surface ?? "launchpad",
      tool_key: opts.toolKey,
      output_shape: toolOutputShape(opts.toolKey),
      title: opts.assetTitle ? opts.assetTitle(input, {}) : null,
      status: "running",
      input,
    })
    .select()
    .single();

  if (runErr || !run)
    return jsonResponse({ error: "Failed to create run", details: runErr?.message }, 500);

  try {
    // Assemble the Business Context Graph + related prior outputs.
    // Failure here must never block the run — context is an enhancer.
    const assembled = await assembleContext(ctx.supabase, ctx.organizationId, {
      toolKey: opts.toolKey,
      fromRunId: opts.fromRunId,
    }).catch(() => ({ block: "", used: [] as string[] }));

    const baseUserPrompt = opts.buildUserPrompt(input);
    let userPrompt = assembled.block
      ? `${assembled.block}\n\n## TASK INPUT\n${baseUserPrompt}`
      : baseUserPrompt;

    // ── Research enrichment (enrich → synthesize) ────────────────────────
    // Tools declared in the static research map get grounded, cited findings
    // from Perplexity injected as context BEFORE the existing Claude call.
    // Claude still writes the answer; Perplexity never does. Any failure
    // (no key, timeout, HTTP error) degrades to the unenriched behavior.
    let researchCitations: string[] = [];
    const researchCfg = getResearchConfig(opts.toolKey);
    if (researchCfg) {
      const research = await fetchResearch({
        query: researchCfg.buildQuery(input),
        tier: researchCfg.tier,
        systemHint: researchCfg.systemHint,
      });
      if (research.ok && research.content) {
        userPrompt +=
          `\n\n<current_research>\nUse the following current, sourced findings as grounding. ` +
          `Do not contradict them. Cite where relevant.\n${research.content}\n</current_research>`;
        researchCitations = research.citations;
      }
    }

    const palResult = await callClaudeTracked(
      (researchCfg ? opts.systemPrompt + GUIDANCE_CONTRACT_PROMPT : opts.systemPrompt) +
        CONTEXT_CONTRACT_PROMPT,
      userPrompt,
      researchCfg
        ? withGuidanceContract(withOutputContract(opts.schema))
        : withOutputContract(opts.schema),
      ctx.plan,
      opts.toolKey,
    );
    const output = palResult.toolResult!;

    // Guarantee the context receipt even if the model skipped it.
    if (
      assembled.used.length > 0 &&
      (!Array.isArray(output.context_used) || output.context_used.length === 0)
    ) {
      output.context_used = assembled.used;
    }

    // Surface research sources in the payload the client receives now,
    // in addition to the durable tool_runs.citations column.
    if (researchCitations.length > 0) {
      output.research_citations = researchCitations;
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await Promise.all([
      // Update tool_run with output + model attribution
      admin
        .from("tool_runs")
        .update({
          status: "succeeded",
          output,
          citations: researchCitations,
          model: palResult.model,
          provider_name: palResult.provider,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id),

      // Save generated asset
      admin.from("generated_assets").insert({
        organization_id: ctx.organizationId,
        user_id: ctx.userId,
        tool_run_id: run.id,
        kind: opts.toolKey,
        title: opts.assetTitle(input, output),
        metadata: output,
      }),

      // Increment quota counter
      // (quota already counted atomically in authenticateAndAuthorize)

      // Write credits + usage event
      writeUsage(admin, palResult, {
        userId: ctx.userId,
        orgId: ctx.organizationId,
        workspaceId: null,
        eventType: "tool_run",
        resourceKey: opts.toolKey,
      }),

      // Index into memory server-side (full content) so the assembler can
      // chain this output into future runs. Replaces the lossy client write.
      saveRunToMemory(admin, {
        orgId: ctx.organizationId,
        userId: ctx.userId,
        toolKey: opts.toolKey,
        input,
        output,
      }),

      // Capture structured verdicts into the Business Context Graph.
      captureVerdict(admin, ctx.organizationId, opts.toolKey, output),
    ]);

    return jsonResponse({ run_id: run.id, output });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[tool-run-error:${opts.toolKey}]`, msg);
    await Promise.allSettled([
      ctx.supabase
        .from("tool_runs")
        .update({ status: "failed", error: msg, completed_at: new Date().toISOString() })
        .eq("id", run.id),
      // The run failed — give the consumed quota credit back.
      refundQuota(ctx, opts.toolKey),
    ]);
    if (msg === "RATE_LIMIT")
      return jsonResponse({ error: "Rate limit exceeded, try again shortly." }, 429);
    if (msg === "PAYMENT_REQUIRED")
      return jsonResponse({ error: "AI credits exhausted. Add funds in Settings." }, 402);
    return jsonResponse({ error: "An internal error occurred. Please try again." }, 500);
  }
}

// ─── saveRunToMemory — server-side memory indexing with full content ──────

async function saveRunToMemory(
  admin: SupabaseClient,
  params: {
    orgId: string;
    userId: string;
    toolKey: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const { orgId, userId, toolKey, input, output } = params;
    const primaryInput = String(
      input.idea ||
        input.product ||
        input.idea_description ||
        input.business_description ||
        input.product_description ||
        input.business ||
        input.topic ||
        "",
    ).slice(0, 300);

    // Find or create the memory source for this tool
    const { data: existing } = await admin
      .from("memory_sources")
      .select("id")
      .eq("org_id", orgId)
      .eq("source_type", "tool")
      .eq("source_label", toolKey)
      .limit(1);

    let sourceId: string | null = existing?.[0]?.id ?? null;
    if (sourceId) {
      await admin
        .from("memory_sources")
        .update({ last_synced_at: new Date().toISOString(), status: "indexed" })
        .eq("id", sourceId);
    } else {
      const { data: created } = await admin
        .from("memory_sources")
        .insert({
          org_id: orgId,
          user_id: userId,
          source_type: "tool",
          source_label: toolKey,
          status: "indexed",
          last_synced_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      sourceId = created?.id ?? null;
    }

    const fullContent = JSON.stringify(output);
    await admin.from("memory_artifacts").insert({
      org_id: orgId,
      user_id: userId,
      source_id: sourceId,
      source_type: "tool",
      source_label: toolKey,
      title: `${toolKey}: ${primaryInput.slice(0, 120)}`,
      content: fullContent.slice(0, 20000),
      content_preview: fullContent.slice(0, 500),
      status: "indexed",
      metadata: { tool: toolKey, input_summary: primaryInput },
    });
  } catch (e) {
    console.error("[saveRunToMemory] non-fatal:", e instanceof Error ? e.message : e);
  }
}

// ─── captureVerdict — structured scores flow back into business_context ───

async function captureVerdict(
  admin: SupabaseClient,
  organizationId: string,
  toolKey: string,
  output: Record<string, unknown>,
): Promise<void> {
  try {
    let patch: Record<string, unknown> | null = null;
    if (toolKey === "idea-validator" || toolKey === "validate-idea") {
      patch = {
        validator_score: output.total_score ?? null,
        validator_verdict: output.verdict ?? null,
        validator_at: new Date().toISOString(),
      };
    } else if (toolKey === "funding-readiness-score") {
      patch = {
        funding_readiness: output.total_score ?? output.score ?? null,
        funding_readiness_at: new Date().toISOString(),
      };
    } else if (toolKey === "kill-my-idea") {
      const risks = Array.isArray(output.top_risks)
        ? output.top_risks
        : Array.isArray(output.reasons)
          ? (output.reasons as unknown[]).slice(0, 3)
          : null;
      if (risks) patch = { top_risks: risks, risks_at: new Date().toISOString() };
    }
    if (!patch) return;

    const { data: row } = await admin
      .from("business_context")
      .select("verdicts")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!row) return;

    const verdicts =
      row.verdicts && typeof row.verdicts === "object"
        ? (row.verdicts as Record<string, unknown>)
        : {};
    await admin
      .from("business_context")
      .update({ verdicts: { ...verdicts, ...patch } })
      .eq("organization_id", organizationId);
  } catch (e) {
    console.error("[captureVerdict] non-fatal:", e instanceof Error ? e.message : e);
  }
}
