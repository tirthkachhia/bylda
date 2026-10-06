import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Behavior, CoachingFocus, Person } from "@/lib/data";
import { G2AssignCoachingModal } from "./G2AssignCoachingModal";
import { G12BehaviorChangeResultAlexMorgan } from "./G12BehaviorChangeResultAlexMorgan";
import { assignmentProblem } from "./coachingModel";

const state = vi.hoisted(() => ({
  role: "manager",
  viewerLoading: false,
  loading: false,
  error: null as Error | null,
  focus: null as CoachingFocus | null,
  focusId: "focus",
  members: [] as Person[],
  behaviors: [] as Behavior[],
  memberReads: 0,
  focusReads: 0,
  pending: false,
  mutate: vi.fn(),
  retry: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ focusId: state.focusId }),
  useNavigate: () => state.navigate,
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/lib/data", () => ({
  ForbiddenForRoleError: class extends Error {},
  REP_INSIGHT_MIN_CALLS: 10,
  OUTCOME_MIN_CLOSED: 30,
  useViewer: () => ({
    data: { id: "me", role: state.role },
    isLoading: state.viewerLoading,
    error: null,
  }),
  useTeamMembers: () => {
    state.memberReads++;
    return {
      data: state.members,
      isLoading: state.loading,
      error: state.error,
      refetch: state.retry,
    };
  },
  useBehaviors: () => ({ data: state.behaviors, isLoading: false, error: null }),
  useCoachingFocus: () => {
    state.focusReads++;
    return {
      data: state.focus,
      isLoading: state.loading,
      error: state.error,
      refetch: state.retry,
    };
  },
  useAssignCoaching: () => ({
    mutateAsync: state.mutate,
    isPending: state.pending,
    error: state.error,
  }),
}));
const member: Person = {
  id: "rep",
  name: "Available rep",
  firstName: "Available",
  role: "rep",
  title: null,
  avatarUrl: null,
  presence: null,
  teamId: null,
};
const behavior: Behavior = {
  key: "pause",
  name: "Pause",
  definition: "Pause before responding",
  rule: {},
  methodologyId: null,
  enabled: true,
  higherIsBetter: true,
};
function focus(): CoachingFocus {
  return {
    id: "focus",
    repId: "me",
    repName: "Own name",
    behaviorKey: "pause",
    behaviorName: "Pause",
    note: "My note",
    evidence: [],
    metric: "seconds",
    baseline: 0.6,
    target: 1.5,
    judgeAfter: { calls: 5, date: null },
    status: "held",
    assignedById: "manager",
    assignedAt: "2026-09-10",
    acknowledgedAt: null,
    result: {
      value: 1.8,
      baseline: 0.6,
      target: 1.5,
      verdict: "held",
      measuredOn: "2026-09-25",
      sampleSize: 5,
    },
  };
}
beforeEach(() => {
  Object.assign(state, {
    role: "manager",
    viewerLoading: false,
    loading: false,
    error: null,
    focus: focus(),
    focusId: "focus",
    members: [member],
    behaviors: [behavior],
    memberReads: 0,
    focusReads: 0,
    pending: false,
  });
  state.mutate.mockReset().mockResolvedValue({ ...focus(), id: "returned-id", repId: "rep" });
  state.retry.mockReset();
  state.navigate.mockReset();
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
async function mountAssignment() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<G2AssignCoachingModal />));
  return {
    root,
    host,
    close: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}
