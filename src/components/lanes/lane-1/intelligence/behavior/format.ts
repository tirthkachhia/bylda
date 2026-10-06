import type { BehaviorDetail, OutcomeAssociation } from "@/lib/data";

/** Display helpers for Behavior Detail. Pure — formatting only, no data. */

export const formatValue = (v: number, unit: BehaviorDetail["unit"]) => {
  const n = Number.isInteger(v) ? String(v) : v.toFixed(1);
  switch (unit) {
    case "per_call":
      return `${n} / call`;
    case "seconds":
      return `${n} s`;
    case "percent":
      return `${Math.round(v)}%`;
    case "ratio":
      return `${Math.round(v * 100)}%`;
    default:
      return n;
  }
};

export const pct = (rate: number) => `${Math.round(rate * 100)}%`;

/** First → last change of a series, whole percent, signed. null when not computable. */
export function periodChange(points: number[]): string | null {
  if (points.length < 2 || points[0] === 0) return null;
  const c = Math.round(((points[points.length - 1] - points[0]) / Math.abs(points[0])) * 100);
  return `${c > 0 ? "+" : c < 0 ? "−" : ""}${Math.abs(c)}%`;
}

export const OUTCOME_LABEL: Record<OutcomeAssociation["outcome"], string> = {
  next_step_booked: "Next step booked",
  advanced: "Advanced a stage",
  won: "Closed-won",
  lost: "Closed-lost",
};
