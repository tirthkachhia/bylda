import type { ReactNode } from "react";
import { cn } from "./cn";
import { ByldaGlyph } from "./ByldaGlyph";
import { ConfidenceMeter, type ConfidenceLevel } from "./ConfidenceMeter";
import { EvidenceBlock, type Evidence } from "./EvidenceBlock";
import { Tag, type TagTone } from "./Tag";
import { Button, type ButtonVariant } from "./Button";

/**
 * Insight Card (4:72) — the atomic unit of Bylda: INSIGHT → EVIDENCE → ACTION.
 *
 * Product rules (CLAUDE.md §4), enforced here so no screen can break them:
 *  - `confidence` and `sampleSize` are REQUIRED props — no insight renders without them.
 *  - `confidence="low"` renders as an observation: actions are NOT shown.
 *  - The word "caused" in the headline/body needs `causalTested` — otherwise the card
 *    renders an "Unverified causal claim" warning tag in dev and logs a warning.
 */
export type InsightKind = "pattern" | "regression" | "improvement" | "call" | "coaching" | "report";

export type InsightAction = {
  label: string;
  variant?: Extract<ButtonVariant, "primary" | "secondary" | "ghost">;
  onClick?: () => void;
  href?: string;
};

export type InsightCardProps = {
  kind: InsightKind;
  headline: string;
  body?: string;
  confidence: ConfidenceLevel;
  sampleSize: number;
  /** e.g. "6 objections · 4 calls". Defaults to "n = {sampleSize}". */
  sampleLabel?: string;
  /** Right-hand timestamp in the header, e.g. "8:04 AM". */
  time?: string;
  tag?: { tone: TagTone; label: string };
  evidence?: Evidence[];
  actions?: InsightAction[];
  /** Must be true for the word "caused" to appear. */
  causalTested?: boolean;
  className?: string;
  children?: ReactNode;
};

const CAUSAL = /\bcaus(e|ed|es|ing)\b/i;

export function InsightCard({
  kind,
  headline,
  body,
  confidence,
  sampleSize,
  sampleLabel,
  time,
  tag,
  evidence = [],
  actions = [],
  causalTested,
  className,
  children,
}: InsightCardProps) {
  const causalViolation =
    !causalTested && (CAUSAL.test(headline) || (body ? CAUSAL.test(body) : false));
  if (causalViolation && import.meta.env.DEV) {
    console.warn(
      `[InsightCard] "${headline}" uses causal language without causalTested — CLAUDE.md §4.`,
    );
  }
  const observationOnly = confidence === "low";

  return (
    <article
      className={cn(
        "animate-by-resolve flex w-full flex-col items-start gap-3.5 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-5 py-[18px]",
        className,
      )}
    >
      <header className="flex w-full items-center gap-2">
        <ByldaGlyph />
        <span className="type-mono-micro text-by-text-secondary">BYLDA · {kind.toUpperCase()}</span>
        <span className="flex-1" />
        {time ? <span className="type-mono-micro text-by-text-tertiary">{time}</span> : null}
      </header>

      <h3 className="type-editorial-insight text-by-text-primary">{headline}</h3>
      {body ? <p className="type-ui-body text-by-text-secondary">{body}</p> : null}

      <div className="flex flex-wrap items-center gap-4">
        <ConfidenceMeter level={confidence} sampleSize={sampleSize} sampleLabel={sampleLabel} />
        {tag ? <Tag tone={tag.tone}>{tag.label}</Tag> : null}
        {causalViolation && import.meta.env.DEV ? (
          <Tag tone="attention">Unverified causal claim</Tag>
        ) : null}
      </div>

      {evidence.map((e, i) => (
        <EvidenceBlock key={`${e.timestamp}-${i}`} evidence={e} />
      ))}

      {children}

      {observationOnly ? (
        <p className="type-mono-micro text-by-text-tertiary">
          OBSERVATION ONLY — LOW CONFIDENCE, NO ACTION RECOMMENDED
        </p>
      ) : actions.length > 0 ? (
        <div className="flex flex-wrap items-start gap-2">
          {actions.map((a, i) =>
            a.href ? (
              <Button
                key={a.label}
                asChild
                variant={a.variant ?? (i === 0 ? "primary" : i === 1 ? "secondary" : "ghost")}
              >
                <a href={a.href}>{a.label}</a>
              </Button>
            ) : (
              <Button
                key={a.label}
                variant={a.variant ?? (i === 0 ? "primary" : i === 1 ? "secondary" : "ghost")}
                onClick={a.onClick}
              >
                {a.label}
              </Button>
            ),
          )}
        </div>
      ) : null}
    </article>
  );
}
