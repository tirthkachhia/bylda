import { describe, expect, it } from "vitest";

import { normalizeCall } from "../../../supabase/functions/_shared/call-normalize";

describe("normalizeCall", () => {
  it("normalizes a ReadyMode recording event", () => {
    const call = normalizeCall({
      provider: "ReadyMode",
      call_log_id: "rm-call-192",
      call_result: "Interested - Follow Up",
      duration_sec: "186",
      phone_from: "+15551230000",
      lead_phone: "+15559870000",
      recording_link: "https://recordings.readymode.com/calls/rm-call-192.mp3",
      call_date: "2026-08-22T16:40:00Z",
      direction: "outbound",
    });

    expect(call).toMatchObject({
      provider: "readymode",
      providerCallId: "rm-call-192",
      disposition: "Interested - Follow Up",
      duration: 186,
      connected: true,
      fromNumber: "+15551230000",
      toNumber: "+15559870000",
      recordingUrl: "https://recordings.readymode.com/calls/rm-call-192.mp3",
      startedAt: "2026-08-22T16:40:00Z",
      direction: "outbound",
    });
  });

  it("reads nested transcripts and detects missed calls", () => {
    const call = normalizeCall({
      provider: "generic-dialer",
      payload: {
        callId: "nested-12",
        status: "no_answer",
        type: "inbound",
        transcription: { text: "This should still normalize." },
        utterances: [{ speaker: "agent", text: "Hello" }],
      },
    });

    expect(call).toMatchObject({
      provider: "generic-dialer",
      providerCallId: "nested-12",
      connected: false,
      direction: "inbound",
      transcript: "This should still normalize.",
      speakerSegments: [{ speaker: "agent", text: "Hello" }],
    });
  });

  it("lets the nested call body override envelope values", () => {
    const call = normalizeCall({
      provider: "webhook-envelope",
      duration: 10,
      call: {
        provider: "Ready Mode",
        call_id: "nested-call",
        duration: 75,
      },
    });

    expect(call.provider).toBe("ready-mode");
    expect(call.providerCallId).toBe("nested-call");
    expect(call.duration).toBe(75);
  });
});
