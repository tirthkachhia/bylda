import { Link } from "@tanstack/react-router";
import {
  Button,
  DataBoundary,
  SkeletonBar,
  SkeletonBlock,
  StateError,
  SystemState,
} from "@/components/bylda";
import { useOutcomeAssociations } from "@/lib/data";
import { OutcomeMatrix } from "./matrix/OutcomeMatrix";
import { IntelligenceFrame, RestrictedState } from "./shared/IntelligenceFrame";
import { isForbidden } from "./shared/model";
import { OUTCOME_MIN_CLOSED, buildMatrix, matrixHasValues } from "./shared/outcomes";

const EYEBROW = "INTELLIGENCE · OUTCOME PATTERNS";

/**
 * I5 · Behavior × Outcome matrix
 * Figma 28:641 (page 1:9) · Lane 1 — Ansh · route /app/intelligence/matrix
 *
 * Which behaviors show up alongside which outcomes. Each cell is the difference in outcome rate
 * between calls with and without the behavior; under ~30 closed outcomes the cell is grey and
 * says so. Association only — the copy never says "caused". Manager-only (the hook refuses a
 * rep → restricted state). Hook: useOutcomeAssociations.
 * GAP: Figma's team / date-range selectors — the hook takes neither (LANE_REQUESTS L1-3).
 */
export function I5BehaviorXOutcomeMatrix() {
  const associations = useOutcomeAssociations();

  if (isForbidden(associations)) {
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
        <span>OUTCOME PATTERNS</span>
      </nav>

      <header className="flex items-end gap-3 max-[1024px]:flex-col max-[1024px]:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h1 className="type-editorial-h1 text-by-text-primary">
            Which behaviors show up alongside which outcomes
          </h1>
          <p className="type-ui-small text-by-text-secondary">
            Each cell: difference in outcome rate between calls with and without the behavior. Grey
            = not enough data. Associations only.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link to="/app/intelligence/graph">See the outcome graph</Link>
        </Button>
      </header>

      <DataBoundary
        query={associations}
        loading={<MatrixSkeleton />}
        error={() => (
          <StateError
            eyebrow={EYEBROW}
            body="Bylda couldn’t load the outcome associations. Your calls are safe — try again."
            onRetry={() => void associations.refetch()}
          />
        )}
        empty={<NoAssociations />}
      >
        {(rows) => {
          const matrix = buildMatrix(rows);
          return (
            <>
              <OutcomeMatrix rows={matrix} />
              {matrixHasValues(matrix) ? null : (
                <p className="type-ui-small text-by-text-secondary">
                  No cell has enough closed outcomes yet.
                </p>
              )}
              <aside className="flex flex-col gap-1 rounded-by-card border border-by-border-engraved bg-by-surface-inset px-4 py-3">
                <p className="type-mono-micro text-by-text-tertiary">READING THIS</p>
                <p className="type-ui-small text-by-text-primary">
                  Colour = a better (green) or worse (red) outcome, read the other way round for
                  closed-lost. Only gaps of 5 points or more at Medium confidence or better are
                  coloured. Every cell shows its confidence and n. A cell needs at least{" "}
                  {OUTCOME_MIN_CLOSED} closed outcomes before Bylda shows a number — grey cells
                  aren’t there yet.
                </p>
              </aside>
            </>
          );
        }}
      </DataBoundary>
    </IntelligenceFrame>
  );
}

function NoAssociations() {
  return (
    <SystemState
      eyebrow={EYEBROW}
      tag={{ tone: "attention", label: "Low evidence" }}
      title="Not enough calls yet to compare behaviors with outcomes."
      body={`Bylda needs ~${OUTCOME_MIN_CLOSED} calls with and without a behavior, plus outcomes from your CRM.`}
    />
  );
}

/** Static skeleton — "NO SHIMMER THEATRICS" (Y13). */
function MatrixSkeleton() {
  return (
    <div className="flex w-full flex-col gap-3" aria-busy="true" aria-label="Loading matrix">
      <SkeletonBar width={320} height={14} />
      <SkeletonBlock height={320} className="rounded-by-card" />
    </div>
  );
}
