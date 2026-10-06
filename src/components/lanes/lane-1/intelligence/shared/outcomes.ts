import {
  isOutcomeSufficient,
  OUTCOME_MIN_CLOSED,
  type Confidence,
  type ObjectionStat,
  type OutcomeAssociation,
} from "@/lib/data";

/** Pure logic for I4 (objections), I5 (behavior × outcome matrix) and I6 (outcome graph). */

type Outcome = OutcomeAssociation["outcome"];

/**
 * I5 columns, in funnel order. `lowerIsBetter` flips the colour: fewer losses is the good side.
 * GAP: Figma also draws "Objection resurfaced" and "Cycle length"; `OutcomeAssociation.outcome`
 * has neither (LANE_REQUESTS L1-3), so they are not columns until the type does.
 */
export const MATRIX_COLUMNS: { outcome: Outcome; label: string; lowerIsBetter: boolean }[] = [
  { outcome: "next_step_booked", label: "NEXT STEP BOOKED", lowerIsBetter: false },
  { outcome: "advanced", label: "STAGE ADVANCED", lowerIsBetter: false },
  { outcome: "won", label: "CLOSED-WON", lowerIsBetter: false },
  { outcome: "lost", label: "CLOSED-LOST", lowerIsBetter: true },
];

export const OUTCOME_LABEL: Record<Outcome, string> = {
  next_step_booked: "Next step booked",
  advanced: "Stage advanced",
  won: "Closed-won",
  lost: "Closed-lost",
};

/** A rate gap under this many points is noise, not an association. */
export const NOISE_POINTS = 5;

/** Rate difference in whole percentage points: with the behavior minus without it. */
export const gapPoints = (r: Pick<OutcomeAssociation, "withRate" | "withoutRate">) =>
  Math.round((r.withRate - r.withoutRate) * 100);

/** "+18 pts", "−9 pts", "0 pts" — a real minus sign so the column lines up in mono. */
export const pointsLabel = (points: number) =>
  `${points > 0 ? "+" : points < 0 ? "−" : ""}${Math.abs(points)} pts`;

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "HIGH",
  medium: "MED",
  low: "LOW",
};

export type MatrixTone = "improve" | "regress" | "neutral";

export type MatrixCell =
  /** No association row for this pair at all. */
  | { kind: "none" }
  /** A row exists but fewer than 30 closed outcomes back it (§4): hide the number. */
  | { kind: "insufficient"; nClosed: number }
  | {
      kind: "value";
      points: number;
      label: string;
      tone: MatrixTone;
      confidence: Confidence;
      nClosed: number;
      nWith: number;
      nWithout: number;
      withRate: number;
      withoutRate: number;
      confounders: string[];
    };

export type MatrixRow = { behaviorKey: string; behaviorName: string; cells: MatrixCell[] };

/**
 * Colour only when the gap clears the noise floor at Medium confidence or better, and then only
 * by direction: better outcome = improve, worse = regress. Low confidence stays uncoloured.
 */
export function cellTone(
  points: number,
  confidence: Confidence,
  lowerIsBetter: boolean,
): MatrixTone {
  if (confidence === "low" || Math.abs(points) < NOISE_POINTS) return "neutral";
  const better = lowerIsBetter ? points < 0 : points > 0;
  return better ? "improve" : "regress";
}

function toCell(r: OutcomeAssociation, lowerIsBetter: boolean): MatrixCell {
  if (!isOutcomeSufficient(r)) return { kind: "insufficient", nClosed: r.nClosed };
  const points = gapPoints(r);
  return {
    kind: "value",
    points,
    label: pointsLabel(points),
    tone: cellTone(points, r.confidence, lowerIsBetter),
    confidence: r.confidence,
    nClosed: r.nClosed,
    nWith: r.nWith,
    nWithout: r.nWithout,
    withRate: r.withRate,
    withoutRate: r.withoutRate,
    confounders: r.confounders,
  };
}

/**
 * I5 grid: one row per behavior (first-seen order), one cell per column. When a behavior has
 * two rows for the same outcome, the one backed by more closed outcomes wins.
 */
export function buildMatrix(rows: OutcomeAssociation[]): MatrixRow[] {
  const order: string[] = [];
  const byBehavior = new Map<string, { name: string; rows: OutcomeAssociation[] }>();
  for (const r of rows) {
    const entry = byBehavior.get(r.behaviorKey);
    if (entry) entry.rows.push(r);
    else {
      order.push(r.behaviorKey);
      byBehavior.set(r.behaviorKey, { name: r.behaviorName, rows: [r] });
    }
  }
  return order.map((key) => {
    const { name, rows: own } = byBehavior.get(key)!;
    return {
      behaviorKey: key,
      behaviorName: name,
      cells: MATRIX_COLUMNS.map(({ outcome, lowerIsBetter }) => {
        const best = own
          .filter((r) => r.outcome === outcome)
          .sort((a, b) => b.nClosed - a.nClosed)[0];
        return best ? toCell(best, lowerIsBetter) : ({ kind: "none" } as const);
      }),
    };
  });
}

/** True when at least one cell has enough closed outcomes to show a number. */
export const matrixHasValues = (rows: MatrixRow[]) =>
  rows.some((r) => r.cells.some((c) => c.kind === "value"));

/**
 * I6 live edge: the behavior → outcome association with the biggest gap, from rows that cleared
 * n_closed 30 at Medium confidence or better. Null when nothing qualifies — the graph then says
 * so instead of drawing a link.
 */
export function strongestAssociation(rows: OutcomeAssociation[]): OutcomeAssociation | null {
  return (
    rows
      .filter((r) => isOutcomeSufficient(r) && r.confidence !== "low")
      .filter((r) => Math.abs(gapPoints(r)) >= NOISE_POINTS)
      .sort(
        (a, b) => Math.abs(gapPoints(b)) - Math.abs(gapPoints(a)) || b.nClosed - a.nClosed,
      )[0] ?? null
  );
}

export type ObjectionSummary = {
  /** Every objection counted across the rows. */
  total: number;
  /** Objections per analyzed call, one decimal. Null until the team's analyzed count is known. */
  perCall: number | null;
  /** Count-weighted "handled well" rate over the rows that have one. Null when none do. */
  handledRate: number | null;
  /** How many objections that rate rests on. */
  handledOf: number;
  /** The most common objection and its share of all objections. */
  top: { label: string; share: number } | null;
};

/**
 * I4 top strip, derived only from the rows. Figma's PRICE SHARE, RESURFACED LATER and "vs Aug"
 * deltas have no field behind them (LANE_REQUESTS L1-3) so they are not drawn.
 */
export function summarizeObjections(
  stats: ObjectionStat[],
  analyzedCalls: number | null,
): ObjectionSummary {
  const total = stats.reduce((n, s) => n + s.count, 0);
  const rated = stats.filter((s) => s.handledWellRate != null);
  const handledOf = rated.reduce((n, s) => n + s.count, 0);
  const handledRate =
    handledOf > 0
      ? rated.reduce((n, s) => n + s.count * (s.handledWellRate ?? 0), 0) / handledOf
      : null;
  const top = [...stats].sort((a, b) => b.count - a.count)[0];
  return {
    total,
    perCall:
      analyzedCalls != null && analyzedCalls > 0
        ? Math.round((total / analyzedCalls) * 10) / 10
        : null,
    handledRate,
    handledOf,
    top: top && total > 0 ? { label: top.label, share: top.count / total } : null,
  };
}

export const percent = (rate: number) => `${Math.round(rate * 100)}%`;

export { OUTCOME_MIN_CLOSED };
