import { describe, expect, it } from "vitest";
import {
  MAX_TONE_NOTE_CHARS,
  parseTimestamp,
  validateStructuredTranscript,
} from "../../../supabase/functions/_shared/coaching/transcript-parse";

const turn = (
  speaker: string,
  start: string,
  text: string,
  overrides: Record<string, unknown> = {},
) => ({
  speaker,
  start,
  end: start,
  text,
  tone: { label: "neutral", note: "even pace" },
  overlap: false,
  ...overrides,
});

const good = {
  schema_version: 1,
  language: "en",
  audio_quality: "good",
  speakers: [
    { role: "rep", evidence: "introduces Acme at 00:02" },
    { role: "customer", evidence: "answers the phone" },
  ],
  turns: [
    turn("rep", "00:00", "Hi, this is Dana from Acme."),
    turn("customer", "00:06", "Who is this?"),
    turn("rep", "00:09", "We help teams cut onboarding time."),
  ],
};

describe("parseTimestamp", () => {
  it("parses MM:SS and H:MM:SS", () => {
    expect(parseTimestamp("01:05")).toBe(65);
    expect(parseTimestamp("1:02:03")).toBe(3723);
    expect(parseTimestamp(" 00:00 ")).toBe(0);
  });
  it("rejects malformed values", () => {
    expect(parseTimestamp("abc")).toBeNull();
    expect(parseTimestamp("1:2:3:4")).toBeNull();
    expect(parseTimestamp("12")).toBeNull();
    expect(parseTimestamp("-1:00")).toBeNull();
  });
});

describe("validateStructuredTranscript", () => {
  it("accepts a good payload with indices and seconds", () => {
    const result = validateStructuredTranscript(good);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transcript.turns.map((t) => t.index)).toEqual([0, 1, 2]);
    expect(result.transcript.turns.map((t) => t.start_s)).toEqual([0, 6, 9]);
    expect(result.transcript.speakers).toHaveLength(2);
    expect(result.transcript.audio_quality).toBe("good");
  });

  it("drops turns with an unknown tone label or empty text, keeps the rest", () => {
    const result = validateStructuredTranscript({
      ...good,
      turns: [
        ...good.turns,
        turn("customer", "00:12", "Interesting", { tone: { label: "elated", note: "" } }),
        turn("customer", "00:14", "   "),
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.transcript.turns).toHaveLength(3);
  });

  it("sorts unsorted turns by start time", () => {
    const result = validateStructuredTranscript({
      ...good,
      turns: [good.turns[2], good.turns[0], good.turns[1]],
    });
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.transcript.turns.map((t) => t.text)).toEqual(good.turns.map((t) => t.text));
  });

  it("fills a bad start timestamp from the previous turn's end", () => {
    const result = validateStructuredTranscript({
      ...good,
      turns: [turn("rep", "00:00", "Hello", { end: "00:04" }), turn("customer", "garbage", "Hi")],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.transcript.turns[1].start_s).toBe(4);
  });

  it("caps the tone note length", () => {
    const result = validateStructuredTranscript({
      ...good,
      turns: [
        turn("rep", "00:00", "Hello", { tone: { label: "warm", note: "x".repeat(300) } }),
        turn("customer", "00:02", "Hi"),
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.transcript.turns[0].tone.note).toHaveLength(MAX_TONE_NOTE_CHARS);
  });

  it("defaults audio quality and language when invalid", () => {
    const result = validateStructuredTranscript({ ...good, audio_quality: "great", language: "" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.transcript.audio_quality).toBe("fair");
      expect(result.transcript.language).toBe("en");
    }
  });

  it("rejects when no rep turn exists", () => {
    const result = validateStructuredTranscript({
      ...good,
      turns: [turn("customer", "00:00", "Hello?"), turn("customer", "00:03", "Anyone there?")],
    });
    expect(result).toEqual({
      ok: false,
      reason: "Gemini could not identify the rep in this recording",
    });
  });

  it("rejects when fewer than two usable turns remain", () => {
    const result = validateStructuredTranscript({ ...good, turns: [good.turns[0]] });
    expect(result).toEqual({ ok: false, reason: "Too little speech was transcribed to review" });
  });

  it("rejects payloads without a turns array", () => {
    expect(validateStructuredTranscript(null).ok).toBe(false);
    expect(validateStructuredTranscript({ turns: "nope" }).ok).toBe(false);
  });
});
