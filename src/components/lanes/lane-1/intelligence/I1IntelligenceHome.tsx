import { Link } from "@tanstack/react-router";
import {
  DataBoundary,
  SkeletonBar,
  SkeletonBlock,
  StateError,
  SystemState,
  systemStates,
} from "@/components/bylda";
import {
  useInsights,
  useObjectionStats,
  useOutcomeAssociations,
  usePatterns,
  useTeam,
  useTeamBehaviors,
  useViewer,
} from "@/lib/data";
import { ImportantCard } from "./home/ImportantCard";
import { PatternsPanel } from "./home/PatternsPanel";
import { TeamBehaviorsTable } from "./home/TeamBehaviorsTable";
import { IntelligenceFrame, IntelligenceTabs, RestrictedState } from "./shared/IntelligenceFrame";
import { NotEnoughCalls } from "./shared/NotEnoughCalls";
import { belowPatternFloor, importantToday, isForbidden, isOpenPattern } from "./shared/model";

const EYEBROW = "INTELLIGENCE · IMPORTANT TODAY";

/**
 * I1 · Intelligence Home
 * Figma 27:298 (page 1:9) · Lane 1 — Ansh · route /app/intelligence
 *
 * What Bylda has learned about how the team sells: the most important team-wide insights, then
 * the team-behaviors table; the context panel holds the pattern lifecycle and the open
 * patterns. Manager-only — the pattern, behavior and outcome hooks refuse a rep (→ restricted
 * state). Below ~50 analyzed team calls it shows the "not enough calls" state instead of any
 * pattern. Hooks: useInsights, usePatterns (+ useTeamBehaviors, useObjectionStats,
 * useOutcomeAssociations, useTeam, useViewer).
 */
export function I1IntelligenceHome() {
  const viewer = useViewer();
  const team = useTeam(viewer.data?.team?.id ?? "");
  const insights = useInsights();
  const patterns = usePatterns();
  const behaviors = useTeamBehaviors();
  const objections = useObjectionStats();
  const outcomes = useOutcomeAssociations();

  const forbidden = isForbidden(patterns, behaviors, objections, outcomes);
  const analyzed = team.data?.analyzedCalls ?? null;
  const tooFew = belowPatternFloor(analyzed);
  const important = importantToday(insights.data ?? []);
  const open = (patterns.data ?? []).filter(isOpenPattern);

  const teamName = viewer.data?.team?.name ?? team.data?.name ?? null;
  const eyebrow = [
    "INTELLIGENCE",
    teamName?.toUpperCase(),
    "LAST 30 DAYS",
    analyzed != null ? `${analyzed} ${analyzed === 1 ? "CALL" : "CALLS"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // A rep gets the restricted state alone — no heading, tabs or team context around it.
  if (forbidden) {
    return (
      <IntelligenceFrame>
        <RestrictedState eyebrow={EYEBROW} />
      </IntelligenceFrame>
    );
  }

  return (
    <IntelligenceFrame>
      <header className="flex flex-col gap-1.5">
        <p className="type-mono-micro text-by-text-tertiary">{eyebrow}</p>
        <h1 className="type-editorial-h1 text-by-text-primary">
          What Bylda has learned about how your team sells.
        </h1>
      </header>

      <IntelligenceTabs
        counts={
          tooFew
            ? {}
            : {
                today: insights.data ? important.length : null,
                patterns: patterns.data ? open.length : null,
                behaviors: behaviors.data?.length ?? null,
                objections: objections.data?.length ?? null,
              }
        }
      />

      {tooFew ? (
        <NotEnoughCalls eyebrow={EYEBROW} analyzed={analyzed ?? 0} />
      ) : (
        <>
          <DataBoundary
            query={insights}
            loading={<CardsSkeleton />}
            error={() => (
              <StateError
                eyebrow={EYEBROW}
                body="Bylda couldn’t load today’s insights. Your calls are safe — try again."
                onRetry={() => void insights.refetch()}
              />
            )}
            empty={<SystemState {...systemStates.noPatternYet()} />}
          >
            {() =>
              important.length === 0 ? (
                <SystemState {...systemStates.noPatternYet()} />
              ) : (
                <>
                  <ImportantCard insight={important[0]} hero />
                  {important.length > 1 ? (
                    <div className="flex items-stretch gap-5 max-[1024px]:flex-col">
                      {important.slice(1).map((i) => (
                        <ImportantCard key={i.id} insight={i} />
                      ))}
                    </div>
                  ) : null}
                </>
              )
            }
          </DataBoundary>

          <DataBoundary
            query={behaviors}
            loading={<SkeletonBlock height={220} className="rounded-by-card" />}
            error={() => (
              <StateError
                body="Bylda couldn’t load the team behaviors."
                onRetry={() => void behaviors.refetch()}
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
            {(rows) => <TeamBehaviorsTable rows={rows} outcomes={outcomes.data} />}
          </DataBoundary>

          <PatternsPanel open={open} loading={patterns.isLoading} failed={!!patterns.error} />
        </>
      )}
    </IntelligenceFrame>
  );
}

/** Static skeleton — "NO SHIMMER THEATRICS" (Y13). */
function CardsSkeleton() {
  return (
    <div className="flex w-full flex-col gap-3" aria-busy="true" aria-label="Loading insights">
      <div className="flex w-full flex-col gap-3 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-[18px] py-4">
        <SkeletonBar width={220} height={10} />
        <SkeletonBar width="80%" height={22} />
        <SkeletonBar width="55%" height={12} />
      </div>
      <SkeletonBlock height={110} className="rounded-by-card" />
    </div>
  );
}
