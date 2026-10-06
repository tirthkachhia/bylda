import { useNavigate } from "@tanstack/react-router";
import {
  ConfidenceMeter,
  ContextPanel,
  DataBoundary,
  SkeletonBar,
  SkeletonBlock,
  StateError,
  SystemState,
  Tag,
  cn,
  type TagTone,
} from "@/components/bylda";
import {
  REP_INSIGHT_MIN_CALLS,
  useMyCalls,
  useMyProgress,
  type BehaviorScore,
  type Call,
  type CoachingFocus,
  type MyProgress,
} from "@/lib/data";
import { LocalSparkline } from "./LocalSparkline";
import { directionTone, formatMedian, formatScore, shortDate } from "./repFormat";

/**
 * R2 · Rep — My progress
 * Figma 32:129 (page 1:7) · Lane 4 — Dravin · route /app/rep/progress
 * Hooks: useMyProgress (+ useMyCalls for the outcome counts)
 *
 * Self-comparison only. The team median is the ONE peer-derived number a rep may see
 * (CLAUDE.md §4, §13.6): an anonymous aggregate the data layer nulls under 8 reps — when
 * it's null the column is gone entirely. Sparklines plot on each behavior's fixed y-range.
 */
export function R2RepMyProgress() {
  const progress = useMyProgress();
  const navigate = useNavigate();
  return (
    <div className="flex w-full flex-col gap-5 px-9 pb-7 pt-7 max-[1024px]:px-6">
      <DataBoundary
        query={progress}
        loading={<ProgressSkeleton />}
        error={() => (
          <StateError
            eyebrow="REP · MY PROGRESS"
            body="Bylda couldn’t load your progress. Try again in a moment."
            onRetry={() => void progress.refetch()}
          />
        )}
        empty={
          <>
            <Header hasMedian={false} />
            <SystemState
              eyebrow="REP · NOT ENOUGH CALLS YET"
              tag={{ tone: "attention", label: "Low evidence" }}
              title="No progress to show yet."
              body={`Bylda tracks your behaviors once ${REP_INSIGHT_MIN_CALLS} of your calls are analyzed.`}
              actions={[
                {
                  label: "See my calls",
                  variant: "ghost",
                  onClick: () => void navigate({ to: "/app/calls/mine" }),
                },
              ]}
            />
          </>
        }
      >
        {(data) => <Progress data={data} />}
      </DataBoundary>
    </div>
  );
}

function Progress({ data }: { data: MyProgress }) {
  // Same team for every row — the median shows for all of them or none (§13.6).
  const hasMedian = data.scores.length > 0 && data.scores.every((s) => s.teamMedian !== null);
  const changed = mostChanged(data.scores, "improving");
  const watch = mostChanged(data.scores, "regressing");

  return (
    <>
      <Header hasMedian={hasMedian} />
      <PeriodTabs />

      {data.scores.length ? (
        <BehaviorTable scores={data.scores} foci={data.foci} hasMedian={hasMedian} />
      ) : (
        <SystemState
          eyebrow="YOUR BEHAVIORS"
          tag={{ tone: "attention", label: "Low evidence" }}
          title="No behavior scores yet."
          body={`They appear once ${REP_INSIGHT_MIN_CALLS} of your calls are analyzed.`}
        />
      )}

      {changed || watch ? (
        <div className="flex items-start gap-5 max-[1100px]:flex-col">
          {changed ? <Callout kind="changed" score={changed} /> : null}
          {watch ? <Callout kind="watch" score={watch} /> : null}
        </div>
      ) : null}

      <ContextPanel>
        <ProgressContext foci={data.foci} />
      </ContextPanel>
    </>
  );
}

function Header({ hasMedian }: { hasMedian: boolean }) {
  return (
    <header className="flex flex-col gap-1.5">
      <h1 className="type-editorial-h1 text-by-text-primary">My progress</h1>
      <p className="type-ui-small text-by-text-secondary">
        Compared with your own recent calls.
        {hasMedian ? " Team median shown for context only — no names, no ranks." : ""}
      </p>
    </header>
  );
}

/**
 * GAP: `useMyProgress` takes no period (LANE_REQUESTS.md #30) — the data is the 30-day
 * view. 90 days / Since joining render as unavailable rather than showing the same
 * numbers under a different label.
 */
