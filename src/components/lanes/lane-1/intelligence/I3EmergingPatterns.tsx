import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  DataBoundary,
  SkeletonBar,
  SkeletonBlock,
  StateError,
  SystemState,
  systemStates,
  cn,
} from "@/components/bylda";
import {
  useInsights,
  usePatterns,
  useTeam,
  useTeamMembers,
  useViewer,
  type Pattern,
  type PatternStatus,
} from "@/lib/data";
import { PatternsTable } from "./patterns/PatternsTable";
import { SelectedPanel } from "./patterns/SelectedPanel";
import { IntelligenceFrame, RestrictedState } from "./shared/IntelligenceFrame";
import { NotEnoughCalls } from "./shared/NotEnoughCalls";
import {
  STATUS_LABEL,
  belowPatternFloor,
  countByStatus,
  insightForPattern,
  isForbidden,
} from "./shared/model";

const EYEBROW = "INTELLIGENCE · PATTERNS";
const FILTERS: PatternStatus[] = ["emerging", "confirmed", "fading", "resolved"];
type Filter = "all" | PatternStatus;

/**
 * I3 · Emerging Patterns
 * Figma 27:567 (page 1:9) · Lane 1 — Ansh · route /app/intelligence/patterns
 *
 * Recurring behaviors across calls or reps, with how sure Bylda is and who they affect. A status
 * filter over a patterns table; selecting a row fills the context panel. Manager-only (the hook
 * refuses a rep → restricted state); below ~50 analyzed team calls it shows the "not enough
 * calls" state. Low-confidence patterns are shown to watch, with no coaching action. Hooks:
 * usePatterns (+ useInsights, useTeamMembers, useTeam, useViewer).
 */
export function I3EmergingPatterns() {
  const viewer = useViewer();
  const team = useTeam(viewer.data?.team?.id ?? "");
  const patterns = usePatterns();
  const insights = useInsights();
  const members = useTeamMembers();
  const [filter, setFilter] = useState<Filter>("all");
  const [pickedId, setPickedId] = useState<string | null>(null);

  const forbidden = isForbidden(patterns);
  const analyzed = team.data?.analyzedCalls ?? null;
  const tooFew = belowPatternFloor(analyzed);
  const repNames = new Map((members.data ?? []).map((p) => [p.id, p.name]));

  // A rep gets the restricted state alone — no heading or breadcrumb around it.
  if (forbidden) {
    return (
      <IntelligenceFrame>
        <RestrictedState eyebrow={EYEBROW} />
      </IntelligenceFrame>
    );
  }

  return (
    <IntelligenceFrame>
      <nav
        aria-label="Breadcrumb"
        className="type-mono-micro flex gap-2 whitespace-pre text-by-text-tertiary"
      >
        <Link to="/app/intelligence" className="hover:text-by-text-primary">
          INTELLIGENCE
        </Link>
        <span>/</span>
        <span>PATTERNS</span>
      </nav>

      <header className="flex flex-col gap-1.5">
        <h1 className="type-editorial-h1 text-by-text-primary">Patterns</h1>
        <p className="type-ui-small text-by-text-secondary">
          Recurring behaviors across calls or reps, with how sure Bylda is and who they affect.
        </p>
      </header>

      {tooFew ? (
        <NotEnoughCalls eyebrow={EYEBROW} analyzed={analyzed ?? 0} />
      ) : (
        <DataBoundary
          query={patterns}
          loading={<TableSkeleton />}
          error={() => (
            <StateError
              eyebrow={EYEBROW}
              body="Bylda couldn’t load the patterns. Your calls are safe — try again."
              onRetry={() => void patterns.refetch()}
            />
          )}
          empty={<SystemState {...systemStates.noPatternYet()} />}
        >
          {(all) => {
            const counts = countByStatus(all);
            const shown = filter === "all" ? all : all.filter((p) => p.status === filter);
            // Default selection: the first pattern with a selected-view, else the first row.
            const selected: Pattern | null =
              shown.find((p) => p.id === pickedId) ??
              shown.find((p) => p.selected) ??
              shown[0] ??
              null;
            return (
              <>
                <div
                  role="tablist"
                  aria-label="Pattern status"
                  className="flex w-full items-start gap-[18px] overflow-x-auto border-b border-by-border-engraved"
                >
                  <FilterTab
                    active={filter === "all"}
                    label="All"
                    count={all.length}
                    onClick={() => setFilter("all")}
                  />
                  {FILTERS.map((s) => (
                    <FilterTab
                      key={s}
                      active={filter === s}
                      label={STATUS_LABEL[s]}
                      count={counts[s]}
                      onClick={() => setFilter(s)}
                    />
                  ))}
                </div>

                {shown.length === 0 ? (
                  <p className="type-ui-small text-by-text-secondary">
                    No{" "}
                    {filter === "all"
                      ? ""
                      : `${STATUS_LABEL[filter as PatternStatus].toLowerCase()} `}
                    patterns right now.
                  </p>
                ) : (
                  <PatternsTable
                    patterns={shown}
                    selectedId={selected?.id ?? null}
                    onSelect={setPickedId}
                    repNames={repNames}
                  />
                )}

                <aside className="flex flex-col gap-1 rounded-by-card border border-by-border-engraved bg-by-surface-inset px-4 py-3">
                  <p className="type-mono-micro text-by-text-tertiary">LOW-CONFIDENCE PATTERNS</p>
                  <p className="type-ui-small text-by-text-primary">
                    Shown so managers can watch them, but have no “assign coaching” action until
                    confidence reaches Medium.
                  </p>
                </aside>

                {selected ? (
                  <SelectedPanel
                    pattern={selected}
                    insight={insightForPattern(selected, insights.data ?? [])}
                    repNames={repNames}
                  />
                ) : null}
              </>
            );
          }}
        </DataBoundary>
      )}
    </IntelligenceFrame>
  );
}

function FilterTab({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "-mb-px flex shrink-0 items-start gap-1.5 border-b-[1.5px] py-2 transition-colors duration-200 ease-out",
        active
          ? "type-ui-body-strong border-by-text-primary text-by-text-primary"
          : "type-ui-body border-transparent text-by-text-secondary hover:text-by-text-primary",
      )}
    >
      <span>{label}</span>
      <span className="type-mono-micro text-by-text-tertiary">{count}</span>
    </button>
  );
}

/** Static skeleton — "NO SHIMMER THEATRICS" (Y13). */
function TableSkeleton() {
  return (
    <div className="flex w-full flex-col gap-3" aria-busy="true" aria-label="Loading patterns">
      <SkeletonBar width={320} height={14} />
      <SkeletonBlock height={260} className="rounded-by-card" />
    </div>
  );
}
