import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Message, Insight } from "@/lib/data";
const state = vi.hoisted(() => ({
  role: "manager",
  callRep: "me",
  member: true,
  participants: ["me", "other"],
  loading: false,
  error: null as Error | null,
  empty: false,
  threshold: 50,
  confidence: "high",
  mutate: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ callId: "own-call", roomId: "room", threadId: "thread" }),
  Link: ({
    to,
    params,
    search,
    children,
    ...props
  }: React.PropsWithChildren<{
    to: string;
    params?: Record<string, string>;
    search?: unknown;
  }>) => {
    void search;
    return (
      <a href={params ? to.replace(/\$(\w+)/g, (_, key) => params[key]) : to} {...props}>
        {children}
      </a>
    );
  },
}));
const result = (data: unknown) => ({
  data,
  isLoading: state.loading,
  error: state.error,
  isEmpty: state.empty,
  refetch: vi.fn(),
});
const insight = (overrides: Partial<Insight> = {}) =>
  ({
    id: "i",
    kind: "pattern",
    headline: "Measured headline",
    body: "Measured body",
    confidence: state.confidence,
    sampleSize: 9,
    callsAnalyzed: state.threshold,
    affectedRepIds: ["peer"],
    evidence: [],
    action: { type: "review_calls", label: "Review", callIds: ["own-call", "peer-call"] },
    ...overrides,
  }) as Insight;
const message = (overrides: Partial<Message> = {}) =>
  ({
    id: "m",
    roomId: "room",
    threadId: "thread",
    authorId: "other",
    authorName: "Other",
    isApp: false,
    body: "Message body",
    block: null,
    reactions: [],
    replyCount: 0,
    createdAt: "2026-09-30T08:00:00Z",
    ...overrides,
  }) as Message;
vi.mock("@/lib/data", () => ({
  mocksForced: () => true,
  useViewer: () => result({ id: "me", name: "My Name", role: state.role }),
  useMyCalls: () => result([{ id: "own-call", repId: "me" }]),
  useMyCoaching: () => result([{ id: "own-focus", repId: "me" }]),
  useHomeFeed: () =>
    result({ attention: [], coachQueue: [], items: [{ id: "i", insight: insight() }] }),
  useCallReview: () =>
    result({
      call: {
        id: "own-call",
        repId: state.callRep,
        repName: "My Name",
        durationSec: 60,
        account: { name: "Private Account" },
        recordingUrl: null,
        status: "ready",
        outcome: "pending",
      },
      analysis: { summary: "Private summary" },
      moments: [],
    }),
  useAssignCoaching: () => ({ isPending: false, isError: false, mutate: state.mutate }),
  useAcknowledgeCoaching: () => ({}),
  useBehaviors: () =>
    result([{ key: "pause", name: "Pause", definition: "Pause definition", enabled: true }]),
  useNotifications: () =>
    result([
      {
        id: "peer",
        type: "behavior_regression",
        typeLabel: "REGRESSION",
        severity: "regress",
        title: "PEER ALERT",
        href: "/app/calls/peer-call",
        createdAt: "2026-09-30",
      },
      {
        id: "own",
        type: "important_call",
        typeLabel: "IMPORTANT CALL",
        severity: "attention",
        title: "Own alert",
        href: "/app/calls/own-call",
        createdAt: "2026-09-30",
      },
    ]),
  usePushRegistration: () => result({ enabled: false }),
  useRoom: () => result({ id: "room", name: "Own room", isMember: state.member, memberCount: 2 }),
  useRoomMessages: () => result([message()]),
  useDmThreads: () =>
    result([
      { id: "thread", title: "Private thread", participantIds: state.participants, isCoach: false },
    ]),
  useDmMessages: () => result([message()]),
  isInsightSufficient: (i: Insight) =>
    i.callsAnalyzed >= (i.kind === "pattern" || i.affectedRepIds.length !== 1 ? 50 : 10),
  ForbiddenForRoleError: class extends Error {},
}));
import { B2MobileManagerBriefAlert } from "./B2MobileManagerBriefAlert";
import { B3MobileQuickCallReviewCoach } from "./B3MobileQuickCallReviewCoach";
import { B5MobileAlerts } from "./B5MobileAlerts";
import { B7MobileRoomObjectionWatch } from "./B7MobileRoomObjectionWatch";
import { B8MobileDirectMessage } from "./B8MobileDirectMessage";
import { LocalMessageList } from "./LocalMobileMessages";
let root: Root;
let container: HTMLDivElement;
const render = async (element: React.ReactNode) => {
  await act(async () => root.render(element));
  return container.textContent ?? "";
};
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.assign(state, {
    role: "manager",
    callRep: "me",
    member: true,
    participants: ["me", "other"],
    loading: false,
    error: null,
    empty: false,
    threshold: 50,
    confidence: "high",
  });
  state.mutate.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
