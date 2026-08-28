import { describe, expect, it } from "vitest";

import { buildReadyModeConnectionRequest, readyModeProgress } from "../readymode";

describe("ReadyMode setup helpers", () => {
  it("creates a copyable admin request with the workspace webhook", () => {
    const message = buildReadyModeConnectionRequest("https://example.supabase.co/calls?key=secret");

    expect(message).toContain("connect our ReadyMode account to Bylda");
    expect(message).toContain("https://example.supabase.co/calls?key=secret");
    expect(message).toContain("recording URL or transcript");
  });

  it("reports progress through receipt, transcription, and analysis", () => {
    expect(readyModeProgress(null)).toBe(0);
    expect(
      readyModeProgress({
        callReceived: true,
        transcriptStored: false,
        analysisReady: false,
        lastCallAt: null,
        transcriptionStatus: "not_configured",
      }),
    ).toBe(1);
    expect(
      readyModeProgress({
        callReceived: true,
        transcriptStored: true,
        analysisReady: true,
        lastCallAt: "2026-08-28T12:00:00Z",
        transcriptionStatus: "completed",
      }),
    ).toBe(3);
  });
});
