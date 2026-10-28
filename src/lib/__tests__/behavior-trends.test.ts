import { describe, expect, it } from "vitest";
import {
  behaviorTrend,
  type BehaviorSample,
} from "../../../supabase/functions/_shared/coaching/behavior-trends";
const now = Date.parse("2026-10-27T12:00:00Z");
const sample = (
  index: number,
  previous: boolean,
  result: BehaviorSample["result"],
  extra: Partial<BehaviorSample> = {},
): BehaviorSample => ({
  id: `${previous}-${index}`,
  call_id: `${previous}-${index}`,
  occurred_at: new Date(now - (previous ? 40 : 10) * 86400_000).toISOString(),
  scope: "same-model/prompt/objective/stage/constraints",
  eligible: true,
  reviewed: true,
  result,
  ...extra,
});
describe("comparable reviewed behavior trends", () => {
  it("compares counts across non-overlapping periods, without turning unknowns into failures", () => {
    const rows = Array.from({ length: 5 }, (_, i) => [
      sample(i, false, "strength"),
      sample(i, true, "concern"),
    ]).flat();
    const trend = behaviorTrend(
      [...rows, sample(8, false, "unobservable"), sample(9, false, "concern", { eligible: false })],
      now,
    );
    expect(trend).toMatchObject({
      state: "improving",
      current: { successful: 5, judged: 5, calls: 5 },
      previous: { successful: 0, judged: 5, calls: 5 },
    });
  });
  it("withholds comparisons across versions or without reviewed and known opportunities", () => {
    const rows = Array.from({ length: 7 }, (_, i) => [
      sample(i, false, "strength", { scope: "v2" }),
      sample(i, true, "concern", { scope: "v1" }),
    ]).flat();
    expect(behaviorTrend(rows, now).state).toBe("insufficient_evidence");
    expect(
      behaviorTrend(
        rows.map((s) => ({ ...s, scope: null })),
        now,
      ).state,
    ).toBe("insufficient_evidence");
    expect(
      behaviorTrend(
        rows.map((s) => ({ ...s, scope: "same", reviewed: false })),
        now,
      ).state,
    ).toBe("insufficient_evidence");
  });
  it("does not treat many moments from one call as replicated evidence", () => {
    const rows = Array.from({ length: 10 }, (_, i) => [
      sample(i, false, "strength", { call_id: "one" }),
      sample(i, true, "concern", { call_id: "two" }),
    ]).flat();
    expect(behaviorTrend(rows, now).state).toBe("insufficient_evidence");
  });
});
