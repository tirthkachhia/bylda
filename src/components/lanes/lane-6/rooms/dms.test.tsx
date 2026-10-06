import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CoachingFocus, DmThread, Message, Viewer } from "@/lib/data";
import { canReadThread, roomNameError, threadMessages } from "./dmModel";
const s = vi.hoisted(() => ({
  viewer: {} as Viewer,
  threads: [] as DmThread[],
  messages: [] as Message[],
  own: [] as CoachingFocus[],
  raw: vi.fn(),
  id: "thread",
}));
vi.mock("@/lib/data", async (original) => ({
  ...(await original<typeof import("@/lib/data")>()),
  useViewer: () => ({ data: s.viewer, isLoading: false, error: null }),
  useDmThreads: () => ({ data: s.threads, isLoading: false, error: null }),
  useDmMessages: () => {
    s.raw();
    return { data: s.messages, isLoading: false, error: null, isEmpty: s.messages.length === 0 };
  },
  useMyCoaching: () => ({
    data: s.own,
    isLoading: false,
    error: null,
    isEmpty: s.own.length === 0,
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ threadId: s.id }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
import { LocalDirectMessage } from "./LocalDirectMessage";
beforeEach(() => {
  s.viewer = { id: "own", name: "Own Person", role: "rep" } as Viewer;
  s.id = "thread";
  s.threads = [
    { id: "thread", participantIds: ["own", "manager"], isCoach: false } as DmThread,
    { id: "dm_coach", participantIds: ["bylda"], isCoach: true } as DmThread,
  ];
  s.messages = [];
  s.own = [];
  s.raw.mockClear();
});
describe("DM privacy and room draft validation", () => {
  it("requires participation for managers too", () => {
    const t = s.threads[0];
    expect(canReadThread(t, s.viewer, false)).toBe(true);
    expect(canReadThread(t, { ...s.viewer, id: "other", role: "manager" }, false)).toBe(false);
  });
  it("requires actual coach identity", () => {
    expect(canReadThread(s.threads[0], s.viewer, true)).toBe(false);
    expect(canReadThread(s.threads[1], s.viewer, true)).toBe(true);
  });
  it("denies nonparticipants before message fetch", () => {
    s.viewer.id = "other";
    expect(renderToStaticMarkup(<LocalDirectMessage />)).toContain("Y9");
    expect(s.raw).not.toHaveBeenCalled();
  });
  it("denies missing threads before fetch", () => {
    s.id = "missing";
    expect(renderToStaticMarkup(<LocalDirectMessage />)).toContain("Y9");
    expect(s.raw).not.toHaveBeenCalled();
  });
  it("filters wrong thread, room and nonparticipant authors", () => {
    const list = [
      { id: "ok", threadId: "thread", roomId: null, authorId: "own" },
      { id: "other", threadId: "other", roomId: null, authorId: "own" },
      { id: "room", threadId: "thread", roomId: "room", authorId: "own" },
      { id: "peer", threadId: "thread", roomId: null, authorId: "peer" },
    ] as Message[];
    expect(threadMessages(list, s.threads[0], s.viewer).map((m) => m.id)).toEqual(["ok"]);
  });
  it("withholds unscoped personal message bodies", () => {
    s.messages = [
      {
        id: "m",
        threadId: "thread",
        roomId: null,
        authorId: "manager",
        authorName: "Manager",
        body: "Peer Secret",
        isApp: false,
        createdAt: "2026-09-29",
      } as Message,
    ];
    expect(renderToStaticMarkup(<LocalDirectMessage />)).not.toContain("Peer Secret");
  });
  it("never renders fixed Jordan focus for another viewer", () => {
    s.messages = [
      {
        id: "m",
        threadId: "dm_coach",
        roomId: null,
        authorId: "bylda",
        authorName: "Coach",
        isApp: true,
        createdAt: "2026-09-29",
        block: {
          type: "coaching",
          focusId: "peer-focus",
          title: "Peer Secret",
          meta: "Peer Secret",
        },
      } as Message,
    ];
    s.own = [{ id: "peer-focus", repId: "peer", behaviorName: "Peer Secret" } as CoachingFocus];
    const html = renderToStaticMarkup(<LocalDirectMessage coach />);
    expect(html).not.toContain("Peer Secret");
    expect(html).toContain("No personal coaching focus available");
  });
  it("resolves a genuinely own coaching attachment", () => {
    s.messages = [
      {
        id: "m",
        threadId: "dm_coach",
        roomId: null,
        authorId: "bylda",
        isApp: true,
        createdAt: "2026-09-29",
        block: { type: "coaching", focusId: "own-focus" },
      } as Message,
    ];
    s.own = [
      { id: "own-focus", repId: "own", behaviorName: "Pause", status: "assigned" } as CoachingFocus,
    ];
    expect(renderToStaticMarkup(<LocalDirectMessage coach />)).toContain("Open my coaching");
  });
  it("validates room names and actual collisions", () => {
    expect(roomNameError("", [])).toContain("Enter");
    expect(roomNameError("Bad name", [])).toContain("lowercase");
    expect(roomNameError("# existing", ["existing"])).toContain("already exists");
    expect(roomNameError("new-room", ["existing"])).toBeNull();
  });
});
