import type { Notification, NotificationType } from "@/lib/data";
import type { TagTone } from "@/components/bylda";
import { clockTime, dayBucket, weekdayShort, type DayBucket } from "../home/shared/format";

/**
 * Display model for N1 (drawer) and N2 (center). Pure — no data fetching, only the grouping,
 * filtering and wording of what `useNotifications` returns.
 */
export type FilterKey = "all" | "needs_you" | "behavior" | "coaching" | "reports" | "system";

type Category = Exclude<FilterKey, "all" | "needs_you">;

/**
 * Figma 31:1357 counts 9 = 4 Behavior + 2 Coaching + 1 Reports + 1 System, which sums to 8: the
 * call alert (`important_call`) is in no tab. Ansh's ruling: it sits in Coaching (a call worth
 * reviewing is a coaching moment), so Coaching reads 3 where Figma reads 2. Deliberate deviation.
 */
const CATEGORY: Record<NotificationType, Category | null> = {
  behavior_regression: "behavior",
  emerging_pattern: "behavior",
  behavior_improvement: "behavior",
  methodology_breakdown: "behavior",
  coaching_completed: "coaching",
  coaching_acknowledged: "coaching",
  report_ready: "reports",
  integration_problem: "system",
  important_call: "coaching",
};

/**
 * "Needs you" = unread AND (tone is regress or attention, OR the type is an emerging pattern).
 * Improvement and any other info-tone row (FYI) never qualify. No category is exempt: a broken
 * integration is regress/attention like any other. Derived from `toneOf` + type because the data
 * type can't say it (#69, #71).
 */
const ACTION_TONES: readonly TagTone[] = ["regress", "attention"];

export const needsYou = (n: Notification): boolean =>
  !n.read && (ACTION_TONES.includes(toneOf(n)) || n.type === "emerging_pattern");

export const matches = (n: Notification, key: FilterKey): boolean =>
  key === "all" ? true : key === "needs_you" ? needsYou(n) : CATEGORY[n.type] === key;

export const countFor = (list: Notification[], key: FilterKey): number =>
  list.filter((n) => matches(n, key)).length;

/**
 * Figma separates "pattern" (info signal, violet) from plain FYI (neutral) — both arrive as
 * `severity: "info"`. LANE_REQUESTS #69: the data layer should carry the distinction.
 */
export const toneOf = (n: Notification): TagTone =>
  n.severity === "info" && n.type !== "emerging_pattern" ? "neutral" : n.severity;

/** Right-hand time column: clock today, "Yesterday", then weekday (Figma 31:1217 · 31:1242 · 31:1254). */
export function whenOf(iso: string, now: number): string {
  const bucket = dayBucket(iso, now);
  if (bucket === "today") return clockTime(iso);
  if (bucket === "yesterday") return "Yesterday";
  return weekdayShort(iso);
}

/** The drawer folds "yesterday" into EARLIER (Figma 31:1236). */
export const drawerBucket = (iso: string, now: number): Extract<DayBucket, "today" | "earlier"> =>
  dayBucket(iso, now) === "today" ? "today" : "earlier";

/** "19:00" → "7 PM" · "08:30" → "8:30 AM". null when it isn't an HH:MM string. */
export function hourLabel(hhmm: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return min === 0 ? `${h12} ${suffix}` : `${h12}:${String(min).padStart(2, "0")} ${suffix}`;
}

export function quietHoursLabel(q: { from: string; to: string } | null): string {
  if (!q) return "Not set";
  const from = hourLabel(q.from);
  const to = hourLabel(q.to);
  return from && to ? `Off ${from} – ${to}` : "Not set";
}
