// Manager-language headlines for learning moments, derived from the signals in
// code so every moment has a readable name even before Claude explains it.
// Pure module, shared by the worker, analyze-call, and the UI.
import type { Exchange } from "./exchanges.ts";
import type { LearningMoment } from "./trajectory.ts";

export type MomentSignals = Pick<
  LearningMoment,
  "type" | "delta" | "risk_probability" | "rep_move" | "low_confidence"
>;

/**
 * Short, specific headline. Order matters: a customer who was trying to buy and
 * lost heat is the strongest story, then an explicit risk, then a weak move.
 */
export function momentHeadline(
  m: MomentSignals,
  context: { customerWasHot?: boolean; customerAskedQuestion?: boolean } = {},
): string {
  const risky = (m.risk_probability ?? 0) >= 0.6;
  const weak = m.rep_move !== null && m.rep_move <= 1;
  const bigDrop = m.delta <= -0.75;
  if (m.type === "temperature_drop" || bigDrop) {
    if (context.customerWasHot) return "Customer was ready to move; the rep introduced friction";
    if (risky) return "Customer cooled after a risky statement";
    if (weak) return "Customer cooled after a weak reply";
    return "Customer cooled here";
  }
  if (m.type === "risk_flag" || risky) {
    if (weak) return "Risky statement and a weak reply";
    return "Statement a reviewer would flag";
  }
  if (context.customerAskedQuestion) return "Customer asked; the rep did not build on it";
  return "Weak reply while the customer was open";
}

/** Context flags from the exchange and the one before it, for the headline. */
export function momentContext(
  exchanges: Exchange[],
  index: number,
  temperatureBefore: number | null,
): { customerWasHot: boolean; customerAskedQuestion: boolean } {
  const prev = exchanges[index - 1];
  return {
    customerWasHot: (temperatureBefore ?? 0) >= 1.75,
    customerAskedQuestion: !!prev?.customer?.text?.includes("?"),
  };
}

/** Plain-language verdict for the top of the Scores panel. Numbers only where they carry meaning. */
export function callVerdict(
  summary: {
    coaching_value_label: "low" | "medium" | "high";
    peak_temperature: number;
    final_temperature: number;
    risk_count: number;
    biggest_drop_exchange_index: number | null;
  },
  options: { peakAt?: string; dropAt?: string } = {},
): string {
  const level = (t: number) =>
    ["Cold", "Warm", "Hot", "Critical"][Math.round(Math.min(3, Math.max(0, t)))];
  const parts: string[] = [];
  const lead =
    summary.coaching_value_label === "high"
      ? "Worth reviewing."
      : summary.coaching_value_label === "medium"
        ? "Some coaching value."
        : "Low coaching value.";
  parts.push(lead);
  if (summary.peak_temperature >= 1.75) {
    parts.push(
      `The customer reached ${level(summary.peak_temperature)}${options.peakAt ? ` at ${options.peakAt}` : ""} and the call ended ${level(summary.final_temperature)}.`,
    );
  } else {
    parts.push(`The customer never got past ${level(summary.peak_temperature)}.`);
  }
  if (summary.risk_count > 0)
    parts.push(
      `${summary.risk_count} ${summary.risk_count === 1 ? "statement" : "statements"} a reviewer would flag.`,
    );
  if (summary.biggest_drop_exchange_index !== null && options.dropAt)
    parts.push(`Best moment to coach: ${options.dropAt}.`);
  return parts.join(" ");
}
