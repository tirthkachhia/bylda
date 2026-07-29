// Single entry point for all AI operator and mentor-agent requests from the client.
// No AI provider calls happen client-side — everything flows through here.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { CLAUDE_MODEL } from "../_shared/config.ts";
import { callPAL, buildUsageRows } from "../_shared/pal/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Lane = "Idea" | "Offer" | "Customer" | "Systems";

const LANE_PERSONA: Record<Lane, string> = {
  Idea: "You are advising a founder who is at the idea/validation stage. Focus on market validation, assumption testing, and de-risking before building.",
  Offer:
    "You are advising a founder who needs to define and package their offer. Focus on positioning, pricing, and communicating value clearly.",
  Customer:
    "You are advising a founder who needs to acquire customers. Focus on outreach, conversion, and building a repeatable sales motion.",
  Systems:
    "You are advising a founder who is scaling and building systems. Focus on automation, delegation, SOPs, and growth levers.",
};

const BASE_SYSTEM = `You are Bylda, an AI founder operating system. You are direct, practical, and action-oriented.
Your job is to give founders the exact next step — not general advice.
You never ask more than one clarifying question at a time.
When you recommend a tool, name it explicitly (e.g., "Run the Idea Validator now").
Response format: 2–4 short paragraphs max, or a numbered list. No long preambles.`;

type MentorAgentId = "growth" | "offer" | "sales" | "content" | "automation" | "finance";

