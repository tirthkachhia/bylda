import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { scanReadyModePage } from "../../../extensions/readymode/collector.js";
import {
  allowedMediaUrl,
  audioType,
  ENDPOINT,
  importCall,
  parseConnection,
  plainTranscript,
} from "../../../extensions/readymode/core.js";
import {
  readyModeHost,
  readyModeImportId,
  validateReadyModeAudio,
  validateReadyModeImport,
} from "../../../supabase/functions/_shared/readymode-extension";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
const token = "a".repeat(64),
  connection = { endpoint: ENDPOINT, token, workspace: "Sales" };
const call = {
  external_id: "call-42",
  source_url: "https://sales.readymode.com/reports",
  duration: 91,
  recording_url: "https://sales.readymode.com/recordings/call-42.mp3",
};

describe("ReadyMode page collector", () => {
  beforeEach(() => {
    vi.stubGlobal("location", new URL("https://sales.readymode.com/reports"));
    vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function (this: Element) {
      return (this.closest("[hidden]") ? [] : [{ width: 100 }]) as unknown as DOMRectList;
    });
  });
  it("extracts distinct loaded call rows, transcripts, and metadata without page notes", () => {
    document.body.innerHTML = `<table><tbody>
      <tr data-call-id="42"><td>Alex inbound 01:31 <time datetime="2026-11-17T10:00:00Z"></time></td><td><a href="/recordings/42.mp3?token=private">Play recording</a><div data-transcript>Agent: Hello\nCustomer: Hi.</div></td></tr>
      <tr data-call-id="43"><td>Jamie outbound 00:52</td><td><audio><source src="/recordings/43.mp3"></audio><a href="/recordings/43.mp3">Download</a></td></tr>
      <tr hidden data-call-id="hidden"><td><a href="/recordings/hidden.mp3">Recording</a></td></tr>
      </tbody></table><p>Call notes are not transcripts.</p>`;
    const result = scanReadyModePage();
    expect(result.calls).toHaveLength(2);
    expect(result.calls[0]).toMatchObject({
      external_id: "42",
      duration: 91,
      direction: "inbound",
      transcript: "Agent: Hello\nCustomer: Hi.",
      started_at: "2026-11-17T10:00:00.000Z",
    });
    expect(result.calls[1]).toMatchObject({ external_id: "43", duration: 52, transcript: "" });
  });
  it("recognizes transcript-only call details and old Xencall domains", () => {
    vi.stubGlobal("location", new URL("https://team.xencall.com/calls/7"));
    document.body.innerHTML = `<article data-call-id="7"><div aria-label="Transcript">Actual transcript</div></article>`;
    expect(scanReadyModePage().calls[0]).toMatchObject({
      external_id: "7",
      transcript: "Actual transcript",
    });
  });
  it("refuses unrelated sites and does not treat notes as transcripts", () => {
    document.body.innerHTML = `<article data-call-id="1"><p>Call notes</p></article>`;
    expect(scanReadyModePage().calls).toHaveLength(0);
    vi.stubGlobal("location", new URL("https://example.com"));
    expect(() => scanReadyModePage()).toThrow(/ReadyMode/);
  });
});

