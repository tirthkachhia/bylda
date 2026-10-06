import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CallReview } from "@/lib/data";
import { canCoach, clampTime, presentation, timeLabel } from "./reviewModel";

const state = vi.hoisted(() => ({ forced: true }));
vi.mock("@/lib/data", () => ({ mocksForced: () => state.forced }));
export function exampleReview(): CallReview {
  return {
    call: {
      id: "call_acme",
      repId: "rep_jordan",
      repName: "Jordan Reyes",
      account: { id: null, name: "Acme Logistics" },
      contactName: "David Park",
      opportunityId: null,
      startedAt: "2026-09-28T18:00:00Z",
      durationSec: 2292,
      type: "negotiation",
      direction: null,
      stageAtCall: "Negotiation",
      outcome: "no_decision",
      coachingValue: null,
      status: "ready",
      keyMoments: 0,
      topMoment: null,
      recordingUrl: null,
    },
    transcript: [],
    events: [],
    moments: [],
    coaching: [],
    analysis: {
      summary: "Actual summary",
      objections: [],
      competitors: [],
      nextSteps: [],
      talkRatio: null,
      sentiment: null,
      methodologyAdherence: [],
      analysisStatus: "completed",
      analysisVersion: null,
    },
  };
}
describe("Call review presentation", () => {
  beforeEach(() => {
    state.forced = true;
  });
  it("supplements only the exported demo call", () => {
    const model = presentation(exampleReview());
    expect(model.demo).toBe(true);
    expect(model.behaviors).toHaveLength(6);
    expect(model.transcript).toEqual([]);
    expect(model.behaviors.every((b) => b.sampleSize > 0 && b.confidence)).toBe(true);
  });
  it("keeps shared fields unchanged even in forced demo mode", () => {
    const review = exampleReview();
    review.call.stageAtCall = "Pricing";
    review.analysis.nextSteps = ["Send rollout plan to David Park by Thu"];
    review.analysis.talkRatio = 0.42;
    const model = presentation(review);
    expect(model.summary).toBe(review.analysis.summary);
    expect(model.transcript).toBe(review.transcript);
    expect(model.moments).toEqual(review.moments);
    expect(model.contacts).toEqual(["David Park"]);
    expect(model.title).toBe("Acme Logistics — negotiation");
    expect(model.opportunity).toBeNull();
    expect(model.behaviors.find((b) => b.name === "Talk / listen")?.value).toBe("42 / 58");
    expect(review.call.stageAtCall).toBe("Pricing");
    expect(review.analysis.nextSteps).toEqual(["Send rollout plan to David Park by Thu"]);
  });
  it("never inserts Figma values into real data", () => {
    state.forced = false;
    const review = exampleReview();
    const model = presentation(review);
    expect(model.demo).toBe(false);
    expect(model.summary).toBe("Actual summary");
    expect(model.behaviors).toEqual([]);
    expect(model.notes).toEqual([]);
    expect(model.transcript).toBe(review.transcript);
    expect(model.opportunity).toBeNull();
  });
  it("never supplements a different call even at the same account", () => {
    const review = exampleReview();
    review.call.id = "another-acme-call";
    expect(presentation(review).demo).toBe(false);
  });
  it("does not replace evidence for processing or failed calls", () => {
    const review = exampleReview();
    review.call.status = "failed";
    expect(presentation(review).demo).toBe(false);
  });
  it("removes peer comparisons from rep-facing presentation", () => {
    const model = presentation(exampleReview(), true);
    expect(JSON.stringify(model)).not.toMatch(/Top 3 on team|Best discovery on the team/);
  });
  it("restricts coaching actions to management roles", () => {
    expect(canCoach("rep")).toBe(false);
    expect(canCoach("viewer")).toBe(false);
    for (const role of ["manager", "coach", "owner", "admin"]) expect(canCoach(role)).toBe(true);
  });
  it("formats and clamps playback positions", () => {
    expect(timeLabel(1122)).toBe("18:42");
    expect(clampTime(-10, 100)).toBe(0);
    expect(clampTime(110, 100)).toBe(100);
    expect(clampTime(NaN, 100)).toBe(0);
  });
});
