import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Avatar,
  Button,
  ConfidenceMeter,
  ContextPanel,
  DataBoundary,
  EvidenceBlock,
  SkeletonBar,
  SkeletonBlock,
  StateError,
  SystemState,
  Tag,
  cn,
} from "@/components/bylda";
import {
  REP_INSIGHT_MIN_CALLS,
  useAcknowledgeCoaching,
  useMyCalls,
  useRepHome,
  type BehaviorScore,
  type Call,
  type CoachingFocus,
  type GatedInsight,
  type Insight,
  type RepHome,
} from "@/lib/data";
import { LocalSparkline } from "./LocalSparkline";
import {
  demoBrief,
  demoFocus,
  demoListen,
  demoListenTotal,
  demoPersonName,
  demoWeek,
} from "./repDemo";
import {
  briefDateLine,
  directionTone,
  firstName,
  formatScore,
  greeting,
  noteTime,
  targetLabel,
  useNow,
} from "./repFormat";

/**
 * R1 · Rep Home — Daily Brief
 * Figma 8:2 (page 1:7) · Lane 4 — Dravin · route /app/rep
 * Hooks: useRepHome, useMyCoaching (via useRepHome), useMyCalls — see src/lib/data/README.md
 *
 * Only the signed-in rep's own data (useRepHome / useMyCalls are rep-scoped in the data
 * layer). No team rankings, no named peers, no team median here (CLAUDE.md §4 — the
 * anonymous median is allowed on R2 only).
 */
export function R1RepHomeDailyBrief() {
  const home = useRepHome();
  return (
    <div className="flex w-full flex-col gap-5 px-9 pb-7 pt-7 max-[1024px]:px-6">
      <DataBoundary
        query={home}
        loading={<BriefSkeleton />}
        error={() => (
          <StateError
            eyebrow="REP HOME · DAILY BRIEF"
            body="Bylda couldn’t load your brief. Your calls are safe — try again."
            onRetry={() => void home.refetch()}
          />
        )}
        empty={
          <SystemState
            eyebrow="REP HOME · NO CALLS YET"
            tag={{ tone: "neutral", label: "Empty" }}
            title="Nothing to brief you on yet."
            body={`Your first insights appear once ${REP_INSIGHT_MIN_CALLS} of your calls are analyzed.`}
          />
        }
      >
        {(data) => (data ? <Brief home={data} /> : null)}
      </DataBoundary>
    </div>
  );
}

function Brief({ home }: { home: RepHome }) {
  const now = useNow();
  const enough = home.analyzedCalls >= home.neededForInsights;
  const focusScore = home.focus
    ? (home.scores.find((s) => s.behaviorKey === home.focus?.behaviorKey) ?? null)
    : null;

  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="type-mono-micro min-h-[13px] text-by-text-tertiary">
          {now ? `${briefDateLine(now)} · 60-SECOND BRIEF` : null}
        </p>
        <h1 className="type-editorial-h1 text-by-text-primary">
          {now ? greeting(now) : "Hello"}, {firstName(home.rep.name)}.
        </h1>
      </header>

      {enough ? (
        <BriefLine insights={home.insights} />
      ) : (
        <SystemState
          eyebrow="REP · NOT ENOUGH CALLS YET"
          tag={{ tone: "attention", label: "Low evidence" }}
          title="Your first insights are on the way."
          body={`${home.analyzedCalls} of ${home.neededForInsights} calls analyzed. Bylda shows insights about you once ${home.neededForInsights} are in.`}
        />
      )}

      {home.focus ? <TodaysFocus focus={home.focus} score={focusScore} /> : <NoFocus />}

      <div className="flex items-start gap-5 max-[1100px]:flex-col">
        <CallsWorthAListen />
        <WorkingCosting scores={home.scores} />
      </div>

      <ContextPanel>
        <RepContext home={home} focusScore={focusScore} />
      </ContextPanel>
    </>
  );
}

/** The 60-second read. Every insight line carries confidence + n (§4, §13.14). */
function BriefLine({ insights }: { insights: GatedInsight[] }) {
  const demo = demoBrief();
  if (demo) {
    return (
      <div className="flex flex-col gap-2">
        <p className="type-editorial-insight text-by-text-primary">{demo.text}</p>
        <ConfidenceMeter
          level={demo.confidence}
          sampleSize={demo.sampleSize}
          sampleLabel={demo.sampleLabel}
        />
      </div>
    );
  }
  const first = insights.find(
    (g): g is { state: "insight"; insight: Insight } => g.state === "insight",
  );
  if (!first) {
    const low = insights.find((g) => g.state === "insufficient");
    return low && low.state === "insufficient" ? (
      <SystemState
        eyebrow="REP · NOT ENOUGH CALLS YET"
        tag={{ tone: "attention", label: "Low evidence" }}
        title="Not enough calls yet to say something useful about you."
        body={`${low.callsAnalyzed} of ${low.callsNeeded} calls analyzed.`}
      />
    ) : null;
  }
  const i = first.insight;
  return (
    <div className="flex flex-col gap-2">
      <p className="type-editorial-insight text-by-text-primary">{i.headline}</p>
      {i.body ? <p className="type-ui-small text-by-text-secondary">{i.body}</p> : null}
      <ConfidenceMeter
        level={i.confidence}
        sampleSize={i.sampleSize}
        sampleLabel={i.sampleLabel ?? undefined}
      />
    </div>
  );
}

