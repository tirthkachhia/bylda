import { describe, expect, it } from "vitest";
import {
  buildCoachingSystemPrompt,
  buildPlaybookBlock,
  normalizeCoaching,
  normalizePlaybookAdherence,
  quoteAppears,
  renderTranscriptForAnalysis,
  TONE_RULE,
} from "../../../supabase/functions/_shared/coaching/analysis-prompt";
import type { ParsedTurn } from "../../../supabase/functions/_shared/coaching/transcript-parse";

const turn = (
  speaker: ParsedTurn["speaker"],
  start_s: number,
  text: string,
  label = "neutral",
  overlap = false,
): ParsedTurn => ({
  index: 0,
  speaker,
  start: "",
  end: "",
  start_s,
  end_s: start_s,
  text,
  tone: { label: label as ParsedTurn["tone"]["label"], note: "" },
  overlap,
});

const turns = [
  turn("rep", 0, "Hi Verna, this is Ethan with Acme.", "warm"),
  turn("customer", 65, "Who is this again?", "skeptical", true),
  turn("rep", 70, "We spoke last week about your coverage."),
];

describe("renderTranscriptForAnalysis", () => {
  it("renders timestamp, speaker, tone, and overlap per line", () => {
    const rendered = renderTranscriptForAnalysis(turns, "fallback");
    expect(rendered.usedTone).toBe(true);
    expect(rendered.truncated).toBe(false);
    expect(rendered.text.split("\n")).toEqual([
      "[00:00] Rep (warm): Hi Verna, this is Ethan with Acme.",
      "[01:05] Customer (skeptical) (overlapping): Who is this again?",
      "[01:10] Rep (neutral): We spoke last week about your coverage.",
    ]);
  });

  it("falls back to plain text without tone", () => {
    const rendered = renderTranscriptForAnalysis(null, "Rep: hi\nCustomer: hello");
    expect(rendered).toEqual({
      text: "Rep: hi\nCustomer: hello",
      usedTone: false,
      truncated: false,
      totalChars: 23,
    });
    expect(renderTranscriptForAnalysis([], "plain").usedTone).toBe(false);
  });

  it("truncates at a line boundary and reports it", () => {
    const rendered = renderTranscriptForAnalysis(turns, "", 60);
    expect(rendered.truncated).toBe(true);
    expect(rendered.text).toBe("[00:00] Rep (warm): Hi Verna, this is Ethan with Acme.");
    expect(rendered.totalChars).toBeGreaterThan(60);
  });
});

describe("prompt composition", () => {
  const playbook = { name: 'Acme "Discovery First"', version: 3, content: "1. Ask about budget." };

  it("wraps the playbook with name and version, and is empty without one", () => {
    const block = buildPlaybookBlock(playbook);
    expect(block).toContain(`<sales_playbook name="Acme 'Discovery First'" version="3">`);
    expect(block).toContain("1. Ask about budget.");
    expect(block).toContain("</sales_playbook>");
    expect(block).toContain("never transcript evidence");
    expect(buildPlaybookBlock(null)).toBe("");
    expect(buildPlaybookBlock({ ...playbook, content: "   " })).toBe("");
  });

  it("orders base prompt, tone rule, then playbook", () => {
    const prompt = buildCoachingSystemPrompt("BASE", playbook);
    const base = prompt.indexOf("BASE");
    const tone = prompt.indexOf(TONE_RULE);
    const block = prompt.indexOf("<sales_playbook");
    expect(base).toBe(0);
    expect(tone).toBeGreaterThan(base);
    expect(block).toBeGreaterThan(tone);
    expect(buildCoachingSystemPrompt("BASE", null)).toBe(`BASE\n\n${TONE_RULE}`);
  });
});

describe("quoteAppears", () => {
  it("matches verbatim text ignoring whitespace, rejects short or fabricated quotes", () => {
    const source = "[00:00] Rep (warm): Hi Verna,   this is Ethan with Acme.";
    expect(quoteAppears("this is Ethan with Acme", source)).toBe(true);
    expect(quoteAppears("this  is Ethan\nwith Acme", source)).toBe(true);
    expect(quoteAppears("Hi Verna", source)).toBe(true);
    expect(quoteAppears("Ethan", source)).toBe(false);
    expect(quoteAppears("Ethan said hello to Bob", source)).toBe(false);
    expect(quoteAppears(42, source)).toBe(false);
  });
});

