import { ContextPanel, SkeletonBar } from "@/components/bylda";
import { useBehaviorDetail, type TeamBehaviorRow } from "@/lib/data";
import { detailFor, distribution } from "../shared/tabsModel";

/** Widest bar, px (Figma 51:1805 — the fullest band). */
const BAR_MAX = 102;

/**
 * I7 context panel (Figma 51:1656): DISTRIBUTION · <behavior> — the team's reps in four bands
 * across the behavior's fixed range — then the "click any behavior" note. Names reps, so it is
 * manager-only like the rest of the page (useBehaviorDetail refuses a rep).
 * The behavior shown is the first regressing one (Figma's pick reads that way); the panel has no
 * picker of its own because a row click opens Behavior Detail.
 */
export function DistributionPanel({ target }: { target: TeamBehaviorRow | null }) {
  return (
    <ContextPanel>
      <div className="flex flex-col gap-[18px]">
        {target ? <Bands target={target} /> : null}
        <aside className="flex flex-col gap-1 rounded-by-card border border-by-border-engraved bg-by-surface-inset px-4 py-3">
          <p className="type-mono-micro text-by-text-tertiary">CLICK ANY BEHAVIOR</p>
          <p className="type-ui-small text-by-text-primary">
            Opens Behavior Detail: definition, trend by rep, outcome association, examples to copy
            and avoid.
          </p>
        </aside>
      </div>
    </ContextPanel>
  );
}

function Bands({ target }: { target: TeamBehaviorRow }) {
  const q = useBehaviorDetail(target.behaviorKey);
  const detail = detailFor(q.data, target.behaviorKey);
  const bands = detail ? distribution(detail) : [];
  const most = Math.max(1, ...bands.map((b) => b.reps.length));

  return (
    <section aria-label={`Distribution of ${target.name}`} className="flex flex-col gap-[18px]">
      <h2 className="type-ui-label text-by-text-primary">
        DISTRIBUTION · {target.name.toUpperCase()}
      </h2>
      {q.isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading distribution">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBar key={i} width="80%" height={10} />
          ))}
        </div>
      ) : q.error ? (
        <p className="type-ui-small text-by-text-secondary">
          Bylda couldn’t load the spread for this behavior.
        </p>
      ) : bands.every((b) => b.reps.length === 0) ? (
        <p className="type-ui-small text-by-text-secondary">
          No per-rep breakdown for this behavior yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-[18px]">
          {bands.map((b) => (
            <li key={b.label} className="flex items-center gap-2 py-1.5">
              <span className="type-mono-data w-[60px] shrink-0 text-by-text-secondary">
                {b.label}
              </span>
              <span
                aria-hidden
                className="h-2.5 shrink-0 rounded-by-bar bg-by-surface-rail-active"
                // Width is the band's share of reps — data, not a design value.
                style={{ width: (b.reps.length / most) * BAR_MAX }}
              />
              <span className="type-ui-small min-w-0 flex-1 text-by-text-primary">
                {b.reps.length > 0 ? b.reps.join(" · ") : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
