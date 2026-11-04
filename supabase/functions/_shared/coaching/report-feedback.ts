/** Reviewer corrections remain separate from immutable model observations. */
export function reportBehaviorAllowed(
  event: { confidence: string; opportunity: string; result: string },
  reviews: {
    reviewed_by: string;
    accuracy: string;
    usefulness: string;
    created_at: string;
    id: string;
  }[],
  confidenceFloor: string,
): boolean {
  if (event.opportunity !== "eligible" || event.result === "unobservable") return false;
  if (
    event.confidence !== "high" &&
    !(confidenceFloor === "medium" && event.confidence === "medium")
  )
    return false;
  const latest = new Map<string, (typeof reviews)[number]>();
  for (const r of [...reviews].sort(
    (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
  ))
    if (!latest.has(r.reviewed_by)) latest.set(r.reviewed_by, r);
  return [...latest.values()].every((r) => r.accuracy === "accurate" && r.usefulness === "useful");
}
