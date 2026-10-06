import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { CoachingFocus, CallReview } from "@/lib/data";
const state = vi.hoisted(() => ({
  role: "rep",
  focusId: "own",
  momentId: "own-call~12",
  loading: false,
  error: null as Error | null,
  empty: false,
  focusRep: "me",
  callRep: "me",
  ack: false,
  mutationError: false,
  analyzed: 10,
  foreignEvidence: false,
  query: "",
  mutate: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ focusId: state.focusId, momentId: state.momentId }),
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
      <a href={params ? to.replace(/\$(\w+)/g, (_, name) => params[name]) : to} {...props}>
        {children}
      </a>
    );
  },
}));
const focus = () =>
  ({
    id: "own",
    repId: state.focusRep,
    repName: "My name",
    behaviorKey: "pause",
    behaviorName: "Own focus",
    note: "Own note",
    evidence: [
      {
        callId: state.foreignEvidence ? "peer-call" : "own-call",
        timestamp: "00:12",
        tSeconds: 12,
        speaker: "prospect",
        speakerLabel: "Prospect",
        quote: "Private evidence",
      },
    ],
    metric: "seconds",
    baseline: 0.4,
    target: 1.5,
    judgeAfter: { calls: 5, date: null },
    status: "assigned",
    result: null,
    assignedById: "manager",
    assignedAt: "2026-09-29",
    acknowledgedAt: state.ack ? "2026-09-29" : null,
  }) as CoachingFocus;
