import { describe, expect, it } from "vitest";
import {
  buildReportSystemPrompt,
  normalizeRepReport,
  renderReportInput,
  repReportTool,
} from "../../../supabase/functions/_shared/coaching/report-contract";
import type { ReportInput } from "../../../supabase/functions/_shared/coaching/report-input";

const input: ReportInput = {
  calls: {
    total: 4,
    high_value: 2,
    avg_quality: 52,
    avg_rep_move: 1.8,
    risk_flags: 3,
    lost_warm_customers: 2,
  },
  themes: [
    {
      guideline: "Spend a minute on their financial situation before numbers.",
      guideline_id: null,
      source: "playbook",
      call_count: 2,
      moment_count: 3,
      moments: [
        {
          call_id: "c1",
          exchange_index: 9,
          at: "01:05",
          rep_text: "So that's $82 a month.",
          customer_text: "Oh, okay.",
          why_it_matters: "Numbers before budget.",
          what_to_say_instead: "Before I pull numbers, what do you bring in monthly?",
        },
        {
          call_id: "c2",
          exchange_index: 3,
          at: "10:05",
          rep_text: "It's $100 for the full plan.",
          customer_text: null,
          why_it_matters: null,
          what_to_say_instead: null,
        },
      ],
    },
  ],
  adherence: [{ guideline: "Confirm DOB", guideline_id: null, followed: 3, partial: 0, missed: 1 }],
  unexplained_moments: 1,
};

describe("prompt rendering", () => {
  it("wraps the playbook and states the one-page rules", () => {
    const prompt = buildReportSystemPrompt({
      name: 'Vets "C2C"',
      version: 2,
      content: "1. Ask why.",
    });
    expect(prompt).toContain("one-page coaching note");
    expect(prompt).toContain(`<sales_playbook name="Vets 'C2C'" version="2">`);
    expect(prompt).toContain("1. Ask why.");
    expect(buildReportSystemPrompt(null)).not.toContain("<sales_playbook");
  });

  it("renders stats, citable moments, adherence, and the omitted count", () => {
    const text = renderReportInput(
      input,
      { name: "Ethan" },
      { start: "2026-10-01", end: "2026-10-18" },
    );
    expect(text).toContain("REP: Ethan");
    expect(text).toContain("Calls scored: 4 (2 worth reviewing)");
    expect(text).toContain(
      "Theme 1: Spend a minute on their financial situation before numbers. [playbook] — 2 call(s), 3 moment(s)",
    );
    expect(text).toContain("call_id c1 exchange_index 9 (at 01:05)");
    expect(text).toContain("Suggested line: Before I pull numbers");
    expect(text).toContain("- Confirm DOB: 3 / 0 / 1");
    expect(text).toContain("1 moment(s) are not yet explained");
  });

  it("exposes a tool with the required top-level fields", () => {
    expect(repReportTool.parameters.required).toEqual(["headline", "patterns", "drill"]);
    expect(repReportTool.parameters.properties.patterns.maxItems).toBe(3);
  });
});

describe("normalizeRepReport", () => {
  it("keeps only citations present in the input and enriches them", () => {
    const report = normalizeRepReport(
      {
        headline: "  Quotes price before discovery and loses warm customers.  ",
        patterns: [
          {
            title: "Price before discovery",
            guideline: "Spend a minute on their financial situation before numbers.",
            what_happened: "Quoted on two calls before asking about income.",
            say_instead: "Before I pull numbers, what do you bring in each month?",
            cited: [
              { call_id: "c1", exchange_index: 9 },
              { call_id: "c1", exchange_index: 9 },
              { call_id: "c9", exchange_index: 1 },
              { call_id: "c2", exchange_index: 3 },
            ],
          },
          {
            title: "Made up",
            guideline: "",
            what_happened: "No real citation.",
            say_instead: "x",
            cited: [{ call_id: "zzz", exchange_index: 0 }],
          },
        ],
        strength: { title: "Warm open", what_happened: "Opens by name.", cited: [] },
        drill: {
          focus: "Discovery before numbers",
          line_to_practice: "What do you bring in monthly?",
        },
      },
      input,
    );
    expect(report).not.toBeNull();
    expect(report!.headline).toBe("Quotes price before discovery and loses warm customers.");
    expect(report!.patterns).toHaveLength(1);
    expect(report!.patterns[0].cited.map((c) => [c.call_id, c.exchange_index, c.at])).toEqual([
      ["c1", 9, "01:05"],
      ["c2", 3, "10:05"],
    ]);
    expect(report!.patterns[0].cited[0].rep_text).toBe("So that's $82 a month.");
    expect(report!.strength).toEqual({
      title: "Warm open",
      what_happened: "Opens by name.",
      cited: [],
    });
    expect(report!.drill.line_to_practice).toBe("What do you bring in monthly?");
  });

  it("rejects an empty or malformed report", () => {
    expect(normalizeRepReport(null, input)).toBeNull();
    expect(normalizeRepReport({ headline: "x", patterns: [], drill: {} }, input)).toBeNull();
    expect(
      normalizeRepReport(
        { headline: "x", patterns: [{ title: "t", what_happened: "w", cited: [] }], drill: {} },
        input,
      ),
    ).toBeNull();
  });
});