describe("import boundaries", () => {
  beforeEach(() => vi.stubGlobal("crypto", webcrypto));
  it("rejects source spoofing, missing permission, oversized text and invalid media", () => {
    for (const source of [
      "http://sales.readymode.com",
      "https://readymode.com.evil.test",
      "https://localhost",
      "https://user:secret@sales.readymode.com",
    ])
      expect(() => readyModeHost(source)).toThrow();
    expect(() => validateReadyModeImport({ ...call, consent: false })).toThrow(/permission/);
    expect(() =>
      validateReadyModeImport({ ...call, consent: true, transcript: "a".repeat(100001) }),
    ).toThrow(/100,000/);
    expect(() => validateReadyModeAudio({ extension: "mp3", size: 104857601 })).toThrow();
    expect(() => validateReadyModeAudio({ extension: "html", size: 10 })).toThrow();
  });
  it("gives retries a stable identity while isolating tenants and workspaces", async () => {
    const id = await readyModeImportId("org-a", "sales.readymode.com", "42");
    expect(await readyModeImportId("org-a", "sales.readymode.com", "42")).toBe(id);
    expect(await readyModeImportId("org-b", "sales.readymode.com", "42")).not.toBe(id);
    expect(await readyModeImportId("org-a", "other.readymode.com", "42")).not.toBe(id);
    expect(id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-8[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  });
  it("will not send connection credentials to a different destination", () => {
    expect(parseConnection(JSON.stringify({ version: 1, ...connection }))).toEqual(connection);
    expect(() =>
      parseConnection(JSON.stringify({ version: 1, ...connection, endpoint: "https://evil.test" })),
    ).toThrow();
    expect(() => allowedMediaUrl("https://127.0.0.1/recording.mp3")).toThrow();
    expect(() => allowedMediaUrl("https://readymode.com.evil.test/recording.mp3")).toThrow();
    expect(() =>
      audioType(new Blob(["<html>sign in</html>"], { type: "text/html" }), "call.mp3"),
    ).toThrow();
    expect(plainTranscript("WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.000\nHello")).toBe("Hello");
    expect(plainTranscript("Customer: The number is\n12345")).toBe(
      "Customer: The number is\n12345",
    );
  });
});

describe("extension upload transport", () => {
  it("can import both a recording and its existing transcript using ReadyMode cookies only for the download", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response("audio", { headers: { "Content-Type": "audio/mpeg" } }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            upload_url:
              "https://ipidfqwlszuhjgjygbvx.supabase.co/storage/v1/object/upload/sign/call-audio/path?token=upload",
            content_type: "audio/mpeg",
          }),
        ),
      )
      .mockResolvedValueOnce(new Response("{}"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ transcript_available: true, analysis_queued: true })),
      );
    await importCall(
      connection,
      { ...call, include_recording: true },
      { transcript: "Agent: Hello", request },
    );
    expect(request.mock.calls[0][0]).toBe(call.recording_url);
    expect(request.mock.calls[0][1]).toMatchObject({ credentials: "include", redirect: "error" });
    expect(request.mock.calls[0][1]).not.toHaveProperty("headers");
    expect(request.mock.calls.slice(1).every((c) => c[1].credentials === "omit")).toBe(true);
    expect(JSON.parse(request.mock.calls[3][1].body)).toMatchObject({
      action: "import",
      transcript: "Agent: Hello",
      extension: "mp3",
    });
  });
  it("imports a supplied transcript without fetching ReadyMode or uploading audio", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ call_id: "id", transcript_available: true, analysis_queued: true }),
        ),
      );
    const result = await importCall(connection, call, { transcript: "Agent: Hello", request });
    expect(result.analysis_queued).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    const [url, options] = request.mock.calls[0];
    expect(url).toBe(ENDPOINT);
    expect(options.credentials).toBe("omit");
    expect(options.headers["x-bylda-connection"]).toBe(token);
    expect(JSON.parse(options.body)).toMatchObject({
      action: "import",
      consent: true,
      external_id: "call-42",
      transcript: "Agent: Hello",
    });
    expect(JSON.parse(options.body)).not.toHaveProperty("recording_url");
  });
  it("uploads authenticated media to private storage before importing, without forwarding cookies", async () => {
    const file = new File(["audio bytes"], "call.mp3", { type: "audio/mpeg" });
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            upload_url:
              "https://ipidfqwlszuhjgjygbvx.supabase.co/storage/v1/object/upload/sign/call-audio/path?token=upload",
            content_type: "audio/mpeg",
          }),
        ),
      )
      .mockResolvedValueOnce(new Response("{}"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ call_id: "id", transcription_status: "queued" })),
      );
    await importCall(connection, call, { file, request });
    expect(request.mock.calls.map((c) => c[1].method)).toEqual(["POST", "PUT", "POST"]);
    expect(request.mock.calls[1][1].headers).not.toHaveProperty("x-bylda-connection");
    expect(request.mock.calls[1][1].credentials).toBe("omit");
    expect(JSON.parse(request.mock.calls[2][1].body)).toMatchObject({
      extension: "mp3",
      size: file.size,
      action: "import",
    });
  });
  it("reuses uploaded audio on retry and surfaces failed analysis dispatch", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ already_uploaded: true })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "Transcript saved, but analysis could not be queued. Retry this import.",
          }),
          { status: 502 },
        ),
      );
    await expect(
      importCall(connection, call, {
        file: new File(["audio"], "call.mp3", { type: "audio/mpeg" }),
        request,
      }),
    ).rejects.toThrow(/Retry/);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("does not create a call when the storage upload fails or points outside BYLDA", async () => {
    for (const uploadUrl of [
      "https://evil.test/upload",
      "https://ipidfqwlszuhjgjygbvx.supabase.co/storage/v1/object/upload/sign/call-audio/path",
    ]) {
      const request = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ upload_url: uploadUrl, content_type: "audio/mpeg" })),
        )
        .mockResolvedValueOnce(new Response("", { status: 500 }));
      await expect(
        importCall(connection, call, {
          file: new File(["audio"], "call.mp3", { type: "audio/mpeg" }),
          request,
        }),
      ).rejects.toThrow();
      expect(
        request.mock.calls.every(
          (c) => c[1].method !== "POST" || JSON.parse(c[1].body).action === "prepare",
        ),
      ).toBe(true);
    }
  });
});
