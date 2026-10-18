import { describe, expect, it } from "vitest";
import {
  flattenTranscript,
  toSpeakerSegments,
} from "../../../supabase/functions/_shared/coaching/transcript-flatten";
import type { ParsedTurn } from "../../../supabase/functions/_shared/coaching/transcript-parse";
import { segmentLines } from "../coaching/calls";

const turns: ParsedTurn[] = [
  {
    index: 0,
    speaker: "rep",
    start: "00:00",
    end: "00:05",
    start_s: 0,
    end_s: 5,
    text: "Hi, this is Dana from Acme.",
    tone: { label: "warm", note: "upbeat greeting" },
    overlap: false,
  },
  {
    index: 1,
    speaker: "customer",
    start: "00:06",
    end: "00:08",
    start_s: 6,
    end_s: 8,
    text: "Who is this?",
    tone: { label: "skeptical", note: "clipped, rising pitch" },
    overlap: false,
  },
  {
    index: 2,
    speaker: "unknown",
    start: "00:09",
    end: "00:09",
    start_s: 9,
    end_s: 9,
    text: "[inaudible]",
    tone: { label: "neutral", note: "" },
    overlap: true,
  },
];

describe("flattenTranscript", () => {
  it("writes one labelled line per turn", () => {
    expect(flattenTranscript(turns)).toBe(
      "Rep: Hi, this is Dana from Acme.\nCustomer: Who is this?\nUnknown: [inaudible]",
    );
  });
  it("returns an empty string for no turns", () => {
    expect(flattenTranscript([])).toBe("");
  });
});

describe("toSpeakerSegments", () => {
  it("keeps seconds, tone, and overlap per segment", () => {
    const segments = toSpeakerSegments(turns);
    expect(segments).toHaveLength(3);
    expect(segments[1]).toEqual({
      speaker: "Customer",
      start: 6,
      end: 8,
      text: "Who is this?",
      tone: { label: "skeptical", note: "clipped, rising pitch" },
      overlap: false,
    });
    expect(segments[2].overlap).toBe(true);
    expect(toSpeakerSegments([])).toEqual([]);
  });

  it("renders through the existing segmentLines reader", () => {
    const lines = segmentLines({ id: "c1", transcript: null, segments: toSpeakerSegments(turns) });
    expect(lines.map((line) => line.speaker)).toEqual(["Rep", "Customer", "Unknown"]);
    expect(lines.map((line) => line.time)).toEqual(["0:00", "0:06", "0:09"]);
    expect(lines[0].text).toBe("Hi, this is Dana from Acme.");
  });
});
