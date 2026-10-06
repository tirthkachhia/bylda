import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { LocalCoachingIndex, LocalMyCoachingScreen } from "./LocalCoachingIndex";
import type { CoachingFocus } from "@/lib/data";
const state = vi.hoisted(() => ({
  role: "rep",
  rows: [] as CoachingFocus[],
  error: null as Error | null,
  loading: false,
  viewerLoading: false,
  reads: 0,
  pending: false,
  ack: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
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
  useViewer: () => ({
    data: { id: "me", role: state.role },
    isLoading: state.viewerLoading,
    error: null,
  }),
  useCoachingFoci: () => {
    state.reads++;
    return { data: state.rows, isLoading: state.loading, error: state.error, refetch: vi.fn() };
  },
  useMyCoaching: () => ({
    data: state.rows,
    isLoading: state.loading,
    error: state.error,
    refetch: vi.fn(),
  }),
  useCalls: () => ({ data: [], isLoading: false, error: null }),
  useAcknowledgeCoaching: () => ({ mutateAsync: state.ack, isPending: state.pending }),
}));
function focus(id = "own", repId = "me"): CoachingFocus {
  return {
    id,
    repId,
    repName: repId === "me" ? "Me" : "Peer secret",
    behaviorKey: "pause",
    behaviorName: repId === "me" ? "Own focus" : "Peer behavior",
    note: repId === "me" ? "Own note" : "Peer note",
    evidence: [],
    metric: "seconds",
    baseline: 0.4,
    target: 1.5,
    judgeAfter: { calls: 5, date: null },
    status: "assigned",
    result: null,
    assignedById: "manager",
    assignedAt: "2026-09-29",
    acknowledgedAt: null,
  };
}
beforeEach(() => {
  Object.assign(state, {
    role: "rep",
    rows: [focus(), focus("peer", "peer")],
    error: null,
    loading: false,
    viewerLoading: false,
    reads: 0,
    pending: false,
  });
  state.ack.mockReset().mockResolvedValue({ ...focus(), status: "acknowledged" });
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
it("routes reps to own list without requesting the manager list", () => {
  const s = renderToStaticMarkup(<LocalCoachingIndex mode="active" />);
  expect(state.reads).toBe(0);
  expect(s).not.toContain("Peer");
  expect(s).not.toContain("Needs follow-up");
  expect(s).toContain("Own note");
});
it("does not mount list hooks before viewer load", () => {
  state.viewerLoading = true;
  renderToStaticMarkup(<LocalCoachingIndex mode="active" />);
  expect(state.reads).toBe(0);
});
it("filters recorded status categories and withholds behavioral result metrics", () => {
  state.role = "manager";
  state.rows[0].status = "held";
  state.rows[0].result = {
    value: 1.8,
    baseline: 0.4,
    target: 1.5,
    verdict: "held",
    measuredOn: "2026-09-30",
    sampleSize: 5,
  };
  const s = renderToStaticMarkup(<LocalCoachingIndex mode="completed" />);
  expect(s).toContain("Own focus");
  expect(s).not.toContain("Peer behavior");
  expect(s).not.toContain("1.8");
  expect(s).toContain("insight unavailable");
});
it("handles no focus and network failure with retry", () => {
  state.rows = [];
  expect(renderToStaticMarkup(<LocalMyCoachingScreen />)).toContain("No current focus");
  state.error = new Error("failed");
  expect(renderToStaticMarkup(<LocalMyCoachingScreen />)).toContain("Retry");
});
it("calls the public acknowledgement once and checks returned focus ownership/ID", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<LocalMyCoachingScreen />));
  const button = () =>
    Array.from(host.querySelectorAll("button")).find((b) => b.textContent === "Acknowledge focus")!;
  state.ack.mockResolvedValueOnce({ ...focus("unexpected"), status: "acknowledged" });
  await act(async () => button().click());
  expect(host.textContent).toContain("not confirmed");
  await act(async () => button().click());
  expect(state.ack).toHaveBeenCalledWith("own");
  expect(host.textContent).toContain("persistence and delivery are unconfirmed");
  expect(button().disabled).toBe(true);
  await act(async () => root.unmount());
  host.remove();
});
it("doesn't offer acknowledgement for already acknowledged focus", () => {
  state.rows[0].acknowledgedAt = "2026-09-29";
  const s = renderToStaticMarkup(<LocalMyCoachingScreen />);
  expect(s).toContain("Already acknowledged");
  expect(s).not.toContain("Acknowledge focus");
});
