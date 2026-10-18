// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  downloadAudio,
  geminiCostUsd,
  getCallMetadata,
  recordGeminiUsage,
  setCoachingStage,
  triggerAnalysis,
  upsertTranscript,
} from "../../../workers/bylda-coaching-transcriber/supabase";
import type { BaseEnv } from "../../../workers/bylda-coaching-transcriber/env";

const env = {
  SUPABASE_URL: "https://proj.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "SERVICE",
} as BaseEnv;

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

describe("downloadAudio", () => {
  it("streams the body when content-length is known and sends service headers", async () => {
    const f = fetchSequence([
      new Response("abcde", {
        status: 200,
        headers: { "content-length": "5", "content-type": "audio/mpeg" },
      }),
    ]);
    const audio = await downloadAudio(env, "org/user/call.mp3", f);
    expect(audio.sizeBytes).toBe(5);
    expect(audio.contentType).toBe("audio/mpeg");
    expect(audio.body).toBeInstanceOf(ReadableStream);
    const [url, init] = requestOf(f, 0);
    expect(url).toBe("https://proj.supabase.co/storage/v1/object/call-audio/org/user/call.mp3");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer SERVICE");
    expect((init.headers as Record<string, string>).apikey).toBe("SERVICE");
  });

  it("buffers when content-length is missing", async () => {
    const f = fetchSequence([new Response("abc", { status: 200 })]);
    const audio = await downloadAudio(env, "p.mp3", f);
    expect(audio.sizeBytes).toBe(3);
    expect(audio.body).toBeInstanceOf(ArrayBuffer);
  });

  it("rejects oversized and missing recordings", async () => {
    const big = fetchSequence([
      new Response("x", {
        status: 200,
        headers: { "content-length": String(100 * 1024 * 1024 + 1) },
      }),
    ]);
    await expect(downloadAudio(env, "p.mp3", big)).rejects.toThrow(/exceeds 100 MB/);
    const missing = fetchSequence([new Response("nope", { status: 404 })]);
    await expect(downloadAudio(env, "p.mp3", missing)).rejects.toThrow(/404/);
  });
});

describe("getCallMetadata / setCoachingStage", () => {
  it("merges existing metadata and writes the stage", async () => {
    const f = fetchSequence([
      json([{ metadata: { audio_path: "a.mp3", transcription_status: "queued" } }]),
      new Response(null, { status: 204 }),
    ]);
    await setCoachingStage(env, "call-1", "transcribing", { coaching_error: null }, f);
    const [readUrl] = requestOf(f, 0);
    expect(readUrl).toBe("https://proj.supabase.co/rest/v1/calls?id=eq.call-1&select=metadata");
    const [writeUrl, init] = requestOf(f, 1);
    expect(writeUrl).toBe("https://proj.supabase.co/rest/v1/calls?id=eq.call-1");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body as string);
    expect(body.metadata).toMatchObject({
      audio_path: "a.mp3",
      transcription_status: "queued",
      coaching_stage: "transcribing",
      coaching_error: null,
    });
    expect(typeof body.metadata.coaching_updated_at).toBe("string");
  });

  it("returns an empty object when the call has no metadata", async () => {
    expect(await getCallMetadata(env, "c", fetchSequence([json([{ metadata: null }])]))).toEqual(
      {},
    );
    expect(await getCallMetadata(env, "c", fetchSequence([json([])]))).toEqual({});
  });
});

describe("upsertTranscript", () => {
  const row = {
    transcript_text: "Rep: hi",
    speaker_segments: [{ speaker: "Rep", text: "hi", start: 0, end: 1 }],
    structured_turns: [{ speaker: "rep", text: "hi" }],
    structured_meta: { model: "gemini-3.8-flash" },
  };

  it("PATCHes the existing row when one exists", async () => {
    const f = fetchSequence([json([{ id: "t-1" }]), json([{ id: "t-1" }])]);
    expect(await upsertTranscript(env, "call-1", "org-1", row, f)).toBe("t-1");
    const [url, init] = requestOf(f, 1);
    expect(url).toBe("https://proj.supabase.co/rest/v1/call_transcripts?id=eq.t-1");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual(row);
    expect(body.call_id).toBeUndefined();
  });

  it("POSTs a new row with call and org ids when none exists", async () => {
    const f = fetchSequence([json([]), json([{ id: "t-2" }], { status: 201 })]);
    expect(await upsertTranscript(env, "call-1", "org-1", row, f)).toBe("t-2");
    const [url, init] = requestOf(f, 1);
    expect(url).toBe("https://proj.supabase.co/rest/v1/call_transcripts");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({
      call_id: "call-1",
      organization_id: "org-1",
      ...row,
    });
    expect((init.headers as Record<string, string>).Prefer).toBe("return=representation");
  });

  it("throws when the write fails", async () => {
    const f = fetchSequence([json([]), new Response("bad", { status: 400 })]);
    await expect(upsertTranscript(env, "c", "o", row, f)).rejects.toThrow(/400/);
  });
});

describe("triggerAnalysis", () => {
  it("posts call_id to the coaching-analyze bridge with the worker secret", async () => {
    const f = fetchSequence([json({ ok: true })]);
    expect(await triggerAnalysis({ ...env, COACHING_WORKER_SECRET: "shared" }, "call-1", f)).toBe(
      true,
    );
    const [url, init] = requestOf(f, 0);
    expect(url).toBe("https://proj.supabase.co/functions/v1/coaching-analyze");
    expect(JSON.parse(init.body as string)).toEqual({ call_id: "call-1" });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer shared");
    expect((init.headers as Record<string, string>).apikey).toBeUndefined();
  });

  it("returns false on HTTP failure and on a thrown fetch", async () => {
    expect(
      await triggerAnalysis(env, "c", fetchSequence([new Response("x", { status: 500 })])),
    ).toBe(false);
    const throwing = vi.fn(async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    expect(await triggerAnalysis(env, "c", throwing)).toBe(false);
  });
});

describe("recordGeminiUsage", () => {
  it("prices input and output tokens from the pinned list prices", () => {
    expect(geminiCostUsd({ promptTokenCount: 1_000_000, candidatesTokenCount: 1_000_000 })).toBe(
      4.5,
    );
    expect(geminiCostUsd({})).toBe(0);
  });

  it("posts a usage_events row with the uploader, org, provider, and cost", async () => {
    const f = fetchSequence([new Response(null, { status: 201 })]);
    await recordGeminiUsage(
      env,
      {
        userId: "user-1",
        organizationId: "org-1",
        callId: "call-1",
        usage: { promptTokenCount: 2000, candidatesTokenCount: 500, thoughtsTokenCount: 100 },
        durationMs: 4200,
      },
      f,
    );
    const [url, init] = requestOf(f, 0);
    expect(url).toBe("https://proj.supabase.co/rest/v1/usage_events");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({
      user_id: "user-1",
      organization_id: "org-1",
      event_type: "call_transcription",
      resource_key: "coaching-transcriber",
      tokens_in: 2000,
      tokens_out: 600,
      provider_name: "gemini",
      model: "gemini-3.8-flash",
      duration_ms: 4200,
      metadata: { call_id: "call-1" },
    });
  });

  it("throws when the insert is rejected", async () => {
    const f = fetchSequence([new Response("bad", { status: 400 })]);
    await expect(
      recordGeminiUsage(
        env,
        { userId: "u", organizationId: "o", callId: "c", usage: {}, durationMs: 1 },
        f,
      ),
    ).rejects.toThrow(/400/);
  });
});
