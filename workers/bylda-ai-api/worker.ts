import { Buffer } from "node:buffer";

// Bylda AI API — served from https://ai.usebylda.com.
// Authenticates with Supabase and runs inference on Cloudflare Workers AI.

interface WorkersAI {
  run(model: string, input: unknown): Promise<unknown>;
}

type TextGenerationResult = {
  response?: string;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: Record<string, number>;
};

type TranscriptionResult = {
  text?: string;
  transcription_info?: { text?: string; word_count?: number };
  segments?: unknown[];
  vtt?: string;
};

type TextGenerationInput = {
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
};

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  CALL_TRANSCRIPTION_SECRET: string;
  TRANSCRIPTION_ALLOWED_HOSTS?: string;
  AI: WorkersAI;
}

type MemoryArtifact = {
  title: string;
  content: string | null;
  content_preview: string | null;
  source_type: string;
  source_label: string | null;
};

type CrmContextSource = {
  label: string;
  table: string;
  orgColumn: "org_id" | "organization_id";
  select: string;
  order?: string;
  limit: number;
};

type CrmContextResult = {
  label: string;
  total: number | null;
  rows: Array<Record<string, unknown>>;
  error?: string;
};

const ALLOWED_ORIGIN = "https://app.usebylda.com";
const MODEL = "@cf/openai/gpt-oss-20b";
const TRANSCRIPTION_MODEL = "@cf/openai/whisper-large-v3-turbo";
const AUDIO_CHUNK_BYTES = 1024 * 1024;
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const SYSTEM_PROMPT = `You are Bylda, the revenue intelligence assistant for sales teams.

Help users understand sales calls, deal history, buyer signals, CRM records, follow-ups, and pipeline risk. Ground every claim in the context provided. Be concise, specific, and operational. Never invent facts that are not present in the user's data. When evidence is incomplete, say what is missing.`;

const CRM_CONTEXT_SOURCES: CrmContextSource[] = [
  {
    label: "CRM contacts",
    table: "contacts",
    orgColumn: "org_id",
    select:
      "id,first_name,last_name,email,phone,company,status,source,tags,notes,last_contacted_at,created_at,updated_at",
    order: "updated_at.desc",
    limit: 50,
  },
  {
    label: "Deals and opportunities",
    table: "leads",
    orgColumn: "organization_id",
    select:
      "id,name,email,phone,company,stage,source,notes,value,probability,close_date,tags,score,priority,owner_name,last_activity_at,external_source,created_at,updated_at",
    order: "updated_at.desc",
    limit: 50,
  },
  {
    label: "Sales calls",
    table: "calls",
    orgColumn: "organization_id",
    select:
      "id,contact_id,lead_id,user_id,direction,status,duration,disposition,outcome_tag,provider,started_at,created_at",
    order: "started_at.desc",
    limit: 40,
  },
  {
    label: "Call transcripts",
    table: "call_transcripts",
    orgColumn: "organization_id",
    select: "id,call_id,transcript_text,sentiment_score,created_at",
    order: "created_at.desc",
    limit: 20,
  },
  {
    label: "Call insights",
    table: "call_insights",
    orgColumn: "organization_id",
    select:
      "id,call_id,objections,competitor_mentions,talk_ratio,next_steps_extracted,summary,created_at",
    order: "created_at.desc",
    limit: 30,
  },
  {
    label: "CRM activities",
    table: "crm_activities",
    orgColumn: "organization_id",
    select: "id,deal_id,type,content,metadata,user_id,created_at",
    order: "created_at.desc",
    limit: 40,
  },
  {
    label: "Tasks and follow-ups",
    table: "tasks",
    orgColumn: "organization_id",
    select:
      "id,title,description,status,priority,due_date,task_type,completed_at,contact_id,lead_id,assigned_to,created_at",
    order: "created_at.desc",
    limit: 40,
  },
  {
    label: "Companies",
    table: "companies",
    orgColumn: "organization_id",
    select: "id,name,domain,website,industry,size,location,notes,created_at,updated_at",
    order: "updated_at.desc",
    limit: 30,
  },
];

function modelText(result: TextGenerationResult): string {
  if (typeof result.response === "string" && result.response.trim()) return result.response.trim();
  if (typeof result.output_text === "string" && result.output_text.trim()) {
    return result.output_text.trim();
  }

  const responsesApiText = result.output
    ?.flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text" || typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("")
    .trim();
  if (responsesApiText) return responsesApiText;

  const chatCompletionText = result.choices?.[0]?.message?.content?.trim();
  return chatCompletionText || "";
}

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

