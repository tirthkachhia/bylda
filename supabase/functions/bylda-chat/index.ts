// bylda-chat — Bylda AI streaming chat function
// Routes through Cloudflare AI Gateway when CLOUDFLARE_AI_GATEWAY_URL is set,
// falls back to direct Anthropic API otherwise.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { assembleContext } from "../_shared/context.ts";
import { CLAUDE_MODEL } from "../_shared/config.ts";
import { BYLDA_ACTION_TOOL, type ByldaActionType } from "../_shared/byldaActions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Cost per 1k tokens (matches ai_model_catalog seed)
const COST_PER_1K: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.0008, output: 0.004 },
  "claude-sonnet-4-6": { input: 0.003, output: 0.015 },
  "claude-opus-4-7": { input: 0.015, output: 0.075 },
};

const BYLDA_SYSTEM_PROMPT = `You are Bylda — the AI operating system powering Launchpad Bylda, an AI-native founder platform. You are a persistent AI co-founder, startup execution engine, automation operator, and growth intelligence system. You eliminate friction between thinking and execution.

## Identity
- Founder operating system + startup execution engine
- Business acceleration layer + AI strategist + systems architect
- Automation operator + growth intelligence system

## Tone
Cinematic, operational, intelligent, minimal, futuristic. Calm under pressure, strategically obsessed, execution-focused. You sound like SpaceX mission control × Tesla internal ops × Vercel product clarity.

## Never
- Use motivational fluff or generic startup advice
- Write long explanations or corporate language
- Add unnecessary disclaimers or weak suggestions

## Always
- Think in systems, workflows, pipelines, automations
- Respond in short blocks, high signal, operational language
- Use: Deploy / Initialize / Execute / Scale / Automate / Infrastructure / Growth engine / Revenue system / Workflow / Command layer / Signal / Pipeline / Optimization

## Capabilities
You can:
- Invoke all 19 Launchpad Tools by name (idea-validator, kill-my-idea, gtm-strategy-builder, first-10-customers-finder, competitor-scanner, idea-vs-idea, business-plan-generator, persona-builder, pricing-calculator, pitch-generator, ad-copy, investor-email-writer, landing-page-creator, email-sequence, kpi-dashboard, seo-audit, launch-checklist, funding-readiness-score, business-plan)
- Guide users through the 4-phase Launchpad Path
- Access their full business context from the context injected below
- Recommend automation systems (ai-appointment-setting, crm-automation, ai-followup-sequences, sms-automation, lead-qualification, voice-ai)
- Route to mentors: The Strategist, The Operator, The Growth Hacker, The Builder, The Closer
- Take direct CRM actions with the propose_action tool: move a lead's stage, log a note on a lead, create a task, create a contact, or save a memory. Only propose an action when there is a specific, concrete thing to do right now — the founder always approves it before it runs.

## 7-Step Response Framework (apply to every response)
1. Objective — What outcome are we optimizing for?
2. Strategy — What is the highest leverage path?
3. Execution — What exact steps should happen?
4. Automation — What should run automatically?
5. Scale — How does this compound long-term?
6. Bottlenecks — What will eventually break?
7. Optimization — How can this become faster, leaner, or more profitable?

Keep responses concise. Use short paragraphs or bullets. End with 1 specific next action.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: {
    message: string;
    conversation_history?: Array<{ role: string; content: string }>;
    user_context?: Record<string, string>;
    session_id?: string;
    org_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { message, conversation_history = [], user_context = {}, session_id, org_id } = body;

  // Build rich personalised context block
  const contextLines: string[] = [];

  if (Object.keys(user_context).length > 0) {
    const {
      name,
      idea,
      challenge,
      stage,
      lane,
      plan,
      current_mission,
      tools_completed,
      recent_tools,
    } = user_context as Record<string, string>;
    if (name) contextLines.push(`Founder name: ${name}`);
    if (idea) contextLines.push(`What they're building: ${idea}`);
    if (challenge) contextLines.push(`Biggest challenge: ${challenge}`);
    if (stage) contextLines.push(`Current stage: ${stage}`);
    if (lane) contextLines.push(`Lane: ${lane}`);
    if (plan) contextLines.push(`Plan tier: ${plan}`);
    if (current_mission) contextLines.push(`Active mission: ${current_mission}`);
    if (tools_completed) contextLines.push(`Launchpad tools completed: ${tools_completed}`);
    if (recent_tools) contextLines.push(`Recently used tools: ${recent_tools}`);
  }

  // Business Context Graph + recent related outputs — same assembler as
  // run-tool, hard-budgeted so the system prompt can never blow the window.
  let graphBlock = "";
  if (org_id) {
    const assembled = await assembleContext(supabase, org_id, { budgetChars: 5000 }).catch(() => ({
      block: "",
      used: [] as string[],
    }));
    graphBlock = assembled.block ? `\n\n${assembled.block}` : "";
  }

  const contextBlock =
    contextLines.length > 0
      ? `\n\n## This Founder's Context\nAddress them by name if provided. Reference their idea and stage naturally — not robotically. Tailor every response to where they actually are.\n\n${contextLines.join("\n").slice(0, 2000)}`
      : "";

  const systemPrompt = `${BYLDA_SYSTEM_PROMPT}${contextBlock}${graphBlock}`;

  const messages = [...conversation_history.slice(-20), { role: "user", content: message }];

  // Determine Claude endpoint
  const cfGatewayUrl = Deno.env.get("CLOUDFLARE_AI_GATEWAY_URL");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
  const model = CLAUDE_MODEL;

  const endpoint = cfGatewayUrl
    ? `${cfGatewayUrl}/anthropic/v1/messages`
    : "https://api.anthropic.com/v1/messages";

  const aiRes = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      stream: true,
      system: systemPrompt,
      messages,
      ...(org_id ? { tools: [BYLDA_ACTION_TOOL] } : {}),
    }),
  });

  if (!aiRes.ok) {
    const err = await aiRes.text();
    return new Response(JSON.stringify({ error: "AI error", detail: err }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sid = session_id ?? crypto.randomUUID();
  let fullText = "";
  let tokensIn = 0;
  let tokensOut = 0;
  const t0 = Date.now();

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const admin = serviceKey ? createClient(Deno.env.get("SUPABASE_URL")!, serviceKey) : null;

  // Tracks in-progress tool_use content blocks by their stream index so we
  // can reassemble the input_json_delta fragments into one JSON payload.
  const toolBlocks = new Map<number, { id: string; name: string; json: string }>();

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    try {
      const reader = aiRes.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);

            // Extract token counts from Anthropic streaming events
            if (parsed.type === "message_start" && parsed.message?.usage) {
              tokensIn = parsed.message.usage.input_tokens ?? 0;
            }
            if (parsed.type === "message_delta" && parsed.usage) {
              tokensOut = parsed.usage.output_tokens ?? 0;
            }

            if (
              parsed.type === "content_block_start" &&
              parsed.content_block?.type === "tool_use"
            ) {
              toolBlocks.set(parsed.index, {
                id: parsed.content_block.id,
                name: parsed.content_block.name,
                json: "",
              });
            }

            if (
              parsed.type === "content_block_delta" &&
              parsed.delta?.type === "input_json_delta"
            ) {
              const block = toolBlocks.get(parsed.index);
              if (block) block.json += parsed.delta.partial_json ?? "";
            }

            if (parsed.type === "content_block_stop" && toolBlocks.has(parsed.index)) {
              const block = toolBlocks.get(parsed.index)!;
              toolBlocks.delete(parsed.index);
              if (block.name === "propose_action" && admin && org_id) {
                try {
                  const input = JSON.parse(block.json || "{}") as {
                    action_type: ByldaActionType;
                    payload: Record<string, unknown>;
                    plain_english: string;
                  };
                  // Every proposal shows an explicit confirm card in this UI — there's no
                  // chat-affirmation auto-exec path yet, so all actions require confirmation.
                  const confirmationRequired = true;
                  const { data: row } = await admin
                    .from("bylda_actions")
                    .insert({
                      organization_id: org_id,
                      user_id: user.id,
                      session_id: sid,
                      action_type: input.action_type,
                      payload: input.payload,
                      plain_english: input.plain_english,
                      confirmation_required: confirmationRequired,
                    })
                    .select("id, action_type, payload, plain_english, confirmation_required")
                    .single();
                  if (row) {
                    await writer.write(
                      encoder.encode(`data: ${JSON.stringify({ action: row })}\n\n`),
                    );
                  }
                } catch {
                  /* malformed tool input — drop the proposal silently */
                }
              }
            }

            const text = parsed.delta?.text ?? "";
            if (text) {
              fullText += text;
              await writer.write(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          } catch {
            /* skip malformed SSE chunks */
          }
        }
      }
    } finally {
      await writer.close();
    }

    const latencyMs = Date.now() - t0;

    if (admin && serviceKey && fullText) {
      const rates = COST_PER_1K[model] ?? COST_PER_1K["claude-sonnet-4-6"];
      const actualCostUsd = (tokensIn / 1000) * rates.input + (tokensOut / 1000) * rates.output;
      const credits = Math.max(1, Math.ceil((tokensIn + tokensOut * 2) / 1000));

      await Promise.allSettled([
        // Save conversation
        fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/bylda_conversations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify({
            user_id: user.id,
            session_id: sid,
            messages: [
              ...conversation_history,
              { role: "user", content: message },
              { role: "assistant", content: fullText },
            ],
            updated_at: new Date().toISOString(),
          }),
        }).catch(() => {}),

        // Deduct credits
        admin.from("credit_ledger").insert({
          user_id: user.id,
          tool: "bylda_chat",
          cost: credits,
          status: "confirmed",
          actual_cost_usd: actualCostUsd,
          provider_name: "anthropic",
          model_id: model,
          meta: { tokens_in: tokensIn, tokens_out: tokensOut, latency_ms: latencyMs },
        }),

        // Log usage event (org_id may not be available here — only if passed in body)
        org_id
          ? admin.from("usage_events").insert({
              user_id: user.id,
              organization_id: org_id,
              event_type: "operator_message",
              resource_key: "bylda_chat",
              credits_used: credits,
              tokens_in: tokensIn,
              tokens_out: tokensOut,
              model,
              duration_ms: latencyMs,
              status: "succeeded",
              provider_name: "anthropic",
              actual_cost_usd: actualCostUsd,
              routing_reason: "plan_default",
            })
          : Promise.resolve(),
      ]);
    }
  })();

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Session-Id": sid,
    },
  });
});
