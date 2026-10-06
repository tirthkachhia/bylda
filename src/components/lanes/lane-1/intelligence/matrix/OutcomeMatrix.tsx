import { Link } from "@tanstack/react-router";
import { cn } from "@/components/bylda";
import {
  CONFIDENCE_LABEL,
  MATRIX_COLUMNS,
  OUTCOME_MIN_CLOSED,
  percent,
  type MatrixCell,
  type MatrixRow,
  type MatrixTone,
} from "../shared/outcomes";

const TONE: Record<MatrixTone, string> = {
  improve: "bg-by-signal-improve-bg text-by-signal-improve",
  regress: "bg-by-signal-regress-bg text-by-signal-regress",
  neutral: "bg-by-surface-raised text-by-text-secondary",
};

/** What a hover / screen reader gets: both rates, both counts, the confounders. Association only. */
function describe(c: Extract<MatrixCell, { kind: "value" }>): string {
  const base = `${percent(c.withRate)} with the behavior vs ${percent(c.withoutRate)} without · ${c.nWith} with, ${c.nWithout} without · ${c.nClosed} closed`;
  return c.confounders.length ? `${base} · adjust for: ${c.confounders.join(", ")}` : base;
}

function Cell({ cell }: { cell: MatrixCell }) {
  if (cell.kind === "none") {
    return (
      <div className="flex h-full flex-col gap-0.5 bg-by-surface-inset px-2.5 py-3 text-by-text-tertiary">
        <span className="type-mono-data">—</span>
        {/* Same two-line height as every other cell, so a row's tints line up. */}
        <span className="type-mono-micro" aria-hidden="true">
          &nbsp;
        </span>
      </div>
    );
  }
  if (cell.kind === "insufficient") {
    return (
      <div className="flex h-full flex-col gap-0.5 bg-by-surface-inset px-2.5 py-3 text-by-text-tertiary">
        <span className="type-mono-data">n too small</span>
        <span className="type-mono-micro">
          n = {cell.nClosed} of {OUTCOME_MIN_CLOSED}
        </span>
      </div>
    );
  }
  return (
    <div
      title={describe(cell)}
      className={cn("flex h-full flex-col gap-0.5 px-2.5 py-3", TONE[cell.tone])}
    >
      <span className="type-mono-data">{cell.label}</span>
      <span className="type-mono-micro text-by-text-secondary">
        {CONFIDENCE_LABEL[cell.confidence]} · n = {cell.nClosed}
      </span>
    </div>
  );
}

/**
 * I5 grid (Figma 28:743): one row per behavior, one column per outcome, each cell the difference
 * in outcome rate between calls with and without the behavior, in points.
 * - Under 30 closed outcomes the number is hidden ("n too small", §4).
 * - Colour is direction only, and only at Medium confidence or better with a gap of 5 points or
 *   more; closed-lost is read the other way round (fewer losses is better).
 * - Confidence + n sit in every cell. Figma shows them on hover only; a hover can't be read on
 *   touch or by a screen reader (LANE_REQUESTS L1-3).
 */
export function OutcomeMatrix({ rows }: { rows: MatrixRow[] }) {
  return (
    <div className="overflow-hidden rounded-by-card border border-by-border-engraved bg-by-surface-raised">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead>
            <tr className="type-mono-micro border-b border-by-border-engraved bg-by-surface-inset text-by-text-tertiary">
              <th scope="col" className="w-[260px] px-4 py-[11px] font-medium">
                BEHAVIOR ↓ &nbsp; OUTCOME →
              </th>
              {MATRIX_COLUMNS.map((c) => (
                <th key={c.outcome} scope="col" className="px-2.5 py-[11px] font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.behaviorKey}
                className="border-b border-by-border-engraved last:border-b-0"
              >
                <th scope="row" className="px-4 py-0 text-left font-normal">
                  <Link
                    to="/app/intelligence/behaviors/$behaviorKey"
                    params={{ behaviorKey: row.behaviorKey }}
                    className="type-ui-small text-by-text-primary hover:underline"
                  >
                    {row.behaviorName}
                  </Link>
                </th>
                {row.cells.map((cell, i) => (
                  <td
                    key={MATRIX_COLUMNS[i].outcome}
                    className="h-full border-l border-by-surface-raised p-0"
                  >
                    <Cell cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
