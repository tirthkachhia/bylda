// Schedule math for the Builder's "Scheduled Time" trigger (trigger_schedule).
// Parses the preset strings the block stores (automation-blocks.ts) and
// computes when the automation runs next. All times are UTC — there is no
// per-org timezone yet, so every label says so honestly.
//
// Mirrored for the dispatcher at supabase/functions/_shared/schedule.ts —
// keep the two files in sync.

export type ScheduleKind = "hourly" | "daily_9" | "weekly_monday_9" | "monthly_first_9";

/**
 * Normalize a stored schedule string to a kind. "Custom" and anything
 * unrecognized return null — those cannot auto-run, and the UI says so
 * instead of silently never firing.
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

/** Plain-words description of when a schedule runs, or null for custom/unknown. */
export function describeSchedule(raw: string | null | undefined): string | null {
  switch (parseSchedule(raw)) {
    case "hourly":
      return "every hour, on the hour";
    case "daily_9":
      return "every day at 9:00 UTC";
    case "weekly_monday_9":
      return "every Monday at 9:00 UTC";
    case "monthly_first_9":
      return "on the 1st of each month at 9:00 UTC";
    default:
      return null;
  }
}

/** Compact "in 3h" / "in 25m" / "in 2d" until `at`; "any minute now" once due. */
export function formatUntil(at: Date, now: Date = new Date()): string {
  const mins = Math.round((at.getTime() - now.getTime()) / 60_000);
  if (mins <= 1) return "any minute now";
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}
