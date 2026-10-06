import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  Button,
  ConfidenceMeter,
  ContextPanel,
  DataBoundary,
  DirectionTag,
  EvidenceBlock,
  SkeletonBar,
  SkeletonBlock,
  StateError,
  SystemState,
  TrendChart,
  systemStates,
  cn,
} from "@/components/bylda";
import {
  ForbiddenForRoleError,
  isOutcomeSufficient,
  useBehaviorDetail,
  useOutcomeAssociations,
  type BehaviorDetail,
  type OutcomeAssociation,
} from "@/lib/data";
import type { QueryLike } from "@/components/bylda";
import { OUTCOME_LABEL, formatValue, pct, periodChange } from "./behavior/format";
import { ExamplePair } from "./behavior/ExamplePair";
import { RepsAffected } from "./behavior/RepsAffected";

/**
 * I2 · Behavior Detail — Interrupting during objections
 * Figma 11:2 (page 1:9) · Lane 1 — Ansh · route /app/intelligence/behaviors/$behaviorKey
 * Resolves any behavior key; an unknown key shows the error state. Manager-only: the
 * hooks refuse a rep (ForbiddenForRoleError → restricted state), so the by-rep list never
 * reaches a rep. Hooks: useBehaviorDetail, useOutcomeAssociations — see src/lib/data/README.md
 */
export function I2BehaviorDetailInterruptingDuringObjections() {
  const { behaviorKey } = useParams({ strict: false }) as { behaviorKey: string };
  const detail = useBehaviorDetail(behaviorKey);
  const outcomes = useOutcomeAssociations(behaviorKey);
  return <BehaviorDetailView detail={detail} outcomes={outcomes} behaviorKey={behaviorKey} />;
}

export function BehaviorDetailView({
  detail,
  outcomes,
  behaviorKey,
}: {
  detail: QueryLike<BehaviorDetail | null>;
  outcomes: QueryLike<OutcomeAssociation[]>;
  behaviorKey: string;
}) {
  return (
    <DataBoundary
      query={detail}
      loading={<DetailSkeleton />}
      error={(err) =>
        err instanceof ForbiddenForRoleError ? (
          <Frame>
            <SystemState
              eyebrow="INTELLIGENCE · MANAGER VIEW"
              tag={{ tone: "neutral", label: "Restricted" }}
              title="Behavior detail is for managers."
              body="It compares reps, so it isn’t shown in a rep view. Your own progress lives on your home."
              actions={[{ label: "Go to my home", variant: "secondary", href: "/app/rep" }]}
            />
          </Frame>
        ) : (
          <Frame>
            <StateError
              eyebrow="INTELLIGENCE · BEHAVIOR"
              body="Bylda couldn’t load this behavior. Your calls are safe — try again."
              onRetry={() => void detail.refetch?.()}
            />
          </Frame>
        )
      }
      empty={
        <Frame>
          <StateError
            eyebrow="INTELLIGENCE · BEHAVIOR"
            title="Bylda doesn’t have a behavior called that."
            body={
              <>
                No behavior with the key <span className="type-mono-data">{behaviorKey}</span>.{" "}
                <a href="/app/intelligence" className="underline">
                  Back to Intelligence
                </a>
              </>
            }
          />
        </Frame>
      }
    >
      {(d) => <Frame>{d ? <Loaded d={d} outcomes={outcomes} /> : null}</Frame>}
    </DataBoundary>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-5 px-9 pb-7 pt-7 max-[1024px]:px-6">{children}</div>
  );
}

