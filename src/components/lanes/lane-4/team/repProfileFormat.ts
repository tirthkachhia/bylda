import { useParams } from "@tanstack/react-router";
import type { TagTone } from "@/components/bylda";
import type { Call, CoachingFocus } from "@/lib/data";
import { shortDate } from "../rep/repFormat";

/** Non-component helpers for the Rep Profile screens T8–T12. Pure functions of data-layer values. */

/** `$repId` from the route. T8–T12 all live under /app/team/reps/$repId. */
export function useRepIdParam(): string {
  const { repId = "" } = useParams({ strict: false }) as { repId?: string };
  return repId;
}

export const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** Coaching status → tag. Colour follows the result's direction; in-flight foci are `info`. */
export function focusTag(f: CoachingFocus): { tone: TagTone; label: string } {
  switch (f.status) {
    case "assigned":
      return { tone: "info", label: "Assigned" };
    case "acknowledged":
      return { tone: "info", label: "Active" };
    case "measuring":
      return { tone: "info", label: "Measuring" };
    case "held":
      return { tone: "improve", label: "Held" };
    case "not_yet":
      return { tone: "attention", label: "Not yet" };
    case "reverted":
      return { tone: "regress", label: "Reverted" };
  }
}

export const isActiveFocus = (f: CoachingFocus) =>
  f.status === "assigned" || f.status === "acknowledged" || f.status === "measuring";

/** "Sep 28 →" while running; "Aug 12 – Sep 2" once measured. */
export const focusDates = (f: CoachingFocus) =>
  f.result
    ? `${shortDate(f.assignedAt)} – ${shortDate(f.result.measuredOn)}`
    : `${shortDate(f.assignedAt)} →`;

/** "18:42 — Lost control" (the timestamp leads; never printed twice). */
export function momentText(call: Call): string {
  const m = call.topMoment;
  if (!m) return "Nothing notable";
  const label = m.label.replace(m.timestamp, "").trim();
  return `${m.timestamp} — ${label}`;
}

export const minutes = (sec: number) => `${Math.round(sec / 60)}m`;