describe("remaining mobile screens", () => {
  it("uses kit wordmarks in the manager brief and messaging headers", async () => {
    await render(<B2MobileManagerBriefAlert />);
    expect(container.querySelector("header .type-brand-logo")?.textContent).toBe("BYLDA");
    await render(<B7MobileRoomObjectionWatch />);
    expect(container.querySelector("header .type-brand-logo")?.textContent).toBe("BYLDA");
    await render(<B8MobileDirectMessage />);
    expect(container.querySelector("header .type-brand-logo")?.textContent).toBe("BYLDA");
  });
  for (const [code, Screen] of [
    ["B2", B2MobileManagerBriefAlert],
    ["B3", B3MobileQuickCallReviewCoach],
    ["B5", B5MobileAlerts],
    ["B7", B7MobileRoomObjectionWatch],
    ["B8", B8MobileDirectMessage],
  ] as const) {
    it(`${code} loads and retries errors`, async () => {
      state.loading = true;
      await render(<Screen />);
      expect(container.querySelector('[role="status"]')).not.toBeNull();
      state.loading = false;
      state.error = new Error("network");
      expect(await render(<Screen />)).toContain("We couldn’t load");
      expect(container.querySelector("button")?.textContent).toContain("Retry");
    });
    it(`${code} has an empty state`, async () => {
      state.empty = true;
      await render(<Screen />);
      expect(container.querySelector('[role="status"]')).not.toBeNull();
      expect(container.textContent).not.toContain("Private summary");
    });
  }
  it("denies manager brief to a rep", async () => {
    state.role = "rep";
    const text = await render(<B2MobileManagerBriefAlert />);
    expect(text).toContain("restricted");
    expect(text).not.toContain("Measured headline");
  });
  it("hides patterns below 50 calls", async () => {
    state.threshold = 49;
    expect(await render(<B2MobileManagerBriefAlert />)).not.toContain("Measured headline");
  });
  it("shows confidence and sample on supported team patterns", async () => {
    const text = await render(<B2MobileManagerBriefAlert />);
    expect(text).toContain("CONFIDENCE HIGH");
    expect(text).toContain("n = 9");
  });
  it("denies peer calls even if an adapter returns one", async () => {
    state.role = "rep";
    state.callRep = "peer";
    const text = await render(<B3MobileQuickCallReviewCoach />);
    expect(text).toContain("restricted");
    expect(text).not.toContain("Private Account");
  });
  it("does not offer assigning coaching to reps or viewers", async () => {
    for (const role of ["rep", "viewer"]) {
      state.role = role;
      expect(await render(<B3MobileQuickCallReviewCoach />)).not.toContain("Assign coaching to");
    }
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("requires explicit complete assignment inputs", async () => {
    await render(<B3MobileQuickCallReviewCoach />);
    await act(async () =>
      Array.from(container.querySelectorAll("button"))
        .find((b) => b.textContent?.startsWith("Assign coaching to"))!
        .click(),
    );
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(
      true,
    );
    expect(container.querySelector<HTMLInputElement>('[aria-label="Target"]')?.value).toBe("");
    expect(
      container.querySelector<HTMLInputElement>('[aria-label="Judge after calls"]')?.value,
    ).toBe("");
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("shows only verifiably owned notifications for reps", async () => {
    state.role = "rep";
    const text = await render(<B5MobileAlerts />);
    expect(text).toContain("Own alert");
    expect(text).not.toContain("PEER ALERT");
  });
  it("does not load a room for non-members", async () => {
    state.member = false;
    const text = await render(<B7MobileRoomObjectionWatch />);
    expect(text).toContain("restricted");
    expect(text).not.toContain("Message body");
  });
  it("does not show other people's DM to managers either", async () => {
    state.participants = ["peer", "other"];
    const text = await render(<B8MobileDirectMessage />);
    expect(text).toContain("restricted");
    expect(text).not.toContain("Message body");
  });
  it("disables composer without a write hook", async () => {
    await render(<B8MobileDirectMessage />);
    expect(container.querySelector<HTMLInputElement>('[aria-label="Message"]')?.disabled).toBe(
      true,
    );
    expect(
      Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Send")
        ?.disabled,
    ).toBe(true);
  });
  it("hides peer and unstructured team updates from rep rooms", async () => {
    state.role = "rep";
    const text = await render(
      <LocalMessageList
        room
        messages={[
          message({ id: "peer", body: "PEER ROOM TEXT" }),
          message({ id: "own", authorId: "me", body: "Own note" }),
          message({ id: "pattern", block: { type: "insight", insight: insight() } }),
        ]}
      />,
    );
    expect(text).not.toContain("PEER ROOM TEXT");
    expect(text).not.toContain("Measured headline");
    expect(text).toContain("Own note");
  });
  it("does not leak peer call block or message body to reps", async () => {
    state.role = "rep";
    const text = await render(
      <LocalMessageList
        messages={[
          message({
            body: "PEER CALL BODY",
            block: {
              type: "call",
              title: "PEER CALL TITLE",
              meta: "Peer meta",
              callId: "peer-call",
              moment: null,
            },
          }),
        ]}
      />,
    );
    expect(text).not.toContain("PEER CALL");
  });
  it("does not publish structured insight text without confidence/sample", async () => {
    const text = await render(
      <LocalMessageList
        messages={[
          message({
            body: "UNQUALIFIED BODY",
            block: {
              type: "structured",
              columns: [
                { title: "Behavioral insight", body: "UNQUALIFIED METRIC" },
                { title: "Focus", body: "UNQUALIFIED ACTION" },
                { title: "Evidence", body: "UNKNOWN" },
              ],
            },
          }),
        ]}
      />,
    );
    expect(text).toContain("needs confidence");
    expect(text).not.toContain("UNQUALIFIED");
  });
  it("renders low confidence observations without a review action", async () => {
    state.confidence = "low";
    const text = await render(
      <LocalMessageList messages={[message({ block: { type: "insight", insight: insight() } })]} />,
    );
    expect(text).toContain("CONFIDENCE LOW");
    expect(text).not.toContain("Review call");
  });
  it("hides foreign evidence/action links even on own rep insight", async () => {
    state.role = "rep";
    const i = insight({
      kind: "call",
      affectedRepIds: ["me"],
      evidence: [
        {
          callId: "peer-call",
          timestamp: "00:12",
          tSeconds: 12,
          speaker: "rep",
          speakerLabel: "Peer",
          quote: "FOREIGN QUOTE",
        },
      ],
    });
    const text = await render(
      <LocalMessageList messages={[message({ block: { type: "insight", insight: i } })]} />,
    );
    expect(text).not.toContain("FOREIGN QUOTE");
    expect(
      Array.from(container.querySelectorAll("a")).some((a) => a.href.includes("peer-call")),
    ).toBe(false);
    expect(text).toContain("Review call");
  });
});