function Loaded({ d, outcomes }: { d: BehaviorDetail; outcomes: QueryLike<OutcomeAssociation[]> }) {
  const { behavior } = d;
  const change = periodChange(d.sparkline.points);
  const trendTone =
    d.direction === "regressing"
      ? "text-by-signal-regress"
      : d.direction === "improving"
        ? "text-by-signal-improve"
        : "text-by-text-secondary";
  return (
    <>
      <nav aria-label="Breadcrumb" className="type-mono-micro flex gap-2 text-by-text-tertiary">
        <Link to="/app/intelligence" className="hover:text-by-text-primary">
          INTELLIGENCE
        </Link>
        <span>/</span>
        <span>BEHAVIORS</span>
        <span>/</span>
        <span className="text-by-text-primary">{behavior.name.toUpperCase()}</span>
      </nav>

      <header className="flex flex-col gap-2">
        <h1 className="type-editorial-h1 text-by-text-primary">{behavior.name}</h1>
        <p className="type-ui-small text-by-text-secondary">
          Definition: {behavior.definition} Configured in{" "}
          {behavior.methodologyId ? (
            <Link
              to="/app/methodology/$methodologyId/rules/$ruleKey"
              params={{ methodologyId: behavior.methodologyId, ruleKey: behavior.key }}
              className="underline"
            >
              Methodology → Behavior rules
            </Link>
          ) : (
            <Link to="/app/methodology" className="underline">
              Methodology → Behavior rules
            </Link>
          )}
          .
        </p>
        {!behavior.enabled ? (
          <p className="type-ui-small text-by-text-secondary">
            This behavior is switched off, so no new calls are scored for it.
          </p>
        ) : null}
      </header>

      <dl className="grid grid-cols-4 overflow-hidden rounded-by-card border border-by-border-engraved bg-by-surface-raised max-[1024px]:grid-cols-2">
        <Stat label="TEAM TREND">
          <span className="type-ui-title text-by-text-primary">{change ?? "—"}</span>
          <DirectionTag direction={d.direction} />
        </Stat>
        <Stat label="CALLS WITH BEHAVIOR">
          {d.callsWithBehavior ? (
            <>
              <span className="type-ui-title text-by-text-primary">
                {d.callsWithBehavior.withBehavior} / {d.callsWithBehavior.total}
              </span>
              <span className="type-mono-micro text-by-text-secondary">
                {Math.round((d.callsWithBehavior.withBehavior / d.callsWithBehavior.total) * 100)}%
                of calls
              </span>
            </>
          ) : (
            <>
              <span className="type-ui-title text-by-text-primary">—</span>
              <span className="type-mono-micro text-by-text-secondary">not counted yet</span>
            </>
          )}
        </Stat>
        <Stat label="REPS AFFECTED">
          <span className="type-ui-title text-by-text-primary">
            {d.teamSize ? `${d.byRep.length} of ${d.teamSize}` : d.byRep.length}
          </span>
          <span className="type-mono-micro text-by-text-secondary">
            {d.byRep.some((r) => r.vsBaseline != null)
              ? `${d.byRep.filter((r) => (r.vsBaseline ?? 0) > 0).length} above baseline`
              : "manager view"}
          </span>
        </Stat>
        <Stat label="EVIDENCE">
          <span className="type-ui-title text-by-text-primary capitalize">{d.confidence}</span>
          <span className="type-mono-micro text-by-text-secondary">n={d.sampleSize}</span>
        </Stat>
      </dl>

      <OutcomeSection d={d} outcomes={outcomes} />

      <div className="flex items-stretch gap-5 max-[1024px]:flex-col">
        <section className="flex flex-1 flex-col gap-2.5 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-5 py-4">
          <h2 className="type-mono-micro text-by-text-tertiary">
            TREND · {behavior.name.toUpperCase()}
          </h2>
          <TrendChart
            series={d.sparkline}
            projected={d.projected}
            label={`${behavior.name} trend, measured then projected`}
            className={trendTone}
          />
          <p className="type-ui-small text-by-text-secondary">
            {d.projected.length > 0 ? "Solid = measured · dashed = projected, " : "Measured, "}
            on a fixed scale. Pattern detected across {d.sampleSize} calls
            {d.projected.length > 0 ? "; a projection isn’t a forecast" : ""}.
          </p>
        </section>
        <RepsAffected detail={d} />
      </div>

      <ExamplePair examples={d.examples} />

      <section className="flex flex-col gap-3">
        <h2 className="type-ui-label text-by-text-primary">EVIDENCE MOMENTS</h2>
        {d.evidence.length === 0 ? (
          <p className="type-ui-small text-by-text-secondary">
            No moments to show yet. Bylda needs more analyzed calls with this behavior.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {d.evidence.map((e) => (
              <li key={`${e.callId}-${e.tSeconds}`}>
                <EvidenceBlock
                  evidence={{
                    timestamp: e.timestamp,
                    speaker: e.speakerLabel,
                    quote: e.quote,
                    href: `/app/calls/${e.callId}`,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Panel d={d} />
    </>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1 border-r border-by-border-engraved px-4 py-3 last:border-r-0">
      <dt className="type-mono-micro text-by-text-tertiary">{label}</dt>
      <dd className="flex flex-col items-start gap-1">{children}</dd>
    </div>
  );
}

function OutcomeSection({
  d,
  outcomes,
}: {
  d: BehaviorDetail;
  outcomes: QueryLike<OutcomeAssociation[]>;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-5 py-4">
      <h2 className="type-ui-label text-by-text-primary">RELATIONSHIP WITH OUTCOMES</h2>
      <DataBoundary
        query={outcomes}
        loading={<SkeletonBlock height={96} />}
        error={() => (
          <StateError
            body="Bylda couldn’t load outcomes for this behavior."
            onRetry={() => void outcomes.refetch?.()}
          />
        )}
        empty={<SystemState {...systemStates.insufficientData({ seenIn: d.sampleSize })} />}
      >
        {(rows) => {
          const ok = rows.filter(isOutcomeSufficient);
          // §4: OutcomeAssociation is hidden below n_closed 30 → Y3.
          if (ok.length === 0) {
            const seen = Math.max(...rows.map((r) => r.nWith), 0);
            return <SystemState {...systemStates.insufficientData({ seenIn: seen })} />;
          }
          const nClosed = Math.min(...ok.map((r) => r.nClosed));
          const confidence = ok[0].confidence;
          return (
            <>
              <ConfidenceMeter
                level={confidence}
                sampleSize={nClosed}
                sampleLabel={`n = ${nClosed} closed`}
              />
              <p className="type-editorial-insight text-by-text-primary">
                Calls with {d.behavior.name.toLowerCase()} were observed alongside different outcome
                rates. This is an association across {nClosed} closed calls — not proof the behavior
                caused it.
              </p>
              <table className="w-full">
                <thead>
                  <tr className="type-mono-micro border-b border-by-border-engraved text-left text-by-text-tertiary">
                    <th className="py-1.5 font-medium">OUTCOME</th>
                    <th className="py-1.5 font-medium">WITH</th>
                    <th className="py-1.5 font-medium">WITHOUT</th>
                    <th className="py-1.5 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {ok.map((r) => (
                    <tr key={r.outcome} className="border-b border-by-border-engraved">
                      <td className="type-ui-small py-[9px] text-by-text-primary">
                        {OUTCOME_LABEL[r.outcome]}
                      </td>
                      <td className="type-mono-data py-[9px] text-by-text-primary">
                        {pct(r.withRate)}{" "}
                        <span className="type-mono-micro text-by-text-tertiary">n={r.nWith}</span>
                      </td>
                      <td className="type-mono-data py-[9px] text-by-text-primary">
                        {pct(r.withoutRate)}{" "}
                        <span className="type-mono-micro text-by-text-tertiary">
                          n={r.nWithout}
                        </span>
                      </td>
                      <td className="py-[9px]">
                        <RateBars withRate={r.withRate} withoutRate={r.withoutRate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ok.some((r) => r.confounders.length > 0) ? (
                <p className="type-ui-small text-by-text-secondary">
                  Possible context factors:{" "}
                  {[...new Set(ok.flatMap((r) => r.confounders))].join(", ")}.
                </p>
              ) : null}
            </>
          );
        }}
      </DataBoundary>
    </section>
  );
}

/** Two bars on a fixed 0–100% scale. SVG attributes, not inline styles. */
function RateBars({ withRate, withoutRate }: { withRate: number; withoutRate: number }) {
  const W = 170;
  return (
    <svg width={W} height={12} viewBox={`0 0 ${W} 12`} aria-hidden>
      <rect width={W * withRate} height={4} y={0} className="fill-by-text-secondary" />
      <rect width={W * withoutRate} height={4} y={7} className="fill-by-surface-sidebar" />
    </svg>
  );
}

function Panel({ d }: { d: BehaviorDetail }) {
  const navigate = useNavigate();
  // Low confidence = observation only: no action button (CLAUDE.md §4).
  const actionable = d.confidence !== "low" && d.recommendedChange !== null;
  const above = d.byRep.filter((r) => (r.vsBaseline ?? 0) > 0);
  return (
    <ContextPanel title="RECOMMENDED CHANGE">
      {actionable ? (
        <>
          <p className="type-editorial-insight text-by-text-primary">{d.recommendedChange}</p>
          <Button
            onClick={() =>
              void navigate({
                to: "/app/coaching/assign",
                search: { behaviorKey: d.behavior.key } as never,
              })
            }
          >
            Create coaching focus
          </Button>
        </>
      ) : (
        <p className="type-ui-small text-by-text-secondary">
          {d.confidence === "low"
            ? `Observation only. Confidence is low at n=${d.sampleSize}, so Bylda isn’t recommending a change yet.`
            : "No recommended change for this behavior yet."}
        </p>
      )}
      <h3 className="type-ui-label text-by-text-primary">HOW SURE IS BYLDA?</h3>
      <div className="flex flex-col gap-2 rounded-by-card border border-by-border-engraved bg-by-surface-inset px-3.5 py-3">
        <ConfidenceMeter level={d.confidence} sampleSize={d.sampleSize} />
        <p className={cn("type-ui-small text-by-text-primary")}>
          Associated with outcomes, not shown to cause them. Based on {d.sampleSize} analyzed calls.
        </p>
        {above.length > 0 ? (
          <p className="type-ui-small text-by-text-secondary">
            {above.length} of {d.byRep.length} reps are above their own baseline.
          </p>
        ) : null}
      </div>
      {d.affectedCalls.length > 0 ? (
        <>
          <h3 className="type-ui-label text-by-text-primary">
            AFFECTED CALLS · {d.callsWithBehavior?.withBehavior ?? d.affectedCalls.length}
          </h3>
          <ul>
            {d.affectedCalls.map((c) => (
              <li
                key={`${c.callId}-${c.tSeconds}`}
                className="border-b border-by-border-engraved last:border-b-0"
              >
                <Link
                  to="/app/calls/$callId"
                  params={{ callId: c.callId }}
                  className="flex items-start gap-2 py-2 hover:bg-by-surface-hover"
                >
                  <span className="type-ui-small min-w-0 flex-1 text-by-text-primary">
                    {c.account}
                  </span>
                  <span className="type-mono-micro whitespace-nowrap text-by-text-secondary">
                    {c.repName.split(" ")[0]} · {c.timestamp} · {c.count}×
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/app/calls" className="type-ui-small text-by-text-secondary hover:underline">
            View all {d.callsWithBehavior?.withBehavior ?? d.affectedCalls.length} calls →
          </Link>
        </>
      ) : null}
    </ContextPanel>
  );
}

function DetailSkeleton() {
  return (
    <Frame>
      <SkeletonBar width={192} height={12} />
      <SkeletonBar width={384} height={36} />
      <SkeletonBlock height={64} />
      <SkeletonBlock height={192} />
    </Frame>
  );
}
