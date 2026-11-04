export function workspaceDateStamp(value: string | number, timeZone: string): string | null {
  try {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    return ["year", "month", "day"]
      .map((key) => parts.find((p) => p.type === key)?.value)
      .join("-");
  } catch {
    return null;
  }
}
export function workspaceWeekStart(
  now: number,
  timeZone: string,
  weekStartsOn: number,
): string | null {
  const stamp = workspaceDateStamp(now, timeZone);
  if (!stamp) return null;
  const day = new Date(`${stamp}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() - weekStartsOn + 7) % 7));
  return day.toISOString().slice(0, 10);
}
