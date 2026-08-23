import { describe, expect, it } from "vitest";

import { buildCallMemoryArtifact } from "../../../supabase/functions/_shared/call-memory";

describe("buildCallMemoryArtifact", () => {
  it("builds a transcript-backed ReadyMode memory artifact", () => {
    const artifact = buildCallMemoryArtifact({
      callId: "call-123",
      provider: "readymode",
      startedAt: "2026-08-22T16:40:00Z",
      disposition: "Interested",
      subject: "Maya at Northstar",
      salesProfile: "insurance",
      profileLabel: "Insurance",
      summary: "Maya wants a follow-up after reviewing coverage options.",
      objections: ["Needs spouse approval"],
      competitors: [],
      nextSteps: ["Call Tuesday at 2 PM"],
      dealInsights: { intent: "warm" },
      fields: [{ key: "follow_up_date", value: "Tuesday at 2 PM" }],
      complianceFlags: [],
      transcript: "Rep: Which coverage option fits?\nMaya: I need to ask my spouse.",
    });

    expect(artifact.title).toBe("ReadyMode call — Maya at Northstar — 2026-08-22");
    expect(artifact.sourceLabel).toBe("ReadyMode calls");
    expect(artifact.metadata).toMatchObject({ call_id: "call-123", transcript_backed: true });
    expect(artifact.content).toContain("## Transcript");
    expect(artifact.content).toContain("I need to ask my spouse");
    expect(artifact.contentPreview).toContain("Needs spouse approval");
  });
});
