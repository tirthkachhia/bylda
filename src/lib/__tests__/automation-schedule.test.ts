import { describe, it, expect } from "vitest";
import {
  parseSchedule,
  nextRunAfter,
  describeSchedule,
  formatUntil,
} from "@/lib/automation-schedule";

// 2026-07-11 was a Saturday.
const SAT_NOON = new Date("2026-07-11T12:34:56Z");

describe("parseSchedule", () => {
  it("recognizes every preset the block offers", () => {
    expect(parseSchedule("Every hour")).toBe("hourly");
    expect(parseSchedule("Every day at 9am")).toBe("daily_9");
    expect(parseSchedule("Every Monday")).toBe("weekly_monday_9");
    expect(parseSchedule("First of month")).toBe("monthly_first_9");
  });

  it("is case/whitespace tolerant", () => {
    expect(parseSchedule("  every DAY at 9am ")).toBe("daily_9");
  });

  it("returns null for Custom and unknown strings — never a silent guess", () => {
    expect(parseSchedule("Custom")).toBeNull();
    expect(parseSchedule("")).toBeNull();
    expect(parseSchedule(null)).toBeNull();
    expect(parseSchedule(undefined)).toBeNull();
    expect(parseSchedule("every 5 minutes")).toBeNull();
  });
});

describe("nextRunAfter", () => {
  it("hourly → next top of the hour", () => {
    expect(nextRunAfter("hourly", SAT_NOON).toISOString()).toBe("2026-07-11T13:00:00.000Z");
  });

  it("hourly exactly on the hour still advances (strictly after)", () => {
    const onTheHour = new Date("2026-07-11T13:00:00Z");
    expect(nextRunAfter("hourly", onTheHour).toISOString()).toBe("2026-07-11T14:00:00.000Z");
  });

  it("daily at 9 → tomorrow when today's 9:00 already passed", () => {
    expect(nextRunAfter("daily_9", SAT_NOON).toISOString()).toBe("2026-07-12T09:00:00.000Z");
  });

  it("daily at 9 → today when it's still before 9:00", () => {
    const early = new Date("2026-07-11T05:00:00Z");
    expect(nextRunAfter("daily_9", early).toISOString()).toBe("2026-07-11T09:00:00.000Z");
  });

  it("weekly Monday 9 → the coming Monday", () => {
    expect(nextRunAfter("weekly_monday_9", SAT_NOON).toISOString()).toBe(
      "2026-07-13T09:00:00.000Z",
    );
  });

  it("weekly Monday 9 on a Monday after 9 → next week's Monday", () => {
    const mondayNoon = new Date("2026-07-13T12:00:00Z");
    expect(nextRunAfter("weekly_monday_9", mondayNoon).toISOString()).toBe(
      "2026-07-20T09:00:00.000Z",
    );
  });

  it("first of month 9 → next month once this month's 1st passed", () => {
    expect(nextRunAfter("monthly_first_9", SAT_NOON).toISOString()).toBe(
      "2026-08-01T09:00:00.000Z",
    );
  });

  it("first of month 9 → this month's 1st when still ahead", () => {
    const newYearsEve = new Date("2026-12-31T23:00:00Z");
    expect(nextRunAfter("monthly_first_9", newYearsEve).toISOString()).toBe(
      "2027-01-01T09:00:00.000Z",
    );
  });
});

describe("describeSchedule", () => {
  it("labels presets in plain words with the UTC caveat", () => {
    expect(describeSchedule("Every day at 9am")).toBe("every day at 9:00 UTC");
    expect(describeSchedule("Every hour")).toBe("every hour, on the hour");
  });

  it("returns null for custom so the UI can warn instead of pretending", () => {
    expect(describeSchedule("Custom")).toBeNull();
  });
});

describe("formatUntil", () => {
  it("renders minutes, hours, and days compactly", () => {
    const now = new Date("2026-07-11T12:00:00Z");
    expect(formatUntil(new Date("2026-07-11T12:25:00Z"), now)).toBe("in 25m");
    expect(formatUntil(new Date("2026-07-11T15:00:00Z"), now)).toBe("in 3h");
    expect(formatUntil(new Date("2026-07-14T12:00:00Z"), now)).toBe("in 3d");
    expect(formatUntil(new Date("2026-07-11T12:00:30Z"), now)).toBe("any minute now");
  });
});
