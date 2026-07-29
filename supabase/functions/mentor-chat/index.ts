// mentor-chat — AI mentor conversations with business-context injection.
// Streaming SSE, persona-driven by agent_id, persisted to mentor_agent_sessions.
// Self-contained (no ../_shared imports) so it deploys as a single file.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CLAUDE_MODEL = "claude-sonnet-4-6";

// Mentor personas. agent_id is the slug stored on mentor_agent_sessions.agent_id.
// The six curriculum mentors — each owns a domain, a stage range, and a
// decision format. Never mention internal tool names; you delegate work and
// speak as a teacher guiding a student through their curriculum.
const MENTORS: Record<string, { name: string; title: string; persona: string }> = {
  "maya-okafor": {
    name: "Maya Okafor",
    title: "Offer & Positioning Mentor",
    persona:
      "You are Maya Okafor, the offer and positioning mentor. You work with founders earliest in their journey — clarifying and validating what they sell. You are warm but exacting: you speak in sharp either/or contrasts, always presenting two framings of an offer and pushing the founder to choose the uncomfortably specific one over the safely vague one. You never mention internal tools; you assign work as a teacher would ('bring me your offer in one sentence').",
  },
  "dhruv-patel": {
    name: "Dhruv Patel",
    title: "Finance & Monetization Mentor",
    persona:
      "You are Dhruv Patel, the finance and monetization mentor — pricing, unit economics, cash flow, and fundability, plus investor readiness when a founder decides to raise. You are direct and numerate: every opinion arrives with a number attached. You are calm about bad news and allergic to hand-waving. You issue clear score-and-verdict judgments and defend them with math. You never mention internal tools; you delegate work like a teacher setting an assignment.",
  },
  "alex-chen": {
    name: "Alex Chen",
    title: "Go-to-Market & Growth Mentor",
    persona:
      "You are Alex Chen, the go-to-market and growth mentor, working with founders from validation through launch. You have an energetic field-commander tone: you talk in channels, angles, and weekly experiments, and you always name the single next move before the grand plan. Your outputs read like intelligence reports — findings first, then the play. You never mention internal tools; you brief the founder like a commander assigning a mission.",
  },
  "james-rivera": {
    name: "James Rivera",
    title: "Operations & Delivery Mentor",
    persona:
      "You are James Rivera, the operations and delivery mentor, active from build through operate. You are calm and methodical: you turn chaos into numbered steps and never assign two things at once — the current step is the only step. Your outputs are step-by-step plans. You never mention internal tools; you walk the founder through the work one step at a time.",
  },
  "priya-nair": {
    name: "Priya Nair",
    title: "AI & Automation Mentor",
    persona:
      "You are Priya Nair, the AI and automation mentor, active from build through scale. You are quietly futuristic and intensely practical: you frame every automation as hours handed back to the founder, and you always prefer wiring one small thing today over designing a big system tomorrow. You never mention internal tools; you describe what will now run by itself and what the founder no longer has to do.",
  },
  "mo-latif": {
    name: "Mo Latif",
    title: "Revenue & Pipeline Mentor",
    persona:
      "You are Mo Latif, the revenue and pipeline mentor — sales conversion, follow-up cadence, retention, and CRM strategy, active from launch through scale. You have upbeat closer energy grounded in the live pipeline: you talk about real deals by name, follow-up timing, and where money is stuck. Your outputs read like pipeline snapshots tied to real CRM data. You never mention internal tools; you coach the founder through their actual deals.",
  },
};

// Legacy agent ids from the previous five-persona roster map onto the nearest
// of the six mentors so existing sessions keep working.
const LEGACY_AGENTS: Record<string, string> = {
  strategist: "alex-chen",
  operator: "james-rivera",
  "growth-hacker": "alex-chen",
  builder: "priya-nair",
  closer: "mo-latif",
};

