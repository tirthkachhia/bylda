import { Link, useNavigate } from "@tanstack/react-router";
import {
  ContextPanel,
  DataBoundary,
  SkeletonBar,
  SkeletonBlock,
  StateError,
  SystemState,
} from "@/components/bylda";
import {
  useMethodologies,
  usePatterns,
  useTeamBehaviors,
  type Methodology,
  type Pattern,
} from "@/lib/data";
import { ProcessTable } from "./methodology/ProcessTable";
import { FactRow, IntelligenceFrame, RestrictedState } from "./shared/IntelligenceFrame";
import { NotEnoughCalls } from "./shared/NotEnoughCalls";
import { PatternCard } from "./shared/PatternCard";
import { TabsHeader } from "./shared/TabsHeader";
import { useIntelligenceContext } from "./shared/useIntelligenceContext";
import { isForbidden, isOpenPattern } from "./shared/model";
import { activeMethodology, methodologyRows } from "./shared/tabsModel";

const EYEBROW = "INTELLIGENCE · METHODOLOGY";

/**
 * I8 · Intelligence — Methodology adherence
 * Figma 51:2887 (page 1:9) · Lane 1 — Ansh · route /app/intelligence/methodology
 *
 * Where the team's process breaks: the active methodology's required behaviors with the team's
 * value and trend, then the methodology patterns Bylda has found (each with confidence + n; Low
 * = observation only, no action). Manager-only (the hooks refuse a rep → restricted state);
 * below ~50 analyzed team calls it shows the "not enough calls" state. Hooks: usePatterns,
 * useMethodologies (+ useTeamBehaviors and the shared tab context).
 * GAP (LANE_REQUESTS L1-4): Figma's coverage strip (MEDDIC COVERAGE / METRICS / ECONOMIC BUYER
 * / DECISION PROCESS / CHAMPION), the STAGE column and the BY REP coverage panel have no field.
 */
export function I8IntelligenceMethodologyAdherence() {
  const ctx = useIntelligenceContext();
  const methodologies = useMethodologies();
  const rows = useTeamBehaviors();
  const patterns = usePatterns("methodology");

  if (isForbidden(rows, patterns)) {
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
        <DataBoundary
          query={methodologies}
          loading={<Skeleton />}
          error={() => (
            <StateError
              eyebrow={EYEBROW}
              body="Bylda couldn’t load your methodology. Your calls are safe — try again."
              onRetry={() => void methodologies.refetch()}
            />
          )}
          empty={<NoMethodology />}
        >
          {(list) => {
            const m = activeMethodology(list);
            if (!m) return <NoMethodology />;
            return (
              <>
                <DataBoundary
                  query={rows}
                  loading={<SkeletonBlock height={280} className="rounded-by-card" />}
                  error={() => (
                    <StateError
                      body="Bylda couldn’t load the team’s behaviors."
                      onRetry={() => void rows.refetch()}
                    />
                  )}
                  empty={<NothingMeasured methodology={m} />}
                >
                  {(all) => {
                    const required = methodologyRows(m, all);
                    return required.length > 0 ? (
                      <ProcessTable rows={required} methodologyName={m.name} />
                    ) : (
                      <NothingMeasured methodology={m} />
                    );
                  }}
                </DataBoundary>

                <Breakdowns
                  methodology={m}
                  patterns={patterns.data?.filter(isOpenPattern) ?? null}
                  loading={patterns.isLoading}
                  failed={!!patterns.error}
                  onRetry={() => void patterns.refetch()}
                />

                <StagesPanel methodology={m} />
              </>
            );
          }}
        </DataBoundary>
      )}
    </IntelligenceFrame>
  );
}

