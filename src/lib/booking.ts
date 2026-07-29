/**
 * Booking availability math — pure, framework-free so it's unit-testable and
 * shared between the public booking page and any future scheduling UI.
 */

/** The next `count` calendar days (excluding today) whose weekday is allowed. */
export function nextDays(count: number, allowed: number[], from: Date = new Date()): Date[] {
  const out: Date[] = [];
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  let guard = 0;
  while (out.length < count && guard < 366) {
    guard++;
    d.setDate(d.getDate() + 1);
    if (allowed.includes(d.getDay())) out.push(new Date(d));
  }
  return out;
}

/**
 * Discrete start times on `day` between `start` and `end` (HH:MM 24h), each
 * `duration` minutes long, such that the slot fits fully before `end`.
 */
export function slotsFor(day: Date, start: string, end: string, duration: number): Date[] {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n)) || duration <= 0) return [];
  const out: Date[] = [];
  const cur = new Date(day);
  cur.setHours(sh, sm, 0, 0);
  const stop = new Date(day);
  stop.setHours(eh, em, 0, 0);
  while (cur.getTime() + duration * 60_000 <= stop.getTime() + 1) {
    out.push(new Date(cur));
    cur.setMinutes(cur.getMinutes() + duration);
  }
  return out;
}
