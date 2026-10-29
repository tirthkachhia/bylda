import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: (q: { queryKey: unknown[] }) => {
    if (q.queryKey[0] === "behavior-events")
      return {
        isPending: false,
        data: [{ id: "event", assessment: { occurrence_key: "moment" } }],
      };
    if (q.queryKey[0] === "behavior-feedback") return { isPending: false, data: [] };
    return { isPending: false, data: undefined };
  },
}));
import { CallDetail } from "../../components/app/coaching/CallDetail";
import type { CoachingCall } from "../coaching/calls";
import type { BehaviorAnalysis, Evidence } from "../coaching/types";
import { normalizeBehavior } from "../../../supabase/functions/_shared/coaching/behavior-intelligence";
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
Element.prototype.scrollIntoView = vi.fn();
const host = document.createElement("div");
document.body.append(host);
let root = createRoot(host);
afterEach(() => {
  act(() => root.unmount());
  root = createRoot(host);
});
const turns: Evidence[] = [
  { turn_id: 0, speaker: "rep", text: "What matters most?", start_s: 0, end_s: 1 },
  { turn_id: 1, speaker: "customer", text: "A safe rollout.", start_s: null, end_s: null },
];
const base = normalizeBehavior({}, turns);
const analysis: BehaviorAnalysis = {
  ...base,
  events: [
    {
      occurrence_key: "moment",
      family: "discovery_recommendation",
      stage: "discovery",
      opportunity: "eligible",
      result: "strength",
      context: "Buyer evaluating rollout",
      rep_behavior: "Asked about priorities",
      buyer_reaction: "Named safe rollout",
      observed_progression: "Need clarified",
      interpretation: "Recommendation can address rollout",
      alternative_explanation: "Existing evaluation may have shaped answer",
      coaching_action: "Ask this question again",
      resolution: "unknown",
      confidence: "medium",
      playbook_relationship: "unknown",
      limitations: ["No external outcome verified"],
      context_evidence: [],
      rep_evidence: [turns[0]],
      buyer_evidence: [turns[1]],
    },
  ],
};
const call: CoachingCall = {
  id: "call",
  rep_id: "rep",
  contact_id: null,
  lead_id: null,
  provider: null,
  direction: "outbound",
  status: "completed",
  duration: 30,
  disposition: null,
  started_at: null,
  created_at: "2026-10-20",
  coaching_stage: "analyzed",
  coaching_error: null,
  audio_path: null,
  contactName: "Prospect",
  company: "Company",
  dealName: null,
  transcript: "CHANGED CURRENT TRANSCRIPT",
  segments: [],
  insight: { id: "insight", summary: "Summary", sales_profile: null, vertical_insights: {} },
};
describe("snapshot call review", () => {
  it("uses the retained transcript and requested reasoning order", () => {
    act(() =>
      root.render(
        <CallDetail
          call={call}
          tab="summary"
          onTab={vi.fn()}
          sourceState="ready"
          sourceTurns={turns}
          sourceAnalysis={analysis}
          sourceRunId="run"
        />,
      ),
    );
    expect(host.textContent).not.toContain("CHANGED CURRENT TRANSCRIPT");
    expect(host.textContent).toContain("What matters most?");
    const labels = [...host.querySelectorAll("dt")].map((e) => e.textContent);
    expect(labels.slice(-5)).toEqual([
      "Context",
      "Rep behavior",
      "Buyer reaction",
      "Observed progression",
      "Sales interpretation",
    ]);
    expect(host.textContent).toContain("Ask this question again");
  });
  it("withholds action recommendations for low-confidence moments", () => {
    act(() =>
      root.render(
        <CallDetail
          call={call}
          tab="summary"
          onTab={vi.fn()}
          sourceState="ready"
          sourceTurns={turns}
          sourceAnalysis={{
            ...analysis,
            events: analysis.events.map((e) => ({ ...e, confidence: "low" })),
          }}
          sourceRunId="run"
        />,
      ),
    );
    expect(host.textContent).not.toContain("Ask this question again");
    expect(host.textContent).toContain("Observe and review before acting");
  });
  it("does not substitute the current transcript when the retained source is missing", () => {
    act(() =>
      root.render(
        <CallDetail call={call} tab="transcript" onTab={vi.fn()} sourceState="unavailable" />,
      ),
    );
    expect(host.textContent).not.toContain("CHANGED CURRENT TRANSCRIPT");
    expect(host.textContent).toContain("Another transcript has not been substituted");
  });
  it("can highlight source evidence with no known timestamp", () => {
    const onTab = vi.fn();
    act(() =>
      root.render(
        <CallDetail
          call={call}
          tab="summary"
          onTab={onTab}
          sourceState="ready"
          sourceTurns={turns}
          sourceAnalysis={analysis}
          sourceRunId="run"
        />,
      ),
    );
    const unknown = [...host.querySelectorAll("button")].find(
      (b) => b.textContent === "Time unknown",
    );
    expect(unknown?.disabled).toBe(false);
    act(() => unknown?.click());
    expect(host.querySelector('[data-source-turn="1"]')?.className).toContain("bg-amber-100");
  });
  it("opens the matching reasoning chain when a retained timeline event is selected", () => {
    const second = {
      ...analysis.events[0],
      occurrence_key: "second",
      family: "objection_resolution" as const,
      rep_behavior: "Clarified the training objection",
    };
    act(() =>
      root.render(
        <CallDetail
          call={call}
          tab="summary"
          onTab={vi.fn()}
          sourceState="ready"
          sourceTurns={turns}
          sourceAnalysis={{ ...analysis, events: [...analysis.events, second] }}
          sourceRunId="run"
        />,
      ),
    );
    expect(host.textContent).not.toContain("Clarified the training objection");
    const event = [...host.querySelectorAll("button")].find((b) =>
      b.title.includes("objection resolution"),
    )!;
    act(() => event.click());
    expect(host.textContent).toContain("Clarified the training objection");
    expect(host.querySelector('[data-source-turn="0"]')?.className).toContain("bg-amber-100");
  });
});
