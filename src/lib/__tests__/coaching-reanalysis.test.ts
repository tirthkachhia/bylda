// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  analyze: vi.fn(async () => true),
  download: vi.fn(),
  upload: vi.fn(),
  generate: vi.fn(),
  score: vi.fn(),
  stage: vi.fn(),
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
}));
vi.mock("../../../workers/bylda-coaching-transcriber/score", () => ({ scoreChunk: state.score }));
import {
  processMessage,
  parseEnqueueItems,
  type Env,
} from "../../../workers/bylda-coaching-transcriber/worker";
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
});
