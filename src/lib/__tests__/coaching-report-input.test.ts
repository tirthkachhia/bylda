import { describe, expect, it } from "vitest";
import {
  buildReportInput,
  groupThemes,
  guidelineKey,
  rankMoments,
  summarizeCalls,
  tallyAdherence,
  type ReportCall,
  type ReportMoment,
} from "../../../supabase/functions/_shared/coaching/report-input";

const moment = (over: Partial<ReportMoment>): ReportMoment => ({
  call_id: "c1",
  exchange_index: 0,
  type: "temperature_drop",
  score: 50,
  low_confidence: false,
  start_s: 65,
  rep_text: "So that's $82 a month for a hundred thousand.",
  customer_text: "Oh, okay.",
  headline: "Quoted before discovery",
  why_it_matters: "Numbers came before any sense of her budget.",
  what_to_say_instead: "Before I pull numbers, what do you bring in each month?",
  playbook_guideline: "Spend a minute on their financial situation before numbers.",
  guideline_source: "playbook",
  ...over,
});

const call = (over: Partial<ReportCall>): ReportCall => ({
  call_id: "c1",
  started_at: "2026-10-10T15:00:00Z",
  duration_seconds: 900,
  coaching_value_label: "medium",
  quality_score: 60,
  risk_count: 1,
  peak_temperature: 2,
  final_temperature: 1,
  rep_move_average: 2,
  ...over,
});

describe("guidelineKey", () => {
  it("normalizes case, punctuation, and trailing words so paraphrases group together", () => {
    expect(guidelineKey("DIG INTO WHY!!! Uncover the real concern.")).toBe(
      "dig into why uncover the real concern",
    );
    expect(guidelineKey("Spend a minute on their financial situation before numbers.")).toBe(
      guidelineKey("spend a minute on their financial situation, before numbers are quoted"),
    );
  });
});

describe("rankMoments", () => {
  it("puts explained, confident, high-score moments first", () => {
    const ranked = rankMoments([
      moment({ exchange_index: 1, score: 90, why_it_matters: null }),
      moment({ exchange_index: 2, score: 40, low_confidence: true }),
      moment({ exchange_index: 3, score: 30 }),
      moment({ exchange_index: 4, score: 70 }),
    ]);
    expect(ranked.map((m) => m.exchange_index)).toEqual([4, 3, 2, 1]);
  });
});

describe("groupThemes", () => {
  it("groups by guideline, ranks by calls touched, keeps one cited moment per call", () => {
    const themes = groupThemes([
      moment({ call_id: "c1", exchange_index: 9, score: 80 }),
      moment({ call_id: "c1", exchange_index: 12, score: 60 }),
      moment({ call_id: "c2", exchange_index: 3, score: 20, start_s: 605 }),
      moment({
        call_id: "c1",
        exchange_index: 4,
        score: 99,
        playbook_guideline: "Do not cite 'federal guidelines'.",
        guideline_source: "general",
      }),
      moment({ call_id: "c3", exchange_index: 0, playbook_guideline: null }),
      moment({ call_id: "c3", exchange_index: 1, rep_text: null }),
    ]);
    expect(
      themes.map((t) => [t.guideline.slice(0, 12), t.source, t.call_count, t.moment_count]),
    ).toEqual([
      ["Spend a minu", "playbook", 2, 3],
      ["Do not cite ", "general", 1, 1],
    ]);
    expect(themes[0].moments.map((m) => [m.call_id, m.exchange_index, m.at])).toEqual([
      ["c1", 9, "01:05"],
      ["c2", 3, "10:05"],
    ]);
    expect(themes[0].moments[0].what_to_say_instead).toContain("Before I pull numbers");
  });

  it("caps themes and moments per theme", () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      moment({ call_id: `c${i}`, playbook_guideline: `Rule number ${i} applies here` }),
    );
    expect(groupThemes(many, { themes: 2, momentsPerTheme: 1 })).toHaveLength(2);
    const same = Array.from({ length: 5 }, (_, i) => moment({ call_id: `c${i}` }));
    expect(groupThemes(same, { themes: 4, momentsPerTheme: 2 })[0].moments).toHaveLength(2);
  });
});

describe("tallyAdherence", () => {
  it("counts statuses per guideline, skips not_applicable, most-missed first", () => {
    const tally = tallyAdherence([
      { call_id: "c1", guideline: "Confirm DOB", status: "followed" },
      { call_id: "c2", guideline: "Confirm DOB.", status: "followed" },
      { call_id: "c1", guideline: "Ask about budget", status: "missed" },
      { call_id: "c2", guideline: "Ask about budget", status: "partial" },
      { call_id: "c3", guideline: "Ask about budget", status: "missed" },
      { call_id: "c1", guideline: "Close for payment", status: "not_applicable" },
      { call_id: "c1", guideline: "  ", status: "missed" },
    ]);
    expect(tally).toEqual([
      { guideline: "Ask about budget", guideline_id: null, followed: 0, partial: 1, missed: 2 },
      { guideline: "Confirm DOB", guideline_id: null, followed: 2, partial: 0, missed: 0 },
    ]);
  });
});

describe("summarizeCalls and buildReportInput", () => {
  it("aggregates the period and counts warm customers that were lost", () => {
    const calls = [
      call({ call_id: "c1", coaching_value_label: "high", quality_score: 40 }),
      call({ call_id: "c2", peak_temperature: 1, final_temperature: 1, rep_move_average: null }),
      call({ call_id: "c3", quality_score: 80, risk_count: 0, final_temperature: 2 }),
    ];
    expect(summarizeCalls(calls)).toEqual({
      total: 3,
      high_value: 1,
      avg_quality: 60,
      avg_rep_move: 2,
      risk_flags: 2,
      lost_warm_customers: 1,
    });
    expect(summarizeCalls([]).avg_quality).toBeNull();

    const input = buildReportInput({
      calls,
      moments: [moment({}), moment({ call_id: "c2", why_it_matters: null })],
      adherence: [],
    });
    expect(input.themes).toHaveLength(1);
    expect(input.adherence).toEqual([]);
    expect(input.unexplained_moments).toBe(1);
  });
});

describe("canonical ids", () => {
  it("groups moments and adherence by guideline id before falling back to text", () => {
    const themes = groupThemes([
      moment({
        call_id: "c1",
        guideline_id: "g-2",
        playbook_guideline: "Ask about income before quoting",
      }),
      moment({
        call_id: "c2",
        guideline_id: "g-2",
        playbook_guideline: "Completely different phrasing",
      }),
      moment({
        call_id: "c3",
        guideline_id: null,
        playbook_guideline: "Ask about income before quoting",
      }),
    ]);
    expect(themes.map((t) => [t.guideline_id, t.call_count])).toEqual([
      ["g-2", 2],
      [null, 1],
    ]);
    const tally = tallyAdherence([
      { call_id: "c1", guideline: "Confirm DOB", status: "followed", guideline_id: "g-1" },
      { call_id: "c2", guideline: "Confirm date of birth", status: "missed", guideline_id: "g-1" },
    ]);
    expect(tally).toEqual([
      { guideline: "Confirm DOB", guideline_id: "g-1", followed: 1, partial: 0, missed: 1 },
    ]);
  });
});
