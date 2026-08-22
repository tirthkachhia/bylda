import { Buffer } from "node:buffer";

// Bylda AI API — served from https://ai.usebylda.com.
// Authenticates with Supabase and runs inference on Cloudflare Workers AI.

interface WorkersAI {
  run(model: string, input: unknown): Promise<unknown>;
}

type TextGenerationResult = {
  response?: string;
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
  content_preview: string | null;
  source_type: string;
  source_label: string | null;
};

const ALLOWED_ORIGIN = "https://app.usebylda.com";
const MODEL = "@cf/openai/gpt-oss-20b";
const TRANSCRIPTION_MODEL = "@cf/openai/whisper-large-v3-turbo";
const AUDIO_CHUNK_BYTES = 1024 * 1024;
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
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
    const result = (await env.AI.run(MODEL, {
      max_tokens: 1200,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `${SYSTEM_PROMPT}\n\nAnswer using only the indexed company memory below. Cite sources inline with the source name and document title.\n\n--- COMPANY MEMORY ---\n${context}\n--- END MEMORY ---`,
        },
        { role: "user", content: request.message },
      ],
    } satisfies TextGenerationInput)) as TextGenerationResult;
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
    const result = (await env.AI.run(MODEL, {
      max_tokens: 1600,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        ...(body.conversation_history ?? []),
        { role: "user", content: body.message },
      ],
    } satisfies TextGenerationInput)) as TextGenerationResult;
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
