// bylda-ai-api — POST /api/bylda
// Streams Claude responses for Bylda AI chat. Saves to bylda_conversations.
// After streaming, writes credit_ledger + usage_events entries via Supabase REST.

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_AI_GATEWAY_ID: string;
  ANTHROPIC_API_KEY: string;
}

const ALLOWED_ORIGIN = "https://app.usebylda.com";
const MODEL = "claude-sonnet-4-6";

// Cost per 1k tokens (matches ai_model_catalog)
const COST_INPUT_PER_1K = 0.003;
const COST_OUTPUT_PER_1K = 0.015;

const BYLDA_SYSTEM_PROMPT = `You are Bylda — the AI operating system powering Launchpad Bylda.

Identity: Founder operating system + startup execution engine + automation operator + growth intelligence system.

Tone: Cinematic, operational, intelligent, minimal, futuristic. Calm under pressure, strategically obsessed, execution-focused. SpaceX mission control × Tesla internal ops × Vercel product clarity.

Never: Use motivational fluff, generic startup advice, long explanations, corporate language, or unnecessary disclaimers.

Always: Think in systems, workflows, pipelines, automations. Respond in short blocks with high signal and operational language.

Preferred vocabulary: Deploy / Initialize / Execute / Scale / Automate / Infrastructure / Growth engine / Revenue system / Workflow / Command layer / Signal / Pipeline / Optimization.

7-step framework (apply to every response):
1. Objective — What outcome are we optimizing for?
2. Strategy — What is the highest leverage path?
3. Execution — What exact steps should happen?
4. Automation — What should run automatically?
5. Scale — How does this compound long-term?
6. Bottlenecks — What will eventually break?
7. Optimization — How can this become faster, leaner, or more profitable?

Dynamic context will be injected at runtime with user business data.`;

async function validateJWT(token: string, env: Env): Promise<{ sub: string } | null> {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id: string };
    return { sub: user.id };
  } catch {
    return null;
  }
}

function cors() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

/** Fire-and-forget: write credit_ledger + usage_events to Supabase via REST. */
async function recordUsage(
  env: Env,
  opts: {
    userId: string;
    tokensIn: number;
    tokensOut: number;
    latencyMs: number;
  },
) {
  const actualCostUsd =
    (opts.tokensIn / 1000) * COST_INPUT_PER_1K + (opts.tokensOut / 1000) * COST_OUTPUT_PER_1K;
  const credits = Math.max(1, Math.ceil((opts.tokensIn + opts.tokensOut * 2) / 1000));

  const headers = {
    "Content-Type": "application/json",
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    Prefer: "return=minimal",
  };
  const base = `${env.SUPABASE_URL}/rest/v1`;

  await Promise.allSettled([
    fetch(`${base}/credit_ledger`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        user_id: opts.userId,
        tool: "bylda_chat_worker",
        cost: credits,
        status: "confirmed",
        actual_cost_usd: actualCostUsd,
        provider_name: "anthropic",
        model_id: MODEL,
        meta: {
          tokens_in: opts.tokensIn,
          tokens_out: opts.tokensOut,
          latency_ms: opts.latencyMs,
        },
      }),
    }),
  ]);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") ?? "";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors() });
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }

    // Auth
    const authHeader = request.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const user = await validateJWT(token, env);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors(), "Content-Type": "application/json" },
      });
    }

    const body = (await request.json()) as {
      message: string;
      conversation_history?: Array<{ role: string; content: string }>;
      user_context?: Record<string, string>;
      session_id?: string;
    };

    const { message, conversation_history = [], user_context = {}, session_id } = body;

    // Build system prompt with injected context
    let systemPrompt = BYLDA_SYSTEM_PROMPT;
    if (Object.keys(user_context).length > 0) {
      systemPrompt += `\n\nUser business context:\n${Object.entries(user_context)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")}`;
    }

    const messages = [...conversation_history, { role: "user", content: message }];

    // Stream from Cloudflare AI Gateway → Anthropic
    const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.CLOUDFLARE_AI_GATEWAY_ID}/anthropic/v1/messages`;

    const aiRes = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        stream: true,
        system: systemPrompt,
        messages,
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      return new Response(JSON.stringify({ error: "AI error", detail: err }), {
        status: 502,
        headers: { ...cors(), "Content-Type": "application/json" },
      });
    }

    const sid = session_id ?? crypto.randomUUID();
    let fullText = "";
    let tokensIn = 0;
    let tokensOut = 0;
    const t0 = Date.now();

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      const reader = aiRes.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
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

            const text = parsed.delta?.text ?? "";
            if (text) {
              fullText += text;
              await writer.write(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          } catch {
            // ignore malformed SSE chunks
          }
        }
      }
      await writer.close();

      const latencyMs = Date.now() - t0;

      // Fire-and-forget: save conversation + write credits
      const headers = {
        "Content-Type": "application/json",
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: "resolution=merge-duplicates",
      };

      await Promise.allSettled([
        fetch(`${env.SUPABASE_URL}/rest/v1/bylda_conversations`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            user_id: user.sub,
            session_id: sid,
            messages: [
              ...conversation_history,
              { role: "user", content: message },
              { role: "assistant", content: fullText },
            ],
            updated_at: new Date().toISOString(),
          }),
        }),
        recordUsage(env, { userId: user.sub, tokensIn, tokensOut, latencyMs }),
      ]);
    })();

    return new Response(readable, {
      headers: {
        ...cors(),
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Session-Id": sid,
      },
    });
  },
};
