import { describe, expect, it } from "vitest";
import { callDuration, normalizedStatus, segmentsFrom, textFrom } from "../../../supabase/functions/_shared/gohighlevel-calls";

describe("GoHighLevel call metadata", () => {
  it("reads the nested metadata returned by message exports", () => {
    const message = { id: "test", status: "completed", meta: { call: { duration: 27, status: "no-answer" } } };
    expect(callDuration(message)).toBe(27);
    expect(normalizedStatus(message)).toBe("missed");
  });
  it("continues to support legacy flat metadata", () => {
    expect(callDuration({ id: "test", meta: { callDuration: "24" } })).toBe(24);
    expect(normalizedStatus({ id: "test", meta: { callStatus: "busy" } })).toBe("failed");
  });
  it("does not fabricate a duration when none was provided", () => {
    expect(callDuration({ id: "test" })).toBeNull();
    expect(callDuration({ id: "test", meta: { callDuration: "invalid" } })).toBeNull();
  });
  it("extracts nested transcript payloads without treating wrappers as sentences", () => {
    const payload = { data: { transcriptions: [{ sentenceIndex: 2, transcript: "Second." }, { sentenceIndex: 1, transcript: "First." }] } };
    expect(textFrom(segmentsFrom(payload))).toBe("First. Second.");
  });
  it("ignores malformed or empty transcript responses", () => {
    expect(textFrom(segmentsFrom({ data: { error: "not available" } }))).toBe("");
    expect(segmentsFrom([null, "invalid", { transcript: "Hello" }])).toEqual([{ transcript: "Hello" }]);
  });
});