function PeriodTabs() {
  return (
    <div
      role="tablist"
      aria-label="Period"
      className="flex gap-[18px] border-b border-by-border-engraved"
    >
      <button
        role="tab"
        aria-selected
        className="type-ui-body -mb-px border-b-[1.5px] border-by-text-primary py-2 text-by-text-primary"
      >
        30 days
      </button>
      {["90 days", "Since joining"].map((label) => (
        <button
          key={label}
          role="tab"
          aria-selected={false}
          aria-disabled
          disabled
          title="Coming soon"
          className="type-ui-body cursor-not-allowed py-2 text-by-text-secondary"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const COLS = {
  behavior: "w-[190px] shrink-0",
  now: "w-[110px] shrink-0",
  trend: "w-[120px] shrink-0",
  median: "w-[100px] shrink-0",
  tag: "min-w-[120px] flex-1",
};

function BehaviorTable({
  scores,
  foci,
  hasMedian,
}: {
  scores: BehaviorScore[];
  foci: CoachingFocus[];
  hasMedian: boolean;
}) {
  return (
    <section
      aria-label="Your behaviors"
      className="flex w-full flex-col overflow-x-auto rounded-by-card border border-by-border-engraved bg-by-surface-raised"
    >
      <p className="type-ui-label border-b border-by-border-engraved px-4 py-3 text-by-text-primary">
        YOUR BEHAVIORS
      </p>
      <div className="type-mono-micro flex items-start border-b border-by-border-engraved bg-by-surface-inset px-4 py-[9px] text-by-text-tertiary">
        <span className={COLS.behavior}>BEHAVIOR</span>
        <span className={COLS.now}>YOU NOW</span>
        <span className={COLS.trend}>TREND</span>
        {hasMedian ? <span className={COLS.median}>TEAM MEDIAN</span> : null}
        <span className={COLS.tag} />
      </div>
      {scores.map((s) => {
        const tag = rowTag(s, foci);
        return (
          <div
            key={s.behaviorKey}
            className="flex items-center border-b border-by-border-engraved px-4 py-2.5 last:border-b-0"
          >
            <span className={cn("type-ui-body-strong text-by-text-primary", COLS.behavior)}>
              {s.name}
            </span>
            <span
              className={cn("type-mono-data text-by-text-secondary", COLS.now)}
              title={`n = ${s.sampleSize} · confidence ${s.confidence}`}
            >
              {formatScore(s.value, s.unit)}
            </span>
            <span className={COLS.trend}>
              <LocalSparkline
                sparkline={s.sparkline}
                tone={directionTone(s.direction)}
                className="h-4 w-[100px]"
              />
            </span>
            {hasMedian && s.teamMedian !== null ? (
              <span className={cn("type-mono-data text-by-text-secondary", COLS.median)}>
                {formatMedian(s.teamMedian, s.unit)}
              </span>
            ) : null}
            <span className={COLS.tag}>
              <Tag tone={tag.tone}>{tag.label}</Tag>
            </span>
          </div>
        );
      })}
    </section>
  );
}

/** Label from your own coaching; colour from direction only. */
function rowTag(s: BehaviorScore, foci: CoachingFocus[]): { tone: TagTone; label: string } {
  const tone = directionTone(s.direction);
  const focus = foci.find((f) => f.behaviorKey === s.behaviorKey);
  if (focus?.status === "held") return { tone, label: "Coaching held" };
  if (focus && focus.status !== "reverted" && focus.status !== "not_yet")
    return { tone, label: "Focus" };
  if (s.direction === "improving") return { tone, label: "Strength" };
  if (s.direction === "regressing") return { tone, label: "Slipping" };
  return { tone, label: "Steady" };
}

/** The behavior that moved furthest across its own fixed range, in one direction. */
function mostChanged(scores: BehaviorScore[], direction: "improving" | "regressing") {
  const moved = (s: BehaviorScore) => {
    const p = s.sparkline.points;
    const span = s.sparkline.yMax - s.sparkline.yMin || 1;
    return p.length > 1 ? Math.abs(p[p.length - 1] - p[0]) / span : 0;
  };
  return (
    scores
      .filter((s) => s.direction === direction && s.sparkline.points.length > 1)
      .sort((a, b) => moved(b) - moved(a))[0] ?? null
  );
}

function Callout({ kind, score }: { kind: "changed" | "watch"; score: BehaviorScore }) {
  const p = score.sparkline.points;
  const from = formatScore(p[0], score.unit);
  const to = formatScore(p[p.length - 1], score.unit);
  const improving = kind === "changed";
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-2.5 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-[18px] py-4">
      <p className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "type-mono-micro",
            improving ? "text-by-signal-improve" : "text-by-signal-regress",
          )}
        >
          △
        </span>
        <span className="type-mono-micro text-by-text-secondary">
          {improving ? "WHAT CHANGED MOST" : "WHAT TO WATCH"}
        </span>
      </p>
      <p className="type-editorial-insight text-by-text-primary">
        {improving
          ? `Your ${score.name.toLowerCase()} went from ${from} to ${to}.`
          : `Your ${score.name.toLowerCase()} slipped from ${from} to ${to}.`}
      </p>
      <ConfidenceMeter level={score.confidence} sampleSize={score.sampleSize} />
    </section>
  );
}

function ProgressContext({ foci }: { foci: CoachingFocus[] }) {
  const calls = useMyCalls();
  // One milestone per focus, its latest state (Figma 32:129): held, else started.
  const milestones = foci
    .map((f) =>
      f.result?.verdict === "held"
        ? { at: f.result.measuredOn, label: `${f.behaviorName} focus held` }
        : { at: f.assignedAt, label: `Started: ${f.behaviorName.toLowerCase()}` },
    )
    .sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="flex flex-col gap-[18px]">
      <PanelLabel>MILESTONES</PanelLabel>
      {milestones.length ? (
        <div className="flex flex-col">
          {milestones.map((m) => (
            <div
              key={m.at + m.label}
              className="flex items-start gap-2.5 border-b border-by-border-engraved py-[7px]"
            >
              <p className="type-mono-data w-14 shrink-0 text-by-text-secondary">
                {shortDate(m.at)}
              </p>
              <p className="type-ui-small flex-1 text-by-text-primary">{m.label}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="type-ui-small text-by-text-secondary">
          No coaching milestones yet. They land here when a focus starts or holds.
        </p>
      )}

      <PanelLabel>OUTCOMES · 30 DAYS</PanelLabel>
      <DataBoundary
        query={calls}
        loading={<SkeletonBlock height={96} />}
        error={() => (
          <StateError body="Couldn’t load outcomes." onRetry={() => void calls.refetch()} />
        )}
        empty={
          <p className="type-ui-small text-by-text-secondary">No calls in the last 30 days.</p>
        }
      >
        {(rows) => <Outcomes calls={rows} />}
      </DataBoundary>

      <div className="flex flex-col gap-1 rounded-by-card border border-by-border-engraved bg-by-surface-inset px-4 py-3">
        <p className="type-mono-micro text-by-text-tertiary">VISIBILITY</p>
        <p className="type-ui-small text-by-text-primary">
          Your manager sees this same page. No one else does.
        </p>
      </div>
    </div>
  );
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Outcome counts from your own calls whose outcome is known (CRM back-fill). */
function Outcomes({ calls }: { calls: Call[] }) {
  const newest = calls.reduce((m, c) => Math.max(m, Date.parse(c.startedAt)), 0);
  const recent = calls.filter((c) => newest - Date.parse(c.startedAt) <= THIRTY_DAYS_MS);
  const count = (o: Call["outcome"]) => recent.filter((c) => c.outcome === o).length;
  const rows: [string, number][] = [
    ["Won", count("won")],
    ["Advanced", count("advanced")],
    ["Stalled", count("no_decision")],
  ];
  return (
    <div className="flex flex-col">
      {rows.map(([label, n]) => (
        <div
          key={label}
          className="flex items-start gap-2.5 border-b border-by-border-engraved py-2"
        >
          <p className="type-mono-micro w-20 shrink-0 text-by-text-tertiary">{label}</p>
          <p className="type-ui-small flex-1 text-by-text-primary">{n}</p>
        </div>
      ))}
    </div>
  );
}

function PanelLabel({ children }: { children: string }) {
  return <p className="type-ui-label text-by-text-primary">{children}</p>;
}

function ProgressSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <SkeletonBar width={220} height={32} />
      <SkeletonBar width={420} height={12} />
      <SkeletonBlock height={36} />
      <SkeletonBlock height={320} />
      <div className="flex gap-5">
        <SkeletonBlock height={120} className="flex-1" />
        <SkeletonBlock height={120} className="flex-1" />
      </div>
    </div>
  );
}
