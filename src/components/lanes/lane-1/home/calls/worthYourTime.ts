import type { Call } from "@/lib/data";

/** Rows shown — Figma lists six, then "Open all calls". */
const ROWS = 6;

/**
 * Which calls H3 lists as "worth your time": analyzed calls that have a coaching value and a
 * top moment, highest coaching value first, capped at six.
 *
 * TODO(LANE_REQUESTS 33d): replace with the server-side review-priority rank
 * (`Call.reviewPriority`). This client-side rule exists only because the data layer has no rank;
 * delete it — and the cap — when the field lands.
 */
export function worthYourTime(calls: Call[]): Call[] {
  return calls
    .filter((c) => c.status === "ready" && c.coachingValue !== null && c.topMoment !== null)
    .sort((a, b) => (b.coachingValue ?? 0) - (a.coachingValue ?? 0))
    .slice(0, ROWS);
}
