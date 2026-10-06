import type { Insight } from "@/lib/data";

/** Where an insight links (page-19 Flow 1: Home → Behavior Detail I2). */
export function behaviorKeyOf(i: Insight): string | null {
  const a = i.action;
  if (!a) return null;
  if (a.type === "assign_coaching" || a.type === "open_behavior") return a.behaviorKey;
  return null;
}

export function evidenceCallIds(i: Insight): string[] {
  const fromAction = i.action?.type === "review_calls" ? i.action.callIds : [];
  return [...new Set([...i.evidence.map((e) => e.callId), ...fromAction])];
}

export function insightRoutes(i: Insight) {
  const behaviorKey = behaviorKeyOf(i);
  return {
    behavior: behaviorKey !== null,
    assignSearch:
      i.action?.type === "assign_coaching"
        ? { repId: i.action.repId, behaviorKey: i.action.behaviorKey }
        : undefined,
  };
}
