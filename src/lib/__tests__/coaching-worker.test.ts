// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import worker, {
  parseEnqueueItems,
  type Env,
  type TranscribeMessage,
} from "../../../workers/bylda-coaching-transcriber/worker";

const item: TranscribeMessage = {
  call_id: "11111111-1111-1111-1111-111111111111",
  organization_id: "22222222-2222-2222-2222-222222222222",
  user_id: "33333333-3333-3333-3333-333333333333",
  audio_path: "org/user/call.mp3",
  content_type: "audio/mpeg",
};

function makeEnv() {
  const sendBatch = vi.fn(async () => {});
  const sendScore = vi.fn(async () => {});
  const env = {
    SUPABASE_URL: "https://proj.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "SERVICE",
    GEMINI_API_KEY: "GEMINI",
    COACHING_WORKER_SECRET: "s3cret",
    TRANSCRIBE_QUEUE: { sendBatch } as unknown as Env["TRANSCRIBE_QUEUE"],
    SCORE_QUEUE: { sendBatch: sendScore } as unknown as Env["SCORE_QUEUE"],
  } as Env;
  return { env, sendBatch, sendScore };
}

const post = (body: unknown, secret?: string) =>
  new Request("https://worker.example/enqueue", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify(body),
  });

describe("parseEnqueueItems", () => {
  it("accepts well-formed items and rejects bad ones", () => {
    expect(parseEnqueueItems({ items: [item] })).toEqual([{ ...item, kind: "transcribe" }]);
    // score-only messages need no audio
    expect(
      parseEnqueueItems({
        items: [
          {
            kind: "score",
            call_id: item.call_id,
            organization_id: item.organization_id,
            user_id: item.user_id,
          },
        ],
      }),
    ).toEqual([
      {
        kind: "score",
        call_id: item.call_id,
        organization_id: item.organization_id,
        user_id: item.user_id,
        audio_path: "",
        content_type: "",
      },
    ]);
    expect(parseEnqueueItems({ items: [{ ...item, kind: "bogus" }] })).toBeNull();
    expect(parseEnqueueItems({ items: [] })).toBeNull();
    expect(parseEnqueueItems({ items: [{ ...item, call_id: "nope" }] })).toBeNull();
    expect(parseEnqueueItems({ items: [{ ...item, audio_path: "../etc/passwd" }] })).toBeNull();
    expect(parseEnqueueItems({ items: [{ ...item, user_id: undefined }] })).toBeNull();
    expect(parseEnqueueItems({ items: Array(51).fill(item) })).toBeNull();
    expect(parseEnqueueItems(null)).toBeNull();
  });
});

describe("worker fetch", () => {
  it("answers /health", async () => {
    const { env } = makeEnv();
    const res = await worker.fetch(new Request("https://worker.example/health"), env);
    expect(res.status).toBe(200);
  });

  it("rejects a missing or wrong secret", async () => {
    const { env, sendBatch } = makeEnv();
    expect((await worker.fetch(post({ items: [item] }), env)).status).toBe(401);
    expect((await worker.fetch(post({ items: [item] }, "wrong"), env)).status).toBe(401);
    expect(sendBatch).not.toHaveBeenCalled();
  });

  it("rejects malformed bodies with 400", async () => {
    const { env, sendBatch } = makeEnv();
    const res = await worker.fetch(post({ items: [{ ...item, call_id: "x" }] }, "s3cret"), env);
    expect(res.status).toBe(400);
    expect(sendBatch).not.toHaveBeenCalled();
  });

  it("enqueues one message per item", async () => {
    const { env, sendBatch } = makeEnv();
    const second = { ...item, call_id: "44444444-4444-4444-4444-444444444444" };
    const res = await worker.fetch(post({ items: [item, second] }, "s3cret"), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ queued: 2 });
    expect(sendBatch).toHaveBeenCalledWith([
      { body: { ...item, kind: "transcribe" } },
      { body: { ...second, kind: "transcribe" } },
    ]);
  });

  it("returns 404 for anything else", async () => {
    const { env } = makeEnv();
    const res = await worker.fetch(new Request("https://worker.example/other"), env);
    expect(res.status).toBe(404);
  });
});
