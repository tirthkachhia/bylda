import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Insight, Message, Room, Viewer } from "@/lib/data";
const state = vi.hoisted(() => ({
  viewer: {} as { data?: Viewer; isLoading: boolean; error: unknown },
  room: {} as { data?: Room; isLoading: boolean; error: unknown },
  messages: vi.fn(),
}));
vi.mock("@/lib/data", async (original) => ({
  ...(await original<typeof import("@/lib/data")>()),
  useViewer: () => ({ ...state.viewer, refetch: vi.fn() }),
  useRoom: () => ({ ...state.room, refetch: vi.fn() }),
  useRoomMessages: () => {
    state.messages();
    return { data: [], isLoading: false, error: null, isEmpty: true };
  },
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ roomId: "room" }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
import { LocalRoomFeed } from "./LocalRoomFeed";
import { roomFeedInsightAllowed } from "./roomFeedModel";
import { ForbiddenForRoleError } from "@/lib/data";
beforeEach(() => {
  state.viewer = { data: { id: "own", role: "manager" } as Viewer, isLoading: false, error: null };
  state.room = {
    data: { id: "room", name: "room", kind: "channel", isMember: true } as Room,
    isLoading: false,
    error: null,
  };
  state.messages.mockClear();
});
describe("room feed scope", () => {
  it("does not fetch raw messages for a rep", () => {
    state.viewer.data!.role = "rep";
    expect(renderToStaticMarkup(<LocalRoomFeed />)).toContain("Y9");
    expect(state.messages).not.toHaveBeenCalled();
  });
  it("does not fetch messages for non-members", () => {
    state.room.data!.isMember = false;
    expect(renderToStaticMarkup(<LocalRoomFeed />)).toContain("Y9");
    expect(state.messages).not.toHaveBeenCalled();
  });
  it("waits for viewer before fetching", () => {
    state.viewer.isLoading = true;
    renderToStaticMarkup(<LocalRoomFeed />);
    expect(state.messages).not.toHaveBeenCalled();
  });
  it("does not leak forbidden server text", () => {
    state.room.error = new ForbiddenForRoleError("Peer Secret", "rep");
    const html = renderToStaticMarkup(<LocalRoomFeed />);
    expect(html).toContain("Y9");
    expect(html).not.toContain("Peer Secret");
  });
  it("has an empty message state", () => {
    expect(renderToStaticMarkup(<LocalRoomFeed />)).toContain("No messages yet");
  });
  it("rejects untyped app blocks and outcome claims", () => {
    expect(
      roomFeedInsightAllowed({ block: { type: "structured", columns: [] } } as unknown as Message),
    ).toBe(false);
    const i = {
      kind: "coaching",
      affectedRepIds: ["own"],
      callsAnalyzed: 10,
      sampleSize: 6,
      confidence: "high",
      headline: "Pause after objections",
      body: null,
      causalTested: false,
    } as Insight;
    expect(roomFeedInsightAllowed({ block: { type: "insight", insight: i } } as Message)).toBe(
      true,
    );
    for (const patch of [
      { callsAnalyzed: 9 },
      { callsAnalyzed: Infinity },
      { confidence: undefined },
      { confidence: "unknown" },
      { sampleSize: 0 },
      { headline: "Won deals rise" },
      { headline: "Outcomes improved" },
      { body: "Win rates improved" },
      { sampleLabel: "n = 40 closed outcomes" },
      { headline: "Pausing caused improvement" },
      { headline: "Pausing caused improvement", causalTested: "true" },
    ])
      expect(
        roomFeedInsightAllowed({
          block: { type: "insight", insight: { ...i, ...patch } },
        } as Message),
      ).toBe(false);
  });
});