function TodaysFocus({ focus, score }: { focus: CoachingFocus; score: BehaviorScore | null }) {
  const copy = demoFocus(focus.id);
  const coach = demoPersonName(focus.assignedById);
  const acknowledge = useAcknowledgeCoaching();
  const [triedToday, setTriedToday] = useState(false);
  const moment = focus.evidence[0] ?? null;

  const onGotIt = () => {
    setTriedToday(true);
    if (!focus.acknowledgedAt) acknowledge.mutate(focus.id);
  };

  return (
    <section
      aria-label="Today’s focus"
      className="flex w-full flex-col gap-4 rounded-by-card bg-by-surface-rail px-7 py-6"
    >
      <div className="flex items-center gap-2">
        <p className="type-ui-label text-by-text-on-dark">TODAY’S FOCUS</p>
        <span className="flex-1" />
        <p className="type-mono-micro text-by-text-on-dark-muted">
          {coach ? `ASSIGNED BY ${shortName(coach).toUpperCase()}` : "ASSIGNED BY YOUR MANAGER"}
          {copy ? ` · ${copy.day}` : ""}
        </p>
      </div>
      <h2 className="type-editorial-h2 text-by-text-on-dark">
        {copy?.headline ?? focus.behaviorName}
      </h2>
      <div className="flex items-start gap-7 max-[1100px]:flex-col max-[1100px]:gap-4">
        {copy ? (
          <>
            <FocusColumn label="WHY IT MATTERS">{copy.why}</FocusColumn>
            <FocusColumn label="TRY THIS NEXT TIME">{copy.tryThis}</FocusColumn>
          </>
        ) : (
          <FocusColumn label={`FROM ${coach ? firstName(coach).toUpperCase() : "YOUR MANAGER"}`}>
            {focus.note}
          </FocusColumn>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="type-mono-micro text-by-text-on-dark-muted">
            YOUR {focus.behaviorName.toUpperCase()}
          </p>
          {score ? (
            <>
              <div className="flex items-end gap-3">
                <p className="type-mono-metric text-by-text-on-dark">
                  {formatScore(score.value, score.unit)}
                </p>
                <p className="type-mono-micro pb-1 text-by-text-on-dark-muted">
                  {targetLabel(focus.target, score.unit)}
                </p>
              </div>
              <LocalSparkline
                sparkline={score.sparkline}
                tone="on-dark"
                className="h-[22px] w-[150px]"
              />
              <ConfidenceMeter
                level={score.confidence}
                sampleSize={score.sampleSize}
                className="[&_span]:text-by-text-on-dark-muted"
              />
            </>
          ) : (
            <p className="type-ui-small text-by-text-on-dark-muted">
              Baseline {focus.baseline} → target {focus.target}. Measuring on your next calls.
            </p>
          )}
        </div>
      </div>
      <div className="flex items-start gap-2">
        <Button
          variant="dark"
          onClick={onGotIt}
          disabled={triedToday || acknowledge.isPending}
          className="disabled:opacity-100"
        >
          {triedToday ? "On it today" : "Got it — I’ll try this today"}
        </Button>
        {moment ? (
          <Button
            variant="ghost"
            asChild
            className="text-by-text-on-dark-muted hover:bg-by-surface-sidebar-hover hover:text-by-text-on-dark"
          >
            <Link
              to="/app/rep/calls/$callId"
              params={{ callId: moment.callId }}
              hash={`t-${moment.tSeconds}`}
            >
              Hear the {moment.timestamp} moment
            </Link>
          </Button>
        ) : null}
      </div>
      {acknowledge.isError ? (
        <p role="alert" className="type-ui-small text-by-text-on-dark-muted">
          Couldn’t save that — try again in a moment.
        </p>
      ) : null}
    </section>
  );
}

function FocusColumn({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <p className="type-mono-micro text-by-text-on-dark-muted">{label}</p>
      <p className="type-ui-small text-by-text-on-dark">{children}</p>
    </div>
  );
}

function NoFocus() {
  return (
    <SystemState
      eyebrow="TODAY’S FOCUS"
      tag={{ tone: "neutral", label: "Empty" }}
      title="No focus assigned right now."
      body="When your manager picks one behavior to work on, it shows up here with the moment that matters."
    />
  );
}

/** Own calls ranked by coaching value — the two worth a listen. */
function CallsWorthAListen() {
  const calls = useMyCalls();
  return (
    <Card className="flex-1">
      <DataBoundary
        query={calls}
        loading={<SkeletonBlock height={160} />}
        error={() => (
          <StateError body="Couldn’t load your calls." onRetry={() => void calls.refetch()} />
        )}
        empty={
          <>
            <CardHeader title="YOUR CALLS WORTH A LISTEN" />
            <p className="type-ui-small text-by-text-secondary">
              No analyzed calls yet. They show up here once Bylda has reviewed them.
            </p>
          </>
        }
      >
        {(rows) => {
          const worth = rankWorthListening(rows);
          const total = demoListenTotal();
          return (
            <>
              <CardHeader
                title="YOUR CALLS WORTH A LISTEN"
                meta={`${worth.length}${total ? ` · ${total}` : ""}`}
              />
              {worth.length === 0 ? (
                <p className="type-ui-small text-by-text-secondary">
                  Nothing stood out on your latest calls.
                </p>
              ) : (
                worth.map((c) => <ListenRow key={c.id} call={c} />)
              )}
            </>
          );
        }}
      </DataBoundary>
    </Card>
  );
}

const rankWorthListening = (calls: Call[]) =>
  calls
    .filter((c) => c.status === "ready" && c.topMoment && c.coachingValue !== null)
    .sort((a, b) => (b.coachingValue ?? 0) - (a.coachingValue ?? 0))
    .slice(0, 2);

function ListenRow({ call }: { call: Call }) {
  const demo = demoListen(call.id);
  const moment = call.topMoment;
  return (
    <Link
      to="/app/rep/calls/$callId"
      params={{ callId: call.id }}
      className="group flex w-full flex-col gap-1 border-b border-by-border-engraved py-2"
    >
      <span className="flex items-center gap-2">
        <span className="type-ui-body-strong flex-1 text-by-text-primary group-hover:underline">
          {call.account.name}
        </span>
        {moment ? (
          <Tag tone={demo?.tone ?? moment.tone}>
            {demo ? `Listen ${demo.length}` : `Listen ${moment.timestamp}`}
          </Tag>
        ) : null}
      </span>
      <span className="type-ui-small text-by-text-secondary">{demo?.note ?? moment?.label}</span>
      <span className="type-mono-micro text-by-text-tertiary">
        {demo?.window ?? moment?.timestamp}
      </span>
    </Link>
  );
}

/** Own behaviors split by direction. Values + n only — no team median on R1 (§4). */
function WorkingCosting({ scores }: { scores: BehaviorScore[] }) {
  const working = scores.filter((s) => s.direction === "improving");
  const costing = scores.filter((s) => s.direction === "regressing");
  return (
    <Card className="flex-1">
      {scores.length === 0 ? (
        <>
          <CardHeader title="YOUR BEHAVIORS" />
          <p className="type-ui-small text-by-text-secondary">
            Bylda needs {REP_INSIGHT_MIN_CALLS} analyzed calls before it scores your behaviors.
          </p>
        </>
      ) : (
        <>
          <p className="type-ui-label text-by-signal-improve">WORKING FOR YOU</p>
          {working.length ? (
            working.map((s) => <ScoreRow key={s.behaviorKey} score={s} />)
          ) : (
            <EmptyRow>Nothing trending up yet.</EmptyRow>
          )}
          <p className="type-ui-label text-by-signal-regress">COSTING YOU</p>
          {costing.length ? (
            costing.map((s) => <ScoreRow key={s.behaviorKey} score={s} />)
          ) : (
            <EmptyRow>Nothing slipping right now.</EmptyRow>
          )}
        </>
      )}
    </Card>
  );
}

function ScoreRow({ score }: { score: BehaviorScore }) {
  return (
    <div className="flex w-full items-start gap-2 border-b border-by-border-engraved py-1.5">
      <p className="type-ui-small flex-1 text-by-text-primary">{score.name}</p>
      <p className="type-mono-micro text-by-text-secondary">
        {formatScore(score.value, score.unit)} · n = {score.sampleSize}
      </p>
    </div>
  );
}

function EmptyRow({ children }: { children: string }) {
  return (
    <p className="type-ui-small w-full border-b border-by-border-engraved py-1.5 text-by-text-tertiary">
      {children}
    </p>
  );
}

function RepContext({ home, focusScore }: { home: RepHome; focusScore: BehaviorScore | null }) {
  const focus = home.focus;
  const coach = focus ? demoPersonName(focus.assignedById) : null;
  const week = demoWeek();
  return (
    <div className="flex flex-col gap-[22px]">
      {focus ? (
        <>
          <PanelLabel>FOCUS PROGRESS</PanelLabel>
          <div className="flex flex-col gap-2 rounded-by-card border border-by-border-engraved bg-by-surface-inset px-3.5 py-3">
            <p className="type-mono-micro text-by-text-tertiary">
              {focus.behaviorName.toUpperCase()}
              {focusScore?.unit === "seconds" ? " (SEC)" : ""} · RECENT TREND
            </p>
            {focusScore ? (
              <LocalSparkline
                sparkline={focusScore.sparkline}
                tone={directionTone(focusScore.direction)}
                target={focus.target}
                targetLabel={`target ${formatScore(focus.target, focusScore.unit)}`}
                className="h-[60px] w-full"
              />
            ) : null}
            <p className="type-ui-small text-by-text-secondary">
              {progressLine(focus, focusScore)}
            </p>
          </div>

          <PanelLabel>
            {coach ? `FROM ${firstName(coach).toUpperCase()}` : "FROM YOUR MANAGER"}
          </PanelLabel>
          <div className="flex flex-col gap-2 border border-by-border-engraved px-3.5 py-3">
            <div className="flex items-center gap-2">
              <Avatar name={coach ?? "Manager"} size={22} />
              <p className="type-ui-body-strong flex-1 text-by-text-primary">
                {coach ?? "Your manager"}
              </p>
              <p className="type-mono-micro text-by-text-tertiary">{noteTime(focus.assignedAt)}</p>
            </div>
            <p className="type-ui-small text-by-text-primary">{focus.note}</p>
            {focus.evidence[0] ? (
              <EvidenceBlock
                evidence={{
                  timestamp: focus.evidence[0].timestamp,
                  speaker: focus.evidence[0].speakerLabel,
                  quote: focus.evidence[0].quote,
                  href: `/app/rep/calls/${focus.evidence[0].callId}#t-${focus.evidence[0].tSeconds}`,
                }}
              />
            ) : null}
          </div>
        </>
      ) : null}

      <PanelLabel>THIS WEEK · YOU</PanelLabel>
      <div className="flex flex-col">
        {week.length ? null : <StatRow label="Calls analyzed" value={String(home.analyzedCalls)} />}
        {week.map((s) => (
          <StatRow key={s.label} label={s.label} value={s.value} tone={s.tone} />
        ))}
      </div>
      <p className="type-mono-micro text-by-text-tertiary">
        No team rankings here. This view is only about you.
      </p>
    </div>
  );
}

/** Says how far the focus is, and when Bylda will judge it — never a verdict early. */
function progressLine(focus: CoachingFocus, score: BehaviorScore | null): string {
  const judge = focus.judgeAfter.calls
    ? `Bylda will judge after ${focus.judgeAfter.calls} calls with objections.`
    : "Bylda will judge it once there are enough calls.";
  if (!score) return `Measuring from your next call. ${judge}`;
  const lead =
    score.direction === "improving"
      ? "Trending the right way, but it’s too early to call it."
      : score.direction === "regressing"
        ? `Not there yet — ${formatScore(score.value, score.unit)} against a ${formatScore(focus.target, score.unit)} target.`
        : "Holding steady so far.";
  return `${lead} ${judge}`;
}

function StatRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "improve" | "regress" | "attention" | "info" | "neutral";
}) {
  return (
    <div className="flex items-start border-b border-by-border-engraved py-[7px]">
      <p className="type-ui-small flex-1 text-by-text-secondary">{label}</p>
      <p
        className={cn(
          "type-mono-data",
          tone === "improve"
            ? "text-by-signal-improve"
            : tone === "regress"
              ? "text-by-signal-regress"
              : "text-by-text-primary",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-2.5 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-[18px] py-4",
        className,
      )}
    >
      {children}
    </section>
  );
}

function CardHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex items-start">
      <p className="type-ui-label flex-1 text-by-text-primary">{title}</p>
      {meta ? <p className="type-mono-micro text-by-text-tertiary">{meta}</p> : null}
    </div>
  );
}

function PanelLabel({ children }: { children: string }) {
  return <p className="type-ui-label text-by-text-primary">{children}</p>;
}

/** "Dana Whitfield" → "Dana W." */
const shortName = (name: string) => {
  const [first, last] = name.split(/\s+/);
  return last ? `${first} ${last[0]}.` : first;
};

function BriefSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <SkeletonBar width={224} height={12} />
      <SkeletonBar width={288} height={32} />
      <SkeletonBlock height={64} />
      <SkeletonBlock height={224} />
      <div className="flex gap-5">
        <SkeletonBlock height={192} className="flex-1" />
        <SkeletonBlock height={192} className="flex-1" />
      </div>
    </div>
  );
}
