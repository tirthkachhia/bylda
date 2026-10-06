import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Brief, Insight, Viewer } from "@/lib/data";
import { ReportDocument } from "./ReportDocument";

const hooks = vi.hoisted(() => ({ viewer: vi.fn(), brief: vi.fn(), search: vi.fn() }));
vi.mock("@/lib/data", async (original) => ({
  ...(await original<object>()),
  useViewer: hooks.viewer,
  useBrief: hooks.brief,
}));
vi.mock("@tanstack/react-router", () => ({
  useSearch: hooks.search,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
const query = (data: unknown, overrides = {}) => ({
  data,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  ...overrides,
});
const insight: Insight = {
  id: "test",
  kind: "regression",
  headline: "Synthetic report statement",
  body: null,
  confidence: "high",
  sampleSize: 10,
  sampleLabel: null,
  callsAnalyzed: 10,
  affectedRepIds: ["rep"],
  evidence: [],
  action: {
    type: "assign_coaching",
    label: "Assign coaching",
    repId: "rep",
    behaviorKey: "discovery",
  },
  causalTested: false,
  tone: "neutral",
  tag: null,
  createdAt: "2026-09-30T08:00:00Z",
};
const brief: Brief = {
  id: "test-brief",
  kind: "daily_manager",
  title: "Test brief",
  period: "Test period",
  subjectId: null,
  generatedAt: insight.createdAt,
  readMinutes: 1,
  sections: [{ heading: "Test section", body: null, insights: [insight] }],
};
beforeEach(() => {
  hooks.search.mockReturnValue({});
  hooks.viewer.mockReturnValue(query({ role: "manager", team: null } as Viewer));
  hooks.brief.mockReturnValue(query(brief));
});
const render = () => renderToStaticMarkup(<ReportDocument />);
describe("Report document safety and boundary states", () => {
  it("shows loading, error and empty instead of a document", () => {
    hooks.brief.mockReturnValue(query(undefined, { isLoading: true }));
    expect(render()).not.toContain("Synthetic report statement");
    hooks.brief.mockReturnValue(query(undefined, { error: new Error("Report unavailable") }));
    expect(render()).toContain("Report unavailable");
    hooks.brief.mockReturnValue(query(undefined, { isEmpty: true }));
    expect(render()).toContain("This report isn’t available.");
  });
  it("denies rep access even when a manager brief is returned", () => {
    hooks.viewer.mockReturnValue(query({ role: "rep" } as Viewer));
    expect(render()).toContain("Manager reports aren’t available");
    expect(render()).not.toContain("Synthetic report statement");
  });
  it("keeps low confidence observation-only and suppresses below-threshold claims", () => {
    hooks.brief.mockReturnValue(
      query({
        ...brief,
        sections: [{ ...brief.sections[0], insights: [{ ...insight, confidence: "low" }] }],
      }),
    );
    expect(render()).toContain("OBSERVATION ONLY");
    expect(render()).not.toContain("Assign coaching");
    hooks.brief.mockReturnValue(
      query({
        ...brief,
        sections: [{ ...brief.sections[0], insights: [{ ...insight, callsAnalyzed: 9 }] }],
      }),
    );
    expect(render()).toContain("9 analyzed calls available; 10 required.");
    expect(render()).not.toContain("Synthetic report statement");
  });
  it("withholds narrative without confidence and sample size, preserving shared input", () => {
    const section = { ...brief.sections[0], body: "Unqualified narrative" };
    hooks.brief.mockReturnValue(query({ ...brief, sections: [section] }));
    expect(render()).not.toContain("Unqualified narrative");
    expect(render()).toContain("n = 10");
    expect(section.body).toBe("Unqualified narrative");
  });
  it("does not render a selected report with the wrong format", () => {
    hooks.search.mockReturnValue({ reportId: "selected-id" });
    hooks.brief.mockReturnValue(query({ ...brief, kind: "weekly_manager" }));
    expect(render()).toContain("This report has a different format");
    expect(hooks.brief).toHaveBeenCalledWith("selected-id");
  });
});
