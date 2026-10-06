import { Button, ConfidenceMeter, cn, type TagTone } from "@/components/bylda";
import { patternShowsConfidence, type Pattern } from "@/lib/data";
import { STATUS_LABEL } from "./model";
import { PATTERN_GLYPH_TONE, callsLabel } from "./tabsModel";

const GLYPH: Record<TagTone, string> = {
  improve: "text-by-signal-improve",
  regress: "text-by-signal-regress",
  attention: "text-by-signal-attention",
  info: "text-by-signal-info",
  neutral: "text-by-text-secondary",
};

export type PatternCardAction = {
  label: string;
  variant?: "primary" | "secondary";
  onClick: () => void;
};

/**
 * Pattern card on the Intelligence tabs (Figma 51:2081 · 51:2458 · 51:2818 · 51:3231):
 * mono eyebrow with a direction glyph → the pattern in Editorial/Insight → confidence + n →
 * actions. Every rule from §4 holds here, whatever the caller passes:
 *  - confidence + n always render, unless the pattern has no live evidence (resolved / 0 calls),
 *    which is said in words instead of a meter;
 *  - Low confidence (or no live evidence) = observation only: no action renders.
 */
export function PatternCard({
  pattern,
  eyebrow,
  sampleLabel,
  actions = [],
  className,
}: {
  pattern: Pattern;
  eyebrow: string;
  /** "38 calls", "7 first calls". Defaults to "N calls". */
  sampleLabel?: string;
  actions?: PatternCardAction[];
  className?: string;
}) {
  const live = patternShowsConfidence(pattern);
  const tone: TagTone = pattern.status ? PATTERN_GLYPH_TONE[pattern.status] : "neutral";
  const canAct = live && pattern.confidence !== "low";

  return (
    <article
      className={cn(
        "animate-by-resolve flex min-w-0 flex-col items-start gap-2.5 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-[18px] py-4",
        className,
      )}
    >
      <p className="type-mono-micro flex items-center gap-2 text-by-text-secondary">
        <svg
          width="10"
          height="9"
          viewBox="0 0 10 9"
          aria-hidden
          className={cn("shrink-0", GLYPH[tone])}
        >
          <path d="M5 0.5 9.3 8.5H0.7Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        {eyebrow}
      </p>
      <h2 className="type-editorial-insight text-by-text-primary">{pattern.headline}</h2>

      {live ? (
        <ConfidenceMeter
          level={pattern.confidence}
          sampleSize={pattern.sampleSize}
          sampleLabel={sampleLabel ?? callsLabel(pattern.sampleSize)}
        />
      ) : (
        <p className="type-mono-micro text-by-text-tertiary">
          NO LIVE EVIDENCE —{" "}
          {pattern.status ? STATUS_LABEL[pattern.status].toUpperCase() : "NO CALLS"}
        </p>
      )}

      {!canAct ? (
        live ? (
          <p className="type-mono-micro text-by-text-tertiary">
            OBSERVATION ONLY — LOW CONFIDENCE, NO ACTION RECOMMENDED
          </p>
        ) : null
      ) : actions.length > 0 ? (
        <div className="flex flex-wrap items-start gap-2">
          {actions.map((a) => (
            <Button key={a.label} variant={a.variant ?? "secondary"} onClick={a.onClick}>
              {a.label}
            </Button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
