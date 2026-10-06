import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Brief, Insight, Message, Room, Viewer } from "@/lib/data";
const s = vi.hoisted(() => ({
  viewer: {} as Viewer,
  room: {} as Room,
  raw: vi.fn(),
  scoped: vi.fn(),
  insights: [] as unknown[],
  messages: [] as Message[],
  brief: null as Brief | null,
  link: vi.fn(),
}));
vi.mock("@/lib/data", async (original) => ({
  ...(await original<typeof import("@/lib/data")>()),
  useViewer: () => ({ data: s.viewer, isLoading: false, error: null }),
  useRoom: () => ({ data: s.room, isLoading: false, error: null }),
  useRoomMessages: () => {
    s.raw();
    return { data: s.messages, isLoading: false, error: null, isEmpty: s.messages.length === 0 };
  },
  useBrief: () => ({ data: s.brief, isLoading: false, error: null }),
  useCalls: () => ({ data: [], isLoading: false, error: null, isEmpty: true }),
  useRoomInsights: () => {
    s.scoped();
    return { data: s.insights, isLoading: false, error: null, isEmpty: s.insights.length === 0 };
  },
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ roomId: "room" }),
  Link: (props: { children: React.ReactNode }) => {
    s.link(props);
    return <a>{props.children}</a>;
  },
}));
import { LocalRoomTabs } from "./LocalRoomTabs";
import { roomAttachments, tabInsightAllowed } from "./roomTabModel";
beforeEach(() => {
  s.viewer = { id: "own", role: "rep" } as Viewer;
  s.room = { id: "room", kind: "channel", isMember: true } as Room;
  s.raw.mockClear();
  s.scoped.mockClear();
  s.insights = [];
  s.messages = [];
  s.brief = null;
  s.link.mockClear();
});
describe("room tabs privacy and actual attachments", () => {
  it("opens the exact report shared to the room instead of the latest report", () => {
    s.viewer = { id: "manager", role: "manager", team: { id: "team" } } as Viewer;
    s.messages = [
      { roomId: "room", threadId: null, block: { type: "report", reportId: "shared" } },
    ] as Message[];
    s.brief = {
      id: "shared",
      kind: "weekly_manager",
      subjectId: "team",
      title: "Shared report",
    } as Brief;
    renderToStaticMarkup(<LocalRoomTabs tab="reports" />);
    const link = s.link.mock.calls.find(([props]) => props.to === "/app/reports/weekly")![0];
    expect(link.search({ as: "manager", reportId: "stale" })).toEqual({
      as: "manager",
      reportId: "shared",
    });
  });
  it("blocks rep raw tabs before fetching", () => {
    for (const tab of ["calls", "reports", "files", "about"] as const)
      expect(renderToStaticMarkup(<LocalRoomTabs tab={tab} />)).toContain("Y9");
    expect(s.raw).not.toHaveBeenCalled();
  });
  it("permits only the scoped rep insight hook", () => {
    expect(renderToStaticMarkup(<LocalRoomTabs tab="insights" />)).toContain(
      "No room insights yet",
    );
    expect(s.scoped).toHaveBeenCalled();
    expect(s.raw).not.toHaveBeenCalled();
  });
  it("blocks a non-member before scoped fetching", () => {
    s.room.isMember = false;
    expect(renderToStaticMarkup(<LocalRoomTabs tab="insights" />)).toContain("Y9");
    expect(s.scoped).not.toHaveBeenCalled();
  });
  it("shows no invented files or About metadata", () => {
    s.viewer.role = "manager";
    expect(renderToStaticMarkup(<LocalRoomTabs tab="files" />)).toContain("Files unavailable");
    expect(renderToStaticMarkup(<LocalRoomTabs tab="about" />)).toContain("Unavailable");
  });
  it("extracts only exact-room attachments and excludes DMs", () => {
    const messages = [
      { id: "ok", roomId: "room", threadId: null, block: { type: "call" } },
      { id: "other", roomId: "other", threadId: null, block: { type: "call" } },
      { id: "dm", roomId: "room", threadId: "dm", block: { type: "call" } },
    ] as Message[];
    expect(roomAttachments(messages, "room", "call").map((m) => m.id)).toEqual(["ok"]);
  });
  it("gates peers, thresholds and unsupported claims", () => {
    const i = {
      kind: "regression",
      affectedRepIds: ["own"],
      callsAnalyzed: 10,
      sampleSize: 6,
      confidence: "high",
      headline: "Pause",
      body: null,
      causalTested: false,
    } as Insight;
    expect(tabInsightAllowed(i, s.viewer)).toBe(true);
    for (const patch of [
      { affectedRepIds: ["peer"] },
      { callsAnalyzed: 9 },
      { callsAnalyzed: Infinity },
      { confidence: undefined },
      { confidence: "unknown" },
      { sampleSize: NaN },
      { headline: "Won deals" },
      { headline: "Outcomes improved" },
      { body: "Win rates improved" },
      { sampleLabel: "n = 40 closed outcomes" },
      { headline: "Pauses caused wins" },
      { headline: "Pausing caused improvement", causalTested: "true" },
      { headline: "Top performers" },
    ])
      expect(tabInsightAllowed({ ...i, ...patch }, s.viewer)).toBe(false);
  });
  it("withholds personal bodies and sample labels with peer comparisons", () => {
    s.insights = [
      {
        state: "insight",
        insight: {
          id: "own",
          kind: "regression",
          affectedRepIds: ["own"],
          callsAnalyzed: 10,
          sampleSize: 6,
          confidence: "high",
          headline: "Pause",
          body: "Peer Secret",
          sampleLabel: "Peer Secret",
          causalTested: false,
        },
      },
    ];
    expect(renderToStaticMarkup(<LocalRoomTabs tab="insights" />)).not.toContain("Peer Secret");
  });
});
