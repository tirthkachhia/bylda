import { Link } from "@tanstack/react-router";
import { Tag, TrendChart, cn } from "@/components/bylda";
import type { TeamBehaviorRow } from "@/lib/data";
import { I8_TAG } from "../shared/tabsModel";

const COLS = "grid grid-cols-[minmax(200px,1fr)_110px_100px_100px] items-center";

const TONE_TEXT = {
  improving: "text-by-signal-improve",
  regressing: "text-by-signal-regress",
  steady: "text-by-text-secondary",
} as const;

/**
 * I8 WHERE THE PROCESS BREAKS (Figma 51:3167): the methodology's required behaviors, with the
 * team's current value, its trend on the behavior's fixed range (§4) and the direction tag.
 * GAP: Figma's STAGE column — a Behavior carries no stage (LANE_REQUESTS L1-4) — so it is not
 * drawn rather than drawn as a column of dashes. DONE is the team value as the data layer labels
 * it, since not every required behavior is a done/not-done rate.
 */
export function ProcessTable({
  rows,
  methodologyName,
}: {
  rows: TeamBehaviorRow[];
  methodologyName: string;
}) {
  return (
    <section
      aria-label="Where the process breaks"
      className="w-full overflow-x-auto rounded-by-card border border-by-border-engraved bg-by-surface-raised"
    >
      <div className="min-w-[560px]">
        <header className="flex items-center gap-2 border-b border-by-border-engraved px-4 py-3">
          <h2 className="type-ui-label flex-1 text-by-text-primary">WHERE THE PROCESS BREAKS</h2>
          <span className="type-mono-micro text-by-text-tertiary">{methodologyName}</span>
        </header>
        <div
          className={cn(
            COLS,
            "type-mono-micro border-b border-by-border-engraved bg-by-surface-inset px-4 py-[9px] text-by-text-tertiary",
          )}
        >
          <span>REQUIRED BEHAVIOR</span>
          <span>DONE</span>
          <span>TREND</span>
          <span />
        </div>
        {rows.map((r) => {
          const tag = I8_TAG[r.direction];
          return (
            <Link
              key={r.behaviorKey}
              to="/app/intelligence/behaviors/$behaviorKey"
              params={{ behaviorKey: r.behaviorKey }}
              className={cn(
                COLS,
                "border-b border-by-border-engraved px-4 py-2.5 transition-colors duration-200 ease-out last:border-b-0 hover:bg-by-surface-hover",
              )}
            >
              <span className="type-ui-small pr-2 text-by-text-primary">{r.name}</span>
              <span className="type-mono-data pr-2 text-by-text-secondary">{r.valueLabel}</span>
              <TrendChart
                series={r.sparkline}
                width={80}
                height={16}
                strokeWidth={1.5}
                pad={1.5}
                className={TONE_TEXT[r.direction]}
              />
              <span className="flex items-start">
                <Tag tone={tag.tone}>{tag.label}</Tag>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
