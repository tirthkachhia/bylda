import { cn } from "./cn";

/**
 * Confidence (4:66) — REQUIRED on every insight, always paired with sample size.
 * Low = observe only, never recommend an action (InsightCard enforces this).
 */
export type ConfidenceLevel = "low" | "medium" | "high";

const FILLED: Record<ConfidenceLevel, number> = { low: 1, medium: 2, high: 3 };

export function ConfidenceMeter({
  level,
  sampleSize,
  sampleLabel,
  className,
}: {
  level: ConfidenceLevel;
  /** n — shown next to the meter when given. */
  sampleSize?: number;
  /** e.g. "6 objections · 4 calls". Defaults to "n = {sampleSize}". */
  sampleLabel?: string;
  className?: string;
}) {
  const filled = FILLED[level];
  return (
    <span className={cn("inline-flex items-center gap-4", className)}>
      <span className="inline-flex items-center gap-1.5" aria-label={`Confidence ${level}`}>
        <span className="inline-flex gap-0.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "h-2.5 w-[3px]",
                i < filled ? "bg-by-surface-rail-active" : "bg-by-border-engraved",
              )}
            />
          ))}
        </span>
        <span className="type-mono-micro text-by-text-secondary">
          CONFIDENCE {level.toUpperCase()}
        </span>
      </span>
      {sampleSize !== undefined ? (
        <span className="type-mono-micro text-by-text-secondary">
          {sampleLabel ?? `n = ${sampleSize}`}
        </span>
      ) : null}
    </span>
  );
}
