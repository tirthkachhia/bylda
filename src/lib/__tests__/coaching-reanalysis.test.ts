// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  analyze: vi.fn(async () => true),
  download: vi.fn(),
  upload: vi.fn(),
  generate: vi.fn(),
  score: vi.fn(),
  stage: vi.fn(),
  claim: vi.fn(async () => "saved"),
}));
vi.mock("../../../workers/bylda-coaching-transcriber/gemini", () => ({
  uploadAudio: state.upload,
  generateTranscript: state.generate,
  waitForActive: vi.fn(),
  deleteFile: vi.fn(),
  GeminiOutputTooLongError: class extends Error {},
}));
vi.mock("../../../workers/bylda-coaching-transcriber/supabase", () => ({
  triggerAnalysis: state.analyze,
  downloadAudio: state.download,
  setCoachingStage: state.stage,
  recordGeminiUsage: vi.fn(),
  upsertTranscript: vi.fn(),
  transcriptionClaim: state.claim,
}));
vi.mock("../../../workers/bylda-coaching-transcriber/score", () => ({ scoreChunk: state.score }));
import {
  processMessage,
  parseEnqueueItems,
  type Env,
} from "../../../workers/bylda-coaching-transcriber/worker";
import worker from "../../../workers/bylda-coaching-transcriber/worker";
const item = {
  kind: "analyze" as const,
  call_id: "11111111-1111-4111-8111-111111111111",
  organization_id: "22222222-2222-4222-8222-222222222222",
  user_id: "33333333-3333-4333-8333-333333333333",
  audio_path: "",
  content_type: "",
};
describe("saved-transcript re-analysis", () => {
  it("accepts an analysis-only queue item without audio", () => {
    expect(parseEnqueueItems({ items: [item] })).toEqual([item]);
  });
  it("runs only the analyzer, without downloading audio, transcribing, or rescoring exchanges", async () => {
    await expect(processMessage(item, {} as Env)).resolves.toBe("done");
    expect(state.analyze).toHaveBeenCalledWith({}, item.call_id);
    expect(state.download).not.toHaveBeenCalled();
    expect(state.upload).not.toHaveBeenCalled();
    expect(state.generate).not.toHaveBeenCalled();
    expect(state.score).not.toHaveBeenCalled();
  });
  it("keeps a failed analysis retryable rather than acknowledging success", async () => {
    state.analyze.mockResolvedValueOnce(false);
    await expect(processMessage(item, {} as Env)).rejects.toThrow("did not complete");
  });
  it("hands scoring off to a separate retryable analysis message", async () => {
    state.score.mockResolvedValueOnce({ status: "skipped", reason: "No exchange provider" });
    state.stage.mockResolvedValue(undefined);
    const sendBatch = vi.fn(async () => undefined);
    await processMessage({ ...item, kind: "score" }, {
      SCORE_QUEUE: { sendBatch },
    } as unknown as Env);
    expect(sendBatch).toHaveBeenCalledWith([
      { body: { ...item, kind: "analyze", chunk: undefined } },
    ]);
  });
  it("retries failed analysis and retains visible failure after exhaustion", async () => {
    const ack = vi.fn(),
      retry = vi.fn();
    state.analyze.mockResolvedValue(false);
    state.stage.mockResolvedValue(undefined);
    await worker.queue({ messages: [{ body: item, attempts: 1, ack, retry }] }, {} as Env);
    expect(ack).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledWith({ delaySeconds: 30 });
    await worker.queue({ messages: [{ body: item, attempts: 3, ack, retry }] }, {} as Env);
    expect(state.stage).toHaveBeenCalledWith({}, item.call_id, "failed", {
      coaching_error: "Saved-transcript analysis did not complete",
    });
    expect(ack).toHaveBeenCalledTimes(1);
    state.analyze.mockResolvedValue(true);
  });
  it("reuses a saved transcript after a queue retry instead of transcribing again", async () => {
    const sendBatch = vi.fn(async () => undefined);
    await processMessage(
      { ...item, kind: "transcribe", audio_path: "saved.mp3" },
      { SCORE_QUEUE: { sendBatch } } as unknown as Env,
      "stable-queue-id",
    );
    expect(state.claim).toHaveBeenCalled();
    expect(state.download).not.toHaveBeenCalled();
    expect(state.generate).not.toHaveBeenCalled();
    expect(sendBatch).toHaveBeenCalled();
  });
});
