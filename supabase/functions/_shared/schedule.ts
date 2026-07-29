// Schedule math for the Builder's "Scheduled Time" trigger (trigger_schedule).
// Mirror of src/lib/automation-schedule.ts (minus the UI-only formatUntil) —
// keep the two files in sync. All times are UTC.

export type ScheduleKind = "hourly" | "daily_9" | "weekly_monday_9" | "monthly_first_9";

/**
 * Normalize a stored schedule string to a kind. "Custom" and anything
 * unrecognized return null — those cannot auto-run.
 */
export function parseSchedule(raw: string | null | undefined): ScheduleKind | null {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "every hour") return "hourly";
  if (s === "every day at 9am") return "daily_9";
  if (s === "every monday") return "weekly_monday_9";
  if (s === "first of month") return "monthly_first_9";
  return null;
}

/** Next occurrence strictly after `from`, in UTC. */
export function nextRunAfter(kind: ScheduleKind, from: Date): Date {
  const d = new Date(from.getTime());
  d.setUTCSeconds(0, 0);
  switch (kind) {
    case "hourly": {
      d.setUTCMinutes(0);
      d.setUTCHours(d.getUTCHours() + 1);
      return d;
    }
    case "daily_9": {
      d.setUTCMinutes(0);
      d.setUTCHours(9);
      if (d.getTime() <= from.getTime()) d.setUTCDate(d.getUTCDate() + 1);
      return d;
    }
    case "weekly_monday_9": {
      d.setUTCMinutes(0);
      d.setUTCHours(9);
      const daysToMonday = (1 - d.getUTCDay() + 7) % 7;
      d.setUTCDate(d.getUTCDate() + daysToMonday);
      if (d.getTime() <= from.getTime()) d.setUTCDate(d.getUTCDate() + 7);
      return d;
    }
    case "monthly_first_9": {
      d.setUTCMinutes(0);
      d.setUTCHours(9);
      d.setUTCDate(1);
      if (d.getTime() <= from.getTime()) d.setUTCMonth(d.getUTCMonth() + 1, 1);
      return d;
    }
  }
}
