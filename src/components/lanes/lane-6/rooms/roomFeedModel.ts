import { isInsightSufficient, type Message } from "@/lib/data";
export function roomFeedInsightAllowed(message: Message) {
  if (message.block?.type !== "insight") return false;
  const i = message.block.insight;
  return (
    isInsightSufficient(i) &&
    Number.isFinite(i.callsAnalyzed) &&
    Number.isFinite(i.sampleSize) &&
    i.sampleSize > 0 &&
    ["low", "medium", "high"].includes(i.confidence) &&
    !/\b(won|wins?|win rates?|closed|outcomes?|lost deals?)\b/i.test(
      `${i.headline} ${i.body ?? ""} ${i.sampleLabel ?? ""}`,
    ) &&
    (i.causalTested === true ||
      !/\bcaus(e|ed|es|ing)\b/i.test(`${i.headline} ${i.body ?? ""} ${i.sampleLabel ?? ""}`))
  );
}
