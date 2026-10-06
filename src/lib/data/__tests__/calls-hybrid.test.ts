import { describe, expect, it } from "vitest";
import { mapAnalysis, mapCallBundle, mapSegments, toCallStatus } from "../calls/map";
import type { CallRowBundle } from "../calls/fetchers";
import type { CallInsightRow, CallRow, CallTranscriptRow } from "../db-types";

/**
 * calls is HYBRID: real rows from calls / call_transcripts / call_insights /
 * call_analysis_jobs; the V1 fields that don't exist yet come back as contract
 * defaults (null / 0) — never invented numbers (CLAUDE.md §4).
 */
const baseCall: CallRow = {
  id: "c1",
  organization_id: "o1",
  contact_id: "ct1",
  lead_id: "l1",
  user_id: "u1",
  direction: "outbound",
  status: "completed",
  duration: 1800,
  recording_url: "https://rec/1",
  disposition: null,
  outcome_tag: "Closed won",
  from_number: null,
  to_number: null,
  provider: "gohighlevel",
  provider_call_id: "p1",
  started_at: "2026-09-28T14:00:00Z",
  metadata: {},
  created_at: "2026-09-28T14:40:00Z",
};
const bundle = (over: Partial<CallRowBundle> = {}): CallRowBundle => ({
  call: baseCall,
  contact: { id: "ct1", first_name: "David", last_name: "Park", company: "Acme Logistics" },
  lead: { id: "l1", name: "Acme renewal" },
  rep: { id: "u1", full_name: "Jordan Reyes" },
  job: null,
  insight: null,
  ...over,
});

describe("calls hybrid mapping", () => {
  it("maps the AVAILABLE fields from real rows", () => {
    const c = mapCallBundle(bundle({ job: { status: "completed" } as never }));
    expect(c).toMatchObject({
      id: "c1",
      repId: "u1",
      repName: "Jordan Reyes",
      account: { name: "Acme Logistics" },
      contactName: "David Park",
      durationSec: 1800,
      direction: "outbound",
      outcome: "won",
      recordingUrl: "https://rec/1",
      status: "ready",
    });
  });

  it("MISSING fields are contract defaults, never invented", () => {
    const c = mapCallBundle(bundle());
    expect(c.coachingValue).toBeNull();
    expect(c.stageAtCall).toBeNull();
    expect(c.opportunityId).toBeNull();
    expect(c.type).toBe("other");
    expect(c.keyMoments).toBe(0);
    expect(c.topMoment).toBeNull();
  });

  it("derives the V1 status from job + transcript + telephony status", () => {
    expect(toCallStatus(bundle({ job: { status: "failed" } as never }), true)).toBe("failed");
    expect(toCallStatus(bundle({ call: { ...baseCall, status: "voicemail" } }), true)).toBe(
      "partial",
    );
    expect(toCallStatus(bundle({ call: { ...baseCall, duration: 40 } }), true)).toBe("partial");
    expect(toCallStatus(bundle({ job: { status: "running" } as never }), true)).toBe("processing");
    expect(toCallStatus(bundle({ insight: {} as CallInsightRow }), true)).toBe("ready");
  });

  it("parses provider-specific speaker_segments tolerantly", () => {
    const t = {
      call_id: "c1",
      speaker_segments: [
        { speaker: "Agent", start: 10, end: 14, text: "Hi" },
        { speaker_label: "Customer", start_time: 15, end_time: 20, transcript: "Hello" },
        "garbage",
        null,
      ],
    } as unknown as CallTranscriptRow;
    const segs = mapSegments(t, "Jordan Reyes");
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({
      speaker: "rep",
      speakerName: "Jordan Reyes",
      tStart: 10,
      tEnd: 14,
      text: "Hi",
    });
    expect(segs[1]).toMatchObject({ speaker: "prospect", tStart: 15, text: "Hello" });
  });

  it("maps call_insights; methodology adherence is a GAP (empty)", () => {
    const a = mapAnalysis(
      {
        objections: ["Price", { label: "Timing", t_seconds: 75 }],
        competitor_mentions: [{ name: "Gong" }],
        next_steps_extracted: ["Send plan"],
        talk_ratio: 0.6,
        summary: "S",
        analysis_version: 3,
      } as unknown as CallInsightRow,
      "completed",
    );
    expect(a.objections.map((o) => o.label)).toEqual(["Price", "Timing"]);
    expect(a.objections[1].timestamp).toBe("1:15");
    expect(a.competitors).toEqual(["Gong"]);
    expect(a.methodologyAdherence).toEqual([]);
    expect(a.analysisStatus).toBe("completed");
  });
});
