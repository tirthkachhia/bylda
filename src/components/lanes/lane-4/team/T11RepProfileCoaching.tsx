import { Link } from "@tanstack/react-router";
import { DataBoundary, SkeletonBlock, StateError, SystemState, Tag, cn } from "@/components/bylda";
import {
  useCoachingFoci,
  useRepScores,
  type BehaviorScore,
  type CoachingFocus,
  type RepSummary,
} from "@/lib/data";
import { demoFocus } from "../rep/repDemo";
import { formatScore } from "../rep/repFormat";
import { RepProfileFrame } from "./repProfile";
import { firstNameOf, focusDates, focusTag, isActiveFocus } from "./repProfileFormat";

/**
 * T11 · Rep Profile — Coaching
 * Figma 45:1841 (page 1:10) · Lane 4 — Dravin · route /app/team/reps/$repId/coaching
 * Hooks: useCoachingFoci (+ useRepScores for the current value and unit)
 *
 * Coaching is 4 objects — Focus, Evidence, Acknowledgement, Result (§4). No courses.
 */
export function T11RepProfileCoaching() {
  return <RepProfileFrame tab="coaching">{(s) => <Coaching summary={s} />}</RepProfileFrame>;
}

function Coaching({ summary }: { summary: RepSummary }) {
  const repId = summary.rep.id;
  const foci = useCoachingFoci({ repId });
  const scores = useRepScores(repId);
  const scoreFor = (key: string) => scores.data?.find((s) => s.behaviorKey === key) ?? null;
  return (
    <DataBoundary
      query={foci}
      loading={
        <div className="flex flex-col gap-5">
          <SkeletonBlock height={112} />
          <SkeletonBlock height={200} />
        </div>
      }
      error={() => (
        <StateError
          eyebrow="REP PROFILE · COACHING"
          body="Bylda couldn’t load this rep’s coaching. Try again in a moment."
          onRetry={() => void foci.refetch()}
        />
      )}
      empty={
        <SystemState
          eyebrow="REP PROFILE · NO COACHING YET"
          title={`${firstNameOf(summary.rep.name)} has no coaching focus yet.`}
          body="Pick one behavior, attach the moment that shows it, and Bylda measures whether it changes."
          actions={[
            {
              label: "Assign coaching",
              href: `/app/coaching/assign?repId=${encodeURIComponent(repId)}`,
            },
          ]}
        />
      }
    >
      {(rows) => {
        const sorted = [...rows].sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
        const active = sorted.find(isActiveFocus) ?? null;
        return (
          <>
            {active ? <ActiveFocus focus={active} score={scoreFor(active.behaviorKey)} /> : null}
            <History foci={sorted} scoreFor={scoreFor} />
          </>
        );
      }}
    </DataBoundary>
  );
}

const fmt = (v: number, score: BehaviorScore | null) =>
  score ? formatScore(v, score.unit) : `${v}`;

/** The one running focus — baseline → now → target, on the focus's own metric. */
function ActiveFocus({ focus, score }: { focus: CoachingFocus; score: BehaviorScore | null }) {
  // GAP: focus headline + "day N of M" have no field (LANE_REQUESTS #30/#32) — demo copy
  // in mock mode only; live mode falls back to the behavior name and the status.
  const demo = demoFocus(focus.id);
  const eyebrow = ["ACTIVE FOCUS", demo?.day ?? focusTag(focus).label.toUpperCase()].join(" · ");
  const judge = focus.judgeAfter.calls
    ? `judged after ${focus.judgeAfter.calls} calls`
    : focus.judgeAfter.date
      ? `judged on ${focus.judgeAfter.date.slice(0, 10)}`
      : null;
  const line = [
    `Baseline ${fmt(focus.baseline, score)}`,
    score ? `now ${fmt(score.value, score)}` : null,
    `target ${fmt(focus.target, score)}`,
  ]
    .filter(Boolean)
    .join(" → ");
  return (
    <Link
      to="/app/coaching/$focusId"
      params={{ focusId: focus.id }}
      className="flex flex-col gap-2 rounded-by-card bg-by-surface-control-dark px-[22px] py-5 transition-opacity duration-200 ease-out hover:opacity-95"
    >
      <p className="type-mono-micro text-by-text-on-dark-muted">{eyebrow}</p>
      <p className="type-editorial-h2 text-by-text-on-dark">
        {demo?.headline ?? `${focus.behaviorName}.`}
      </p>
      <p className="type-ui-small text-by-text-on-dark">{judge ? `${line} · ${judge}` : line}</p>
    </Link>
  );
}

const COLS = {
  focus: "w-[300px] shrink-0",
  dates: "w-[180px] shrink-0",
  result: "w-[160px] shrink-0",
  change: "w-[200px] shrink-0",
  open: "min-w-[60px] flex-1",
};

function History({
  foci,
  scoreFor,
}: {
  foci: CoachingFocus[];
  scoreFor: (key: string) => BehaviorScore | null;
}) {
  return (
    <section
      aria-label="Coaching history"
      className="flex w-full flex-col overflow-x-auto border border-by-border-engraved bg-by-surface-raised"
    >
      <p className="type-ui-label border-b border-by-border-engraved px-4 py-3 text-by-text-primary">
        COACHING HISTORY
      </p>
      <div className="type-mono-micro flex min-w-[860px] items-center border-b border-by-border-engraved bg-by-surface-inset px-4 py-[9px] text-by-text-tertiary">
        <span className={COLS.focus}>FOCUS</span>
        <span className={COLS.dates}>DATES</span>
        <span className={COLS.result}>RESULT</span>
        <span className={COLS.change}>CHANGE</span>
        <span className={COLS.open} />
      </div>
      {foci.map((f) => {
        const score = scoreFor(f.behaviorKey);
        const tag = focusTag(f);
        // Result value once measured; while running, the current score on the same metric.
        const now = f.result?.value ?? score?.value ?? null;
        return (
          <div
            key={f.id}
            className="flex min-w-[860px] items-center border-b border-by-border-engraved px-4 py-2.5 last:border-b-0"
          >
            <span className={cn("type-ui-small text-by-text-primary", COLS.focus)}>
              {f.behaviorName}
            </span>
            <span className={cn("type-mono-data text-by-text-secondary", COLS.dates)}>
              {focusDates(f)}
            </span>
            <span className={COLS.result}>
              <Tag tone={tag.tone}>{tag.label}</Tag>
            </span>
            <span
              className={cn("type-mono-data text-by-text-secondary", COLS.change)}
              title={f.result ? `n = ${f.result.sampleSize}` : undefined}
            >
              {now === null ? "—" : `${fmt(f.baseline, score)} → ${fmt(now, score)}`}
            </span>
            <Link
              to="/app/coaching/$focusId"
              params={{ focusId: f.id }}
              className={cn(
                "type-ui-small text-by-text-primary underline-offset-4 hover:underline",
                COLS.open,
              )}
            >
              Open
            </Link>
          </div>
        );
      })}
    </section>
  );
}
