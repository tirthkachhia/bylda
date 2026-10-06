import { cn } from "./cn";

/** A series on a FIXED y-range (CLAUDE.md §4: a steady rep looks steady). Never auto-scaled. */
export type TrendSeries = { points: number[]; yMin: number; yMax: number };

/**
 * Trend chart — solid line = measured, dashed continuation = projected, both on the series'
 * fixed y-range. With no `projected` it is a plain sparkline (set `width`/`height` small).
 * Stroke is currentColor: colour it with a signal text utility at the call site. Pass `label`
 * for a standalone chart; without it the SVG is decorative.
 */
export function TrendChart({
  series,
  projected = [],
  label,
  width = 300,
  height = 120,
  strokeWidth = 2,
  pad = 4,
  className,
}: {
  series: TrendSeries;
  /** Points continuing the series, drawn dashed. Supplied by the data layer, never extrapolated here. */
  projected?: number[];
  label?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  pad?: number;
  className?: string;
}) {
  const { points, yMin, yMax } = series;
  if (points.length < 2 || yMax <= yMin) return null;
  const total = points.length + projected.length;
  const x = (i: number) => pad + (i / (total - 1)) * (width - pad * 2);
  const y = (v: number) => {
    const c = Math.min(yMax, Math.max(yMin, v));
    return pad + (1 - (c - yMin) / (yMax - yMin)) * (height - pad * 2);
  };
  const measured = points.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const dashed = [points[points.length - 1], ...projected]
    .map((v, i) => `${x(points.length - 1 + i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0", className)}
    >
      <polyline
        points={measured}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {projected.length > 0 ? (
        <polyline
          points={dashed}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray="4 4"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}
