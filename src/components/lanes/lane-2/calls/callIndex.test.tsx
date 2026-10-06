import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Call, Viewer } from "@/lib/data";
import { C1CallsIndexSavedViews } from "./C1CallsIndexSavedViews";
import { C2CallsIndexAllCallsFiltersOpen } from "./C2CallsIndexAllCallsFiltersOpen";
import { C9CallsRepView } from "./C9CallsRepView";
import { emptyFilters, filterCalls, medianDuration, ownCalls, sortCalls } from "./callIndexModel";

const state = vi.hoisted(() => ({
  calls: [] as Call[],
  role: "manager",
  loading: false,
  error: null as Error | null,
  savedReads: 0,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: { children: ReactNode; params?: { callId: string } }) => (
    <a href={params ? `/app/calls/${params.callId}` : undefined}>{children}</a>
  ),
}));
vi.mock("@/components/bylda", async () => ({
  ...(await vi.importActual("@/components/bylda")),
  ContextPanel: ({ children }: { children: ReactNode }) => <aside>{children}</aside>,
}));
vi.mock("@/lib/data", () => ({
  ForbiddenForRoleError: class extends Error {},
  useViewer: () => ({
    data: { id: "me", role: state.role } as Viewer,
    isLoading: false,
    error: null,
  }),
  useCalls: () => ({
    data: state.calls,
    isEmpty: !state.calls.length,
    isLoading: state.loading,
    error: state.error,
    refetch: vi.fn(),
  }),
  useMyCalls: () => ({
    data: state.calls,
    isEmpty: !state.calls.length,
    isLoading: state.loading,
    error: state.error,
    refetch: vi.fn(),
  }),
  useSavedViews: () => {
    state.savedReads++;
    return {
      data: [
        { id: "failed", name: "Failed calls", count: 9, filter: { status: "failed" } },
        { id: "team", name: "Team-only saved", count: 42, filter: { teamId: "team" } },
      ],
      isEmpty: false,
      isLoading: false,
      error: null,
    };
  },
}));
function call(id: string, repId = "me", extra: Partial<Call> = {}): Call {
  return {
    id,
    repId,
    repName: repId === "me" ? "My name" : "Peer secret",
    account: { id: null, name: id },
    contactName: null,
    startedAt: "2026-10-01T15:00:00Z",
    durationSec: 1200,
    type: "discovery",
    stageAtCall: null,
    outcome: null,
    status: "ready",
    coachingValue: null,
    topMoment: null,
    keyMoments: 0,
    direction: null,
    opportunityId: null,
    recordingUrl: null,
    ...extra,
  };
}
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  state.calls = [
    call("own", "me", {
      coachingValue: 70,
      topMoment: { label: "Unsupported insight", tone: "regress", timestamp: "18:42" },
    }),
    call("peer", "peer", { outcome: "won", status: "failed" }),
  ];
  state.role = "manager";
  state.loading = false;
  state.error = null;
  state.savedReads = 0;
});
afterEach(() => {
  document.body.replaceChildren();
});
describe("Call index model", () => {
  it("scopes own lists without mutating the shared calls", () => {
    const source = [...state.calls];
    expect(ownCalls(source, { id: "me" } as Viewer).map((item) => item.id)).toEqual(["own"]);
    expect(source).toEqual(state.calls);
  });
  it("combines filters, saved conditions and case-insensitive search", () => {
    const calls = [
      call("Acme", "me", { outcome: "won", stageAtCall: "Pricing", status: "failed" }),
      call("other", "me", { durationSec: 40 }),
      call("Old", "me", { startedAt: "2026-08-01T00:00:00Z" }),
    ];
    expect(
      filterCalls(
        calls,
        {
          ...emptyFilters(),
          search: "acME",
          rep: "me",
          outcomes: ["won"],
          types: ["discovery"],
          stages: ["Pricing"],
          duration: "15–60 min",
          days: "7 days",
        },
        { status: "failed" },
        new Date("2026-10-02T15:00:00Z"),
      ),
    ).toEqual([calls[0]]);
    expect(filterCalls(calls, { ...emptyFilters(), duration: "Under 15 min" })).toEqual([calls[1]]);
    expect(filterCalls(calls, { ...emptyFilters(), outcomes: ["lost"] })).toEqual([]);
  });
  it("sorts coaching values with nulls last and preserves original order", () => {
    const calls = [
      call("missing"),
      call("lower", "me", { coachingValue: 0 }),
      call("highest", "me", { coachingValue: 99 }),
    ];
    expect(sortCalls(calls, "Coaching value").map((item) => item.id)).toEqual([
      "highest",
      "lower",
      "missing",
    ]);
    expect(calls[0].id).toBe("missing");
    expect(medianDuration([])).toBeNull();
    expect(
      medianDuration([call("a", "me", { durationSec: 40 }), call("b", "me", { durationSec: 80 })]),
    ).toBe(60);
  });
});
describe("C1/C2/C9 safety and states", () => {
  for (const Screen of [C1CallsIndexSavedViews, C2CallsIndexAllCallsFiltersOpen, C9CallsRepView]) {
    it(`${Screen.name} renders boundaries and never invents insight evidence`, () => {
      let html = renderToStaticMarkup(<Screen />);
      expect(html).not.toContain("Unsupported insight");
      expect(html).toContain("Insight confidence and sample size unavailable");
      state.loading = true;
      html = renderToStaticMarkup(<Screen />);
      expect(html).not.toContain("18:42");
      state.loading = false;
      state.error = new Error("Connection marker");
      expect(renderToStaticMarkup(<Screen />)).toContain("Connection marker");
      state.error = null;
      state.calls = [];
      expect(renderToStaticMarkup(<Screen />)).toContain("No calls yet.");
    });
    it(`${Screen.name} filters peer rows and deep links for a rep`, () => {
      state.role = "rep";
      const html = renderToStaticMarkup(<Screen />);
      expect(html).toContain("/app/calls/own");
      expect(html).not.toMatch(/Peer secret|\/app\/calls\/peer|Team-only saved/);
      expect(state.savedReads).toBe(0);
    });
  }
  it("C9 remains own-only for a manager preview", () => {
    expect(renderToStaticMarkup(<C9CallsRepView />)).not.toMatch(/Peer secret|\/app\/calls\/peer/);
  });
  it("applies saved filters, rejects unsupported team scopes, and discloses unsaved drafts", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<C2CallsIndexAllCallsFiltersOpen />));
    const click = async (text: string) => {
      const button = [...host.querySelectorAll("button")].find((item) =>
        item.textContent?.startsWith(text),
      );
      expect(button).toBeTruthy();
      await act(async () => button!.click());
    };
    await click("Failed calls");
    expect(host.querySelector("tbody")?.textContent).toContain("peer");
    expect(host.querySelector("tbody")?.textContent).not.toContain("own");
    await click("Clear all");
    await click("Team-only saved");
    expect(host.textContent).toContain("team scoping, which is unavailable");
    expect(host.querySelectorAll("tbody tr").length).toBe(2);
    await click("Save as view");
    expect(host.textContent).toContain("Unsaved draft");
    await act(async () => root.unmount());
  });
});
