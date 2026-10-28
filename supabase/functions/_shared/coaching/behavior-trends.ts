export type BehaviorSample = {
  id: string;
  call_id: string;
  occurred_at: string;
  scope: string | null;
  eligible: boolean;
  reviewed: boolean;
  result: "strength" | "concern" | "mixed" | "unobservable";
};
export type BehaviorTrend = {
  state: "improving" | "degrading" | "unchanged" | "insufficient_evidence";
  current: { successful: number; judged: number; calls: number };
  previous: { successful: number; judged: number; calls: number };
  scope: string | null;
};
/** Descriptive behavior-frequency comparison, never a claim that coaching caused change. */
export function behaviorTrend(samples: BehaviorSample[], now: number): BehaviorTrend {
  const day = 86400_000,
    cut = now - 30 * day,
    start = now - 60 * day;
  const groups = new Map<string, { current: BehaviorSample[]; previous: BehaviorSample[] }>();
  for (const s of samples) {
    const at = Date.parse(s.occurred_at);
    if (
      !s.scope ||
      !s.eligible ||
      !s.reviewed ||
      s.result === "unobservable" ||
      !Number.isFinite(at) ||
      at < start ||
      at >= now
    )
      continue;
    const g = groups.get(s.scope) ?? { current: [], previous: [] };
    (at >= cut ? g.current : g.previous).push(s);
    groups.set(s.scope, g);
  }
  const count = (rows: BehaviorSample[]) => ({
    successful: rows.filter((s) => s.result === "strength").length,
    judged: rows.length,
    calls: new Set(rows.map((s) => s.call_id)).size,
  });
  const candidates = [...groups.entries()]
    .map(([scope, g]) => ({ scope, current: count(g.current), previous: count(g.previous) }))
    .filter(
      (g) =>
        g.current.judged >= 5 &&
        g.previous.judged >= 5 &&
        g.current.calls >= 3 &&
        g.previous.calls >= 3,
    )
    .sort(
      (a, b) =>
        Math.min(b.current.judged, b.previous.judged) -
        Math.min(a.current.judged, a.previous.judged),
    );
  if (!candidates.length)
    return { state: "insufficient_evidence", current: count([]), previous: count([]), scope: null };
  const best = candidates[0],
    delta =
      best.current.successful / best.current.judged -
      best.previous.successful / best.previous.judged;
  return {
    ...best,
    state: Math.abs(delta) < 0.2 ? "unchanged" : delta > 0 ? "improving" : "degrading",
  };
}
