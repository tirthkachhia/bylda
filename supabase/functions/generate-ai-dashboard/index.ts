import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse, callClaude } from "../_shared/helpers.ts";
import { CLAUDE_MODEL } from "../_shared/config.ts";

// ── Schema ────────────────────────────────────────────────────────────────────

const DASHBOARD_SCHEMA = {
  name: "generate_ai_dashboard",
  description: "Generate a fully personalized AI operator dashboard for a founder.",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: [
      "headline",
      "summary",
      "north_star_metric",
      "top_risks",
      "quick_wins",
      "tool_recommendations",
    ],
    properties: {
      headline: {
        type: "string",
        description: "One punchy line that captures their situation and what they must do next.",
      },
      summary: {
        type: "string",
        description:
          "2-3 sentences: where they are, what the biggest lever is, and what the AI operator will help with.",
      },
      north_star_metric: {
        type: "string",
        description:
          "The single most important metric to move right now, specific to their business.",
      },
      top_risks: {
        type: "array",
        description: "3 concrete risks specific to their situation.",
        minItems: 2,
        maxItems: 3,
        items: { type: "string" },
      },
      quick_wins: {
        type: "array",
        description: "3-5 things the founder can complete this week with real impact.",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "impact", "effort", "description"],
          properties: {
            title: { type: "string" },
            impact: { type: "string" },
            effort: { type: "string", enum: ["low", "medium", "high"] },
            description: { type: "string" },
          },
        },
      },
      tool_recommendations: {
        type: "array",
        description: "2-4 platform tools that directly apply to their next actions.",
        minItems: 2,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["tool", "reason", "slug"],
          properties: {
            tool: { type: "string" },
            reason: {
              type: "string",
              description: "One sentence specific to their business, not generic.",
            },
            slug: {
              type: "string",
              enum: [
                "idea-validator",
                "pitch-generator",
                "gtm-strategy",
                "offer",
                "ops-plan",
                "followup",
                "website-audit",
                "first-10-customers",
                "kill-my-idea",
                "funding-score",
                "business-plan",
                "landing-page",
                "competitor",
                "pricing",
              ],
            },
          },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `You are Bylda — the AI operator running inside a startup launchpad platform.

Your role: take a founder's business context and generate a personalized intelligence dashboard that acts as their strategic command center inside the platform.

Rules:
- Every risk and quick win must be specific to their actual business, niche, stage, and goal. Generic output is a failure.
- Reference their niche, customer type, offer, and revenue situation directly.
- Quick wins must be completable this week, not aspirational.
- The north-star metric must be the single most important number for their situation right now.
- Tool recommendations must link to tools that make direct sense for their next 30 days.
- Tone: direct, operator-level. No fluff. Think operator, not coach.`;

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = req.headers.get("Authorization");
  if (!auth) return jsonResponse({ error: "Missing Authorization header" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return jsonResponse({ error: "Invalid token" }, 401);
  const userId = userData.user.id;

  // ── Resolve org ───────────────────────────────────────────────────────────
  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!member) return jsonResponse({ error: "No organization found" }, 403);
  const organizationId = member.organization_id as string;

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  // ── Enrich with onboarding data if not overridden ─────────────────────────
  const { data: onboarding } = await supabase
    .from("onboarding_responses")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Merge: body (explicit form input) takes priority over saved onboarding
  const context = {
    business: (body.business as string) || (onboarding?.offer as string) || "",
    niche: (body.niche as string) || (onboarding?.niche as string) || "",
    stage: (body.stage as string) || (onboarding?.stage as string) || "Validate",
    goal: (body.goal as string) || (onboarding?.goal as string) || "",
    current_revenue:
      (body.current_revenue as string) || (onboarding?.current_revenue as string) || "Pre-revenue",
    target_customer:
      (body.target_customer as string) || (onboarding?.target_customer as string) || "",
    biggest_blocker:
      (body.biggest_blocker as string) || (onboarding?.biggest_blocker as string) || "",
  };

  if (!context.business && !context.goal) {
    return jsonResponse(
      { error: "Provide at least 'business' and 'goal' to generate a dashboard." },
      400,
    );
  }

  // ── Read recent tool runs for richer context ──────────────────────────────
  const { data: recentRuns } = await supabase
    .from("tool_runs")
    .select("tool_key, status, created_at")
    .eq("organization_id", organizationId)
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(10);

  const usedTools = [...new Set((recentRuns || []).map((r) => r.tool_key as string))];

  // ── Build prompts ─────────────────────────────────────────────────────────
  const userPrompt = `Generate a personalized operator dashboard for this founder:

BUSINESS DESCRIPTION: ${context.business}
NICHE / INDUSTRY: ${context.niche || "Not specified"}
CURRENT STAGE: ${context.stage}
PRIMARY GOAL (next 90 days): ${context.goal || "Not specified"}
CURRENT MONTHLY REVENUE: ${context.current_revenue}
TARGET CUSTOMER: ${context.target_customer || "Not specified"}
BIGGEST BLOCKER: ${context.biggest_blocker || "Not specified"}
TOOLS ALREADY USED ON PLATFORM: ${usedTools.length > 0 ? usedTools.join(", ") : "None yet"}

Build the dashboard as if you are the AI operator who knows their business. Every section must be specific to them.`;

  // ── Call AI ───────────────────────────────────────────────────────────────
  let payload: Record<string, unknown>;
  try {
    payload = await callClaude(SYSTEM_PROMPT, userPrompt, DASHBOARD_SCHEMA);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[generate-ai-dashboard] AI error:", msg);
    if (msg === "RATE_LIMIT")
      return jsonResponse({ error: "Rate limit reached — please wait a moment." }, 429);
    if (msg === "PAYMENT_REQUIRED") return jsonResponse({ error: "AI credits exhausted." }, 402);
    return jsonResponse({ error: "AI generation failed. Please try again." }, 500);
  }

  // ── Persist to ai_dashboards ──────────────────────────────────────────────
  const { data: saved, error: saveErr } = await supabase
    .from("ai_dashboards")
    .insert({
      organization_id: organizationId,
      user_id: userId,
      business: context.business,
      niche: context.niche,
      stage: context.stage,
      goal: context.goal,
      current_revenue: context.current_revenue,
      target_customer: context.target_customer,
      biggest_blocker: context.biggest_blocker,
      payload,
      model: CLAUDE_MODEL,
      prompt_version: "v2",
    })
    .select("id, created_at")
    .single();

  if (saveErr) {
    console.error("[generate-ai-dashboard] Save error:", saveErr.message);
    // Still return the payload even if save fails — don't block the user
    return jsonResponse({ dashboard_id: null, payload, context });
  }

  return jsonResponse({ dashboard_id: saved.id, payload, context });
});
