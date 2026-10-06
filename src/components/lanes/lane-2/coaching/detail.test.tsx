import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { LocalCoachingDetail } from "./LocalCoachingDetail";
import type { Call, CoachingFocus } from "@/lib/data";
const state = vi.hoisted(() => ({
  role: "manager",
  viewerLoading: false,
  loading: false,
  error: null as Error | null,
  focus: null as CoachingFocus | null,
  calls: [] as Call[],
  reads: 0,
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ focusId: "focus" }),
  Link: ({ children, params }: { children: ReactNode; params?: { focusId: string } }) => (
    <a href={params ? `/app/coaching/${params.focusId}` : undefined}>{children}</a>
  ),
}));
vi.mock("@/components/bylda", async () => ({
  ...(await vi.importActual("@/components/bylda")),
  ContextPanel: ({ children }: { children: ReactNode }) => <aside>{children}</aside>,
}));
vi.mock("@/lib/data", () => ({
  ForbiddenForRoleError: class extends Error {},
  REP_INSIGHT_MIN_CALLS: 10,
  useViewer: () => ({
    data: { id: "me", role: state.role },
    isLoading: state.viewerLoading,
    error: null,
  }),
  useCoachingFocus: () => {
    state.reads++;
    return { data: state.focus, isLoading: state.loading, error: state.error, refetch: vi.fn() };
  },
  useCalls: () => ({ data: state.calls, isLoading: false, error: null }),
  useCoachingComments: () => ({
    data: [
      {
        id: "comment",
        focusId: "focus",
        authorId: "manager",
        authorName: "Manager",
        body: "Try it.",
        createdAt: "2026-09-29",
      },
      { id: "peer", focusId: "focus", authorId: "peer", authorName: "Peer secret", body: "Secret" },
    ],
    isLoading: false,
    error: null,
  }),
}));
beforeEach(() => {
  Object.assign(state, {
    role: "manager",
    viewerLoading: false,
    loading: false,
    error: null,
    reads: 0,
    calls: [],
    focus: {
      id: "focus",
      repId: "me",
      repName: "My name",
      behaviorKey: "pause",
      behaviorName: "Pause",
      note: "Own note",
      evidence: [
        {
          callId: "peer-call",
          quote: "Peer quote",
          timestamp: "01:00",
          tSeconds: 60,
          speaker: "rep",
          speakerLabel: "Peer",
        },
      ],
      metric: "Seconds",
      baseline: 0.4,
      target: 1.5,
      judgeAfter: { calls: 5, date: null },
      status: "measuring",
      result: null,
      assignedAt: "2026-09-29",
      assignedById: "manager",
      acknowledgedAt: null,
    },
  });
});
it("doesn't mount focus reads before viewer is loaded", () => {
  state.viewerLoading = true;
  renderToStaticMarkup(<LocalCoachingDetail view="overview" />);
  expect(state.reads).toBe(0);
});
it("denies peer focus responses without leaking fields or links", () => {
  state.role = "rep";
  state.focus!.repId = "peer";
  const s = renderToStaticMarkup(<LocalCoachingDetail view="active" />);
  expect(s).toContain("You don’t have access");
  expect(s).not.toContain("Own note");
  expect(s).not.toContain("My name");
  expect(s).not.toContain("peer-call");
});
it("withholds confidence-free measurements and series", () => {
  const s = renderToStaticMarkup(<LocalCoachingDetail view="progress" />);
  expect(s).toContain("Measurement series unavailable");
  expect(s).not.toContain("0.4");
  expect(s).not.toContain("<polyline");
  expect(s).not.toContain("86%");
});
it("filters unavailable and peer evidence before showing quotes/IDs/links", () => {
  state.role = "rep";
  const s = renderToStaticMarkup(<LocalCoachingDetail view="evidence" />);
  expect(s).not.toContain("Peer quote");
  expect(s).not.toContain("peer-call");
});
it("keeps manager comments but hides peer comments for reps", () => {
  state.role = "rep";
  const s = renderToStaticMarkup(<LocalCoachingDetail view="discussion" />);
  expect(s).toContain("Try it.");
  expect(s).not.toContain("Peer secret");
  expect(s).toContain("Unsaved draft");
  expect(s).toContain("disabled");
});
it("supports empty, loading, failed retry and stale focus states", () => {
  state.focus = null;
  expect(renderToStaticMarkup(<LocalCoachingDetail view="overview" />)).toContain(
    "Focus unavailable",
  );
  state.error = new Error("Failure");
  expect(renderToStaticMarkup(<LocalCoachingDetail view="overview" />)).toContain("Retry");
  state.error = null;
  state.loading = true;
  expect(renderToStaticMarkup(<LocalCoachingDetail view="overview" />)).not.toContain("Own note");
});
