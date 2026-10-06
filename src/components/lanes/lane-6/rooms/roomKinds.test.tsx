import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Brief, Room, Viewer } from "@/lib/data";
const s = vi.hoisted(() => ({
  viewer: {} as Viewer,
  room: {} as Room,
  raw: vi.fn(),
  brief: {} as Brief,
  messages: [] as unknown[],
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
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ roomId: "room" }),
  Link: (props: { children: React.ReactNode }) => {
    s.link(props);
    return <a>{props.children}</a>;
  },
}));
import { LocalKindRoom } from "./LocalKindRoom";
beforeEach(() => {
  s.viewer = { id: "own", role: "manager", team: { id: "team" } } as Viewer;
  s.room = { id: "room", name: "Room", kind: "brief", isMember: true } as Room;
  s.messages = [];
  s.brief = {
    id: "report",
    kind: "weekly_manager",
    title: "Shared report",
    subjectId: "team",
    readMinutes: 5,
    period: "Week",
  } as Brief;
  s.raw.mockClear();
  s.link.mockClear();
});
describe("room kinds routing and scope", () => {
  it("blocks rep messages for every room kind", () => {
    s.viewer.role = "rep";
    for (const kind of ["brief", "coaching", "team", "deal"] as const)
      expect(renderToStaticMarkup(<LocalKindRoom kind={kind} />)).toContain("Y9");
    expect(s.raw).not.toHaveBeenCalled();
  });
  it("requires exact room kind before fetching messages", () => {
    expect(renderToStaticMarkup(<LocalKindRoom kind="deal" />)).toContain("doesn&#x27;t match");
    expect(s.raw).not.toHaveBeenCalled();
  });
  it("requires membership", () => {
    s.room.isMember = false;
    expect(renderToStaticMarkup(<LocalKindRoom kind="brief" />)).toContain("Y9");
    expect(s.raw).not.toHaveBeenCalled();
  });
  it("shows honest empty feeds", () => {
    for (const kind of ["brief", "coaching", "team", "deal"] as const) {
      s.room.kind = kind;
      expect(renderToStaticMarkup(<LocalKindRoom kind={kind} />)).toContain(
        "No messages in this room yet",
      );
    }
  });
  it("resolves an actual shared report and omits untyped app body", () => {
    s.messages = [
      {
        id: "m",
        roomId: "room",
        threadId: null,
        authorName: "Bylda",
        isApp: true,
        body: "Unscoped Secret",
        block: { type: "report", reportId: "report" },
      },
    ];
    const html = renderToStaticMarkup(<LocalKindRoom kind="brief" />);
    expect(html).toContain("Shared report");
    expect(html).not.toContain("Unscoped Secret");
    const link = s.link.mock.calls.find(([props]) => props.to === "/app/reports/weekly")![0];
    expect(link.search({ as: "manager", reportId: "stale" })).toEqual({
      as: "manager",
      reportId: "report",
    });
  });
  it("withholds wrong-subject reports", () => {
    s.brief.subjectId = "other";
    s.brief.title = "Peer Secret";
    s.messages = [
      {
        id: "m",
        roomId: "room",
        threadId: null,
        authorName: "Bylda",
        isApp: true,
        block: { type: "report", reportId: "report" },
      },
    ];
    expect(renderToStaticMarkup(<LocalKindRoom kind="brief" />)).not.toContain("Peer Secret");
  });
});
