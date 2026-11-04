import { describe, expect, it } from "vitest";
import { buildCallTimeline } from "../coaching/timeline";
import {
  normalizeBehavior,
  sourceTurns,
} from "../../../supabase/functions/_shared/coaching/behavior-intelligence";
import type { ParsedTurn } from "../../../supabase/functions/_shared/coaching/transcript-parse";
const raw: ParsedTurn[] = [
  {
    index: 0,
    speaker: "rep",
    text: "What matters most?",
    start: "00:00",
    end: "00:04",
    start_s: 0,
    end_s: 4,
    overlap: false,
    tone: { label: "curious", note: "Rising question" },
  },
  {
    index: 1,
    speaker: "customer",
    text: "Clear payment timing.",
    start: "00:03",
    end: "00:07",
    start_s: 3,
    end_s: 7,
    overlap: true,
    tone: { label: "neutral", note: "Even delivery" },
  },
];
const turns = sourceTurns(raw, "");
const analysis = normalizeBehavior(
  {
    events: [
      {
        family: "discovery_recommendation",
        stage: "application",
        opportunity: "eligible",
        result: "strength",
        rep_behavior: "Asked what mattered",
        buyer_reaction: "Named payment timing",
        confidence: "medium",
        coaching_action: "Ask the buyer to name their priority.",
        context_turn_ids: [],
        rep_turn_ids: [0],
        buyer_turn_ids: [1],
      },
    ],
  },
  turns,
);
describe("retained call timeline", () => {
  it("populates all five tracks from the same snapshot including time zero", () => {
    const t = buildCallTimeline(analysis, turns, raw, null);
    for (const track of Object.values(t.tracks)) expect(track.length).toBeGreaterThan(0);
    expect(t.tracks.Events[0].start).toBe(0);
    expect(t.duration).toBe(7);
    expect(t.repSeconds).toBe(4);
    expect(t.buyerSeconds).toBe(4);
    expect(t.coveredSeconds).toBe(7);
  });
  it("does not substitute tone from another transcript or infer control without a question", () => {
    const modified = raw.map((t) => ({ ...t, text: "Different source" }));
    const t = buildCallTimeline(
      null,
      turns.map((e) => ({ ...e, text: e.text.replace("?", ".") })),
      modified,
      30,
    );
    expect(t.tracks.Sentiment).toHaveLength(0);
    expect(t.tracks.Control).toHaveLength(0);
    expect(t.tracks.Stage).toHaveLength(0);
  });
  it("leaves unknown times unplotted and never invents zero-valued speech duration", () => {
    const unknown = turns.map((t) => ({ ...t, start_s: null, end_s: null }));
    const t = buildCallTimeline(analysis, unknown, null, null);
    expect(t.duration).toBeNull();
    expect(t.tracks.Events).toHaveLength(0);
    expect(t.untimedEvents).toBe(1);
    expect(t.tracks.Talk).toHaveLength(0);
  });
  it("unions overlapping turns by the same speaker instead of counting them twice", () => {
    const t = buildCallTimeline(
      null,
      [...turns, { ...turns[0], turn_id: 2, start_s: 2, end_s: 5 }],
      null,
      10,
    );
    expect(t.repSeconds).toBe(5);
    expect(t.coveredSeconds).toBe(7);
  });
});
