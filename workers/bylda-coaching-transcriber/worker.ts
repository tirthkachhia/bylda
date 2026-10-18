// bylda-coaching-transcriber — Cloudflare Worker + Queue
// POST /enqueue (shared secret) accepts work items; the queue consumer runs each:
//   kind "transcribe": Gemini transcript → enqueue scoring chunk 0
//   kind "score":      Jev-score one chunk of exchanges → enqueue the next chunk,
//                      or on the last chunk write summary + moments → analyze-call
// Chunking keeps every invocation under Cloudflare's per-invocation subrequest cap.
import { GEMINI_MODEL } from "../../supabase/functions/_shared/coaching/transcript-schema.ts";
import { validateStructuredTranscript } from "../../supabase/functions/_shared/coaching/transcript-parse.ts";
import {
  flattenTranscript,
  toSpeakerSegments,
} from "../../supabase/functions/_shared/coaching/transcript-flatten.ts";
import type { BaseEnv, MessageBatchLike, QueueLike } from "./env.ts";
import {
  deleteFile,
  generateTranscript,
  GeminiOutputTooLongError,
  uploadAudio,
  waitForActive,
} from "./gemini.ts";
import {
  downloadAudio,
  recordGeminiUsage,
  setCoachingStage,
  triggerAnalysis,
  upsertTranscript,
} from "./supabase.ts";
import { scoreChunk, type ScoreChunk } from "./score.ts";

export interface Env extends BaseEnv {
  TRANSCRIBE_QUEUE: QueueLike<TranscribeMessage>;
  /** Scoring chunks: seconds each, so they must not queue behind transcriptions. */
  SCORE_QUEUE: QueueLike<TranscribeMessage>;
}

export type MessageKind = "transcribe" | "score";

export type TranscribeMessage = {
  kind?: MessageKind; // defaults to "transcribe"
  call_id: string;
  organization_id: string;
  user_id: string;
  /** Required for "transcribe"; ignored for "score". */
  audio_path: string;
  content_type: string;
  /** Present on continuation messages of a chunked scoring run. */
  chunk?: ScoreChunk;
};

export const MAX_ENQUEUE_ITEMS = 50;
const MAX_ATTEMPTS = 3; // keep in step with wrangler.jsonc consumers[].max_retries

const UUID = /^[0-9a-f-]{36}$/i;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function parseEnqueueItems(input: unknown): TranscribeMessage[] | null {
  const items = (input as { items?: unknown } | null)?.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ENQUEUE_ITEMS) return null;
  const parsed: TranscribeMessage[] = [];
  for (const raw of items) {
    const item = raw as Partial<TranscribeMessage> | null;
    if (!item) return null;
    const kind: MessageKind = item.kind === "score" ? "score" : "transcribe";
    if (item.kind !== undefined && item.kind !== "score" && item.kind !== "transcribe") return null;
    if (
      typeof item.call_id !== "string" ||
      !UUID.test(item.call_id) ||
      typeof item.organization_id !== "string" ||
      !UUID.test(item.organization_id) ||
      typeof item.user_id !== "string" ||
      !UUID.test(item.user_id)
    )
      return null;
    if (
      kind === "transcribe" &&
      (typeof item.audio_path !== "string" ||
        !item.audio_path ||
        item.audio_path.includes("..") ||
        typeof item.content_type !== "string" ||
        !item.content_type)
    )
      return null;
    parsed.push({
      kind,
      call_id: item.call_id,
      organization_id: item.organization_id,
      user_id: item.user_id,
      audio_path: typeof item.audio_path === "string" ? item.audio_path : "",
      content_type: typeof item.content_type === "string" ? item.content_type : "",
    });
  }
  return parsed;
}

async function handleEnqueue(request: Request, env: Env): Promise<Response> {
  const supplied = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!env.COACHING_WORKER_SECRET || !safeEqual(supplied, env.COACHING_WORKER_SECRET))
    return json({ error: "Unauthorized" }, 401);
  const body = await request.json().catch(() => null);
  const items = parseEnqueueItems(body);
  if (!items) return json({ error: "Provide 1-50 valid items" }, 400);
  // Scoring and transcription have very different durations; keep them on separate queues.
  const transcribe = items.filter((item) => item.kind !== "score");
  const score = items.filter((item) => item.kind === "score");
  if (transcribe.length)
    await env.TRANSCRIBE_QUEUE.sendBatch(transcribe.map((item) => ({ body: item })));
  if (score.length) await env.SCORE_QUEUE.sendBatch(score.map((item) => ({ body: item })));
  return json({ queued: items.length });
}

/** Hand a call to the scoring pipeline (chunk 0). */
async function enqueueScoring(msg: TranscribeMessage, env: Env): Promise<void> {
  await env.SCORE_QUEUE.sendBatch([
    {
      body: {
        kind: "score",
        call_id: msg.call_id,
        organization_id: msg.organization_id,
        user_id: msg.user_id,
        audio_path: "",
        content_type: "",
      },
    },
  ]);
}

