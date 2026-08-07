// Bylda AI API — served from https://ai.usebylda.com.
// Authenticates with Supabase and runs inference on Cloudflare Workers AI.

type AiResponse = {
  response?: string;
  usage?: Record<string, number>;
};

interface WorkersAI {
  run(
    model: string,
    input: {
      messages: Array<{ role: string; content: string }>;
      max_tokens?: number;
      temperature?: number;
    },
  ): Promise<AiResponse>;
}

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  AI: WorkersAI;
}

type MemoryArtifact = {
  title: string;
  content_preview: string | null;
  source_type: string;
  source_label: string | null;
};

const ALLOWED_ORIGIN = "https://app.usebylda.com";
const MODEL = "@cf/openai/gpt-oss-20b";
const SYSTEM_PROMPT = `You are Bylda, the revenue intelligence assistant for sales teams.

Help users understand sales calls, deal history, buyer signals, CRM records, follow-ups, and pipeline risk. Ground every claim in the context provided. Be concise, specific, and operational. Never invent facts that are not present in the user's data. When evidence is incomplete, say what is missing.`;

function cors() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(), "Content-Type": "application/json" },
  });
}

async function validateJWT(token: string, env: Env): Promise<boolean> {
  try {
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function runMemoryQuery(
  request: { message: string; orgId: string },
  token: string,
  env: Env,
) {
  const params = new URLSearchParams({
    select: "title,content_preview,source_type,source_label",
    org_id: `eq.${request.orgId}`,
    status: "eq.indexed",
    order: "updated_at.desc",
    limit: "60",
  });
  const artifactsResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/memory_artifacts?${params.toString()}`,
    {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    },
  );
  if (!artifactsResponse.ok) {
    console.error("[bylda-ai-api] artifact fetch failed", artifactsResponse.status);
    return json({ error: "Failed to fetch memory artifacts" }, 500);
  }

  const artifacts = (await artifactsResponse.json()) as MemoryArtifact[];
  if (artifacts.length === 0) {
    return json({
      answer: "No indexed content was found. Add and index a source before asking Bylda.",
      sources_searched: 0,
      provider: "cloudflare-workers-ai",
      model: MODEL,
    });
  }

  const context = artifacts
    .map((artifact) => {
      const source = artifact.source_label ?? artifact.source_type;
      return `### [${source}] ${artifact.title}\n${artifact.content_preview ?? "(no preview)"}`;
    })
    .join("\n\n");

  try {
    const result = await env.AI.run(MODEL, {
      max_tokens: 1200,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `${SYSTEM_PROMPT}\n\nAnswer using only the indexed company memory below. Cite sources inline with the source name and document title.\n\n--- COMPANY MEMORY ---\n${context}\n--- END MEMORY ---`,
        },
        { role: "user", content: request.message },
      ],
    });
    return json({
      answer: result.response ?? "No response generated.",
      sources_searched: artifacts.length,
      provider: "cloudflare-workers-ai",
      model: MODEL,
      usage: result.usage,
    });
  } catch (error) {
    console.error("[bylda-ai-api] Workers AI error", error);
    return json({ error: "AI service error" }, 502);
  }
}

async function runChat(
  body: {
    message: string;
    conversation_history?: Array<{ role: string; content: string }>;
    user_context?: Record<string, string>;
  },
  env: Env,
) {
  let system = SYSTEM_PROMPT;
  if (body.user_context && Object.keys(body.user_context).length > 0) {
    system += `\n\nUser business context:\n${Object.entries(body.user_context)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n")}`;
  }

  try {
    const result = await env.AI.run(MODEL, {
      max_tokens: 1600,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        ...(body.conversation_history ?? []),
        { role: "user", content: body.message },
      ],
    });
    return json({
      answer: result.response ?? "No response generated.",
      provider: "cloudflare-workers-ai",
      model: MODEL,
      usage: result.usage,
    });
  } catch (error) {
    console.error("[bylda-ai-api] Workers AI error", error);
    return json({ error: "AI service error" }, 502);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const token = (request.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!(await validateJWT(token, env))) return json({ error: "Unauthorized" }, 401);

    let body: {
      mode?: "chat" | "memory_query";
      message?: string;
      org_id?: string;
      conversation_history?: Array<{ role: string; content: string }>;
      user_context?: Record<string, string>;
    };
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    if (!body.message?.trim()) return json({ error: "message is required" }, 400);
    if (body.mode === "memory_query") {
      if (!body.org_id) return json({ error: "org_id is required" }, 400);
      return runMemoryQuery({ message: body.message.trim(), orgId: body.org_id }, token, env);
    }
    return runChat({ ...body, message: body.message.trim() }, env);
  },
};
