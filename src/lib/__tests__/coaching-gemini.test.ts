// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  deleteFile,
  generateTranscript,
  GeminiOutputTooLongError,
  readSseEvents,
  uploadAudio,
  waitForActive,
} from "../../../workers/bylda-coaching-transcriber/gemini";
import {
  GEMINI_MODEL,
  TRANSCRIPT_PROMPT,
} from "../../../supabase/functions/_shared/coaching/transcript-schema";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

function fetchSequence(responses: Response[]) {
  const queue = [...responses];
  return vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error("fetch called more times than expected");
    return next;
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

const requestOf = (f: ReturnType<typeof vi.fn>, call: number) =>
  f.mock.calls[call] as unknown as [string, RequestInit];

describe("uploadAudio", () => {
  it("starts a resumable upload, then finalizes with the bytes", async () => {
    const f = fetchSequence([
      new Response(null, {
        status: 200,
        headers: { "x-goog-upload-url": "https://up.example/u1" },
      }),
      json({ file: { name: "files/abc", uri: "https://files.example/abc", state: "PROCESSING" } }),
    ]);
    const file = await uploadAudio("bytes", 5, "audio/mpeg", "call-1", "KEY", f);
    expect(file.name).toBe("files/abc");

    const [startUrl, startInit] = requestOf(f, 0);
    expect(startUrl).toBe("https://generativelanguage.googleapis.com/upload/v1beta/files");
    const startHeaders = startInit.headers as Record<string, string>;
    expect(startHeaders["x-goog-api-key"]).toBe("KEY");
    expect(startHeaders["X-Goog-Upload-Protocol"]).toBe("resumable");
    expect(startHeaders["X-Goog-Upload-Command"]).toBe("start");
    expect(startHeaders["X-Goog-Upload-Header-Content-Length"]).toBe("5");
    expect(startHeaders["X-Goog-Upload-Header-Content-Type"]).toBe("audio/mpeg");
    expect(JSON.parse(startInit.body as string)).toEqual({ file: { display_name: "call-1" } });

    const [finishUrl, finishInit] = requestOf(f, 1);
    expect(finishUrl).toBe("https://up.example/u1");
    const finishHeaders = finishInit.headers as Record<string, string>;
    expect(finishHeaders["X-Goog-Upload-Command"]).toBe("upload, finalize");
    expect(finishHeaders["X-Goog-Upload-Offset"]).toBe("0");
    expect(finishInit.body).toBe("bytes");
  });

  it("fails when the start response has no upload url", async () => {
    const f = fetchSequence([new Response("nope", { status: 400 })]);
    await expect(uploadAudio("b", 1, "audio/mpeg", "c", "KEY", f)).rejects.toThrow(
      /upload start failed: 400/,
    );
  });
});

describe("waitForActive", () => {
  it("polls until ACTIVE and sleeps between attempts", async () => {
    const f = fetchSequence([
      json({ name: "files/abc", uri: "u", state: "PROCESSING" }),
      json({ name: "files/abc", uri: "u", state: "ACTIVE" }),
    ]);
    const sleep = vi.fn(async () => {});
    const file = await waitForActive("files/abc", "KEY", f, { sleep, intervalMs: 7 });
    expect(file.state).toBe("ACTIVE");
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(7);
    expect(requestOf(f, 0)[0]).toBe("https://generativelanguage.googleapis.com/v1beta/files/abc");
  });

  it("throws on FAILED and on timeout", async () => {
    const failed = fetchSequence([
      json({ name: "files/abc", uri: "u", state: "FAILED", error: { message: "bad audio" } }),
    ]);
    await expect(waitForActive("files/abc", "KEY", failed)).rejects.toThrow(/bad audio/);

    const stuck = fetchSequence([
      json({ name: "files/abc", uri: "u", state: "PROCESSING" }),
      json({ name: "files/abc", uri: "u", state: "PROCESSING" }),
    ]);
    await expect(
      waitForActive("files/abc", "KEY", stuck, { maxAttempts: 2, sleep: async () => {} }),
    ).rejects.toThrow(/did not become active/);
  });
});

/** Builds an SSE body the way Gemini streams it: one `data:` frame per chunk. */
const sse = (chunks: unknown[], init: ResponseInit = {}) =>
  new Response(chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join(""), {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
    ...init,
  });

const textChunk = (text: string, extra: Record<string, unknown> = {}) => ({
  candidates: [{ content: { parts: [{ text }] }, ...extra }],
});

describe("generateTranscript", () => {
  it("streams the JSON across chunks and concatenates the text", async () => {
    const payload = { schema_version: 1, turns: [{ speaker: "rep", text: "Hi there" }] };
    const full = JSON.stringify(payload);
    const cut = Math.floor(full.length / 2);
    const f = fetchSequence([
      sse([
        textChunk(full.slice(0, cut)),
        {
          ...textChunk(full.slice(cut), { finishReason: "STOP" }),
          usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 300 },
        },
      ]),
    ]);
    const result = await generateTranscript("https://files.example/abc", "audio/mpeg", "KEY", f);
    expect(result.json).toEqual(payload);
    expect(result.usage.promptTokenCount).toBe(1200);
    expect(result.finishReason).toBe("STOP");

    const [url, init] = requestOf(f, 0);
    expect(url).toBe(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`,
    );
    const body = JSON.parse(init.body as string);
    expect(body.contents[0].parts[0]).toEqual({
      fileData: { fileUri: "https://files.example/abc", mimeType: "audio/mpeg" },
    });
    expect(body.contents[0].parts[1].text).toBe(TRANSCRIPT_PROMPT);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema.type).toBe("OBJECT");
  });

  it("throws a specific error when the output hit the token cap", async () => {
    const f = fetchSequence([
      sse([
        textChunk('{"schema_version":1,'),
        textChunk('"turns":[', { finishReason: "MAX_TOKENS" }),
      ]),
    ]);
    await expect(generateTranscript("u", "audio/mpeg", "KEY", f)).rejects.toBeInstanceOf(
      GeminiOutputTooLongError,
    );
  });

  it("surfaces HTTP failures and non-JSON text", async () => {
    const f500 = fetchSequence([new Response("overloaded", { status: 503 })]);
    await expect(generateTranscript("u", "audio/mpeg", "KEY", f500)).rejects.toThrow(
      /generate failed: 503 overloaded/,
    );
    const fBad = fetchSequence([sse([textChunk("not json", { finishReason: "STOP" })])]);
    await expect(generateTranscript("u", "audio/mpeg", "KEY", fBad)).rejects.toThrow(
      /not valid JSON/,
    );
  });

  it("parses SSE frames split across network reads and ignores non-JSON keep-alives", async () => {
    const frames = `data: ${JSON.stringify(textChunk("ab"))}\n\n: keep-alive\n\ndata: ${JSON.stringify(
      textChunk("cd", { finishReason: "STOP" }),
    )}\n\n`;
    const half = Math.floor(frames.length / 3);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(enc.encode(frames.slice(0, half)));
        controller.enqueue(enc.encode(frames.slice(half)));
        controller.close();
      },
    });
    const events: string[] = [];
    for await (const event of readSseEvents(body)) events.push(event);
    expect(events).toHaveLength(2);
    expect(JSON.parse(events[0]).candidates[0].content.parts[0].text).toBe("ab");
    expect(JSON.parse(events[1]).candidates[0].finishReason).toBe("STOP");
  });
});

describe("deleteFile", () => {
  it("returns true on success and false on any failure without throwing", async () => {
    expect(await deleteFile("files/abc", "KEY", fetchSequence([json({})]))).toBe(true);
    expect(
      await deleteFile("files/abc", "KEY", fetchSequence([new Response("x", { status: 404 })])),
    ).toBe(false);
    const throwing = vi.fn(async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    expect(await deleteFile("files/abc", "KEY", throwing)).toBe(false);
  });
});
