// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { type Env } from "../../../workers/bylda-ai-api/worker";

afterEach(() => vi.unstubAllGlobals());
describe("worker recording stream", () => {
  async function run(size: number, declared = true) {
    let remaining = size;
    let received = 0;
    const response = new Response(new ReadableStream({
      pull(controller) {
        if (!remaining) return controller.close();
        const length = Math.min(remaining, 65536);
        remaining -= length;
        controller.enqueue(new Uint8Array(length));
      },
    }), { headers: { "content-type": "audio/mpeg", ...(declared ? { "content-length": String(size) } : {}) } });
    Object.defineProperty(response, "url", { value: "https://recordings.example/call.mp3" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    const env = {
      CALL_TRANSCRIPTION_SECRET: "test-only", TRANSCRIPTION_ALLOWED_HOSTS: "recordings.example",
      AI: { run: async (_model: string, input: any) => {
        expect(input.audio.contentType).toBe("audio/mpeg");
        const reader = input.audio.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.byteLength;
        }
        return { text: "Synthetic transcript" };
      } },
    } as Env;
    const result = await worker.fetch(new Request("https://ai.example/transcribe", {
      method: "POST", headers: { Authorization: "Bearer test-only" },
      body: JSON.stringify({ recording_url: response.url }),
    }), env);
    return { result, received };
  }
  it("streams exactly 100 MB to AI without base64 buffering", async () => {
    const { result, received } = await run(104857600);
    expect(result.status).toBe(200);
    expect(received).toBe(104857600);
  });
  it("rejects a declared file above 100 MB before inference", async () => {
    const { result, received } = await run(104857601);
    expect(result.status).toBe(413);
    expect(received).toBe(0);
  });
  it("stops oversized streams even without a length header", async () => {
    const { result, received } = await run(104857601, false);
    expect(result.status).not.toBe(200);
    expect(received).toBeLessThanOrEqual(104857600);
  });
});
