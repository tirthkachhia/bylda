import { cn } from "@/components/bylda";
import type { Sparkline } from "@/lib/data";

/**
 * LocalSparkline — fold-into-kit (LANE_REQUESTS.md #29). The kit has no sparkline yet.
 *
 * Plots on the series' OWN fixed y-range (`yMin`–`yMax` from the data layer), never
 * auto-scaled, so a steady rep looks steady (CLAUDE.md §4 — "fix in build, mockups
 * auto-scale"). Colour comes from `tone`, which encodes behavioral direction only.
 */
export type SparkTone = "improve" | "regress" | "neutral" | "on-dark";

const TONE: Record<SparkTone, string> = {
  improve: "text-by-signal-improve",
  regress: "text-by-signal-regress",
  neutral: "text-by-text-tertiary",
  "on-dark": "text-by-text-on-dark",
};

export function LocalSparkline({
  sparkline,
  tone = "neutral",
  target,
  targetLabel,
  className,
}: {
  sparkline: Sparkline;
  tone?: SparkTone;
  /** Optional goal line, on the same fixed y-range. */
  target?: number | null;
  targetLabel?: string;
  /** Size it with width/height utilities (e.g. `h-4 w-[120px]`). */
  className?: string;
}) {
  const { points, yMin, yMax } = sparkline;
  const span = yMax - yMin || 1;
  const y = (v: number) => 100 - (Math.min(Math.max(v, yMin), yMax) - yMin) * (100 / span);
  const x = (i: number) => (points.length > 1 ? (i * 100) / (points.length - 1) : 50);
  const path = points.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const targetY = target === null || target === undefined ? null : y(target);

  const plot = (
    <span className={cn("relative block", TONE[tone], className)}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        role="img"
        aria-label={`Trend: ${points.join(", ")}`}
      >
        {targetY !== null ? (
          <line
            x1="0"
            x2="100"
            y1={targetY}
            y2={targetY}
            stroke="currentColor"
            strokeOpacity={0.5}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            className="text-by-signal-improve"
          />
        ) : null}
        {points.length > 0 ? (
          <polyline
            points={path}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
    </span>
  );
  if (!targetLabel || targetY === null) return plot;
  return (
    <span className="flex flex-col gap-1">
      <span className="type-mono-micro self-end text-by-signal-improve">{targetLabel}</span>
      {plot}
    </span>
  );
}