async function input(label: string, value: string) {
  const el = Array.from(document.querySelectorAll("input,textarea")).find((e) =>
    e.closest("label")?.textContent?.startsWith(label),
  ) as HTMLInputElement | HTMLTextAreaElement;
  const prototype =
    el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(el, value);
  await act(async () => el.dispatchEvent(new Event("input", { bubbles: true })));
}
async function submit() {
  await act(async () =>
    document
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}
describe("assignment input and public mutation", () => {
  it("rejects unavailable selections, whitespace, invalid targets and fractional/zero calls", () => {
    const good = { repId: "rep", behaviorKey: "pause", note: "Note", target: "1.5", calls: "5" };
    expect(assignmentProblem(good, [member], [behavior])).toBeNull();
    for (const bad of [
      { repId: "missing" },
      { behaviorKey: "missing" },
      { note: " " },
      { target: "" },
      { target: "Infinity" },
      { calls: "0" },
      { calls: "1.5" },
      { calls: "" },
    ])
      expect(assignmentProblem({ ...good, ...bad }, [member], [behavior])).not.toBeNull();
    expect(assignmentProblem(good, [member], [{ ...behavior, enabled: false }])).not.toBeNull();
  });
  it("validates the actual form, sends only supported fields and reports returned ID without a fake link", async () => {
    const view = await mountAssignment();
    await submit();
    expect(state.mutate).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Add a note");
    await input("Your note", "  Try the pause  ");
    await input("Target", "1.5");
    await input("Judge after calls", "5");
    await submit();
    expect(state.mutate).toHaveBeenCalledWith({
      repId: "rep",
      behaviorKey: "pause",
      note: "Try the pause",
      target: 1.5,
      judgeAfterCalls: 5,
      evidence: [],
    });
    expect(document.body.textContent).toContain("returned-id");
    expect(document.body.textContent).toContain("Persistence and delivery are unconfirmed");
    expect(document.querySelector('a[href*="returned-id"]')).toBeNull();
    await submit();
    expect(state.mutate).toHaveBeenCalledTimes(1);
    await view.close();
  });
  it("does not expose peer options or mount assignment hooks for reps/viewers or before viewer load", () => {
    for (const role of ["rep", "viewer"]) {
      state.role = role;
      const html = renderToStaticMarkup(<G2AssignCoachingModal />);
      expect(html).toContain("You don’t have access");
      expect(html).not.toContain(member.name);
    }
    state.role = "manager";
    state.viewerLoading = true;
    renderToStaticMarkup(<G2AssignCoachingModal />);
    expect(state.memberReads).toBe(0);
  });
  it("handles source failure/retry and empty enabled choices", () => {
    state.error = new Error("source failed");
    expect(renderToStaticMarkup(<G2AssignCoachingModal />)).toContain("Retry");
    state.error = null;
    state.behaviors = [];
    expect(renderToStaticMarkup(<G2AssignCoachingModal />)).toContain("Assignment unavailable");
  });
  it("disables submission and dismissal during pending and routes cancel through the existing thin route", async () => {
    state.pending = true;
    const view = await mountAssignment();
    expect(document.querySelector('button[type="submit"]')?.hasAttribute("disabled")).toBe(true);
    await submit();
    expect(state.mutate).not.toHaveBeenCalled();
    await view.close();
    state.pending = false;
    const next = await mountAssignment();
    await act(async () =>
      document
        .querySelector('button[aria-label="Close assignment"]')!
        .dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    expect(state.navigate).toHaveBeenCalledWith({ to: "/app/coaching", search: true });
    await next.close();
  });
  it("rejects unexpected returned IDs and permits a failed request to retry", async () => {
    const view = await mountAssignment();
    await input("Your note", "Note");
    await input("Target", "1");
    await input("Judge after calls", "10");
    state.mutate.mockRejectedValueOnce(new Error("network failed"));
    await submit();
    expect(document.body.textContent).toContain("network failed");
    state.mutate.mockResolvedValueOnce({ ...focus(), repId: "peer" });
    await submit();
    expect(document.body.textContent).toContain("doesn’t match");
    await view.close();
  });
});
describe("result ownership and evidence gating", () => {
  it("withholds values, verdict, chart and actions at n=5 and when n is large but confidence/windows are missing", () => {
    for (const n of [5, 100]) {
      state.focus!.result!.sampleSize = n;
      const html = renderToStaticMarkup(<G12BehaviorChangeResultAlexMorgan />);
      expect(html).toContain(`n = ${n} calls`);
      expect(html).toContain("Confidence");
      expect(html).toContain("Comparison chart unavailable");
      expect(html).not.toContain("1.8");
      expect(html).not.toContain("65%");
      expect(html).not.toContain("<polyline");
      expect(html.match(/<button[^>]*disabled/g)).toHaveLength(3);
    }
  });
  it("withholds invalid samples and handles no result", () => {
    state.focus!.result!.sampleSize = NaN;
    expect(renderToStaticMarkup(<G12BehaviorChangeResultAlexMorgan />)).not.toContain("n = NaN");
    state.focus!.result = null;
    expect(renderToStaticMarkup(<G12BehaviorChangeResultAlexMorgan />)).toContain(
      "awaiting a result",
    );
  });
  it("renders own focus but denies peer responses without leaking name/note/evidence/links", () => {
    state.role = "rep";
    expect(renderToStaticMarkup(<G12BehaviorChangeResultAlexMorgan />)).toContain("Own name");
    state.focus!.repId = "peer";
    state.focus!.repName = "Peer secret";
    const html = renderToStaticMarkup(<G12BehaviorChangeResultAlexMorgan />);
    expect(html).toContain("You don’t have access");
    expect(html).not.toContain("Peer secret");
    expect(html).not.toContain("My note");
    expect(html).not.toContain("/app/calls");
  });
  it("fails closed for stale IDs, forbidden errors, empty and loading; retries failures", async () => {
    state.focus!.id = "different";
    expect(renderToStaticMarkup(<G12BehaviorChangeResultAlexMorgan />)).toContain("Focus changed");
    state.focus = null;
    expect(renderToStaticMarkup(<G12BehaviorChangeResultAlexMorgan />)).toContain(
      "Focus unavailable",
    );
    state.loading = true;
    expect(renderToStaticMarkup(<G12BehaviorChangeResultAlexMorgan />)).not.toContain("My note");
    state.loading = false;
    const { ForbiddenForRoleError } = await import("@/lib/data");
    state.error = new ForbiddenForRoleError("blocked", "rep");
    expect(renderToStaticMarkup(<G12BehaviorChangeResultAlexMorgan />)).toContain(
      "You don’t have access",
    );
    state.error = new Error("failed");
    expect(renderToStaticMarkup(<G12BehaviorChangeResultAlexMorgan />)).toContain("Retry");
  });
});
