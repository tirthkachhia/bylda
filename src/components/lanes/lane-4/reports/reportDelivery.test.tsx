import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Brief, Viewer } from "@/lib/data";
const state = vi.hoisted(() => ({
  viewer: {} as { data?: Viewer; isLoading: boolean; error: unknown },
  brief: {} as { data?: Brief | null; isLoading: boolean; error: unknown; isEmpty?: boolean },
  load: vi.fn(),
  link: vi.fn(),
}));
vi.mock("@/lib/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data")>()),
  useViewer: () => ({ ...state.viewer, refetch: vi.fn() }),
  useBrief: (kind: string) => {
    state.load(kind);
    return { ...state.brief, refetch: vi.fn() };
  },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: (props: { children: React.ReactNode }) => {
    state.link(props);
    return <a>{props.children}</a>;
  },
}));
import { LocalReportDelivery } from "./LocalReportDelivery";
import { ForbiddenForRoleError } from "@/lib/data";
beforeEach(() => {
  state.viewer = {
    data: {
      id: "own",
      name: "Person Own",
      role: "manager",
      team: { id: "team", name: "Team", repCount: 1 },
    } as Viewer,
    isLoading: false,
    error: null,
  };
  state.brief = {
    data: {
      id: "brief",
      kind: "daily_manager",
      title: "Daily Manager Brief",
      period: "Today",
      subjectId: "team",
      sections: [],
      readMinutes: 2,
    } as unknown as Brief,
    isLoading: false,
    error: null,
  };
  state.load.mockClear();
  state.link.mockClear();
});
const render = (delivery: "email" | "push" | "print" = "email") =>
  renderToStaticMarkup(<LocalReportDelivery delivery={delivery} />);
describe("shell-free delivery boundaries", () => {
  it("opens the displayed brief instead of a stale report selection", () => {
    render();
    const link = state.link.mock.calls.find(([props]) => props.to === "/app/reports/daily")![0];
    expect(link.search({ as: "manager", reportId: "stale" })).toEqual({
      as: "manager",
      reportId: "brief",
    });
  });
  it("checks access before mounting report hooks", () => {
    state.viewer.data!.role = "rep";
    expect(render()).toContain("Y9");
    expect(state.load).not.toHaveBeenCalled();
  });
  it("does not fetch a brief while viewer is loading", () => {
    state.viewer = { isLoading: true, error: null };
    render();
    expect(state.load).not.toHaveBeenCalled();
  });
  it("renders generic errors without leaking server messages", () => {
    state.brief.error = new Error("Peer Secret");
    const html = render();
    expect(html).toContain("couldn&#x27;t be loaded");
    expect(html).not.toContain("Peer Secret");
  });
  it("renders forbidden errors as Y9", () => {
    state.brief.error = new ForbiddenForRoleError("Peer Secret", "rep");
    expect(render()).toContain("Y9");
    expect(render()).not.toContain("Peer Secret");
  });
  it("shows missing daily brief without substituting weekly content", () => {
    state.brief = { data: null, isEmpty: true, isLoading: false, error: null };
    expect(render("push")).toContain("No brief available yet");
    expect(state.load).toHaveBeenCalledWith("daily_rep");
  });
  it("withholds mismatched subject and kind before exposing title", () => {
    state.brief.data!.subjectId = "peer";
    state.brief.data!.title = "Peer Secret";
    expect(render()).toContain("Y9");
    expect(render()).not.toContain("Peer Secret");
  });
  it("preserves missing structured sections instead of inventing metrics", () => {
    expect(render()).toContain("Coach today");
    expect(render()).not.toContain("142 calls");
  });
});
