import { useEffect, useState } from "react";
import type { BehaviorScore, Call, CallOutcome, Direction } from "@/lib/data";

/** Formatting for R1–R3. Pure functions of data-layer values — no numbers of their own. */

export function formatScore(value: number, unit: BehaviorScore["unit"]): string {
  switch (unit) {
    case "seconds":
      return `${value.toFixed(1)}s`;
    case "per_call":
      return `${value.toFixed(1)} / call`;
    case "ratio":
      return `${Math.round(value * 100)}%`;
    case "percent":
      return `${Math.round(value)}%`;
    case "count":
      return `${value}`;
  }
}

/** "0.4s → 1.5s target" — the focus metric against its goal. */
export const targetLabel = (target: number, unit: BehaviorScore["unit"]) =>
  `→ ${formatScore(target, unit)} target`;

/** Figma R2 sets the team median bare ("2.4", not "2.4 / call"); the YOU NOW column carries the unit. */
export const formatMedian = (value: number, unit: BehaviorScore["unit"]) =>
  unit === "per_call" ? value.toFixed(1) : formatScore(value, unit);

export const directionTone = (d: Direction) =>
  d === "improving" ? "improve" : d === "regressing" ? "regress" : "neutral";

export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${String(m).padStart(2, "0")}:${r}`;
}

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const WEEKDAY_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const WEEKDAY_TIME = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

/** "Sep 28" */
export const shortDate = (iso: string) => DATE.format(new Date(iso));
/** "Mon Sep 28" */
export const callDate = (iso: string) => WEEKDAY_DATE.format(new Date(iso)).replace(",", "");
/** "Mon 5:12 PM" */
export const noteTime = (iso: string) => WEEKDAY_TIME.format(new Date(iso));

export const OUTCOME_LABEL: Record<CallOutcome, string> = {
  won: "Won",
  lost: "Lost",
  advanced: "Advanced",
  no_decision: "Stalled",
  pending: "Open",
};

export const CALL_TYPE_LABEL: Record<Call["type"], string> = {
  discovery: "Discovery",
  demo: "Demo",
  negotiation: "Negotiation",
  follow_up: "Follow-up",
  other: "Call",
};

/**
 * The viewer's clock, read after mount — the server's clock and timezone aren't the
 * viewer's, so date copy must not render during SSR.
 */
export function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  return now;
}

const DAY_LINE = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});
/** "TUESDAY · SEPTEMBER 29" */
export function briefDateLine(now: Date): string {
  const parts = DAY_LINE.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")} · ${get("month")} ${get("day")}`.toUpperCase();
}

export function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
