import { isInsightSufficient, type Insight, type Message, type Viewer } from "@/lib/data";
export function tabInsightAllowed(i: Insight, viewer: Viewer) {
  if (
    !isInsightSufficient(i) ||
    !Number.isFinite(i.callsAnalyzed) ||
    !Number.isFinite(i.sampleSize) ||
    i.sampleSize <= 0 ||
    !["low", "medium", "high"].includes(i.confidence)
  )
    return false;
  const text = `${i.headline} ${i.body ?? ""} ${i.sampleLabel ?? ""}`;
  if (
    /\b(won|wins?|win rates?|closed|outcomes?|lost deals?)\b/i.test(text) ||
    (i.causalTested !== true && /\bcaus(e|ed|es|ing)\b/i.test(text))
  )
    return false;
  return (
    viewer.role !== "rep" ||
    (i.kind !== "pattern" &&
      i.affectedRepIds.length === 1 &&
      i.affectedRepIds[0] === viewer.id &&
      !/\b(team|peers?|rank(?:ing)?s?|top performers?|other reps?)\b/i.test(i.headline))
  );
}
export function roomAttachments(messages: Message[], roomId: string, type: "call" | "report") {
  return messages.filter(
    (m) => m.roomId === roomId && m.threadId === null && m.block?.type === type,
  );
}
