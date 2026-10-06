import { describe, expect, it } from "vitest";
import type { Brief, Insight, Viewer } from "@/lib/data";
import { canReadDelivery, deliveryInsightAllowed, matchesDelivery } from "./deliveryModel";
const viewer = { id: "own", role: "rep", team: { id: "team" } } as Viewer;
const insight: Insight = {
  id: "i",
  kind: "coaching",
  headline: "Pause after an objection",
  body: null,
  confidence: "high",
  sampleSize: 6,
  sampleLabel: null,
  callsAnalyzed: 10,
  affectedRepIds: ["own"],
  evidence: [],
  action: null,
  causalTested: false,
  tone: "neutral",
  tag: null,
  createdAt: "",
};
describe("delivery access and evidence", () => {
  it("rejects malformed quality flags and outcome claims in every displayed text field", () => {
    for (const patch of [
      { callsAnalyzed: Infinity },
      { confidence: undefined },
      { confidence: "unknown" },
      { headline: "Outcomes improved" },
      { body: "Win rates improved" },
      { sampleLabel: "n = 40 closed outcomes" },
      { headline: "Pausing caused change", causalTested: "true" },
    ])
      expect(deliveryInsightAllowed({ ...insight, ...patch } as Insight, viewer, "email")).toBe(
        false,
      );
    expect(
      deliveryInsightAllowed({ ...insight, headline: "Rankings improved" }, viewer, "push"),
    ).toBe(false);
  });
  it("denies manager delivery to reps, viewers and coaches", () => {
    for (const role of ["rep", "viewer", "coach"] as const)
      expect(canReadDelivery({ ...viewer, role }, "email")).toBe(false);
  });
  it("requires exact own subject and daily kind for push", () => {
    const brief = { kind: "daily_rep", subjectId: "own" } as Brief;
    expect(matchesDelivery(brief, viewer, "push")).toBe(true);
    expect(matchesDelivery({ ...brief, subjectId: "peer" }, viewer, "push")).toBe(false);
    expect(matchesDelivery({ ...brief, subjectId: null }, viewer, "push")).toBe(false);
    expect(matchesDelivery({ ...brief, kind: "weekly_rep" }, viewer, "push")).toBe(false);
  });
  it("requires manager team subject", () => {
    const manager = { ...viewer, role: "manager" as const };
    expect(
      matchesDelivery({ kind: "daily_manager", subjectId: "team" } as Brief, manager, "email"),
    ).toBe(true);
    expect(
      matchesDelivery({ kind: "daily_manager", subjectId: "other" } as Brief, manager, "email"),
    ).toBe(false);
  });
  it("requires thresholds, finite positive sample and known confidence", () => {
    expect(deliveryInsightAllowed(insight, viewer, "push")).toBe(true);
    for (const sampleSize of [0, -1, Infinity, NaN])
      expect(deliveryInsightAllowed({ ...insight, sampleSize }, viewer, "push")).toBe(false);
    expect(deliveryInsightAllowed({ ...insight, callsAnalyzed: 9 }, viewer, "push")).toBe(false);
  });
  it("withholds peer, ranking and team insights in a personal brief", () => {
    for (const patch of [
      { affectedRepIds: ["peer"] },
      { affectedRepIds: ["own", "peer"] },
      { headline: "Top performers pause" },
      { kind: "pattern" as const, callsAnalyzed: 50 },
    ])
      expect(deliveryInsightAllowed({ ...insight, ...patch }, viewer, "push")).toBe(false);
  });
  it("withholds outcome claims without closed-deal counts", () => {
    expect(
      deliveryInsightAllowed(
        { ...insight, headline: "Won deals contain more discovery" },
        viewer,
        "email",
      ),
    ).toBe(false);
  });
  it("withholds untested causal claims", () => {
    expect(
      deliveryInsightAllowed({ ...insight, body: "Pausing caused improvement" }, viewer, "email"),
    ).toBe(false);
    expect(
      deliveryInsightAllowed(
        { ...insight, body: "Pausing caused improvement", causalTested: true },
        viewer,
        "email",
      ),
    ).toBe(true);
  });
});
