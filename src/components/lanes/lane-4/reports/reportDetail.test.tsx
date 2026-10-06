import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Brief, Call, Insight, Viewer } from "@/lib/data";
import { ForbiddenForRoleError } from "@/lib/data";
import { P7WeeklyRepReportJordan } from "./P7WeeklyRepReportJordan";
import { P8TeamReportSeptember } from "./P8TeamReportSeptember";
import { P9BehaviorReportObjectionHandling } from "./P9BehaviorReportObjectionHandling";
import { P6WeeklySalesBehaviorReportOutline } from "./P6WeeklySalesBehaviorReportOutline";
import { detailMatches, statementAllowed, ownEvidence } from "./reportDetailModel";

const hooks = vi.hoisted(() => ({
  viewer: vi.fn(),
  brief: vi.fn(),
  calls: vi.fn(),
  params: vi.fn(),
  search: vi.fn(),
}));
vi.mock("@/lib/data", async (original) => ({
  ...(await original<object>()),
  useViewer: hooks.viewer,
  useBrief: hooks.brief,
  useCalls: hooks.calls,
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: hooks.params,
  useSearch: hooks.search,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
const query = (data: unknown, overrides = {}) => ({
  data,
  isLoading: false,
  isEmpty: false,
  error: null,
  refetch: vi.fn(),
  ...overrides,
});
const insight: Insight = {
  id: "i",
  kind: "regression",
  headline: "Personal statement",
  body: "Top performers on this team pause longer",
  confidence: "high",
  sampleSize: 6,
  sampleLabel: "Peer label",
  callsAnalyzed: 41,
  affectedRepIds: ["rep"],
  evidence: [
    {
      callId: "own",
      timestamp: "01:00",
      tSeconds: 60,
      speaker: "rep",
      speakerLabel: "Self",
      quote: "Own quote",
    },
    {
      callId: "peer",
      timestamp: "02:00",
      tSeconds: 120,
      speaker: "rep",
      speakerLabel: "Peer name",
      quote: "Peer quote",
    },
  ],
  action: {
    type: "assign_coaching",
    label: "Unverified recommendation",
    repId: "rep",
    behaviorKey: "pause",
  },
  causalTested: false,
  tone: "regress",
  tag: null,
  createdAt: "2026-09-29T00:00:00Z",
};
const brief: Brief = {
  id: "b",
  kind: "weekly_rep",
  title: "Personal report",
  subjectId: "rep",
  period: "Wk 39",
  generatedAt: insight.createdAt,
  readMinutes: 5,
  sections: [{ heading: "Shared section", body: "Unqualified narrative", insights: [insight] }],
};
beforeEach(() => {
  hooks.viewer.mockReturnValue(query({ id: "rep", role: "manager" } as Viewer));
  hooks.params.mockReturnValue({ repId: "rep", teamId: "team", behaviorKey: "pause" });
  hooks.search.mockReturnValue({});
  hooks.brief.mockReturnValue(query(brief));
  hooks.calls.mockReturnValue(
    query([
      { id: "own", repId: "rep" },
      { id: "peer", repId: "other" },
    ] as Call[]),
  );
  hooks.brief.mockClear();
});
const screens = [
  ["rep", P7WeeklyRepReportJordan, "weekly_rep", "rep"],
  ["team", P8TeamReportSeptember, "team", "team"],
  ["behavior", P9BehaviorReportObjectionHandling, "behavior", "pause"],
  ["outline", P6WeeklySalesBehaviorReportOutline, "weekly_manager", "team"],
] as const;
describe("Report detail access and boundary states", () => {
  for (const [screen, Component, kind, subject] of screens) {
    it(screen + " renders for manager with the matching format", () => {
      hooks.brief.mockReturnValue(query({ ...brief, kind, subjectId: subject }));
      expect(renderToStaticMarkup(<Component />)).toContain("Personal report");
      expect(hooks.brief).toHaveBeenCalledWith(kind);
    });
    it(screen + " handles loading, error and absent brief", () => {
      hooks.brief.mockReturnValue(query(undefined, { isLoading: true }));
      expect(renderToStaticMarkup(<Component />)).not.toContain("Personal report");
      hooks.brief.mockReturnValue(
        query(undefined, { error: new Error("Report service unavailable") }),
      );
      expect(renderToStaticMarkup(<Component />)).toContain("Report service unavailable");
      hooks.brief.mockReturnValue(query(null, { isEmpty: true }));
      expect(renderToStaticMarkup(<Component />)).toContain("No shared report is available");
      hooks.brief.mockReturnValue(
        query(undefined, { error: new ForbiddenForRoleError("private", "rep") }),
      );
      expect(renderToStaticMarkup(<Component />)).toContain(
        "This report isn’t available to your role",
      );
    });
    it(screen + " independently enforces rep access before the report hook", () => {
      hooks.viewer.mockReturnValue(query({ id: "rep", role: "rep" } as Viewer));
      const markup = renderToStaticMarkup(<Component />);
      if (screen === "rep") {
        expect(markup).toContain("Personal statement");
        expect(markup).toContain("Own quote");
        for (const text of [
          "Peer quote",
          "Peer name",
          "Peer label",
          "Top performers",
          "Unqualified narrative",
          "Unverified recommendation",
        ])
          expect(markup).not.toContain(text);
      } else {
        expect(markup).toContain("This report isn’t available to your role");
        expect(hooks.brief).not.toHaveBeenCalled();
        expect(markup).not.toContain("Personal statement");
      }
    });
    it(screen + " rejects selected wrong format and binds route subjects", () => {
      hooks.search.mockReturnValue({ reportId: "chosen" });
      hooks.brief.mockReturnValue(query({ ...brief, kind: "daily_manager" }));
      expect(renderToStaticMarkup(<Component />)).toContain("No report matches");
      expect(hooks.brief).toHaveBeenCalledWith("chosen");
      if (screen !== "outline") {
        hooks.brief.mockReturnValue(query({ ...brief, kind, subjectId: "another" }));
        expect(renderToStaticMarkup(<Component />)).toContain("No report matches");
      }
    });
  }
  it("denies peer and absent rep parameters without loading a brief", () => {
    hooks.viewer.mockReturnValue(query({ id: "rep", role: "rep" } as Viewer));
    for (const params of [{ repId: "peer" }, {}]) {
      hooks.params.mockReturnValue(params);
      expect(renderToStaticMarkup(<P7WeeklyRepReportJordan />)).toContain(
        "This report isn’t available",
      );
    }
    expect(hooks.brief).not.toHaveBeenCalled();
  });
  it("keeps low-confidence observations free of actions", () => {
    hooks.brief.mockReturnValue(
      query({
        ...brief,
        sections: [{ ...brief.sections[0], insights: [{ ...insight, confidence: "low" }] }],
      }),
    );
    const markup = renderToStaticMarkup(<P7WeeklyRepReportJordan />);
    expect(markup).toContain("OBSERVATION ONLY");
    expect(markup).toContain("n = 6");
    expect(markup).not.toContain("Unverified recommendation");
    expect(markup).toContain("disabled");
  });
  it("outline includes all ten disclosures with honest comments", () => {
    hooks.brief.mockReturnValue(query({ ...brief, kind: "weekly_manager" }));
    const markup = renderToStaticMarkup(<P6WeeklySalesBehaviorReportOutline />);
    expect((markup.match(/<details/g) ?? []).length).toBe(10);
    expect(markup).toContain('href="#report-outline-9"');
    expect(markup).toContain("Report comments and collaborators are unavailable");
  });
});
describe("Statement quality and ownership", () => {
  it("rejects unverified plural outcomes and invalid quality metadata before rendering", () => {
    const invalid = [
      { headline: "Outcomes improved this week" },
      { body: "Win rates improved this week" },
      { sampleLabel: "n = 40 closed outcomes" },
      { confidence: undefined },
      { confidence: null },
      { confidence: "unknown" },
      { callsAnalyzed: Infinity },
      { headline: "Pausing caused change", causalTested: "true" },
    ];
    for (const patch of invalid) {
      const candidate = { ...insight, ...patch } as Insight;
      expect(statementAllowed(candidate)).toBe(false);
      for (const [, Component, kind, subject] of screens) {
        hooks.brief.mockReturnValue(
          query({
            ...brief,
            kind,
            subjectId: subject,
            sections: [{ ...brief.sections[0], insights: [candidate] }],
          }),
        );
        const markup = renderToStaticMarkup(<Component />);
        expect(markup).not.toContain(candidate.headline);
        expect(markup).not.toContain("Own quote");
        expect(markup).not.toContain("Unverified recommendation");
      }
    }
  });
  it("withholds plural peer and ranking headlines from a personal report", () => {
    for (const headline of ["Peers improved", "Rankings improved", "Other reps improved"]) {
      expect(statementAllowed({ ...insight, headline }, "rep")).toBe(false);
    }
  });
  it("withholds own evidence during loading, error and absent call results", () => {
    for (const override of [
      { isLoading: true },
      { error: new Error("Call service unavailable") },
      { isEmpty: true },
    ]) {
      hooks.calls.mockReturnValue(query(undefined, override));
      const markup = renderToStaticMarkup(<P7WeeklyRepReportJordan />);
      expect(markup).not.toContain("Own quote");
      expect(markup).not.toContain("Peer quote");
    }
    hooks.calls.mockReturnValue(
      query(undefined, { error: new ForbiddenForRoleError("peer secret", "rep") }),
    );
    const denied = renderToStaticMarkup(<P7WeeklyRepReportJordan />);
    expect(denied).toContain("This report isn’t available to your role");
    expect(denied).not.toContain("peer secret");
  });
  it("waits for viewer identity and denies unapproved read roles", () => {
    hooks.viewer.mockReturnValue(query(undefined, { isLoading: true }));
    expect(renderToStaticMarkup(<P7WeeklyRepReportJordan />)).not.toContain("Personal statement");
    expect(hooks.brief).not.toHaveBeenCalled();
    hooks.viewer.mockReturnValue(query({ id: "rep", role: "viewer" } as Viewer));
    expect(renderToStaticMarkup(<P8TeamReportSeptember />)).toContain(
      "This report isn’t available",
    );
    expect(hooks.brief).not.toHaveBeenCalled();
  });
  it("fails closed on rep/team thresholds, missing sample, peers and rankings", () => {
    expect(statementAllowed({ ...insight, callsAnalyzed: 9 }, "rep")).toBe(false);
    expect(statementAllowed({ ...insight, kind: "pattern", callsAnalyzed: 49 })).toBe(false);
    expect(statementAllowed({ ...insight, kind: "pattern", callsAnalyzed: 50, body: null })).toBe(
      true,
    );
    expect(statementAllowed({ ...insight, sampleSize: NaN })).toBe(false);
    expect(statementAllowed({ ...insight, sampleSize: 0 })).toBe(false);
    expect(statementAllowed({ ...insight, affectedRepIds: ["peer"] }, "rep")).toBe(false);
    expect(statementAllowed({ ...insight, affectedRepIds: ["rep", "peer"] }, "rep")).toBe(false);
    expect(statementAllowed({ ...insight, headline: "Best on the team" }, "rep")).toBe(false);
  });
  it("does not infer closed-outcome sufficiency or render unsupported causal language", () => {
    expect(statementAllowed({ ...insight, headline: "Won deals improve", sampleSize: 100 })).toBe(
      false,
    );
    expect(statementAllowed({ ...insight, headline: "This caused a change" })).toBe(false);
    expect(
      statementAllowed({
        ...insight,
        headline: "This caused a change",
        body: null,
        causalTested: true,
      }),
    ).toBe(true);
  });
  it("whitelists evidence by call ownership and requires explicit subject identity", () => {
    expect(
      ownEvidence(
        insight,
        [
          { id: "own", repId: "rep" },
          { id: "peer", repId: "peer" },
        ] as Call[],
        "rep",
      ).map((e) => e.callId),
    ).toEqual(["own"]);
    expect(detailMatches({ ...brief, subjectId: null }, "rep", "rep")).toBe(false);
    expect(detailMatches(brief, "rep", "other")).toBe(false);
  });
});
