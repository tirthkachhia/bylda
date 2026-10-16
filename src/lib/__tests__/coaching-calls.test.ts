import { describe, expect, it } from "vitest";
import { formatDuration, initials, segmentLines } from "../coaching/calls";

describe("segmentLines", () => {
  it("turns speaker segments into timed lines", () => {
    const lines = segmentLines({
      id: "c1",
      transcript: "ignored when segments exist",
      segments: [
        { speaker: "Rep", text: "Hi there", start: 0 },
        { speaker: "Customer", text: "Hello", start: 65 },
        { speaker: "Rep", text: "   ", start: 70 },
      ],
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ speaker: "Rep", text: "Hi there", time: "0:00" });
    expect(lines[1]).toMatchObject({ speaker: "Customer", text: "Hello", time: "1:05" });
  });

  it("falls back to the raw transcript as a single line", () => {
    const lines = segmentLines({ id: "c2", transcript: "Whole call text", segments: [] });
    expect(lines).toEqual([{ key: "c2", time: "—", speaker: "Call", text: "Whole call text" }]);
  });

  it("returns nothing when there is neither", () => {
    expect(segmentLines({ id: "c3", transcript: null, segments: [] })).toEqual([]);
  });
});

describe("formatting helpers", () => {
  it("formats durations and initials", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(125)).toBe("2:05");
    expect(initials("Jane Q Public")).toBe("JQ");
    expect(initials("")).toBe("?");
  });
});
