import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import type { CallReview, Viewer } from "@/lib/data";
import { C3CallReviewTranscriptTimeline } from "./C3CallReviewTranscriptTimeline";
import { C4CallReviewOverview } from "./C4CallReviewOverview";
import { C5CallReviewAnalysis } from "./C5CallReviewAnalysis";
import { C6CallReviewCoaching } from "./C6CallReviewCoaching";

const state = vi.hoisted(() => ({
  review: null as CallReview | null,
  loading: false,
  error: null as Error | null,
  role: "manager",
  forced: true,
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ callId: "call_acme" }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/components/bylda", async () => ({
  ...(await vi.importActual("@/components/bylda")),
  ContextPanel: ({ children }: { children: ReactNode }) => <aside>{children}</aside>,
}));
vi.mock("@/lib/data", () => ({
  mocksForced: () => state.forced,
  ForbiddenForRoleError: class extends Error {},
  useViewer: () => ({
    data: { id: "rep_jordan", name: "Dana Whitfield", role: state.role } as Viewer,
    isLoading: false,
    error: null,
  }),
  useCallReview: () => ({
    data: state.review,
    isLoading: state.loading,
    error: state.error,
    isEmpty: !state.review,
    refetch: vi.fn(),
  }),
  useCalls: () => ({
    data: state.review ? [state.review.call] : [],
    isLoading: false,
    error: null,
  }),
  useBehavioralEvents: () => ({ data: [], isEmpty: true, isLoading: false, error: null }),
  useReanalyzeCall: () => ({ mutate: vi.fn(), isPending: false, isError: false, isSuccess: false }),
  useAssignCoaching: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
  }),
}));
const screens = [
  C4CallReviewOverview,
  C3CallReviewTranscriptTimeline,
  C5CallReviewAnalysis,
  C6CallReviewCoaching,
];
describe("Call review screens", () => {
  beforeEach(() => {
    state.loading = false;
    state.error = null;
    state.role = "manager";
    state.forced = true;
    state.review = {
      call: {
        id: "call_acme",
        repId: "rep_jordan",
        repName: "Jordan Reyes",
        account: { id: null, name: "Acme Logistics" },
        contactName: "David Park",
        opportunityId: null,
        startedAt: "2026-09-28T18:00:00Z",
        durationSec: 2292,
        type: "negotiation",
        direction: null,
        stageAtCall: "Negotiation",
        outcome: "no_decision",
        coachingValue: null,
        status: "ready",
        keyMoments: 0,
        topMoment: null,
        recordingUrl: null,
      },
      transcript: [],
      events: [],
      moments: [],
      coaching: [],
      analysis: {
        summary: "Actual summary",
        objections: [],
        competitors: [],
        nextSteps: [],
        talkRatio: null,
        sentiment: null,
        methodologyAdherence: [],
        analysisStatus: "completed",
        analysisVersion: null,
      },
    };
  });
  for (const Screen of screens) {
    it(`${Screen.name} uses the shared stage rather than the design stage`, () => {
      state.review!.call.stageAtCall = "Shared stage marker";
      expect(renderToStaticMarkup(<Screen />)).toContain("Shared stage marker");
    });
    it(`${Screen.name} renders loading, error and empty boundaries`, () => {
      state.loading = true;
      let html = renderToStaticMarkup(<Screen />);
      expect(html).not.toContain("Pricing follow-up");
      state.loading = false;
      state.error = new Error("Test connection error");
      html = renderToStaticMarkup(<Screen />);
      expect(html).toContain("Test connection error");
      state.error = null;
      state.review = null;
      html = renderToStaticMarkup(<Screen />);
      expect(html).toContain("This call isn’t available.");
      expect(html).not.toContain("Sep 20");
    });
    it(`${Screen.name} keeps rep actions and comparisons private`, () => {
      state.role = "rep";
      const html = renderToStaticMarkup(<Screen />);
      expect(html).toContain("negotiation");
      expect(html).not.toMatch(
        /Assign coaching|Top 3 on team|Best discovery on the team|EXAMPLE · THEO/,
      );
    });
    it(`${Screen.name} avoids demo supplement in real mode`, () => {
      state.forced = false;
      const html = renderToStaticMarkup(<Screen />);
      expect(html).not.toMatch(/\$48,000|rollout risk|12% off|4 of Jordan’s last 6/);
    });
  }
  it("shows the shared next step in overview and transcript summary", () => {
    state.review!.analysis.nextSteps = ["Shared next-step marker"];
    for (const Screen of [C4CallReviewOverview, C3CallReviewTranscriptTimeline]) {
      const html = renderToStaticMarkup(<Screen />);
      expect(html).toContain("Shared next-step marker");
      expect(html).not.toContain("None set");
    }
  });
  it("renders processing without fabricated progress counts", () => {
    state.review!.call.status = "processing";
    expect(renderToStaticMarkup(<C4CallReviewOverview />)).toContain(
      "This call is still processing.",
    );
    expect(renderToStaticMarkup(<C4CallReviewOverview />)).not.toContain("312 of 486");
  });
  it("renders retry for a failed call", () => {
    state.review!.call.status = "failed";
    expect(renderToStaticMarkup(<C5CallReviewAnalysis />)).toContain(
      "This call couldn’t be analyzed.",
    );
  });
});
