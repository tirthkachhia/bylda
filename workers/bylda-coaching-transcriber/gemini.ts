// Gemini REST client for the transcriber worker. Four small calls with an
// injectable fetch so each one is unit-testable with canned responses.
// Shapes pinned from the live docs on 2026-10-16 (Files API + generateContent).
import {
  GEMINI_MODEL,
  TRANSCRIPT_PROMPT,
  TRANSCRIPT_RESPONSE_SCHEMA,
} from "../../supabase/functions/_shared/coaching/transcript-schema.ts";

const BASE = "https://generativelanguage.googleapis.com";
const UPLOAD_TIMEOUT_MS = 600_000;
const POLL_TIMEOUT_MS = 60_000;
const GENERATE_TIMEOUT_MS = 600_000;
const MAX_OUTPUT_TOKENS = 65_536;

export type FetchLike = typeof fetch;

export type GeminiFileState = "STATE_UNSPECIFIED" | "PROCESSING" | "ACTIVE" | "FAILED";

export type GeminiFile = {
  /** "files/{id}" */
  name: string;
  uri: string;
  mimeType?: string;
  state: GeminiFileState;
  error?: { message?: string };
};

export type GeminiUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
};

export type TranscriptGeneration = {
  json: unknown;
  usage: GeminiUsage;
  finishReason: string | undefined;
};

/** Gemini stopped at the output cap; the recording is too long for one pass. */
export class GeminiOutputTooLongError extends Error {
  constructor() {
    super("Gemini output hit the token cap before the transcript finished");
    this.name = "GeminiOutputTooLongError";
  }
}

const authHeaders = (apiKey: string) => ({ "x-goog-api-key": apiKey });

/**
 * Resumable Files API upload: a metadata "start" request returns an upload
 * URL, then one "upload, finalize" request carries the bytes. The body streams
 * straight through, so a 100 MB recording is never buffered in the worker.
 */
export async function uploadAudio(
  body: BodyInit,
  sizeBytes: number,
  mimeType: string,
  displayName: string,
  apiKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<GeminiFile> {
  const start = await fetchImpl(`${BASE}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      ...authHeaders(apiKey),
      "Content-Type": "application/json",
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(sizeBytes),
      "X-Goog-Upload-Header-Content-Type": mimeType,
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
    signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
  });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!start.ok || !uploadUrl)
    throw new Error(`Gemini upload start failed: ${start.status} ${await safeText(start)}`);

  const finish = await fetchImpl(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(sizeBytes),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body,
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });
  if (!finish.ok)
    throw new Error(`Gemini upload failed: ${finish.status} ${await safeText(finish)}`);
  const data = (await finish.json()) as { file?: GeminiFile };
  if (!data.file?.name || !data.file.uri) throw new Error("Gemini upload returned no file");
  return data.file;
}

/** Polls files.get until the file is ACTIVE. Sleep is injectable for tests. */
export async function waitForActive(
  name: string,
  apiKey: string,
  fetchImpl: FetchLike = fetch,
  options: {
    intervalMs?: number;
    maxAttempts?: number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<GeminiFile> {
  const intervalMs = options.intervalMs ?? 2_000;
  const maxAttempts = options.maxAttempts ?? 90;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetchImpl(`${BASE}/v1beta/${name}`, {
      headers: authHeaders(apiKey),
      signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Gemini file status failed: ${res.status} ${await safeText(res)}`);
    const file = (await res.json()) as GeminiFile;
    if (file.state === "ACTIVE") return file;
    if (file.state === "FAILED")
      throw new Error(`Gemini could not process the audio: ${file.error?.message ?? "unknown"}`);
    await sleep(intervalMs);
  }
  throw new Error("Gemini file did not become active in time");
}

type GenerateChunk = {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
  }>;
  usageMetadata?: GeminiUsage;
};

/** Yields the payload of each `data:` event from a server-sent-events body. */
export async function* readSseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];
  const flush = () => {
    const payload = data.join("\n");
    data = [];
    return payload;
  };
  for (;;) {
    const { value, done } = await reader.read();
    buffer += done ? "" : decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).replace(/\r$/, "");
      buffer = buffer.slice(newline + 1);
      if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      else if (line === "" && data.length) yield flush();
      newline = buffer.indexOf("\n");
    }
    if (done) break;
  }
  if (buffer.startsWith("data:")) data.push(buffer.slice(5).trimStart());
  if (data.length) yield flush();
}

/**
 * One streamGenerateContent call: audio file + prompt in, schema-constrained JSON out.
 * Streaming matters on Cloudflare: a non-streaming generateContent on a long
 * recording sends nothing for minutes, and the Workers runtime aborts outbound
 * fetches that wait ~100s for a first byte (HTTP 524). SSE chunks start within
 * seconds and keep the connection alive; the JSON text is concatenated from them.
 */
export async function generateTranscript(
  fileUri: string,
  mimeType: string,
  apiKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<TranscriptGeneration> {
  const res = await fetchImpl(
    `${BASE}/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: { ...authHeaders(apiKey), "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ fileData: { fileUri, mimeType } }, { text: TRANSCRIPT_PROMPT }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: TRANSCRIPT_RESPONSE_SCHEMA,
          temperature: 0.2,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      }),
      signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
    },
  );
  if (!res.ok) throw new Error(`Gemini generate failed: ${res.status} ${await safeText(res)}`);
  if (!res.body) throw new Error("Gemini returned an empty stream");

  let text = "";
  let finishReason: string | undefined;
  let usage: GeminiUsage = {};
  for await (const event of readSseEvents(res.body)) {
    let chunk: GenerateChunk;
    try {
      chunk = JSON.parse(event) as GenerateChunk;
    } catch {
      continue; // keep-alive or malformed frame; the final JSON check below catches real damage
    }
    const candidate = chunk.candidates?.[0];
    for (const part of candidate?.content?.parts ?? [])
      if (typeof part.text === "string") text += part.text;
    if (candidate?.finishReason) finishReason = candidate.finishReason;
    if (chunk.usageMetadata) usage = chunk.usageMetadata;
  }

  if (finishReason === "MAX_TOKENS") throw new GeminiOutputTooLongError();
  if (!text) throw new Error(`Gemini returned no text (${finishReason ?? "no candidate"})`);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned text that is not valid JSON");
  }
  return { json, usage, finishReason };
}

/** Best effort; files expire after 48 hours anyway. Never throws. */
export async function deleteFile(
  name: string,
  apiKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<boolean> {
  try {
    const res = await fetchImpl(`${BASE}/v1beta/${name}`, {
      method: "DELETE",
      headers: authHeaders(apiKey),
      signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "";
  }
}
