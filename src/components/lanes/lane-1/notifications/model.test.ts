import { describe, expect, it } from "vitest";
import type { Notification } from "@/lib/data";
import {
  countFor,
  drawerBucket,
  hourLabel,
  matches,
  quietHoursLabel,
  toneOf,
  whenOf,
} from "./model";

const n = (o: Partial<Notification> & Pick<Notification, "type">): Notification => ({
  id: o.type,
  typeLabel: o.type.toUpperCase(),
  severity: "info",
  title: "t",
  body: null,
  href: "/app/notifications",
  read: false,
  createdAt: "2026-09-30T08:10:00",
  ...o,
});

const LIST = [
  n({ type: "behavior_regression", severity: "regress" }),
  n({ type: "important_call", severity: "attention" }),
  n({ type: "emerging_pattern" }),
  n({ type: "report_ready", read: true }),
  n({ type: "coaching_completed", severity: "improve", read: true }),
  n({ type: "coaching_acknowledged", read: true }),
  n({ type: "methodology_breakdown", severity: "attention", read: true }),
  n({ type: "integration_problem", severity: "regress", read: true }),
  n({ type: "behavior_improvement", severity: "improve", read: true }),
];

describe("filters", () => {
  it("reproduces the Figma tab counts for the Figma list", () => {
    expect(countFor(LIST, "all")).toBe(9);
    // Figma 31:1363 reads 3 — the unread regression, call alert and emerging pattern. The
    // integration problem there is read, so it stays out.
    expect(countFor(LIST, "needs_you")).toBe(3);
    expect(countFor(LIST, "behavior")).toBe(4);
    // Figma reads 2: its tabs sum to 8 of 9 and leave the call alert out. Ruling: the call
    // alert is a Coaching row, so 3. The only count that differs from the frames.
    expect(countFor(LIST, "coaching")).toBe(3);
    expect(countFor(LIST, "reports")).toBe(1);
    expect(countFor(LIST, "system")).toBe(1);
  });
  describe("needs you = unread AND (regress | attention | emerging pattern)", () => {
    const cases: [Notification["type"], Notification["severity"], boolean][] = [
      ["behavior_regression", "regress", true],
      ["important_call", "attention", true],
      ["methodology_breakdown", "attention", true],
      ["emerging_pattern", "info", true],
      ["integration_problem", "regress", true],
      ["integration_problem", "attention", true],
      ["integration_problem", "info", false],
      ["behavior_improvement", "improve", false],
      ["coaching_completed", "improve", false],
      ["report_ready", "info", false],
      ["coaching_acknowledged", "info", false],
    ];
    it.each(cases)("%s (%s) unread → %s", (type, severity, expected) => {
      expect(matches(n({ type, severity, read: false }), "needs_you")).toBe(expected);
    });
    it.each(cases)("%s (%s) read → never", (type, severity) => {
      expect(matches(n({ type, severity, read: true }), "needs_you")).toBe(false);
    });
    it("a broken integration is in both System and Needs you", () => {
      const sys = n({ type: "integration_problem", severity: "regress", read: false });
      expect(matches(sys, "system")).toBe(true);
      expect(matches(sys, "needs_you")).toBe(true);
    });
  });
  it("a call alert is a Coaching row (ruling; Figma's tabs leave it out)", () => {
    const call = n({ type: "important_call", severity: "attention" });
    expect(matches(call, "coaching")).toBe(true);
    expect(["behavior", "reports", "system"].some((k) => matches(call, k as never))).toBe(false);
  });
});

describe("toneOf", () => {
  it("keeps signal severities", () => {
    expect(toneOf(n({ type: "behavior_regression", severity: "regress" }))).toBe("regress");
    expect(toneOf(n({ type: "behavior_improvement", severity: "improve" }))).toBe("improve");
    expect(toneOf(n({ type: "important_call", severity: "attention" }))).toBe("attention");
  });
  it("emerging pattern is the info signal; other info is neutral FYI", () => {
    expect(toneOf(n({ type: "emerging_pattern" }))).toBe("info");
    expect(toneOf(n({ type: "report_ready" }))).toBe("neutral");
    expect(toneOf(n({ type: "coaching_acknowledged" }))).toBe("neutral");
  });
});

describe("time labels", () => {
  const now = new Date("2026-09-30T12:00:00").getTime();
  it("clock today, Yesterday, then weekday", () => {
    expect(whenOf("2026-09-30T08:10:00", now)).toBe("8:10 AM");
    expect(whenOf("2026-09-29T08:10:00", now)).toBe("Yesterday");
    expect(whenOf("2026-09-26T08:10:00", now)).toBe("Sat");
  });
  it("drawer folds yesterday into earlier", () => {
    expect(drawerBucket("2026-09-30T08:10:00", now)).toBe("today");
    expect(drawerBucket("2026-09-29T08:10:00", now)).toBe("earlier");
    expect(drawerBucket("2026-09-20T08:10:00", now)).toBe("earlier");
  });
});

describe("quiet hours", () => {
  it.each([
    ["19:00", "7 PM"],
    ["07:00", "7 AM"],
    ["00:00", "12 AM"],
    ["12:00", "12 PM"],
    ["08:30", "8:30 AM"],
  ])("%s → %s", (i, o) => expect(hourLabel(i)).toBe(o));
  it("rejects junk", () => {
    expect(hourLabel("7pm")).toBeNull();
    expect(hourLabel("25:00")).toBeNull();
  });
  it("label", () => {
    expect(quietHoursLabel({ from: "19:00", to: "07:00" })).toBe("Off 7 PM – 7 AM");
    expect(quietHoursLabel(null)).toBe("Not set");
    expect(quietHoursLabel({ from: "x", to: "y" })).toBe("Not set");
  });
});
