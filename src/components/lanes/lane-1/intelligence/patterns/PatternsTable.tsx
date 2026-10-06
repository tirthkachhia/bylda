import { Tag, cn } from "@/components/bylda";
import type { Pattern } from "@/lib/data";
import { STATUS_LABEL, STATUS_TONE, confidenceCell, repInitials, shortDate } from "../shared/model";

const COLS = "grid grid-cols-[minmax(180px,1fr)_100px_90px_60px_70px_80px] items-center gap-x-2";

/**
 * Patterns table (Figma 27:681): pattern + its rule · lifecycle status · reps · calls · confidence
 * · first seen. A row selects the pattern for the context panel. Every row shows its sample
 * (CALLS) and confidence; a resolved or zero-call pattern shows "—" for confidence (nothing live
 * to be confident about). Reps render as initials: this is a manager-only screen.
 */
export function PatternsTable({
  patterns,
  selectedId,
  onSelect,
  repNames,
}: {
  patterns: Pattern[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  repNames: Map<string, string>;
}) {
  return (
    <section
      aria-label="Patterns"
      className="w-full overflow-x-auto rounded-by-card border border-by-border-engraved bg-by-surface-raised"
    >
      <div className="min-w-[640px]">
        <div
          className={cn(
            COLS,
            "type-mono-micro border-b border-by-border-engraved bg-by-surface-inset px-4 py-[9px] text-by-text-tertiary",
          )}
        >
          <span>PATTERN</span>
          <span>STATUS</span>
          <span>REPS</span>
          <span>CALLS</span>
          <span>CONF.</span>
          <span>FIRST SEEN</span>
        </div>
        {patterns.map((p) => {
          const selected = p.id === selectedId;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(p.id)}
              className={cn(
                COLS,
                "w-full border-b border-by-border-engraved px-4 py-2.5 text-left transition-colors duration-200 ease-out last:border-b-0 hover:bg-by-surface-hover",
                selected && "bg-by-surface-inset",
              )}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="type-ui-body-strong truncate text-by-text-primary">
                  {p.headline}
                </span>
                {p.rule ? (
                  <span className="type-mono-micro truncate text-by-text-tertiary">{p.rule}</span>
                ) : null}
              </span>
              <span className="flex items-start">
                {p.status ? (
                  <Tag tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Tag>
                ) : (
                  <span className="type-mono-data text-by-text-secondary">—</span>
                )}
              </span>
              <span className="type-ui-small text-by-text-primary">
                {repInitials(p.affectedRepIds, repNames).join(" · ") || "—"}
              </span>
              <span className="type-mono-data text-by-text-secondary">{p.sampleSize}</span>
              <span className="type-mono-data text-by-text-secondary">{confidenceCell(p)}</span>
              <span className="type-mono-data text-by-text-secondary">
                {shortDate(p.firstSeenAt)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
