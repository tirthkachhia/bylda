import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { Call, PaletteItem, SearchResponse, Viewer } from "@/lib/data";
import { LocalSearchGate, LocalSearchScreen, LocalPalette } from "./LocalSearch";
import { safePaletteItems, verifiedSearchCalls, visibleFilters } from "./searchModel";
const state = vi.hoisted(() => ({
  loading: false,
  error: null as Error | null,
  reads: 0,
  query: "",
  days: 30,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    search: _search,
    ...rest
  }: {
    children: ReactNode;
    to: string;
    params?: { callId: string };
    search?: boolean;
  }) => (
    <a href={params ? "/app/calls/" + params.callId : to} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/data", () => ({
  useViewer: () => ({
    data: { id: "me", role: "rep" },
    isLoading: state.loading,
    error: state.error,
    refetch: vi.fn(),
  }),
  useCalls: () => {
    state.reads++;
    return { data: calls, isLoading: false, error: state.error, refetch: vi.fn() };
  },
  usePaletteItems: () => ({
    data: items,
    isLoading: state.loading,
    error: state.error,
    refetch: vi.fn(),
  }),
  useSearch: (query: string, days: number) => {
    state.query = query;
    state.days = days;
    return {
      data: { ...response, query, windowDays: days },
      isLoading: state.loading,
      error: state.error,
      refetch: vi.fn(),
    };
  },
}));
const viewer = { id: "me", role: "rep" } as Viewer;
const call = (id: string, repId: string): Call => ({
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
});
const calls = [call("own", "me"), call("peer", "other")];
const response: SearchResponse = {
  query: "own",
  windowDays: 30,
  filters: [],
  results: calls.map((c) => ({
    callId: c.id,
    title: "Leaked title",
    repName: "Peer secret",
    startedAt: c.startedAt,
    snippet: "Unsupported insight",
    timestamp: null,
    matched: [],
  })),
};
const items: PaletteItem[] = calls.map((c) => ({
  id: c.id,
  kind: "call",
  label: "Leaked title",
  hint: "Unsupported insight",
  href: "/app/calls/" + c.id,
}));
beforeEach(() => {
  state.loading = false;
  state.error = null;
  state.reads = 0;
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => document.body.replaceChildren());
it("rejects unknown and peer IDs and uses canonical call metadata", () => {
  const rows = verifiedSearchCalls(
    { ...response, results: [...response.results, { ...response.results[0], callId: "unknown" }] },
    calls,
    viewer,
    Date.parse("2026-10-02"),
  );
  expect(rows.map((c) => c.id)).toEqual(["own"]);
  const palette = safePaletteItems(
    [...items, { ...items[0], href: "javascript:alert(1)" }],
    calls,
    viewer,
  );
  expect(palette).toHaveLength(1);
  expect(palette[0].label).toBe("My name × own");
  expect(palette[0].hint).toBeNull();
});
it("withholds unverified filters and peer filter labels", () => {
  const filtered = {
    ...response,
    filters: [{ field: "rep" as const, value: "other", label: "Peer secret" }],
  };
  expect(visibleFilters(filtered, viewer)).toEqual([]);
  expect(verifiedSearchCalls(filtered, calls, viewer)).toEqual([]);
  expect(
    verifiedSearchCalls(
      { ...response, filters: [{ field: "objection", value: "price", label: "Price" }] },
      calls,
      viewer,
    ),
  ).toEqual([]);
});
it("checks actual outcome, account text and call window", () => {
  const now = Date.parse("2026-10-02");
  expect(
    verifiedSearchCalls(
      { ...response, filters: [{ field: "outcome", value: "won", label: "Won" }] },
      calls,
      viewer,
      now,
    ),
  ).toEqual([]);
  expect(
    verifiedSearchCalls(
      { ...response, filters: [{ field: "text", value: "peer", label: "peer" }] },
      calls,
      viewer,
      now,
    ),
  ).toEqual([]);
  expect(verifiedSearchCalls({ ...response, windowDays: 0 }, calls, viewer, now)).toEqual([]);
  expect(verifiedSearchCalls(response, calls, viewer, Date.parse("2026-12-02"))).toEqual([]);
});
it("does not mount search hooks before viewer authorization and hides error details", () => {
  state.loading = true;
  renderToStaticMarkup(
    <LocalSearchGate>{(v) => <LocalSearchScreen viewer={v} />}</LocalSearchGate>,
  );
  expect(state.reads).toBe(0);
  state.loading = false;
  state.error = new Error("Peer secret");
  const html = renderToStaticMarkup(
    <LocalSearchGate>{(v) => <LocalSearchScreen viewer={v} />}</LocalSearchGate>,
  );
  expect(html).toContain("unavailable");
  expect(html).not.toContain("Peer secret");
});
it("shows only own palette rows and supports Escape", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const close = vi.fn();
  await act(async () => root.render(<LocalPalette viewer={viewer} onClose={close} />));
  expect(container.textContent).not.toMatch(/Peer secret|Leaked title|Unsupported insight|People/);
  await act(async () =>
    container
      .querySelector("input")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
  );
  expect(close).toHaveBeenCalledOnce();
  await act(async () => root.unmount());
});
it("submits edited question and window through public search arguments", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<LocalSearchScreen viewer={viewer} />));
  const inputs = container.querySelectorAll("input");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
      inputs[0],
      "own",
    );
    inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
      inputs[1],
      "90",
    );
    inputs[1].dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () =>
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(state.query).toBe("own");
  expect(state.days).toBe(90);
  expect(container.textContent).not.toMatch(/Peer secret|Unsupported insight|Leaked title/);
  await act(async () => root.unmount());
});