describe("normalizePlaybookAdherence", () => {
  const source = renderTranscriptForAnalysis(turns, "").text;

  it("requires verbatim quotes for followed/partial, allows none for missed/not_applicable", () => {
    const out = normalizePlaybookAdherence(
      [
        {
          guideline: "Warm opening",
          status: "followed",
          evidence_quote: "Hi Verna, this is Ethan with Acme.",
          note: "Named himself and company.",
        },
        {
          guideline: "Confirm the callback",
          status: "partial",
          evidence_quote: "something never said",
          note: "",
        },
        {
          guideline: "Ask about budget",
          status: "missed",
          evidence_quote: "",
          note: "Never raised.",
        },
        {
          guideline: "Close for a demo",
          status: "not_applicable",
          evidence_quote: "",
          note: "Call ended early.",
        },
        { guideline: "Bad status", status: "great", evidence_quote: "", note: "" },
        { guideline: "", status: "missed", evidence_quote: "", note: "" },
      ],
      source,
    );
    expect(out.map((i) => [i.guideline, i.status])).toEqual([
      ["Warm opening", "followed"],
      ["Ask about budget", "missed"],
      ["Close for a demo", "not_applicable"],
    ]);
    expect(out[0].evidence_quote).toBe("Hi Verna, this is Ethan with Acme.");
  });

  it("caps at 25 items and tolerates garbage", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      guideline: `g${i}`,
      status: "missed",
      evidence_quote: "",
      note: "",
    }));
    expect(normalizePlaybookAdherence(many, source)).toHaveLength(25);
    expect(normalizePlaybookAdherence(null, source)).toEqual([]);
    expect(normalizePlaybookAdherence([null, 7, "x"], source)).toEqual([]);
  });
});

describe("normalizeCoaching", () => {
  const source = renderTranscriptForAnalysis(turns, "").text;

  it("keeps only quoted points, carries playbook_guideline on improvements, trims focus", () => {
    const out = normalizeCoaching(
      {
        strengths: [
          { point: "Opened by name", evidence_quote: "Hi Verna, this is Ethan with Acme." },
          { point: "Fabricated", evidence_quote: "never said this sentence" },
        ],
        improvements: [
          {
            point: "Re-establish context before pitching; the customer sounded skeptical.",
            evidence_quote: "Who is this again?",
            playbook_guideline: "Confirm recognition before the pitch",
          },
          { point: "No quote", evidence_quote: "" },
        ],
        next_call_focus: "  Confirm recognition in the first 20 seconds.  ",
      },
      source,
    );
    expect(out.strengths).toHaveLength(1);
    expect(out.improvements).toEqual([
      {
        point: "Re-establish context before pitching; the customer sounded skeptical.",
        evidence_quote: "Who is this again?",
        playbook_guideline: "Confirm recognition before the pitch",
      },
    ]);
    expect(out.next_call_focus).toBe("Confirm recognition in the first 20 seconds.");
  });

  it("returns empty structure for garbage", () => {
    expect(normalizeCoaching(undefined, source)).toEqual({
      strengths: [],
      improvements: [],
      next_call_focus: "",
    });
  });
});

describe("key moments", () => {
  it("renders the block and normalizes explanations to listed moments only", async () => {
    const { buildKeyMomentsBlock, normalizeKeyMoments } =
      await import("../../../supabase/functions/_shared/coaching/analysis-prompt");
    const block = buildKeyMomentsBlock([
      {
        exchange_index: 63,
        timestamp: "15:20",
        headline: "Customer was ready to move; the rep introduced friction",
        temperature_before: 2.89,
        temperature_after: 2.03,
        rep_move: 1.7,
        risk_probability: 0.77,
        rep_text: "They don't do cards anymore.",
        customer_text: "Oh, okay.",
      },
    ]);
    expect(block).toContain("KEY MOMENTS");
    expect(block).toContain("exchange_index 63 (at 15:20)");
    expect(block).toContain("zero-based; do not renumber");
    expect(block).toContain("2.9 → 2.0");
    expect(block).toContain("flagged as a risky statement");
    expect(block).toContain("Rep: They don't do cards anymore.");
    expect(buildKeyMomentsBlock([])).toBe("");

    const out = normalizeKeyMoments(
      [
        {
          exchange_index: 63,
          headline: "Lost her at payment",
          why_it_matters: "She tried to pay.",
          what_to_say_instead: "Great, a card works; let me take that.",
          playbook_guideline: "",
        },
        { exchange_index: 63, headline: "dup", why_it_matters: "dup" },
        { exchange_index: 99, headline: "not listed", why_it_matters: "x" },
        { exchange_index: 4, headline: "", why_it_matters: "missing headline" },
      ],
      [63, 4],
    );
    expect(out).toEqual([
      {
        exchange_index: 63,
        headline: "Lost her at payment",
        why_it_matters: "She tried to pay.",
        what_to_say_instead: "Great, a card works; let me take that.",
        playbook_guideline: null,
        guideline_source: null,
        guideline_code: null,
      },
    ]);
  });
});

