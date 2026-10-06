import type { ReactNode } from "react";
import { cn } from "@/components/bylda";

/**
 * The list vocabulary of Manager Home tabs H2–H6 (Figma 43:692 · 43:1176 · 43:1673 · 43:2142 ·
 * 43:2615): a section label over a raised, hairline card of rows. Figma draws these cards at 12px;
 * CLAUDE.md §13.5 overrides it — cards are 10px (`rounded-by-card`), always.
 */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="type-ui-label text-by-text-secondary">{children}</p>;
}

export function ListCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2.5 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-4 py-3.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Rows inside a `ListCard` — pass `divide-y divide-by-border-engraved gap-0` on the card. */
export function ListRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex items-center gap-3 py-2.5", className)}>{children}</div>;
}

export const ROW_LIST = "gap-0 divide-y divide-by-border-engraved";
