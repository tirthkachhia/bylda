// Supabase access for the transcriber worker: Storage download, PostgREST
// reads/writes with the service-role key, and the internal analyze-call trigger.
// Every function takes an injectable fetch so it can be unit-tested.
import type { BaseEnv as Env } from "./env.ts";

export const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
const BUCKET = "call-audio";

export type FetchLike = typeof fetch;

/** Stored in calls.metadata.coaching_stage. "Coaching ready" is implied by a call_insights row. */
export type CoachingStage = "queued" | "transcribing" | "scoring" | "transcribed" | "failed";

export type TranscriptRow = {
  transcript_text: string;
  speaker_segments: unknown[];
  structured_turns: unknown[];
  structured_meta: Record<string, unknown>;
};

export type DownloadedAudio = {
  body: ReadableStream<Uint8Array> | ArrayBuffer;
  sizeBytes: number;
  contentType: string;
};

function headers(env: Env, extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

const jsonHeaders = (env: Env, prefer?: string) =>
  headers(env, { "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) });

/**
 * Streams the recording from the private bucket. Uses content-length for the
 * size Gemini needs up front; falls back to buffering only when it is absent.
 */
export async function downloadAudio(
  env: Env,
  path: string,
  fetchImpl: FetchLike = fetch,
): Promise<DownloadedAudio> {
  const res = await fetchImpl(`${env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    headers: headers(env),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok || !res.body) throw new Error(`Could not download recording (${res.status})`);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_AUDIO_BYTES) throw new Error("Recording exceeds 100 MB");
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  if (declared > 0) return { body: res.body, sizeBytes: declared, contentType };
  const buffer = await res.arrayBuffer();
  if (!buffer.byteLength) throw new Error("Recording is empty");
  if (buffer.byteLength > MAX_AUDIO_BYTES) throw new Error("Recording exceeds 100 MB");
  return { body: buffer, sizeBytes: buffer.byteLength, contentType };
}

export async function getCallMetadata(
  env: Env,
  callId: string,
  fetchImpl: FetchLike = fetch,
): Promise<Record<string, unknown>> {
  const res = await fetchImpl(
    `${env.SUPABASE_URL}/rest/v1/calls?id=eq.${encodeURIComponent(callId)}&select=metadata`,
    { headers: headers(env), signal: AbortSignal.timeout(30_000) },
  );
  if (!res.ok) throw new Error(`Could not read call (${res.status})`);
  const rows = (await res.json()) as Array<{ metadata?: Record<string, unknown> | null }>;
  return rows[0]?.metadata ?? {};
}

/** Read-merge-write: PostgREST replaces the whole jsonb column on PATCH. */
export async function setCoachingStage(
  env: Env,
  callId: string,
  stage: CoachingStage,
  extra: Record<string, unknown> = {},
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const metadata = await getCallMetadata(env, callId, fetchImpl);
  const res = await fetchImpl(
    `${env.SUPABASE_URL}/rest/v1/calls?id=eq.${encodeURIComponent(callId)}`,
    {
      method: "PATCH",
      headers: jsonHeaders(env, "return=minimal"),
      body: JSON.stringify({
        metadata: {
          ...metadata,
          ...extra,
          coaching_stage: stage,
          coaching_updated_at: new Date().toISOString(),
        },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!res.ok) throw new Error(`Could not update call stage (${res.status})`);
}

/** One transcript row per call: PATCH if it exists, otherwise POST. Returns the row id. */
export async function upsertTranscript(
  env: Env,
  callId: string,
  organizationId: string,
  row: TranscriptRow,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const existing = await fetchImpl(
    `${env.SUPABASE_URL}/rest/v1/call_transcripts?call_id=eq.${encodeURIComponent(callId)}&select=id&limit=1`,
    { headers: headers(env), signal: AbortSignal.timeout(30_000) },
  );
  if (!existing.ok) throw new Error(`Could not read transcript (${existing.status})`);
  const found = ((await existing.json()) as Array<{ id: string }>)[0];

  const url = found
    ? `${env.SUPABASE_URL}/rest/v1/call_transcripts?id=eq.${encodeURIComponent(found.id)}`
    : `${env.SUPABASE_URL}/rest/v1/call_transcripts`;
  const res = await fetchImpl(url, {
    method: found ? "PATCH" : "POST",
    headers: jsonHeaders(env, "return=representation"),
    body: JSON.stringify(
      found ? row : { call_id: callId, organization_id: organizationId, ...row },
    ),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Could not save transcript (${res.status})`);
  const saved = (await res.json()) as Array<{ id: string }>;
  const id = saved[0]?.id ?? found?.id;
  if (!id) throw new Error("Transcript saved but no id returned");
  return id;
}

/** Gemini 3.8 Flash list prices (USD per 1M tokens), pinned 2026-10-16. */
export const GEMINI_INPUT_USD_PER_M = 0.75;
export const GEMINI_OUTPUT_USD_PER_M = 3.75;

export type GeminiUsageInput = {
  userId: string;
  organizationId: string;
  callId: string;
  usage: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  durationMs: number;
};

export function geminiCostUsd(usage: GeminiUsageInput["usage"]): number {
  const tokensIn = usage.promptTokenCount ?? 0;
  const tokensOut = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
  return (tokensIn * GEMINI_INPUT_USD_PER_M + tokensOut * GEMINI_OUTPUT_USD_PER_M) / 1_000_000;
}

/** One usage_events row per transcription so Gemini spend shows up with every other model call. */
export async function recordGeminiUsage(
  env: Env,
  input: GeminiUsageInput,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const tokensIn = input.usage.promptTokenCount ?? 0;
  const tokensOut = (input.usage.candidatesTokenCount ?? 0) + (input.usage.thoughtsTokenCount ?? 0);
  const res = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/usage_events`, {
    method: "POST",
    headers: jsonHeaders(env, "return=minimal"),
    body: JSON.stringify({
      user_id: input.userId,
      organization_id: input.organizationId,
      event_type: "call_transcription",
      resource_key: "coaching-transcriber",
      credits_used: 0,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      model: "gemini-3.8-flash",
      duration_ms: input.durationMs,
      status: "succeeded",
      provider_name: "gemini",
      actual_cost_usd: geminiCostUsd(input.usage),
      routing_reason: "coaching_transcriber",
      metadata: { call_id: input.callId },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Could not record usage (${res.status})`);
}

/**
 * Asks the coaching-analyze edge function to run analyze-call for this call.
 * analyze-call only trusts the service key injected into the edge runtime, which
 * differs from the legacy key a worker can hold, so the bridge authenticates with
 * the shared COACHING_WORKER_SECRET instead. Never throws: a saved transcript must
 * not be lost to an analysis hiccup.
 */
export async function triggerAnalysis(
  env: Env,
  callId: string,
  fetchImpl: FetchLike = fetch,
): Promise<boolean> {
  try {
    const res = await fetchImpl(`${env.SUPABASE_URL}/functions/v1/coaching-analyze`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.COACHING_WORKER_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ call_id: callId }),
      signal: AbortSignal.timeout(160_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
