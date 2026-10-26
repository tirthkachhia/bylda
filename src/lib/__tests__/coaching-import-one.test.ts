import { describe, expect, it, vi } from "vitest";
import { importRecording, type ImportDeps } from "../coaching/import-one";

const input = {
  file: new File(["audio"], "call.mp3"),
  organizationId: "org-1",
  userId: "user-1",
  repId: "rep-1",
};

function makeDeps(overrides: Partial<ImportDeps> = {}): ImportDeps {
  return {
    upload: vi.fn(async () => ({ error: null })),
    invoke: vi.fn(async (name: string) =>
      name === "import-call"
        ? { data: { call_id: "x", transcript_available: true }, error: null }
        : { data: { ok: true }, error: null },
    ),
    ...overrides,
  };
}

describe("importRecording", () => {
  it("uploads, imports, then analyzes and reports analyzed", async () => {
    const deps = makeDeps();
    const result = await importRecording(input, deps);
    expect(result.status).toBe("analyzed");
    expect(deps.upload).toHaveBeenCalledTimes(1);
    const names = vi.mocked(deps.invoke).mock.calls.map(([name]) => name);
    expect(names).toEqual(["import-call", "analyze-call"]);
  });

  it("sends rep_id and consent with the import and builds the storage path", async () => {
    const deps = makeDeps();
    const result = await importRecording(input, deps);
    const [path, , contentType] = vi.mocked(deps.upload).mock.calls[0];
    expect(path).toBe(`org-1/user-1/${result.callId}.mp3`);
    expect(contentType).toBe("audio/mpeg");
    const [, body] = vi.mocked(deps.invoke).mock.calls[0];
    expect(body).toMatchObject({
      organization_id: "org-1",
      import_id: result.callId,
      audio_path: path,
      content_type: "audio/mpeg",
      consent: true,
      rep_id: "rep-1",
    });
  });

  it("returns queued without analyzing when the worker took the recording", async () => {
    const deps = makeDeps({
      invoke: vi.fn(async () => ({
        data: { call_id: "x", transcript_available: false, coaching_stage: "queued" },
        error: null,
      })),
    });
    const result = await importRecording(input, deps);
    expect(result.status).toBe("queued");
    expect(deps.invoke).toHaveBeenCalledTimes(1);
  });

  it("skips analysis when no transcript is available", async () => {
    const deps = makeDeps({
      invoke: vi.fn(async () => ({ data: { transcript_available: false }, error: null })),
    });
    const result = await importRecording(input, deps);
    expect(result.status).toBe("saved_no_transcript");
    expect(deps.invoke).toHaveBeenCalledTimes(1);
  });

  it("throws on an upload failure before calling any function", async () => {
    const deps = makeDeps({ upload: vi.fn(async () => ({ error: { message: "quota" } })) });
    await expect(importRecording(input, deps)).rejects.toThrow("quota");
    expect(deps.invoke).not.toHaveBeenCalled();
  });

  it("ignores an 'already exists' upload error and continues", async () => {
    const deps = makeDeps({
      upload: vi.fn(async () => ({ error: { message: "The resource already exists" } })),
    });
    await expect(importRecording(input, deps)).resolves.toMatchObject({ status: "analyzed" });
  });

  it("surfaces the import-call error message", async () => {
    const deps = makeDeps({
      invoke: vi.fn(async () => ({
        data: { error: "Rep not found in this workspace" },
        error: null,
      })),
    });
    await expect(importRecording(input, deps)).rejects.toThrow("Rep not found in this workspace");
  });
});
