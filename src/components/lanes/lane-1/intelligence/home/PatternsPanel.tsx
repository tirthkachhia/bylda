import { Link } from "@tanstack/react-router";
import { ContextPanel, SkeletonBar, Tag } from "@/components/bylda";
import type { Pattern } from "@/lib/data";
import { LIFECYCLE } from "../shared/lifecycle";
import { STATUS_LABEL, STATUS_TONE } from "../shared/model";
import { FactRow } from "../shared/IntelligenceFrame";

/**
 * I1 context panel (Figma 27:389): PATTERN LIFECYCLE legend · OPEN PATTERNS (name + status) ·
 * the language rule. The open list is the data layer's; nothing is typed in.
 */
export function PatternsPanel({
  open,
  loading,
  failed,
}: {
  open: Pattern[];
  loading: boolean;
  failed: boolean;
}) {
  return (
    <ContextPanel>
      <div className="flex flex-col gap-[18px]">
        <section className="flex flex-col gap-2">
          <h2 className="type-ui-label text-by-text-primary">PATTERN LIFECYCLE</h2>
          <div>
            {LIFECYCLE.map((l) => (
              <FactRow key={l.status} label={l.label}>
                {l.rule}
              </FactRow>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-1">
          <header className="flex items-center gap-2">
            <h2 className="type-ui-label flex-1 text-by-text-primary">OPEN PATTERNS</h2>
            {!loading && !failed ? (
              <span className="type-mono-micro text-by-text-tertiary">{open.length}</span>
            ) : null}
          </header>
          {loading ? (
            <div className="flex flex-col gap-3 pt-2" aria-busy="true">
              <SkeletonBar width="80%" height={14} />
              <SkeletonBar width="65%" height={14} />
              <SkeletonBar width="75%" height={14} />
            </div>
          ) : failed ? (
            <p className="type-ui-small pt-2 text-by-text-secondary">
              Bylda couldn’t load the open patterns.
            </p>
          ) : open.length === 0 ? (
            <p className="type-ui-small pt-2 text-by-text-secondary">
              No open patterns. That’s normal for a steady team.
            </p>
          ) : (
            <ul>
              {open.map((p) => (
                <li key={p.id} className="border-b border-by-border-engraved">
                  <Link
                    to="/app/intelligence/patterns"
                    className="flex items-center gap-2 py-2 hover:bg-by-surface-hover"
                  >
                    <span className="type-ui-small min-w-0 flex-1 text-by-text-primary">
                      {p.headline}
                    </span>
                    {p.status ? (
                      <Tag tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Tag>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-1 rounded-by-card border border-by-border-engraved bg-by-surface-inset px-4 py-3">
          <p className="type-mono-micro text-by-text-tertiary">LANGUAGE</p>
          <p className="type-ui-small text-by-text-primary">
            Every pattern here is an association. Bylda marks something “causal” only after a
            coaching change moves both the behavior and the outcome.
          </p>
        </aside>
      </div>
    </ContextPanel>
  );
}