/** One scoring chunk; enqueues the next or finishes with analysis. Scoring problems never block analysis. */
async function processScoreMessage(msg: TranscribeMessage, env: Env): Promise<void> {
  if (!msg.chunk) await setCoachingStage(env, msg.call_id, "scoring", { scoring_error: null });
  let outcome: Awaited<ReturnType<typeof scoreChunk>>;
  try {
    outcome = await scoreChunk(env, msg.call_id, msg.chunk);
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    console.error("[transcriber] scoring", msg.call_id, `chunk from ${msg.chunk?.from ?? 0}`, text);
    await setCoachingStage(env, msg.call_id, "transcribed", { scoring_error: text }).catch(
      () => undefined,
    );
    const analyzed = await triggerAnalysis(env, msg.call_id);
    if (!analyzed) console.error("[transcriber] analyze-call did not accept", msg.call_id);
    return;
  }
  if (outcome.status === "next") {
    await env.SCORE_QUEUE.sendBatch([{ body: { ...msg, chunk: outcome.chunk } }]);
    return;
  }
  if (outcome.status === "skipped")
    console.error("[transcriber] scoring skipped", msg.call_id, outcome.reason);
  else
    console.log(
      "[transcriber] scored",
      msg.call_id,
      `${outcome.scoredCount}/${outcome.exchangeCount} exchanges`,
      `value=${outcome.coachingValue}`,
      `quality=${outcome.qualityScore}`,
      `$${outcome.costUsd.toFixed(4)}`,
    );
  await setCoachingStage(env, msg.call_id, "transcribed", {
    scoring_error: outcome.status === "skipped" ? outcome.reason : null,
  });
  const analyzed = await triggerAnalysis(env, msg.call_id);
  if (!analyzed) console.error("[transcriber] analyze-call did not accept", msg.call_id);
}

/** Full pipeline for one message. Throws on transient errors; returns "failed" on permanent ones. */
export async function processMessage(msg: TranscribeMessage, env: Env): Promise<"done" | "failed"> {
  if (msg.kind === "score") {
    await processScoreMessage(msg, env);
    return "done";
  }
  await setCoachingStage(env, msg.call_id, "transcribing", { coaching_error: null });
  const startedAt = Date.now();

  const audio = await downloadAudio(env, msg.audio_path);
  const file = await uploadAudio(
    audio.body,
    audio.sizeBytes,
    audio.contentType,
    msg.call_id,
    env.GEMINI_API_KEY,
  );
  await waitForActive(file.name, env.GEMINI_API_KEY);
  const generated = await generateTranscript(file.uri, audio.contentType, env.GEMINI_API_KEY);
  void deleteFile(file.name, env.GEMINI_API_KEY);

  const validated = validateStructuredTranscript(generated.json);
  if (!validated.ok) {
    await setCoachingStage(env, msg.call_id, "failed", { coaching_error: validated.reason });
    return "failed";
  }

  const { turns, ...meta } = validated.transcript;
  await upsertTranscript(env, msg.call_id, msg.organization_id, {
    transcript_text: flattenTranscript(turns),
    speaker_segments: toSpeakerSegments(turns),
    structured_turns: turns,
    structured_meta: {
      ...meta,
      model: GEMINI_MODEL,
      usage: generated.usage,
      finish_reason: generated.finishReason ?? null,
      generated_at: new Date().toISOString(),
    },
  });
  await recordGeminiUsage(env, {
    userId: msg.user_id,
    organizationId: msg.organization_id,
    callId: msg.call_id,
    usage: generated.usage,
    durationMs: Date.now() - startedAt,
  }).catch((error) => console.error("[transcriber] usage row", String(error)));

  await setCoachingStage(env, msg.call_id, "scoring");
  await enqueueScoring(msg, env);
  return "done";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/health") return json({ ok: true });
    if (request.method === "POST" && pathname === "/enqueue") return handleEnqueue(request, env);
    return json({ error: "Not found" }, 404);
  },

  async queue(batch: MessageBatchLike<TranscribeMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const msg = message.body;
      try {
        await processMessage(msg, env);
        message.ack();
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        const permanent = error instanceof GeminiOutputTooLongError;
        const exhausted = message.attempts >= MAX_ATTEMPTS;
        console.error("[transcriber]", msg.call_id, `attempt ${message.attempts}`, text);
        if (permanent || exhausted) {
          await setCoachingStage(env, msg.call_id, "failed", { coaching_error: text }).catch(
            () => undefined,
          );
          message.ack();
        } else {
          message.retry({ delaySeconds: 30 * message.attempts });
        }
      }
    }
  },
};