function mentorFor(agentId: string) {
  return MENTORS[agentId] ?? MENTORS[LEGACY_AGENTS[agentId] ?? ""] ?? MENTORS["alex-chen"];
}

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Compact a business_context row into a short text block for the system prompt.
function contextBlock(bc: Record<string, unknown> | null): string {
  if (!bc) return "";
  const pick = (v: unknown): string => {
    if (!v) return "";
    if (typeof v === "string") return v;
    try {
      return Object.values(v as Record<string, unknown>)
        .filter((x) => typeof x === "string" && x)
        .join(" · ");
    } catch {
      return "";
    }
  };
  const lines: string[] = [];
  const identity = pick(bc.identity);
  const customer = pick(bc.customer);
  const stage = pick(bc.stage);
  const goals = pick(bc.goals);
  if (identity) lines.push(`Business: ${identity}`);
  if (customer) lines.push(`Customer: ${customer}`);
  if (stage) lines.push(`Stage: ${stage}`);
  if (goals) lines.push(`Goals: ${goals}`);
  if (lines.length === 0) return "";
  return `\n\n## This Founder's Business Context\nReference these specifics naturally; never restate them robotically.\n${lines.join("\n").slice(0, 2000)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonError("Missing authorization", 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return jsonError("Unauthorized", 401);

  let body: {
    agent_id?: string;
    message?: string;
    org_id?: string;
    session_key?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const agentId = (body.agent_id || "alex-chen").toLowerCase();
  const message = (body.message || "").trim();
  if (!message) return jsonError("Missing message", 400);
  const mentor = mentorFor(agentId);

  // Resolve org — explicit org_id wins, else the caller's first membership.
  let orgId = body.org_id ?? null;
  if (orgId) {
    const { data: m } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!m) return jsonError("Forbidden", 403);
  } else {
    const { data: m } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!m) return jsonError("No organization", 403);
    orgId = m.organization_id as string;
  }

  // Load business context for injection.
  const { data: bc } = await supabase
    .from("business_context")
    .select("identity, customer, stage, goals")
    .eq("organization_id", orgId)
    .maybeSingle();

  // Load (or start) the mentor session — history keyed by org + agent + session_key.
  const sessionKey = body.session_key ?? "default";
  const { data: session } = await supabase
    .from("mentor_agent_sessions")
    .select("id, messages")
    .eq("org_id", orgId)
    .eq("agent_id", agentId)
    .eq("session_key", sessionKey)
    .maybeSingle();

  const history: Array<{ role: string; content: string }> = Array.isArray(session?.messages)
    ? (session!.messages as Array<{ role: string; content: string }>)
    : [];

  const systemPrompt =
    `${mentor.persona}\n\nYou are ${mentor.name}, ${mentor.title}, advising this founder inside Bylda. ` +
    `Keep replies tight and operational — short paragraphs or bullets, high signal, no motivational fluff. ` +
    `End with one specific next action.${contextBlock(bc as Record<string, unknown> | null)}`;

  const messages = [...history.slice(-20), { role: "user", content: message }];

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) return jsonError("AI not configured", 503);
  const cfGatewayUrl = Deno.env.get("CLOUDFLARE_AI_GATEWAY_URL");
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
      model: CLAUDE_MODEL,
      max_tokens: 1536,
      stream: true,
      system: systemPrompt,
      messages,
    }),
  });

  if (!aiRes.ok) {
    const detail = await aiRes.text();
    return new Response(JSON.stringify({ error: "AI error", detail }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const admin = serviceKey ? createClient(Deno.env.get("SUPABASE_URL")!, serviceKey) : null;

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  let fullText = "";

  (async () => {
    try {
      const reader = aiRes.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n").filter((l) => l.startsWith("data: "))) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const text = parsed.delta?.text ?? "";
            if (text) {
              fullText += text;
              await writer.write(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          } catch {
            /* skip malformed SSE chunk */
          }
        }
      }
    } finally {
      await writer.close();
    }

    // Persist the updated session transcript (service role — bypass caller RLS).
    if (admin && fullText) {
      const nextMessages = [
        ...history,
        { role: "user", content: message },
        { role: "assistant", content: fullText },
      ].slice(-100);
      if (session?.id) {
        await admin
          .from("mentor_agent_sessions")
          .update({ messages: nextMessages, updated_at: new Date().toISOString() })
          .eq("id", session.id);
      } else {
        await admin.from("mentor_agent_sessions").insert({
          org_id: orgId,
          user_id: user.id,
          agent_id: agentId,
          session_key: sessionKey,
          messages: nextMessages,
        });
      }

      // Cross-system Connection 3: Mentor → memory. Fold this mentor's advice into
      // the Business Context Graph so it surfaces in Recent Memory and is queryable
      // by Bylda and the tools. One rolling artifact per session (keyed by
      // session_key) keeps memory high-signal instead of one row per turn. Only
      // log substantive advice; skip trivial one-liners.
      if (fullText.trim().length > 80) {
        const nowIso = new Date().toISOString();
        const preview = fullText.slice(0, 500);
        const { data: existingArtifact } = await admin
          .from("memory_artifacts")
          .select("id, title")
          .eq("org_id", orgId)
          .eq("source_type", "mentor")
          .eq("source_label", agentId)
          .eq("metadata->>session_key", sessionKey)
          .maybeSingle();

        const artifactMeta = {
          source: "mentor",
          agent_id: agentId,
          mentor_name: mentor.name,
          session_key: sessionKey,
          last_question: message.slice(0, 240),
        };

        if (existingArtifact?.id) {
          await admin
            .from("memory_artifacts")
            .update({
              content: fullText,
              content_preview: preview,
              status: "indexed",
              metadata: artifactMeta,
              updated_at: nowIso,
            })
            .eq("id", existingArtifact.id);
        } else {
          await admin.from("memory_artifacts").insert({
            org_id: orgId,
            user_id: user.id,
            source_type: "mentor",
            source_label: agentId,
            title: `${mentor.name}: ${message.slice(0, 70)}`,
            content: fullText,
            content_preview: preview,
            status: "indexed",
            metadata: artifactMeta,
          });
        }
      }
    }
  })();

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
});
