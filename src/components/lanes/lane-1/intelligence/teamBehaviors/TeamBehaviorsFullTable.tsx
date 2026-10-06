import { Link } from "@tanstack/react-router";
import { Tag, TrendChart, cn } from "@/components/bylda";
import { useBehaviorDetail, type TeamBehaviorRow } from "@/lib/data";
import { I7_TAG, bestAndNeedsWork, detailFor } from "../shared/tabsModel";

const COLS = "grid grid-cols-[minmax(170px,1fr)_96px_70px_90px_80px_80px_72px] items-center";

const TONE_TEXT = {
  improving: "text-by-signal-improve",
  regressing: "text-by-signal-regress",
  steady: "text-by-text-secondary",
} as const;

/**
 * I7 table (Figma 51:1682): every tracked behavior — team now · change · trend · best · needs
 * work · direction. Every number is a display string from the data layer; sparklines share a
 * fixed y-range per behavior (§4). A row opens Behavior Detail (I2), as the panel note says.
 * Manager-only: BEST / NEEDS WORK name reps, and the hooks behind them refuse a rep.
 */
export function TeamBehaviorsFullTable({
  rows,
  methodologyName,
}: {
  rows: TeamBehaviorRow[];
  /** "from MEDDIC — Mid-Market". Null until the methodology loads (or if there is none). */
  methodologyName: string | null;
}) {
  return (
    <section
      aria-label="Team behaviors"
      className="w-full overflow-x-auto rounded-by-card border border-by-border-engraved bg-by-surface-raised"
    >
      <div className="min-w-[712px]">
        <header className="flex items-center gap-2 border-b border-by-border-engraved px-4 py-3">
          <h2 className="type-ui-label flex-1 text-by-text-primary">
            {rows.length} {rows.length === 1 ? "BEHAVIOR" : "BEHAVIORS"} TRACKED
          </h2>
          {methodologyName ? (
            <span className="type-mono-micro text-by-text-tertiary">from {methodologyName}</span>
          ) : null}
        </header>
        <div
          className={cn(
            COLS,
            "type-mono-micro border-b border-by-border-engraved bg-by-surface-inset px-4 py-[9px] text-by-text-tertiary",
          )}
        >
          <span>BEHAVIOR</span>
          <span>TEAM</span>
          <span>CHANGE</span>
          <span>TREND</span>
          <span>BEST</span>
          <span>NEEDS WORK</span>
          <span />
        </div>
        {rows.map((r) => (
          <Row key={r.behaviorKey} row={r} />
        ))}
      </div>
    </section>
  );
}

function Row({ row: r }: { row: TeamBehaviorRow }) {
  // GAP: TeamBehaviorRow has no best / needs-work rep (LANE_REQUESTS L1-4). The fixture models
  // them as the top and bottom of BehaviorDetail.byRep, so each row reads its own detail.
  const detail = useBehaviorDetail(r.behaviorKey);
  const ends = bestAndNeedsWork(detailFor(detail.data, r.behaviorKey));
  const tag = I7_TAG[r.direction];
  return (
    <Link
      to="/app/intelligence/behaviors/$behaviorKey"
      params={{ behaviorKey: r.behaviorKey }}
      className={cn(
        COLS,
        "border-b border-by-border-engraved px-4 py-2.5 transition-colors duration-200 ease-out last:border-b-0 hover:bg-by-surface-hover",
      )}
    >
      <span className="type-ui-body-strong pr-2 text-by-text-primary">{r.name}</span>
      <span className="type-mono-data pr-2 text-by-text-secondary">{r.valueLabel}</span>
      <span className={cn("type-mono-data", TONE_TEXT[r.direction])}>{r.changeLabel}</span>
      <TrendChart
        series={r.sparkline}
        width={80}
        height={16}
        strokeWidth={1.5}
        pad={1.5}
        className={TONE_TEXT[r.direction]}
      />
      <span className="type-ui-small pr-2 text-by-text-primary">{ends?.best ?? "—"}</span>
      <span className="type-ui-small pr-2 text-by-text-primary">{ends?.needsWork ?? "—"}</span>
      <span className="flex items-start">
        <Tag tone={tag.tone}>{tag.label}</Tag>
      </span>
    </Link>
  );
}
