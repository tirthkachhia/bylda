import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/workspace-view", () => ({ useWorkspaceView: () => "manager" }));
const state = vi.hoisted(() => ({
  history: { runs: [], events: [] } as unknown,
  reviews: [] as unknown[],
  feedbackError: null as Error | null,
  feedbackPending: false,
  permission: true,
  held: vi.fn(),
  reports: [] as unknown[],
  call: null as unknown,
  source: null as unknown,
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ currentOrgId: "org", user: { id: "manager" } }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/queries", () => ({
  repReportsQuery: () => ({ queryKey: ["rep-reports"] }),
  coachingManagerPermissionQuery: () => ({ queryKey: ["permission"] }),
  generateRepReport: vi.fn(),
  markReportDelivered: state.held,
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: (q: { queryKey: unknown[] }) => {
    if (q.queryKey[0] === "rep-behavior") return { data: state.history, isPending: false };
    if (q.queryKey[0] === "behavior-feedback")
      return { data: state.reviews, isPending: state.feedbackPending, error: state.feedbackError };
    if (q.queryKey[0] === "rep-reports") return { data: state.reports, isPending: false };
    if (q.queryKey[0] === "coaching-call") return { data: state.call, isPending: false };
    if (q.queryKey[0] === "behavior-run-source") return { data: state.source, isPending: false };
    return { data: state.permission, isPending: false };
  },
}));
import { BehaviorManagerBrief } from "../../components/app/coaching/BehaviorManagerBrief";
import { RepReportPanel } from "../../components/app/coaching/RepReportPanel";
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
const host = document.createElement("div");
document.body.append(host);
let root = createRoot(host);
beforeEach(() => {
  state.permission = true;
  state.call = null;
  state.source = null;
  state.held.mockClear();
  state.feedbackError = null;
  state.feedbackPending = false;
  state.reviews = [];
  state.history = {
    runs: [
      {
        id: "run",
        call_id: "call",
        call_occurred_at: "2026-10-20",
        prompt_version: "v1",
        taxonomy_version: "v1",
        models: ["m"],
        analysis: { context: { objective: "discover", constraints: "unknown" } },
      },
    ],
    events: [
      {
        id: "event",
        run_id: "run",
        call_id: "call",
        rep_id: "rep",
        family: "discovery_recommendation",
        opportunity: "eligible",
        result: "strength",
        start_s: 0,
        evidence: { rep: [{ turn_id: 0 }], buyer: [], context: [] },
        assessment: {
          stage: "discovery",
          rep_behavior: "Asked about the rollout",
          buyer_reaction: "Named training needs",
          observed_progression: "Need clarified",
          coaching_action: "Repeat the question",
          confidence: "medium",
        },
      },
    ],
  };
  state.reports = [
    {
      id: "report",
      rep_id: "rep",
      status: "completed",
      period_start: "2026-10-01",
      period_end: "2026-10-07",
      call_count: 2,
      report: {
        headline: "Clarify needs before recommending",
        patterns: [
          {
            title: "Rollout questions",
            what_happened: "Asked about training",
            say_instead: "",
            guideline: null,
            cited: [
              {
                call_id: "call",
                exchange_index: -12,
                at: "00:00",
                rep_text: "What is blocking rollout?",
                customer_text: "Training",
              },
            ],
          },
        ],
        strength: null,
        drill: {
          focus: "Ask one clarifying question",
          line_to_practice: "What is blocking rollout?",
        },
        strip: [],
        since_last: null,
      },
    },
  ];
});
afterEach(() => {
  act(() => root.unmount());
  root = createRoot(host);
});
const button = (text: string) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(text))!;
describe("manager source and uncertainty behavior", () => {
  it("preserves run/event/turn provenance including time zero", async () => {
    const onOpenSource = vi.fn();
    act(() =>
      root.render(
        <BehaviorManagerBrief repId="rep" onOpenCall={vi.fn()} onOpenSource={onOpenSource} />,
      ),
    );
    await act(async () => button("Review at 0:00").click());
    expect(onOpenSource).toHaveBeenCalledWith(
      expect.objectContaining({
        callId: "call",
        startSeconds: 0,
        source: { kind: "behavior", runId: "run", eventId: "event", turnId: 0 },
      }),
    );
  });
  it("uses a validated source route without a snapshot handler and withholds unsupported comparisons", () => {
    act(() => root.render(<BehaviorManagerBrief repId="rep" onOpenCall={vi.fn()} />));
    const source = [...host.querySelectorAll("a")].find((a) =>
      a.textContent?.includes("Review at"),
    )!;
    expect(source.getAttribute("href")).toContain("runId=run");
    expect(source.getAttribute("href")).toContain("eventId=event");
    expect(source.getAttribute("href")).toContain("turnId=0&at=0");
    act(() => button("Trends").click());
    expect(host.textContent).toContain("Not enough comparable evidence");
    expect(host.textContent).not.toContain("Improving");
  });
  it("shows zero opportunities when there are runs without events and no feedback query", () => {
    (state.history as { events: unknown[] }).events = [];
    state.feedbackPending = true;
    act(() => root.render(<BehaviorManagerBrief repId="rep" onOpenCall={vi.fn()} />));
    expect(host.textContent).toContain("No eligible source-backed examples");
    expect(host.textContent).not.toContain("Loading reviewer evidence");
    expect(host.textContent).not.toContain("Comparison unavailable");
  });
  it("withholds an action when the observation has low confidence", () => {
    const event = (state.history as { events: { assessment: { confidence: string } }[] }).events[0];
    event.assessment.confidence = "low";
    act(() => root.render(<BehaviorManagerBrief repId="rep" onOpenCall={vi.fn()} />));
    expect(host.textContent).toContain("Asked about the rollout");
    expect(host.textContent).not.toContain("Repeat the question");
  });
  it("does not recommend findings when reviewer data is unavailable", () => {
    state.feedbackError = new Error("offline");
    act(() =>
      root.render(<BehaviorManagerBrief repId="rep" onOpenCall={vi.fn()} onOpenSource={vi.fn()} />),
    );
    expect(host.textContent).toContain("Recommendations and comparisons are withheld");
    expect(host.textContent).not.toContain("Repeat the question");
  });
  it("opens legacy report citations without inventing run or turn IDs", async () => {
    const onOpenSource = vi.fn();
    act(() =>
      root.render(
        <RepReportPanel
          repId="rep"
          repName="Jordan"
          onOpenCall={vi.fn()}
          onOpenSource={onOpenSource}
        />,
      ),
    );
    await act(async () => button("Open call at 00:00").click());
    expect(onOpenSource).toHaveBeenCalledWith({
      organizationId: "org",
      repId: "rep",
      callId: "call",
      startSeconds: 0,
      source: { kind: "report", reportId: "report" },
    });
  });
  it("opens retained call evidence inline and selects transcript turns without audio", () => {
    const turns = [
      { speaker: "customer", text: "This is over budget", start_s: 5, end_s: 7 },
      { speaker: "rep", text: "Where did the budget come from?", start_s: 10, end_s: 12 },
    ];
    state.call = {
      id: "call",
      rep_id: "rep",
      contactName: "Evidence call",
      duration: 60,
      audio_path: null,
      recording_url: null,
      segments: [],
      insight: { vertical_insights: { behavior_analysis: { run_id: "run" } } },
    };
    state.source = {
      id: "run",
      call_id: "call",
      rep_id: "rep",
      organization_id: "org",
      transcript_hash: "retained",
      source_snapshot: { structured_turns: turns, transcript_text: "" },
      analysis: {
        events: [
          {
            occurrence_key: "objection",
            family: "objection_resolution",
            result: "strength",
            stage: "decision",
            rep_behavior: "Asked a clarifying question",
            rep_evidence: [{ turn_id: 1 }],
            buyer_evidence: [{ turn_id: 0 }],
          },
        ],
      },
    };
    const onOpenSource = vi.fn();
    act(() =>
      root.render(
        <RepReportPanel
          repId="rep"
          repName="Jordan"
          onOpenCall={vi.fn()}
          onOpenSource={onOpenSource}
        />,
      ),
    );
    const details = host.querySelector("details")!;
    expect(host.querySelector('[aria-label="Call timeline"]')).toBeNull();
    act(() => {
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
    });
    expect(host.querySelector('[aria-label="Call timeline"]')).not.toBeNull();
    expect(host.textContent).toContain("Recording unavailable.");
    expect(host.querySelector("audio")).toBeNull();
    const marker = host.querySelector<HTMLButtonElement>('[aria-label="Behavior moments"] button')!;
    act(() => marker.click());
    expect(
      host.querySelector('[aria-label="Transcript turns"] [aria-current="true"]')?.textContent,
    ).toContain("This is over budget");
    expect(onOpenSource).not.toHaveBeenCalled();
    act(() => {
      details.open = false;
      details.dispatchEvent(new Event("toggle"));
    });
    expect(host.querySelector('[aria-label="Call timeline"]')).toBeNull();
  });
  it("records a manager-held conversation through the existing backend action", async () => {
    act(() => root.render(<RepReportPanel repId="rep" repName="Jordan" onOpenCall={vi.fn()} />));
    await act(async () => button("Mark conversation held").click());
    expect(state.held).toHaveBeenCalledWith("report", true);
    expect(host.textContent).toContain("Manager recorded");
  });
  it("does not offer the manager-held action without permission", () => {
    state.permission = false;
    act(() => root.render(<RepReportPanel repId="rep" repName="Jordan" onOpenCall={vi.fn()} />));
    expect(host.textContent).not.toContain("Mark conversation held");
  });
  it("does not substitute the latest report when the requested report is missing", () => {
    act(() =>
      root.render(
        <RepReportPanel
          repId="rep"
          repName="Jordan"
          initialReportId="deleted-report"
          onOpenCall={vi.fn()}
        />,
      ),
    );
    expect(host.textContent).toContain("requested report is unavailable");
    expect(host.textContent).not.toContain("Clarify needs before recommending");
  });
});
