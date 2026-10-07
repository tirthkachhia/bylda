import { afterEach, describe, expect, it, vi } from "vitest";
import { closeTranscript, syncCloseCalls } from "../../../supabase/functions/_shared/close-calls";

vi.mock("../../../supabase/functions/_shared/context-ingestion.ts", () => ({
  resolveCallEntities: async () => ({ contactId: "contact-test", leadId: null }),
  upsertExternalObject: async () => undefined,
}));
afterEach(() => vi.unstubAllGlobals());

describe("Close transcripts", () => {
  it("preserves speaker and timing evidence", () => {
    const result = closeTranscript({ recording_transcript: { utterances: [{ speaker_label: "Alex", speaker_side: "close-user", start: 0, end: 2, text: "What is your process?" }] } });
    expect(result.text).toBe("Alex: What is your process?");
    expect(result.segments[0]).toMatchObject({ start: 0, end: 2, speaker_side: "close-user" });
  });
  it("does not invent a transcript from call notes or summaries", () => {
    expect(closeTranscript({ note: "Notes", recording_transcript: { summary_text: "Summary" } }).text).toBe("");
  });
  it("supports voicemail and ignores malformed utterances", () => {
    const result = closeTranscript({ voicemail_transcript: { utterances: [null, {}, { text: "Call me", start: "unknown" }] } });
    expect(result.text).toBe("Unknown: Call me");
    expect(result.segments[0]).not.toHaveProperty("start");
  });
});

describe("Close import pipeline", () => {
  it("requests transcript fields, stores evidence, and queues real analysis", async () => {
    const writes: Array<{ table: string; data: any }> = [];
    const admin = { from: (table: string) => {
      const query: any = {
        upsert(data: unknown) { writes.push({ table, data }); return query; },
        select() { return query; }, eq() { return query; },
        single: async () => ({ data: { id: "call-test" }, error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
        then(resolve: (value: unknown) => void) { resolve({ error: null }); },
      };
      return query;
    } };
    vi.stubGlobal("Deno", { env: { get: (key: string) => key === "SUPABASE_URL" ? "https://test.supabase.co" : "test-service-key" } });
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "acti_test", status: "completed", recording_transcript: { utterances: [{ text: "Send a proposal", speaker_label: "Buyer" }] } }], has_more: false }), { status: 200 })).mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await syncCloseCalls(admin as never, { organizationId: "org-test", oauth: { accessToken: "test" } as never });
    expect(String(fetchMock.mock.calls[0][0])).toContain("recording_transcript");
    expect(result).toMatchObject({ calls_imported: 1, transcripts_imported: 1, analyses_queued: 1 });
    expect(writes.find((w) => w.table === "call_transcripts")?.data.transcript_text).toBe("Buyer: Send a proposal");
    expect(fetchMock.mock.calls[1][0]).toBe("https://test.supabase.co/functions/v1/analyze-call");
  });
  it("reports an empty source instead of claiming transcripts were imported", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], has_more: false }))));
    const result = await syncCloseCalls({} as never, { organizationId: "org-test", oauth: { accessToken: "test" } as never });
    expect(result.transcripts_imported).toBe(0);
    expect(result.warning).toContain("no call activities");
  });
});
