import { isInsightSufficient, type Brief, type Insight, type Viewer } from "@/lib/data";
export type Delivery = "email" | "push" | "print";
export const deliveryKind = {
  email: "daily_manager",
  push: "daily_rep",
  print: "weekly_manager",
} as const;
export function canReadDelivery(viewer: Viewer, delivery: Delivery) {
  return (
    delivery === "push" ? ["rep", "manager", "owner", "admin"] : ["manager", "owner", "admin"]
  ).includes(viewer.role);
}
export function matchesDelivery(brief: Brief, viewer: Viewer, delivery: Delivery) {
  if (!canReadDelivery(viewer, delivery) || brief.kind !== deliveryKind[delivery]) return false;
  if (delivery === "push") return brief.subjectId === viewer.id;
  return viewer.role !== "manager" || (!!viewer.team && brief.subjectId === viewer.team.id);
}
/** Brief lacks the closed-deal sample required to publish outcome claims. */
export function deliveryInsightAllowed(insight: Insight, viewer: Viewer, delivery: Delivery) {
  if (
    !isInsightSufficient(insight) ||
    !Number.isFinite(insight.callsAnalyzed) ||
    !Number.isFinite(insight.sampleSize) ||
    insight.sampleSize <= 0
  )
    return false;
  if (!["low", "medium", "high"].includes(insight.confidence)) return false;
  const text = `${insight.headline} ${insight.body ?? ""} ${insight.sampleLabel ?? ""}`;
  if (/\b(won|wins?|win rates?|closed|outcomes?|lost deals?)\b/i.test(text)) return false;
  if (insight.causalTested !== true && /\bcaus(e|ed|es|ing)\b/i.test(text)) return false;
  if (delivery === "push")
    return (
      insight.kind !== "pattern" &&
      insight.affectedRepIds.length === 1 &&
      insight.affectedRepIds[0] === viewer.id &&
      !/\b(team|peers?|rank(?:ing)?s?|top performers?|other reps?)\b/i.test(insight.headline)
    );
  return true;
}