async function fetchCrmContextSource(
  source: CrmContextSource,
  orgId: string,
  token: string,
  env: Env,
): Promise<CrmContextResult> {
  const params = new URLSearchParams({
    select: source.select,
    [source.orgColumn]: `eq.${orgId}`,
    limit: String(source.limit),
  });
  if (source.order) params.set("order", source.order);

  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/${source.table}?${params.toString()}`,
      {
        headers: {
          apikey: env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          Prefer: "count=exact",
          Range: `0-${source.limit - 1}`,
        },
      },
    );
    if (!response.ok) {
      console.error(
        `[bylda-ai-api] ${source.table} fetch failed`,
        response.status,
        await response.text(),
      );
      return { label: source.label, total: null, rows: [], error: `HTTP ${response.status}` };
    }

    const contentRange = response.headers.get("content-range");
    const totalText = contentRange?.split("/")[1];
    const total = totalText && totalText !== "*" ? Number(totalText) : null;
    return {
      label: source.label,
      total: Number.isFinite(total) ? total : null,
      rows: (await response.json()) as Array<Record<string, unknown>>,
    };
  } catch (error) {
    console.error(`[bylda-ai-api] ${source.table} fetch error`, error);
    return { label: source.label, total: null, rows: [], error: "request_failed" };
  }
}

async function runMemoryQuery(
  request: { message: string; orgId: string },
  token: string,
  env: Env,
) {
  const params = new URLSearchParams({
    select: "title,content,content_preview,source_type,source_label",
    org_id: `eq.${request.orgId}`,
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
  }

  const artifacts = (artifactsResponse.ok
    ? ((await artifactsResponse.json()) as MemoryArtifact[])
    : []
  ).filter(
    (artifact) => Boolean(artifact.content?.trim() || artifact.content_preview?.trim()),
  );

  const crmContext = await Promise.all(
    CRM_CONTEXT_SOURCES.map((source) =>
      fetchCrmContextSource(source, request.orgId, token, env),
    ),
  );

  let memoryBudget = 12000;
  const memoryContext = artifacts
    .map((artifact) => {
      if (memoryBudget <= 0) return "";
      const source = artifact.source_label ?? artifact.source_type;
      const body = artifact.content ?? artifact.content_preview ?? "(no preview)";
      const excerpt = body.slice(0, Math.min(4000, memoryBudget));
      memoryBudget -= excerpt.length;
      return `### [${source}] ${artifact.title}\n${excerpt}`;
    })
    .filter(Boolean)
    .join("\n\n");

  let crmBudget = 38000;
  const crmContextText = crmContext
    .map((source) => {
      if (crmBudget <= 0) return "";
      const serialized = JSON.stringify(source.rows);
      const excerpt = serialized.slice(0, Math.min(8000, crmBudget));
      crmBudget -= excerpt.length;
      const total = source.total === null ? "unknown" : String(source.total);
      const status = source.error ? `; unavailable: ${source.error}` : "";
      return `### ${source.label} (total visible records: ${total}; included below: ${source.rows.length}${status})\n${excerpt}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const availableCrmSources = crmContext.filter(
    (source) => !source.error && (source.total !== 0 || source.rows.length > 0),
  );

  const combinedContext = [
    crmContextText ? `--- LIVE CRM DATA ---\n${crmContextText}\n--- END LIVE CRM DATA ---` : "",
    memoryContext ? `--- COMPANY MEMORY ---\n${memoryContext}\n--- END COMPANY MEMORY ---` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const groundingInstruction = combinedContext
    ? `Use the live CRM data and company memory below whenever the question concerns this business. CRM totals are exact when a numeric total is supplied, while record arrays may be samples of the most recent records. Cite the relevant section label and record name or ID for specific claims. Never claim that a record exists unless it appears below. If the supplied business data cannot answer the question, say what is missing, then provide clearly labeled general guidance. For questions unrelated to this business, answer normally and do not force CRM citations.\n\n${combinedContext}`
    : "No company CRM data or memory is available yet. Answer general questions normally. For business-specific questions, clearly say that Bylda has no accessible records and identify what data would be needed.";

  try {
    const result = (await env.AI.run(MODEL, {
      max_tokens: 1200,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `${SYSTEM_PROMPT}\n\n${groundingInstruction}`,
        },
        { role: "user", content: request.message },
      ],
    } satisfies TextGenerationInput)) as TextGenerationResult;
    const answer = modelText(result);
    if (!answer) {
      console.error("[bylda-ai-api] Workers AI returned no text", JSON.stringify(result));
      return json({ error: "AI returned an empty response" }, 502);
    }
    return json({
      answer,
      sources_searched: artifacts.length + availableCrmSources.length,
      crm_context_used: availableCrmSources.length > 0,
      crm_sources: availableCrmSources.map((source) => ({
        name: source.label,
        total: source.total,
        included: source.rows.length,
      })),
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
    const result = (await env.AI.run(MODEL, {
      max_tokens: 1600,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        ...(body.conversation_history ?? []),
        { role: "user", content: body.message },
      ],
    } satisfies TextGenerationInput)) as TextGenerationResult;
    const answer = modelText(result);
    if (!answer) {
      console.error("[bylda-ai-api] Workers AI returned no text", JSON.stringify(result));
      return json({ error: "AI returned an empty response" }, 502);
    }
    return json({
      answer,
      provider: "cloudflare-workers-ai",
      model: MODEL,
      usage: result.usage,
    });
  } catch (error) {
    console.error("[bylda-ai-api] Workers AI error", error);
    return json({ error: "AI service error" }, 502);
  }
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function allowedRecordingUrl(value: string, env: Env) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) {
      return false;
    }
    const configured = (env.TRANSCRIPTION_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
    const allowed = configured.length
      ? configured
      : ["readymode.com", "amazonaws.com", "cloudfront.net", "storage.googleapis.com"];
    return allowed.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

async function transcribeChunk(chunk: ArrayBuffer, env: Env) {
  const audio = Buffer.from(chunk).toString("base64");
  const result = (await env.AI.run(TRANSCRIPTION_MODEL, {
    audio,
    task: "transcribe",
    language: "en",
    vad_filter: true,
    condition_on_previous_text: false,
    initial_prompt:
      "Insurance sales call. Preserve names, carriers, policy types, premiums, coverage, objections, beneficiaries, and next steps accurately.",
  })) as TranscriptionResult;
  return (result.text ?? result.transcription_info?.text ?? "").trim();
}

async function runTranscription(request: Request, env: Env) {
  const supplied = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!env.CALL_TRANSCRIPTION_SECRET || !safeEqual(supplied, env.CALL_TRANSCRIPTION_SECRET)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const body = (await request.json().catch(() => null)) as {
    recording_url?: string;
    provider?: string;
  } | null;
  const recordingUrl = body?.recording_url?.trim() ?? "";
  if (!recordingUrl || !allowedRecordingUrl(recordingUrl, env)) {
    return json({ error: "Recording URL is not allowed" }, 400);
  }

  const audioResponse = await fetch(recordingUrl, {
    headers: { Accept: "audio/*,application/octet-stream;q=0.8" },
    redirect: "follow",
  });
  if (!audioResponse.ok) return json({ error: "Could not download the call recording" }, 502);
  if (!allowedRecordingUrl(audioResponse.url, env)) {
    return json({ error: "Recording redirect is not allowed" }, 400);
  }
  const declaredLength = Number(audioResponse.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_AUDIO_BYTES) return json({ error: "Recording is too large" }, 413);

  const audio = await audioResponse.arrayBuffer();
  if (!audio.byteLength || audio.byteLength > MAX_AUDIO_BYTES) {
    return json({ error: "Recording is empty or too large" }, audio.byteLength ? 413 : 400);
  }

  const transcriptParts: string[] = [];
  for (let offset = 0; offset < audio.byteLength; offset += AUDIO_CHUNK_BYTES) {
    const text = await transcribeChunk(audio.slice(offset, offset + AUDIO_CHUNK_BYTES), env);
    if (text) transcriptParts.push(text);
  }
  const transcript = transcriptParts.join("\n").trim();
  if (!transcript) return json({ error: "The recording did not contain recognizable speech" }, 422);

  return json({
    transcript,
    provider: body?.provider ?? "readymode",
    model: TRANSCRIPTION_MODEL,
    chunks: Math.ceil(audio.byteLength / AUDIO_CHUNK_BYTES),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const pathname = new URL(request.url).pathname;
    if (pathname === "/transcribe") return runTranscription(request, env);

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