/** METHODOLOGY BREAKDOWN cards (Figma 51:3231), one per open methodology pattern. */
function Breakdowns({
  methodology,
  patterns,
  loading,
  failed,
  onRetry,
}: {
  methodology: Methodology;
  patterns: Pattern[] | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  if (loading) return <SkeletonBlock height={150} className="rounded-by-card" />;
  if (failed)
    return <StateError body="Bylda couldn’t load the methodology patterns." onRetry={onRetry} />;
  if (!patterns || patterns.length === 0)
    return (
      <p className="type-ui-small text-by-text-secondary">
        No breakdown in the process yet. Bylda flags one when a required behavior drops across
        enough calls to be sure.
      </p>
    );
  return (
    <div className="flex flex-col gap-5">
      {patterns.map((p) => {
        const behaviorKey = p.behaviorKey;
        return (
          <PatternCard
            key={p.id}
            pattern={p}
            eyebrow="METHODOLOGY BREAKDOWN"
            actions={[
              // No team-level focus exists (F-1 "Not added"): G2 opens on the behavior instead.
              ...(behaviorKey
                ? [
                    {
                      label: "Create team focus",
                      variant: "primary" as const,
                      onClick: () =>
                        void navigate({
                          to: "/app/coaching/assign",
                          search: { behaviorKey } as never,
                        }),
                    },
                  ]
                : []),
              {
                label: "Edit methodology",
                onClick: () =>
                  void navigate({
                    to: "/app/methodology/$methodologyId",
                    params: { methodologyId: methodology.id },
                  }),
              },
            ]}
          />
        );
      })}
    </div>
  );
}

/**
 * Context panel. Figma: BY REP · MEDDIC COVERAGE (rep · coverage %). No coverage figure exists
 * per rep (LANE_REQUESTS L1-4), so the panel shows the methodology the table is measured
 * against: its stages in order, and where to change it.
 */
function StagesPanel({ methodology }: { methodology: Methodology }) {
  const stages = [...methodology.stages].sort((a, b) => a.order - b.order);
  return (
    <ContextPanel>
      <div className="flex flex-col gap-[18px]">
        <h2 className="type-ui-label text-by-text-primary">
          STAGES · {methodology.name.toUpperCase()}
        </h2>
        {stages.length > 0 ? (
          <div>
            {stages.map((s, i) => (
              <FactRow key={s.key} label={String(i + 1).padStart(2, "0")}>
                {s.name}
              </FactRow>
            ))}
          </div>
        ) : (
          <p className="type-ui-small text-by-text-secondary">No stages defined yet.</p>
        )}
        <aside className="flex flex-col gap-1 rounded-by-card border border-by-border-engraved bg-by-surface-inset px-4 py-3">
          <p className="type-mono-micro text-by-text-tertiary">BY REP</p>
          <p className="type-ui-small text-by-text-primary">
            Coverage per rep isn’t measured yet. Each behavior’s spread by rep is on its detail
            page.
          </p>
        </aside>
      </div>
    </ContextPanel>
  );
}

function NothingMeasured({ methodology }: { methodology: Methodology }) {
  return (
    <p className="type-ui-small text-by-text-secondary">
      None of {methodology.name}’s behaviors has been measured yet. Check them in{" "}
      <Link
        to="/app/methodology/$methodologyId"
        params={{ methodologyId: methodology.id }}
        className="underline"
      >
        Methodology → Behavior rules
      </Link>
      .
    </p>
  );
}

function NoMethodology() {
  return (
    <SystemState
      eyebrow={EYEBROW}
      tag={{ tone: "neutral", label: "Empty" }}
      title="No methodology set up yet."
      body="Pick one and Bylda measures how closely calls follow it."
      actions={[{ label: "Set up methodology", variant: "secondary", href: "/app/methodology" }]}
    />
  );
}

/** Static skeleton — "NO SHIMMER THEATRICS" (Y13). */
function Skeleton() {
  return (
    <div className="flex w-full flex-col gap-3" aria-busy="true" aria-label="Loading methodology">
      <SkeletonBar width={220} height={12} />
      <SkeletonBlock height={280} className="rounded-by-card" />
      <SkeletonBlock height={150} className="rounded-by-card" />
    </div>
  );
}
