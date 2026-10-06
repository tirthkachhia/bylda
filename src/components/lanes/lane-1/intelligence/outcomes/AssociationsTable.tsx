import { Link } from "@tanstack/react-router";
import { cn } from "@/components/bylda";
import { isOutcomeSufficient, type OutcomeAssociation } from "@/lib/data";
import {
  CONFIDENCE_LABEL,
  MATRIX_COLUMNS,
  OUTCOME_LABEL,
  OUTCOME_MIN_CLOSED,
  cellTone,
  gapPoints,
  percent,
  pointsLabel,
} from "../shared/outcomes";

const COLS = "grid grid-cols-[minmax(170px,1fr)_112px_64px_70px_76px_104px_76px] items-center";

const TONE_TEXT = {
  improve: "text-by-signal-improve",
  regress: "text-by-signal-regress",
  neutral: "text-by-text-secondary",
} as const;

const LOWER_IS_BETTER = new Map(MATRIX_COLUMNS.map((c) => [c.outcome, c.lowerIsBetter]));

/**
 * I9 BEHAVIOR ↔ OUTCOME (Figma 51:2097) — associations only. One row per association: the
 * outcome rate in calls WITH the behavior and WITHOUT it, the gap, and confidence + n.
 * Under ~30 closed outcomes the numbers are hidden and the row says how far it has to go (§4).
 * The gap is coloured only at Medium+ confidence and ≥ 5 points (same rule as I5).
 * GAP: Figma's WON / LOST columns are how often the behavior appears in won vs lost deals;
 * `OutcomeAssociation` is the outcome rate with vs without the behavior (LANE_REQUESTS L1-4).
 */
export function AssociationsTable({ rows }: { rows: OutcomeAssociation[] }) {
  return (
    <section
      aria-label="Behavior and outcome associations"
      className="w-full overflow-x-auto rounded-by-card border border-by-border-engraved bg-by-surface-raised"
    >
      <div className="min-w-[680px]">
        <header className="flex items-center gap-2 border-b border-by-border-engraved px-4 py-3">
          <h2 className="type-ui-label flex-1 text-by-text-primary">BEHAVIOR ↔ OUTCOME</h2>
          <span className="type-mono-micro text-by-text-tertiary">associations only</span>
        </header>
        <div
          className={cn(
            COLS,
            "type-mono-micro border-b border-by-border-engraved bg-by-surface-inset px-4 py-[9px] text-by-text-tertiary",
          )}
        >
          <span>BEHAVIOR SEEN IN…</span>
          <span>OUTCOME</span>
          <span>WITH</span>
          <span>WITHOUT</span>
          <span>GAP</span>
          <span>CONF.</span>
          <span />
        </div>
        {rows.map((r) => (
          <Row key={`${r.behaviorKey}-${r.outcome}`} row={r} />
        ))}
      </div>
    </section>
  );
}

function Row({ row: r }: { row: OutcomeAssociation }) {
  const ok = isOutcomeSufficient(r);
  const points = gapPoints(r);
  const tone = cellTone(points, r.confidence, LOWER_IS_BETTER.get(r.outcome) ?? false);
  return (
    <div
      className={cn(
        COLS,
        "border-b border-by-border-engraved px-4 py-2.5 last:border-b-0",
        !ok && "bg-by-surface-inset",
      )}
      title={
        r.confounders.length > 0 ? `Possible confounders: ${r.confounders.join(", ")}` : undefined
      }
    >
      <span className="type-ui-body-strong pr-2 text-by-text-primary">{r.behaviorName}</span>
      <span className="type-ui-small pr-2 text-by-text-secondary">{OUTCOME_LABEL[r.outcome]}</span>
      {ok ? (
        <>
          <span className="type-mono-data text-by-text-secondary">{percent(r.withRate)}</span>
          <span className="type-mono-data text-by-text-secondary">{percent(r.withoutRate)}</span>
          <span className={cn("type-mono-data", TONE_TEXT[tone])}>{pointsLabel(points)}</span>
        </>
      ) : (
        <span className="type-mono-micro col-span-3 text-by-text-tertiary">
          NOT ENOUGH DATA · {r.nClosed}/{OUTCOME_MIN_CLOSED} CLOSED
        </span>
      )}
      <span className="type-mono-data text-by-text-secondary">
        {CONFIDENCE_LABEL[r.confidence]} · n={r.nClosed}
      </span>
      <Link
        to="/app/intelligence/behaviors/$behaviorKey"
        params={{ behaviorKey: r.behaviorKey }}
        className="type-ui-small text-by-text-primary hover:underline"
      >
        See calls
      </Link>
    </div>
  );
}
