import { describe, expect, it } from "vitest";
import type { Behavior, Methodology } from "@/lib/data";
import { findMethodologyBehavior, ruleDescription } from "./methodologyModel";
const member: Behavior = {
  key: "pause",
  name: "Pause",
  definition: "Pause",
  rule: { event: "objection" },
  methodologyId: "m1",
  enabled: true,
  higherIsBetter: true,
};
const methodology: Methodology = {
  id: "m1",
  name: "One",
  template: "custom",
  stages: [],
  behaviors: [member],
  isActive: true,
};
describe("methodology rule scope", () => {
  it("refuses global catalog rules absent from the requested methodology", () => {
    expect(
      findMethodologyBehavior(methodology, [{ ...member, key: "other" }], "other"),
    ).toBeUndefined();
  });
  it("refuses mismatched methodology ownership in either response", () => {
    expect(
      findMethodologyBehavior(methodology, [{ ...member, methodologyId: "m2" }], "pause"),
    ).toBeUndefined();
    expect(
      findMethodologyBehavior(
        { ...methodology, behaviors: [{ ...member, methodologyId: "m2" }] },
        [member],
        "pause",
      ),
    ).toBeUndefined();
  });
  it("keeps the requested methodology's enabled state rather than overriding it with the catalog", () => {
    expect(
      findMethodologyBehavior(
        { ...methodology, behaviors: [{ ...member, enabled: false }] },
        [member],
        "pause",
      )?.enabled,
    ).toBe(false);
  });
  it("does not invent thresholds or stringify unsupported nested rules", () => {
    expect(ruleDescription({ event: "objection", threshold: { seconds: 30 } })).toEqual([
      ["EVENT", "Objection"],
    ]);
    expect(ruleDescription({ threshold: { seconds: 30 } })).toEqual([
      ["RULE", "Rule details unavailable"],
    ]);
  });
});
