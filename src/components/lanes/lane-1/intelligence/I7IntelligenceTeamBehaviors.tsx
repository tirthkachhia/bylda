import { Link } from "@tanstack/react-router";
import { DataBoundary, SkeletonBar, SkeletonBlock, StateError } from "@/components/bylda";
import { useBehaviors, useMethodologies, useTeamBehaviors } from "@/lib/data";
import { IntelligenceFrame, RestrictedState } from "./shared/IntelligenceFrame";
import { NotEnoughCalls } from "./shared/NotEnoughCalls";
import { TabsHeader } from "./shared/TabsHeader";
import { useIntelligenceContext } from "./shared/useIntelligenceContext";
import { isForbidden } from "./shared/model";
import { activeMethodology, distributionTarget } from "./shared/tabsModel";
import { DistributionPanel } from "./teamBehaviors/DistributionPanel";
import { TeamBehaviorsFullTable } from "./teamBehaviors/TeamBehaviorsFullTable";

const EYEBROW = "INTELLIGENCE · TEAM BEHAVIORS";

/**
 * I7 · Intelligence — Team behaviors
 * Figma 51:1420 (page 1:9) · Lane 1 — Ansh · route /app/intelligence/team-behaviors
 *
 * Every behavior the methodology tracks, for the whole team: where it is now, which way it is
 * moving, who does it best and who needs work. The context panel shows how the reps spread across
 * the first regressing behavior. Manager-only (the hooks refuse a rep → restricted state); below
 * ~50 analyzed team calls it shows the "not enough calls" state. Hooks: useTeamBehaviors,
 * useBehaviors (+ useBehaviorDetail per row, useMethodologies, and the shared tab context).
 * Figma lists usePatterns here; the rows are behaviors, so patterns only feed the tab counts.
 */
export function I7IntelligenceTeamBehaviors() {
  const ctx = useIntelligenceContext();
  const rows = useTeamBehaviors();
  const behaviors = useBehaviors();
  const methodologies = useMethodologies();

  if (isForbidden(rows)) {
    return (
      <IntelligenceFrame>
        <RestrictedState eyebrow={EYEBROW} />
      </IntelligenceFrame>
    );
  }

  // Only behaviors that are still switched on are tracked; an unknown key (behaviors not loaded,
  // or a row the catalogue doesn't list) stays in rather than vanishing.
  const disabled = new Set((behaviors.data ?? []).filter((b) => !b.enabled).map((b) => b.key));
  const methodology = activeMethodology(methodologies.data ?? []);

  return (
    <IntelligenceFrame>
      <TabsHeader eyebrow={ctx.eyebrow} counts={ctx.counts} />

      {ctx.tooFew ? (
        <NotEnoughCalls eyebrow={EYEBROW} analyzed={ctx.analyzed ?? 0} />
      ) : (
        <DataBoundary
          query={rows}
          loading={<TableSkeleton />}
          error={() => (
            <StateError
              eyebrow={EYEBROW}
              body="Bylda couldn’t load the team behaviors. Your calls are safe — try again."
              onRetry={() => void rows.refetch()}
            />
          )}
          empty={
            <p className="type-ui-small text-by-text-secondary">
              No behaviors are tracked yet. Turn some on in{" "}
              <Link to="/app/methodology" className="underline">
                Methodology → Behavior rules
              </Link>
              .
            </p>
          }
        >
          {(all) => {
            const tracked = all.filter((r) => !disabled.has(r.behaviorKey));
            return (
              <>
                <TeamBehaviorsFullTable
                  rows={tracked}
                  methodologyName={methodology?.name ?? null}
                />
                <DistributionPanel target={distributionTarget(tracked)} />
              </>
            );
          }}
        </DataBoundary>
      )}
    </IntelligenceFrame>
  );
}

/** Static skeleton — "NO SHIMMER THEATRICS" (Y13). */
function TableSkeleton() {
  return (
    <div className="flex w-full flex-col gap-3" aria-busy="true" aria-label="Loading behaviors">
      <SkeletonBar width={200} height={12} />
      <SkeletonBlock height={360} className="rounded-by-card" />
    </div>
  );
}
