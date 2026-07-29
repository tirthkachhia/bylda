import { describe, it, expect } from "vitest";
import { nextDays, slotsFor } from "@/lib/booking";

describe("nextDays", () => {
  it("returns exactly `count` days, all on allowed weekdays, excluding today", () => {
    // Anchor on a known Wednesday (2024-01-03).
    const from = new Date("2024-01-03T12:00:00");
    const weekdays = [1, 2, 3, 4, 5]; // Mon–Fri
    const days = nextDays(5, weekdays, from);
    expect(days).toHaveLength(5);
    for (const d of days) expect(weekdays).toContain(d.getDay());
    // First result is Thursday the 4th (never today).
    expect(days[0].getDate()).toBe(4);
  });

  it("skips disallowed weekdays (weekends)", () => {
    const from = new Date("2024-01-05T12:00:00"); // Friday
    const days = nextDays(2, [1, 2, 3, 4, 5], from);
    // Sat/Sun skipped → Mon 8th, Tue 9th.
    expect(days.map((d) => d.getDate())).toEqual([8, 9]);
  });

  it("returns an empty array when no weekday is allowed", () => {
    expect(nextDays(3, [], new Date("2024-01-03"))).toEqual([]);
  });
});

describe("slotsFor", () => {
  const day = new Date("2024-01-04T00:00:00");

  it("generates back-to-back slots that fit before the end time", () => {
    const slots = slotsFor(day, "09:00", "10:00", 30);
    expect(slots).toHaveLength(2); // 09:00, 09:30 (10:00 slot would end at 10:30)
    expect(slots[0].getHours()).toBe(9);
    expect(slots[0].getMinutes()).toBe(0);
    expect(slots[1].getMinutes()).toBe(30);
  });

  it("excludes a slot that would run past the end", () => {
    // 09:00–10:00 with 45-min slots → only 09:00 (09:45 slot ends 10:30).
    expect(slotsFor(day, "09:00", "10:00", 45)).toHaveLength(1);
  });

  it("returns [] for invalid times or non-positive duration", () => {
    expect(slotsFor(day, "bad", "10:00", 30)).toEqual([]);
    expect(slotsFor(day, "09:00", "10:00", 0)).toEqual([]);
  });
});
