import type { Behavior, Methodology } from "@/lib/data";
/** A global catalog entry must never make an unrelated rule accessible in a methodology. */
export function findMethodologyBehavior(
  methodology: Methodology,
  catalog: Behavior[],
  key: string,
): Behavior | undefined {
  const member = methodology.behaviors.find((item) => item.key === key);
  if (!member || (member.methodologyId !== null && member.methodologyId !== methodology.id))
    return undefined;
  const item = catalog.find(
    (item) =>
      item.key === key && (item.methodologyId === null || item.methodologyId === methodology.id),
  );
  return item ? member : undefined;
}
const labels: Record<string, string> = {
  event: "EVENT",
  measure: "MEASURE",
  during: "DURING",
  per: "PER",
};
const values: Record<string, string> = {
  gap_seconds: "Gap in seconds",
  talk_ratio: "Talk ratio",
  objection: "Objection",
  interruption: "Interruption",
  question: "Question",
  topic: "Topic",
};
export function ruleDescription(rule: Record<string, unknown>): [string, string][] {
  const rows = Object.entries(rule)
    .filter(([key, value]) => key in labels && typeof value === "string")
    .map(([key, value]): [string, string] => [
      labels[key],
      values[value as string] ?? String(value),
    ]);
  return rows.length ? rows : [["RULE", "Rule details unavailable"]];
}

export const templateLabels: Record<Methodology["template"], string> = {
  meddic: "MEDDIC",
  spin: "SPIN",
  challenger: "Challenger",
  sandler: "Sandler",
  bant: "BANT",
  custom: "Blank",
};
