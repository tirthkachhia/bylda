import { describe, expect, it } from "vitest";
import { reportBehaviorAllowed } from "../../../supabase/functions/_shared/coaching/report-feedback";
const event = { confidence: "high", opportunity: "eligible", result: "concern" };
const review = {
  reviewed_by: "manager",
  accuracy: "incorrect",
  usefulness: "useful",
  created_at: "2026-11-01",
  id: "a",
};
describe("report recommendation eligibility", () => {
  it("withholds rejected, disputed and unhelpful observations", () => {
    expect(reportBehaviorAllowed(event, [review], "medium")).toBe(false);
    expect(reportBehaviorAllowed(event, [{ ...review, accuracy: "uncertain" }], "medium")).toBe(
      false,
    );
    expect(
      reportBehaviorAllowed(
        event,
        [{ ...review, accuracy: "accurate", usefulness: "unhelpful" }],
        "medium",
      ),
    ).toBe(false);
  });
  it("respects the latest correction per reviewer without ignoring other reviewers", () => {
    const correction = { ...review, accuracy: "accurate", created_at: "2026-11-02" };
    expect(reportBehaviorAllowed(event, [review, correction], "medium")).toBe(true);
    expect(
      reportBehaviorAllowed(event, [correction, { ...review, reviewed_by: "other" }], "medium"),
    ).toBe(false);
  });
  it("honors confidence and eligible-opportunity boundaries", () => {
    expect(reportBehaviorAllowed(event, [], "high")).toBe(true);
    expect(reportBehaviorAllowed({ ...event, confidence: "medium" }, [], "high")).toBe(false);
    expect(reportBehaviorAllowed({ ...event, confidence: "medium" }, [], "medium")).toBe(true);
    expect(reportBehaviorAllowed({ ...event, opportunity: "unknown" }, [], "medium")).toBe(false);
  });
});
