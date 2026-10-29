import { describe, expect, it } from "vitest";
import { callsSearchFromSource, readCallsSearch } from "../coaching/calls-search";
describe("call source URL state", () => {
  it("retains exact run/turn zero and time zero across navigation", () => {
    const search = callsSearchFromSource({
      organizationId: "org",
      repId: "rep",
      callId: "call",
      startSeconds: 0,
      source: { kind: "behavior", runId: "old-run", turnId: 0, eventId: "event" },
    });
    expect(readCallsSearch(search)).toMatchObject({
      view: "calls",
      callId: "call",
      repId: "rep",
      runId: "old-run",
      turnId: 0,
      eventId: "event",
      at: 0,
    });
  });
  it.each([
    { callId: "c", at: "" },
    { callId: "c", at: "NaN" },
    { callId: "c", at: -1 },
    { callId: "c", runId: "r", turnId: 1.2 },
    { callId: "c", turnId: 0 },
    { runId: "r" },
    { at: 0 },
  ])("refuses invalid or incomplete source URLs: %j", (input) =>
    expect(readCallsSearch(input).sourceError).toBeTruthy(),
  );
  it("accepts call and report links without inventing a snapshot", () => {
    expect(readCallsSearch({ view: "report", repId: "rep", reportId: "report" })).toEqual({
      view: "report",
      repId: "rep",
      reportId: "report",
    });
    const result = callsSearchFromSource({
      organizationId: "org",
      repId: null,
      callId: "call",
      startSeconds: null,
      source: { kind: "report", reportId: "report", exchangeIndex: -10 },
    });
    expect(result.runId).toBeUndefined();
    expect(result.turnId).toBeUndefined();
    expect(result.at).toBeUndefined();
    expect(result.reportId).toBe("report");
  });
});
