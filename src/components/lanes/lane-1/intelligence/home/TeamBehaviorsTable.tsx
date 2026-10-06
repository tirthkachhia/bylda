import { Link } from "@tanstack/react-router";
import { DirectionTag, TrendChart, cn } from "@/components/bylda";
import type { OutcomeAssociation, TeamBehaviorRow } from "@/lib/data";
import { associatedWith } from "../shared/model";

/** Rows I1 shows of the tracked behaviors (Figma "12 tracked · 5 shown"). */
export const SHOWN_BEHAVIORS = 5;

const COLS = "grid grid-cols-[170px_100px_90px_100px_130px_minmax(96px,1fr)] items-center";

/**
 * TEAM BEHAVIORS (Figma 27:463): behavior · team now · 30-day change · trend · associated with
 * · direction. Every number is a display string from the data layer. Sparklines share a fixed
 * y-range per behavior (§4); "associated with" is association language only, and an
 * OutcomeAssociation under n_closed 30 is never summarised (§4).
 */
export function TeamBehaviorsTable({
  rows,
  outcomes,
}: {
  rows: TeamBehaviorRow[];
  /** undefined while loading or failed: the cell shows "—", never a guess. */
  outcomes: OutcomeAssociation[] | undefined;
}) {
  const shown = rows.slice(0, SHOWN_BEHAVIORS);
  return (
    <section
      aria-label="Team behaviors"
      className="w-full overflow-x-auto rounded-by-card border border-by-border-engraved bg-by-surface-raised"
    >
      <div className="min-w-[712px]">
        <header className="flex items-center gap-2 border-b border-by-border-engraved px-4 py-3">
          <h2 className="type-ui-label flex-1 text-by-text-primary">TEAM BEHAVIORS</h2>
          <span className="type-mono-micro text-by-text-tertiary">
            {rows.length} tracked · {shown.length} shown
          </span>
        </header>
        <div
          className={cn(
            COLS,
            "type-mono-micro border-b border-by-border-engraved bg-by-surface-inset px-4 py-[9px] text-by-text-tertiary",
          )}
        >
          <span>BEHAVIOR</span>
          <span>TEAM NOW</span>
          <span>30-DAY CHANGE</span>
          <span>TREND</span>
          <span>ASSOCIATED WITH</span>
          <span />
        </div>
        {shown.map((r) => (
          <Link
            key={r.behaviorKey}
            to="/app/intelligence/behaviors/$behaviorKey"
            params={{ behaviorKey: r.behaviorKey }}
            className={cn(
              COLS,
              "border-b border-by-border-engraved px-4 py-2.5 transition-colors duration-200 ease-out last:border-b-0 hover:bg-by-surface-hover",
            )}
          >
            <span className="type-ui-body-strong pr-2 text-by-text-primary">{r.name}</span>
            <span className="type-mono-data text-by-text-secondary">{r.valueLabel}</span>
            <span
              className={cn(
                "type-mono-data",
                r.direction === "improving" && "text-by-signal-improve",
                r.direction === "regressing" && "text-by-signal-regress",
                r.direction === "steady" && "text-by-text-secondary",
              )}
            >
              {r.changeLabel}
            </span>
            <TrendChart
              series={r.sparkline}
              width={88}
              height={16}
              strokeWidth={1.5}
              pad={1.5}
              className={cn(
                r.direction === "improving" && "text-by-signal-improve",
                r.direction === "regressing" && "text-by-signal-regress",
                r.direction === "steady" && "text-by-text-secondary",
              )}
            />
            <span className="type-ui-small pr-2 text-by-text-primary">
              {outcomes
                ? associatedWith(outcomes.filter((o) => o.behaviorKey === r.behaviorKey))
                : "—"}
            </span>
            <span className="flex items-start">
              <DirectionTag direction={r.direction} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
