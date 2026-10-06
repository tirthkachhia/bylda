import type { Call } from "@/lib/data";

/** Display helpers for Manager Home. Pure — no data, only formatting of what hooks return. */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export function greetingFor(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Calls that finished analysis and started at/after `sinceMs`. */
export const callsAnalyzedSince = (calls: Call[], sinceMs: number) =>
  calls.filter((c) => c.status === "ready" && Date.parse(c.startedAt) >= sinceMs).length;

const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const dayShort = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export const clockTime = (iso: string) => clock.format(new Date(iso));

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** "Today · 8:04 AM" · "Yesterday · 5:00 PM" · "Tue, Sep 29 · 9:00 AM" */
export function stamp(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const today = new Date(now);
  const yesterday = new Date(now - DAY_MS);
  const day = sameDay(d, today)
    ? "Today"
    : sameDay(d, yesterday)
      ? "Yesterday"
      : dayShort.format(d);
  return `${day} · ${clock.format(d)}`;
}

/** "just now" · "10 min ago" · "2 h ago" · "3 d ago" */
export function ago(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - Date.parse(iso));
  if (diff < MINUTE_MS) return "just now";
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)} min ago`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)} h ago`;
  return `${Math.floor(diff / DAY_MS)} d ago`;
}

export const minutesOf = (sec: number) => `${Math.max(1, Math.round(sec / 60))} min`;

/** Last-vs-previous change, as a whole percent. null when not computable. */
export function lastChangePct(points: number[]): number | null {
  if (points.length < 2) return null;
  const prev = points[points.length - 2];
  const last = points[points.length - 1];
  if (prev === 0) return null;
  return Math.round(((last - prev) / Math.abs(prev)) * 100);
}

const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" });

export const weekdayShort = (iso: string) => weekday.format(new Date(iso));

export type DayBucket = "today" | "yesterday" | "earlier";

export const dayBucket = (iso: string, now: number): DayBucket => {
  const d = new Date(iso);
  if (sameDay(d, new Date(now))) return "today";
  if (sameDay(d, new Date(now - DAY_MS))) return "yesterday";
  return "earlier";
};

/** Clock time for today's items, weekday for older ones — the right-hand time column. */
export const whenLabel = (iso: string, now: number) =>
  dayBucket(iso, now) === "today" ? clockTime(iso) : weekdayShort(iso);
