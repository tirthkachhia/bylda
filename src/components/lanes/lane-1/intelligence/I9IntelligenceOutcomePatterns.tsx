import { useNavigate } from "@tanstack/react-router";
import {
  ContextPanel,
  DataBoundary,
  SkeletonBar,
  SkeletonBlock,
  StateError,
  SystemState,
} from "@/components/bylda";
import { useOutcomeAssociations, usePatterns, type Pattern } from "@/lib/data";
import { AssociationsTable } from "./outcomes/AssociationsTable";
import { IntelligenceFrame, RestrictedState } from "./shared/IntelligenceFrame";
import { NotEnoughCalls } from "./shared/NotEnoughCalls";
import { PatternCard } from "./shared/PatternCard";
import { TabsHeader } from "./shared/TabsHeader";
import { useIntelligenceContext } from "./shared/useIntelligenceContext";
import { isForbidden, isOpenPattern } from "./shared/model";
import { OUTCOME_MIN_CLOSED } from "./shared/outcomes";

const EYEBROW = "INTELLIGENCE · OUTCOME PATTERNS";

/**
 * I9 · Intelligence — Outcome patterns
 * Figma 51:1819 (page 1:9) · Lane 1 — Ansh · route /app/intelligence/outcomes
 *
 * What shows up alongside the outcomes the team cares about: the outcome patterns Bylda has found
 * (each with confidence + n; Low = observation only), then every behavior ↔ outcome association.
 * Association language only — nothing here says "caused". An association under ~30 closed
 * outcomes hides its numbers (§4). Manager-only (the hooks refuse a rep → restricted state);
 * below ~50 analyzed team calls it shows the "not enough calls" state. Hooks: usePatterns,
 * useOutcomeAssociations (+ the shared tab context).
 * GAP (LANE_REQUESTS L1-4): the panel's OUTCOMES IN SCOPE counts (won / lost / advanced /
 * stalled / open) and the cards' category line ("WON vs LOST", "CYCLE LENGTH") have no field.
 */
export function I9IntelligenceOutcomePatterns() {
  const ctx = useIntelligenceContext();
  const patterns = usePatterns("outcome");
  const associations = useOutcomeAssociations();

  if (isForbidden(patterns, associations)) {
    return (
      <IntelligenceFrame>
        <RestrictedState eyebrow={EYEBROW} />
      </IntelligenceFrame>
    );
  }

  return (
    <IntelligenceFrame>
      <TabsHeader eyebrow={ctx.eyebrow} counts={ctx.counts} />

      {ctx.tooFew ? (
        <NotEnoughCalls eyebrow={EYEBROW} analyzed={ctx.analyzed ?? 0} />
      ) : (
        <>
          <DataBoundary
            query={patterns}
            loading={<SkeletonBlock height={150} className="rounded-by-card" />}
            error={() => (
              <StateError
                eyebrow={EYEBROW}
                body="Bylda couldn’t load the outcome patterns. Your calls are safe — try again."
                onRetry={() => void patterns.refetch()}
              />
            )}
            empty={<NoOutcomePattern />}
          >
            {(all) => {
              const open = all.filter(isOpenPattern);
              return open.length > 0 ? <OutcomeCards patterns={open} /> : <NoOutcomePattern />;
            }}
          </DataBoundary>

          <DataBoundary
            query={associations}
            loading={<TableSkeleton />}
            error={() => (
              <StateError
                body="Bylda couldn’t load the behavior ↔ outcome associations."
                onRetry={() => void associations.refetch()}
              />
            )}
            empty={
              <SystemState
                eyebrow={EYEBROW}
                tag={{ tone: "attention", label: "Low evidence" }}
                title="Not enough calls yet to compare behaviors with outcomes."
                body={`Bylda needs ~${OUTCOME_MIN_CLOSED} calls with and without a behavior, plus outcomes from your CRM.`}
              />
            }
          >
            {(rows) => <AssociationsTable rows={rows} />}
          </DataBoundary>

          <ContextPanel>
            <div className="flex flex-col gap-[18px]">
              <aside className="flex flex-col gap-1 rounded-by-card border border-by-border-engraved bg-by-surface-inset px-4 py-3">
                <p className="type-mono-micro text-by-text-tertiary">CONFIDENCE</p>
                <p className="type-ui-small text-by-text-primary">
                  An association needs at least {OUTCOME_MIN_CLOSED} closed outcomes before Bylda
                  shows its numbers. Next-step and stage data fill the gap meanwhile.
                </p>
              </aside>
            </div>
          </ContextPanel>
        </>
      )}
    </IntelligenceFrame>
  );
}

/** Figma 51:2081 + 51:2143: the first pattern full width, the rest two to a row. */
function OutcomeCards({ patterns }: { patterns: Pattern[] }) {
  const navigate = useNavigate();
  const card = (p: Pattern, className?: string) => {
    const behaviorKey = p.behaviorKey;
    return (
      <PatternCard
        key={p.id}
        pattern={p}
        eyebrow="OUTCOME PATTERN"
        className={className}
        actions={
          behaviorKey
            ? [
                {
                  label: "See examples",
                  onClick: () =>
                    void navigate({
                      to: "/app/intelligence/behaviors/$behaviorKey",
                      params: { behaviorKey },
                    }),
                },
              ]
            : []
        }
      />
    );
  };
  const [first, ...rest] = patterns;
  return (
    <>
      {card(first, "w-full")}
      {rest.length > 0 ? (
        <div className="grid grid-cols-2 gap-5 max-[1024px]:grid-cols-1">
          {rest.map((p) => card(p))}
        </div>
      ) : null}
    </>
  );
}

function NoOutcomePattern() {
  return (
    <p className="type-ui-small text-by-text-secondary">
      No outcome pattern yet. Bylda names one when a behavior keeps showing up alongside wins,
      losses or stalls across enough closed deals.
    </p>
  );
}

/** Static skeleton — "NO SHIMMER THEATRICS" (Y13). */
function TableSkeleton() {
  return (
    <div className="flex w-full flex-col gap-3" aria-busy="true" aria-label="Loading associations">
      <SkeletonBar width={200} height={12} />
      <SkeletonBlock height={260} className="rounded-by-card" />
    </div>
  );
}
