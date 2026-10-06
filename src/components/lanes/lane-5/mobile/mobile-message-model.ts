import { isInsightSufficient, type Insight } from "@/lib/data";
export function visibleInsight(i: Insight, viewer: { id: string; role: string }) {
  return (
    isInsightSufficient(i) &&
    (viewer.role !== "rep" ||
      (i.kind !== "pattern" && i.affectedRepIds.length === 1 && i.affectedRepIds[0] === viewer.id))
  );
}