describe("guideline source verification", () => {
  it("labels a cited guideline as playbook only when its words appear in the playbook text", async () => {
    const { guidelineInPlaybook, normalizeKeyMoments } =
      await import("../../../supabase/functions/_shared/coaching/analysis-prompt");
    const playbook =
      "Client Suitability Sheet\nDIG INTO WHY!!!\nAND DO YOU BANK WITH A Federal bank or military branch credit union?";
    expect(
      guidelineInPlaybook("Complete suitability and 'dig into why' before numbers", playbook),
    ).toBe(true);
    expect(guidelineInPlaybook("Do you bank with a federal bank?", playbook)).toBe(true);
    expect(guidelineInPlaybook("Do not treat quoted premiums as guaranteed", playbook)).toBe(false);
    expect(guidelineInPlaybook("anything", null)).toBe(false);

    const out = normalizeKeyMoments(
      [
        {
          exchange_index: 1,
          headline: "a",
          why_it_matters: "b",
          what_to_say_instead: "",
          playbook_guideline: "DIG INTO WHY",
        },
        {
          exchange_index: 2,
          headline: "c",
          why_it_matters: "d",
          what_to_say_instead: "",
          playbook_guideline: "Use approved talk tracks only",
        },
        { exchange_index: 3, headline: "e", why_it_matters: "f", what_to_say_instead: "" },
      ],
      [1, 2, 3],
      playbook,
    );
    expect(out.map((m) => m.guideline_source)).toEqual(["playbook", "general", null]);
  });
});

describe("canonical guideline codes", () => {
  const guidelines = [
    { position: 1, code: "G1", title: "Confirm DOB", detail: null, phase: "opening" as const },
    {
      position: 2,
      code: "G2",
      title: "Ask about income before quoting",
      detail: "x",
      phase: "discovery" as const,
    },
  ];
  const source = renderTranscriptForAnalysis(turns, "").text;

  it("lists the checklist in the playbook block and makes code an enum in the tool", async () => {
    const { buildPlaybookAdherenceTool, buildKeyMomentsTool } =
      await import("../../../supabase/functions/_shared/coaching/analysis-prompt");
    const block = buildPlaybookBlock({ name: "P", version: 1, content: "script" }, guidelines);
    expect(block).toContain("<guidelines>");
    expect(block).toContain("G2 [discovery] Ask about income before quoting — x");
    expect(buildPlaybookBlock({ name: "P", version: 1, content: "script" })).not.toContain(
      "<guidelines>",
    );
    const tool = buildPlaybookAdherenceTool(["G1", "G2"]);
    expect(tool.items.properties.code).toEqual({ type: "string", enum: ["G1", "G2"] });
    expect(tool.items.required[0]).toBe("code");
    expect(buildPlaybookAdherenceTool().items.properties.code).toBeUndefined();
    const km = buildKeyMomentsTool(["G1"]);
    expect(km.items.properties.guideline_code).toEqual({ type: "string", enum: ["G1", "none"] });
    expect(km.items.required).toContain("guideline_code");
    expect(buildKeyMomentsTool().items.required).not.toContain("guideline_code");
  });

  it("adherence keeps only listed codes, once each, with the canonical title", () => {
    const out = normalizePlaybookAdherence(
      [
        {
          code: "G1",
          guideline: "confirmed the dob",
          status: "followed",
          evidence_quote: "Hi Verna, this is Ethan with Acme.",
          note: "",
        },
        { code: "G1", guideline: "dup", status: "missed", evidence_quote: "", note: "" },
        { code: "G9", guideline: "invented", status: "missed", evidence_quote: "", note: "" },
        { guideline: "no code", status: "missed", evidence_quote: "", note: "" },
        { code: "G2", guideline: "", status: "missed", evidence_quote: "", note: "Never asked." },
      ],
      source,
      guidelines,
    );
    expect(out.map((i) => [i.code, i.guideline, i.status])).toEqual([
      ["G1", "Confirm DOB", "followed"],
      ["G2", "Ask about income before quoting", "missed"],
    ]);
    expect(
      normalizePlaybookAdherence(
        [{ guideline: "free", status: "missed", evidence_quote: "", note: "" }],
        source,
      )[0].code,
    ).toBeNull();
  });

  it("key moments with a valid code are playbook-sourced and titled from the checklist", async () => {
    const { normalizeKeyMoments } =
      await import("../../../supabase/functions/_shared/coaching/analysis-prompt");
    const out = normalizeKeyMoments(
      [
        {
          exchange_index: 1,
          headline: "a",
          why_it_matters: "b",
          what_to_say_instead: "",
          guideline_code: "G2",
        },
        {
          exchange_index: 2,
          headline: "c",
          why_it_matters: "d",
          what_to_say_instead: "",
          guideline_code: "G7",
          playbook_guideline: "Something else",
        },
      ],
      [1, 2],
      "unrelated playbook text",
      guidelines,
    );
    expect(out.map((m) => [m.guideline_code, m.playbook_guideline, m.guideline_source])).toEqual([
      ["G2", "Ask about income before quoting", "playbook"],
      [null, "Something else", "general"],
    ]);
  });
});