const MENTOR_PERSONAS: Record<MentorAgentId, string> = {
  growth: `You are a Growth Mentor — a seasoned growth hacker and marketing strategist. You specialise in user acquisition, retention, viral loops, and channel optimisation. Be data-driven, channel-specific, and always push the founder to their next 10x growth lever.`,
  offer: `You are an Offer Mentor — an expert offer architect trained in Alex Hormozi's $100M Offers framework. You help founders build irresistible offers with value stacking, guarantees, and pricing psychology. Push for specificity and concrete positioning.`,
  sales: `You are a Sales Mentor — a battle-tested B2B sales coach. You specialise in discovery calls, closing techniques, pipeline management, and objection handling. Focus on concrete scripts, talk tracks, and daily revenue-generating activities.`,
  content: `You are a Content Mentor — a social media and content strategist with expertise in LinkedIn, Twitter/X, short-form video, and email newsletters. Help founders build a content engine that generates leads on autopilot.`,
  automation: `You are an Automation Mentor — a workflow automation expert with deep knowledge of Claude AI agents, Make, Zapier, and custom-coded automation. Help founders eliminate manual work, save hours per week, and build scalable AI-native systems.`,
  finance: `You are a Finance Mentor — a startup finance expert covering cash flow, pricing, unit economics, and fundraising. Be precise with numbers, help founders understand their financial levers, and always tie advice back to profitability.`,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);
  const userId = userData.user.id;

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  let body: {
    message: string;
    workspace_id?: string;
    mission_id?: string;
    session_id?: string;
    context?: Record<string, unknown>;
    agent_id?: MentorAgentId;
    org_id?: string;
    business_context?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { message, workspace_id, session_id, agent_id, business_context } = body;
  if (!message?.trim()) return json({ error: "message is required" }, 400);

  // ── Resolve org + plan + Ollama settings ──────────────────────────────
  let orgId: string | null = null;
  let plan = "starter";
  let ollamaEndpoint: string | undefined;
  let ollamaModel: string | undefined;

  const { data: ws } = await admin
    .from("workspaces")
    .select("lane, organization_id")
    .eq(workspace_id ? "id" : "owner_id", workspace_id ?? userId)
    .maybeSingle();

  if (ws?.organization_id) orgId = ws.organization_id as string;

  if (orgId) {
    const [subResult, orgResult] = await Promise.all([
      admin.from("subscriptions").select("plan").eq("organization_id", orgId).maybeSingle(),
      admin
        .from("organizations")
        .select("ollama_endpoint, ollama_model")
        .eq("id", orgId)
        .maybeSingle(),
    ]);
    plan = (subResult.data?.plan as string) ?? "starter";
    if (orgResult.data?.ollama_endpoint) {
      ollamaEndpoint = orgResult.data.ollama_endpoint as string;
      ollamaModel = (orgResult.data.ollama_model as string | null) ?? "llama3.2";
    }
  }

  // ── Credit guard — check balance from credit_ledger ───────────────────
  const { data: balance } = await admin
    .from("user_credit_balance")
    .select("credits_remaining, starting_credits")
    .eq("user_id", userId)
    .maybeSingle();

  // NULL credits_remaining = unlimited (Scale/unlimited plan)
  const creditsRemaining = balance?.credits_remaining ?? null;
  if (creditsRemaining !== null && (creditsRemaining as number) <= 0) {
    return json({
      status: "credit_insufficient",
      credits_remaining: 0,
      upgrade_url: "/app/billing",
      upsell_message: "You've used all your credits this month. Upgrade to continue.",
    });
  }

  // ── Mentor agent fast-path ─────────────────────────────────────────────
  if (agent_id) {
    const persona = MENTOR_PERSONAS[agent_id] ?? MENTOR_PERSONAS.growth;
    const mentorSystem = `${persona}

Business context: ${business_context || "Not provided"}

IMPORTANT rules:
- Be concise, specific, and action-oriented
- Address the founder by their stage and context
- When recommending a tool, name it explicitly
- End every response with one clear, immediate next action
- Use bullet points for 3+ items, otherwise prose`;

    const mentorSessionId = session_id ?? crypto.randomUUID();

    // Load prior conversation turns
    const mentorHistory: { role: "user" | "assistant"; content: string }[] = [];
    if (session_id) {
      const { data: priorRuns } = await admin
        .from("agent_runs")
        .select("input, output, created_at")
        .eq("session_id", mentorSessionId)
        .eq("agent_type", `mentor_${agent_id}`)
        .order("created_at", { ascending: true })
        .limit(12);

      for (const run of priorRuns ?? []) {
        const inp = run.input as { message?: string } | null;
        const out = run.output as { reply?: string } | null;
        if (inp?.message) mentorHistory.push({ role: "user", content: inp.message });
        if (out?.reply) mentorHistory.push({ role: "assistant", content: out.reply });
      }
    }

    try {
      const palResult = await callPAL(
        {
          systemPrompt: mentorSystem,
          messages: [...mentorHistory, { role: "user", content: message }],
          maxTokens: 800,
        },
        { ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY") },
        plan,
        undefined,
        message,
        ollamaEndpoint,
        ollamaModel,
      );
      const reply = palResult.content;

      await Promise.allSettled([
        admin.from("agent_runs").insert({
          user_id: userId,
          agent_type: `mentor_${agent_id}`,
          session_id: mentorSessionId,
          input: { message },
          output: { reply },
          status: "succeeded",
          model: palResult.model,
          provider_name: palResult.provider,
          tokens_used: palResult.tokensIn + palResult.tokensOut,
          actual_cost_usd: palResult.actualCostUsd,
          duration_ms: palResult.latencyMs,
        }),
        // Deduct credits
        admin.from("credit_ledger").insert({
          user_id: userId,
          tool: `mentor_${agent_id}`,
          cost: palResult.credits,
          status: "confirmed",
          actual_cost_usd: palResult.actualCostUsd,
          provider_name: palResult.provider,
          model_id: palResult.model,
          meta: { tokens_in: palResult.tokensIn, tokens_out: palResult.tokensOut },
        }),
      ]);

      return json({
        success: true,
        response: reply,
        agent_id,
        session_id: mentorSessionId,
        credits_used: palResult.credits,
        // model + provider intentionally omitted
      });
    } catch (e) {
      return json({ success: false, error: e instanceof Error ? e.message : "AI error" }, 500);
    }
  }

  // ── Main operator flow ─────────────────────────────────────────────────
  const sessionId = session_id ?? crypto.randomUUID();
  const t0 = Date.now();

  let lane: Lane = "Idea";
  let currentMissionTitle = "";
  let userName = "";

  if (ws) lane = (ws.lane as Lane) ?? "Idea";

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.full_name) userName = profile.full_name as string;

  if (workspace_id) {
    const { data: mission } = await admin
      .from("missions")
      .select("title")
      .eq("workspace_id", workspace_id)
      .eq("status", "active")
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (mission?.title) currentMissionTitle = mission.title as string;
  }

  const lanePersona = LANE_PERSONA[lane];
  const contextLines = [
    `User: ${userName || "Founder"}`,
    lane ? `Lane: ${lane}` : null,
    currentMissionTitle ? `Current mission: "${currentMissionTitle}"` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = `${BASE_SYSTEM}\n\n${lanePersona}\n\nContext:\n${contextLines}`;

  // Load session transcript for multi-turn context (session_id now a proper column)
  type MsgRole = "user" | "assistant";
  const conversationHistory: { role: MsgRole; content: string }[] = [];

  const { data: priorRuns } = await admin
    .from("agent_runs")
    .select("input, output, created_at")
    .eq("session_id", sessionId)
    .eq("agent_type", "operator")
    .order("created_at", { ascending: true })
    .limit(10);

  for (const run of priorRuns ?? []) {
    const input = run.input as { message?: string } | null;
    const output = run.output as { reply?: string } | null;
    if (input?.message) conversationHistory.push({ role: "user", content: input.message });
    if (output?.reply) conversationHistory.push({ role: "assistant", content: output.reply });
  }

  // ── Call PAL (plan + input-complexity routed; Ollama if org has endpoint) ─
  let palResult;
  try {
    palResult = await callPAL(
      {
        systemPrompt,
        messages: [...conversationHistory, { role: "user", content: message }],
        maxTokens: 600,
      },
      { ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY") },
      plan,
      "operator",
      message,
      ollamaEndpoint,
      ollamaModel,
    );
  } catch (e) {
    return json({ status: "error", error: (e as Error).message }, 500);
  }

  const reply = palResult.content;
  const durationMs = Date.now() - t0;

  // ── Persist agent run + credits ────────────────────────────────────────
  const { data: agentRun } = await admin
    .from("agent_runs")
    .insert({
      workspace_id: workspace_id ?? null,
      user_id: userId,
      agent_type: "operator",
      session_id: sessionId,
      input: { message },
      output: { reply },
      status: "succeeded",
      model: palResult.model,
      provider_name: palResult.provider,
      tokens_used: palResult.tokensIn + palResult.tokensOut,
      actual_cost_usd: palResult.actualCostUsd,
      duration_ms: durationMs,
    })
    .select("id")
    .single();

  const { creditRow, usageRow } = buildUsageRows(palResult, {
    userId,
    orgId,
    workspaceId: workspace_id ?? null,
    eventType: "operator_message",
    resourceKey: "operator",
  });

  await Promise.allSettled([
    admin.from("credit_ledger").insert(creditRow),
    usageRow ? admin.from("usage_events").insert(usageRow) : Promise.resolve(),
  ]);

  // Re-fetch updated balance for the response
  const { data: updatedBalance } = await admin
    .from("user_credit_balance")
    .select("credits_remaining")
    .eq("user_id", userId)
    .maybeSingle();

  const newCreditsRemaining = updatedBalance?.credits_remaining ?? null;

  return json({
    status: "success",
    session_id: sessionId,
    agent_run_id: agentRun?.id ?? null,
    reply,
    credits_used: palResult.credits,
    credits_remaining: newCreditsRemaining,
    // model + provider intentionally omitted — internal routing only
  });
});