const result = (data: unknown) => ({
  data,
  isLoading: state.loading,
  error: state.error,
  isEmpty: state.empty,
  refetch: vi.fn(),
});
vi.mock("@/lib/data", () => ({
  useViewer: () => result({ id: "me", role: state.role, name: "My name" }),
  useMyCalls: () => result([{ id: "own-call", repId: "me", account: { name: "Own account" } }]),
  useMyCoaching: () => result([focus()]),
  useDmThreads: () => result([]),
  usePushRegistration: () => result({ enabled: false }),
  useAcknowledgeCoaching: () => ({
    isPending: false,
    isError: state.mutationError,
    mutate: state.mutate,
  }),
  useRepHome: () =>
    result({
      rep: { id: "me", firstName: "Me" },
      focus: focus(),
      analyzedCalls: state.analyzed,
      insights: [
        {
          state: "insight",
          insight: {
            kind: "call",
            headline: "Own insight",
            confidence: "low",
            sampleSize: 6,
            callsAnalyzed: state.analyzed,
            affectedRepIds: ["me"],
          },
        },
        {
          state: "insight",
          insight: { kind: "pattern", headline: "SECRET TEAM PATTERN", affectedRepIds: ["peer"] },
        },
      ],
    }),
  REP_INSIGHT_MIN_CALLS: 10,
  isInsightSufficient: (i: { callsAnalyzed: number }) => i.callsAnalyzed >= 10,
  useCallReview: () =>
    result({
      call: {
        id: "own-call",
        repId: state.callRep,
        account: { name: "Own account" },
        recordingUrl: null,
      },
      moments: [
        {
          callId: "own-call",
          tSeconds: 12,
          timestamp: "00:12",
          quote: "Own moment quote",
          speakerLabel: "Me",
        },
      ],
      coaching: [focus()],
      transcript: [],
    } as unknown as CallReview),
  useSearch: (query: string) => {
    state.query = query;
    return result({
      filters: [{ field: "text", label: query, value: query }],
      results: [
        { callId: "own-call", title: "Own result", snippet: "Own evidence", timestamp: "00:12" },
        { callId: "peer-call", title: "SECRET PEER RESULT", snippet: "Peer evidence" },
      ],
    });
  },
  ForbiddenForRoleError: class extends Error {},
}));
import { B1MobileRepDailyBrief } from "./B1MobileRepDailyBrief";
import { B4MobileCoachingAcknowledge } from "./B4MobileCoachingAcknowledge";
import { B6MobileMomentPlayer } from "./B6MobileMomentPlayer";
import { B9MobileAskByldaBYLDACoach } from "./B9MobileAskByldaBYLDACoach";
import { parseMomentKey, momentKey } from "./mobile-evidence";
let container: HTMLDivElement;
let root: Root;
const render = async (element: React.ReactNode) => {
  await act(async () => root.render(element));
  return container.textContent ?? "";
};
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.assign(state, {
    role: "rep",
    focusId: "own",
    momentId: "own-call~12",
    loading: false,
    error: null,
    empty: false,
    focusRep: "me",
    callRep: "me",
    ack: false,
    mutationError: false,
    analyzed: 10,
    foreignEvidence: false,
    query: "",
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
describe("mobile privacy and data states", () => {
  it("uses the shared Cinzel wordmark for mobile header branding", async () => {
    await render(<B1MobileRepDailyBrief />);
    const branding = container.querySelectorAll("header .type-brand-logo");
    expect(branding).toHaveLength(1);
    expect([...branding].every((mark) => mark.textContent === "BYLDA")).toBe(true);
    expect(container.querySelector("header .type-display-label")).toBeNull();
    await render(<B9MobileAskByldaBYLDACoach />);
    expect(container.querySelector("header .type-brand-logo")?.textContent).toBe("BYLDA");
  });
  it("hides team patterns and shows insight confidence/sample", async () => {
    const text = await render(<B1MobileRepDailyBrief />);
    expect(text).toContain("Own insight");
    expect(text).toContain("CONFIDENCE LOW");
    expect(text).toContain("n = 6");
    expect(text).not.toContain("SECRET TEAM PATTERN");
  });
  it("gates insights below the rep threshold", async () => {
    state.analyzed = 9;
    const text = await render(<B1MobileRepDailyBrief />);
    expect(text).not.toContain("Own insight");
    expect(text).toContain("Insights need 10 analyzed calls");
  });
  it("never displays a foreign coaching focus", async () => {
    state.focusRep = "peer";
    const text = await render(<B4MobileCoachingAcknowledge />);
    expect(text).toContain("restricted");
    expect(text).not.toContain("Own note");
  });
  it("does not display evidence for foreign calls in an own focus", async () => {
    state.foreignEvidence = true;
    const text = await render(<B4MobileCoachingAcknowledge />);
    expect(text).not.toContain("Private evidence");
  });
  it("does not render a peer call returned by the adapter", async () => {
    state.callRep = "peer";
    const text = await render(<B6MobileMomentPlayer />);
    expect(text).toContain("restricted");
    expect(text).not.toContain("Own moment quote");
  });
  it("rejects opaque moment links without guessing a call", async () => {
    state.momentId = "opaque-moment";
    expect(await render(<B6MobileMomentPlayer />)).toContain("This moment link isn’t available");
  });
  it("requires an exact timestamped moment", async () => {
    state.momentId = "own-call~14";
    expect(await render(<B6MobileMomentPlayer />)).toContain("Moment not found");
  });
  it("shows missing recording honestly", async () => {
    const text = await render(<B6MobileMomentPlayer />);
    expect(text).toContain("Recording unavailable");
    expect(container.querySelector("audio")).toBeNull();
  });
  for (const [name, Screen] of [
    ["B1", B1MobileRepDailyBrief],
    ["B4", B4MobileCoachingAcknowledge],
    ["B6", B6MobileMomentPlayer],
    ["B9", B9MobileAskByldaBYLDACoach],
  ] as const) {
    it(`${name} rejects non-rep access`, async () => {
      state.role = "manager";
      expect(await render(<Screen />)).toContain("restricted");
      expect(container.textContent).not.toContain("Private evidence");
    });
    it(`${name} has loading/error states`, async () => {
      state.loading = true;
      await render(<Screen />);
      expect(container.querySelector('[role="status"]')).not.toBeNull();
      state.loading = false;
      state.error = new Error("FORBIDDEN_FOR_ROLE");
      expect(await render(<Screen />)).toContain("restricted");
      state.error = new Error("unavailable");
      expect(await render(<Screen />)).toContain("We couldn’t load");
    });
  }
  it("does not acknowledge twice", async () => {
    state.ack = true;
    await render(<B4MobileCoachingAcknowledge />);
    expect(container.querySelector("button")?.disabled).toBe(true);
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("acknowledges only the own focus through the shared mutation", async () => {
    state.mutate.mockImplementation((id, opts) =>
      opts.onSuccess({ ...focus(), acknowledgedAt: "2026-09-30" }),
    );
    await render(<B4MobileCoachingAcknowledge />);
    await act(async () => container.querySelector("button")!.click());
    expect(state.mutate.mock.calls[0][0]).toBe("own");
    expect(container.textContent).toContain("Focus acknowledged");
  });
  it("search shows visible editable filters and only owned call links", async () => {
    await render(<B9MobileAskByldaBYLDACoach />);
    await act(async () =>
      Array.from(container.querySelectorAll("button"))
        .find((b) => b.textContent === "Show my pricing calls")!
        .click(),
    );
    expect(state.query).toBe("Show my pricing calls");
    expect(container.textContent).toContain("Own result");
    expect(container.textContent).not.toContain("SECRET PEER RESULT");
    expect(container.querySelector('[aria-label="Edit text filter"]')).not.toBeNull();
    expect(container.textContent).toContain("coaching answer isn’t available");
  });
  it("round trips exact evidence addresses and rejects invalid timestamps", () => {
    expect(parseMomentKey(momentKey({ callId: "abc", tSeconds: 1122 }))).toEqual({
      callId: "abc",
      tSeconds: 1122,
    });
    for (const key of ["abc", "abc~-1", "abc~1.5", "abc~9007199254740992", "abc~12~3"])
      expect(parseMomentKey(key)).toBeNull();
  });
});
