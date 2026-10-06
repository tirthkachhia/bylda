import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Call, CallComparison, CallReview } from "@/lib/data";
import { C7CallsManualUpload } from "./C7CallsManualUpload";
import { C8CallComparison } from "./C8CallComparison";
import { fileProblem, alignedTranscript } from "./uploadComparisonModel";
const state = vi.hoisted(() => ({
  role: "manager",
  calls: [] as Call[],
  comparison: undefined as CallComparison | undefined,
  loading: false,
  error: null as Error | null,
  upload: vi.fn(),
  pending: false,
  requested: [] as string[][],
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: { children: ReactNode; params?: { callId: string } }) => (
    <a href={params ? `/app/calls/${params.callId}/transcript` : undefined}>{children}</a>
  ),
}));
vi.mock("@/components/bylda", async () => ({
  ...(await vi.importActual("@/components/bylda")),
  ContextPanel: ({ children }: { children: ReactNode }) => <aside>{children}</aside>,
}));
vi.mock("@/lib/data", () => ({
  ForbiddenForRoleError: class extends Error {},
  useViewer: () => ({ data: { id: "me", role: state.role }, isLoading: false, error: null }),
  useCalls: () => ({
    data: state.calls,
    isLoading: false,
    isEmpty: !state.calls.length,
    error: null,
    refetch: vi.fn(),
  }),
  useCallComparison: (a: string, b: string) => {
    state.requested.push([a, b]);
    return {
      data: state.comparison,
      isLoading: state.loading,
      error: state.error,
      refetch: vi.fn(),
    };
  },
  useUploadCall: () => ({
    mutateAsync: state.upload,
    isPending: state.pending,
    error: state.error,
  }),
}));
const policy = {
  uploadUrl: "https://upload.invalid/mock",
  accepted: ["mp3", "txt"],
  maxBytes: 100,
};
function review(id: string, repId = "me"): CallReview {
  return {
    call: {
      id,
      repId,
      repName: repId === "me" ? "My name" : "Peer secret",
      account: { id: null, name: id },
      contactName: null,
      opportunityId: null,
      startedAt: "2026-10-01T12:00:00Z",
      durationSec: 600,
      type: "demo",
      direction: null,
      stageAtCall: null,
      outcome: null,
      coachingValue: null,
      status: "ready",
      keyMoments: 0,
      topMoment: null,
      recordingUrl: null,
    },
    transcript: [
      {
        id: "segment",
        speaker: "rep",
        speakerName: "Speaker",
        tStart: 3,
        tEnd: 6,
        text: `${id} raw words`,
      },
    ],
    analysis: {
      summary: null,
      objections: [],
      competitors: [],
      nextSteps: [],
      talkRatio: null,
      sentiment: null,
      methodologyAdherence: [],
      analysisStatus: "completed",
      analysisVersion: null,
    },
    events: [],
    moments: [],
    coaching: [],
  };
}
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  state.role = "manager";
  state.calls = [review("left").call, review("right").call, review("peer", "peer").call];
  state.comparison = {
    left: review("left"),
    right: review("right"),
    differences: [{ label: "Unsupported metric", left: "78%", right: "38%" }],
  };
  state.loading = false;
  state.error = null;
  state.pending = false;
  state.requested = [];
  state.upload.mockReset().mockResolvedValue(policy);
});
afterEach(() => document.body.replaceChildren());
describe("file validation", () => {
  it("uses the shared policy, including size boundary and case", () => {
    expect(fileProblem({ name: "call.MP3", size: 100 }, policy)).toBeNull();
    expect(fileProblem({ name: "call.mp3", size: 101 }, policy)).toBe("Exceeds file size limit");
    expect(fileProblem({ name: "call.mp3", size: 0 }, policy)).toBe("Empty file");
    expect(fileProblem({ name: "call.srt", size: 1 }, policy)).toBe("Unsupported file type");
  });
  it("shows selected files as local and removable, without uploading", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<C7CallsManualUpload />));
    const input = host.querySelector('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      value: [new File(["hello"], "call.txt"), new File(["x"], "bad.mov")],
    });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    expect(state.upload).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("Validated locally · not uploaded");
    expect(host.textContent).toContain("Unsupported file type");
    expect(host.textContent).not.toContain("Analyzed");
    const remove = host.querySelector('button[aria-label="Remove call.txt"]')!;
    await act(async () => remove.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(host.textContent).not.toContain("call.txt");
    await act(async () => root.unmount());
  });
  it("shows upload service failures and empty selection", () => {
    state.error = new Error("Unavailable");
    const html = renderToStaticMarkup(<C7CallsManualUpload />);
    expect(html).toContain("Unavailable");
    expect(html).toContain("No files selected");
  });
});
describe("comparison ownership and evidence", () => {
  it("shows raw transcripts and withholds ungated whole-call differences", () => {
    const html = renderToStaticMarkup(<C8CallComparison />);
    expect(html).toContain("left raw words");
    expect(html).toContain("No objection anchor");
    expect(html).not.toContain("Unsupported metric");
    expect(html).not.toContain("78%");
  });
  it("filters peer choices and denies unexpected peer comparison responses", () => {
    state.role = "rep";
    state.comparison!.right = review("right", "peer");
    const html = renderToStaticMarkup(<C8CallComparison />);
    expect(html).not.toContain("Peer secret");
    expect(html).not.toContain("left raw words");
    expect(html).toContain("You don’t have access");
    expect(state.requested).toEqual([["left", "right"]]);
  });
  it("does not request a comparison when a rep has only one own call", () => {
    state.role = "rep";
    state.calls = [review("left").call, review("peer", "peer").call];
    expect(renderToStaticMarkup(<C8CallComparison />)).toContain("Choose two calls");
    expect(state.requested).toEqual([]);
  });
  it("rejects a stale response with different IDs", () => {
    state.comparison!.left = review("unexpected");
    const html = renderToStaticMarkup(<C8CallComparison />);
    expect(html).toContain("Comparison changed");
    expect(html).not.toContain("unexpected raw words");
  });
  it("shows comparison loading, failure and empty", () => {
    state.loading = true;
    expect(renderToStaticMarkup(<C8CallComparison />)).not.toContain("left raw words");
    state.loading = false;
    state.error = new Error("failed");
    expect(renderToStaticMarkup(<C8CallComparison />)).toContain("Comparison couldn’t load");
    state.error = null;
    state.comparison = undefined;
    expect(renderToStaticMarkup(<C8CallComparison />)).toContain("Comparison unavailable");
  });
  it("aligns transcripts to actual event metadata without inventing an objection", () => {
    const r = review("a");
    expect(alignedTranscript(r).anchor).toBeUndefined();
    r.events = [
      {
        id: "event",
        callId: "a",
        type: "objection",
        tStart: 5,
        tEnd: 6,
        speaker: "prospect",
        attrs: {},
        detectorVersion: "v1",
      },
    ];
    expect(alignedTranscript(r).anchor).toBe(5);
    expect(alignedTranscript(r).segments).toHaveLength(1);
  });
});
