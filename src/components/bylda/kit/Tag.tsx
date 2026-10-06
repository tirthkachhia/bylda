import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Tag (4:34). Colour ONLY encodes behavioral direction — never decorative.
 * Improve / Regress / Attention / Info use the signal pairs; Neutral is white + hairline.
 */
export type TagTone = "improve" | "regress" | "attention" | "info" | "neutral";

const TONE: Record<TagTone, string> = {
  improve: "bg-by-signal-improve-bg text-by-signal-improve",
  regress: "bg-by-signal-regress-bg text-by-signal-regress",
  attention: "bg-by-signal-attention-bg text-by-signal-attention",
  info: "bg-by-signal-info-bg text-by-signal-info",
  neutral: "bg-by-surface-raised text-by-text-secondary border border-by-border-control",
};

export function Tag({
  tone = "neutral",
  children,
  className,
}: {
  tone?: TagTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "type-mono-micro inline-flex items-center whitespace-nowrap rounded-by-pill px-2 py-[3px]",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Direction → tag, with the Figma arrows. */
export function DirectionTag({ direction }: { direction: "improving" | "regressing" | "steady" }) {
  if (direction === "improving") return <Tag tone="improve">↑ Improving</Tag>;
  if (direction === "regressing") return <Tag tone="regress">↓ Regressing</Tag>;
  return <Tag tone="neutral">Steady</Tag>;
}
