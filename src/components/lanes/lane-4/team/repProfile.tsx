import { Link } from "@tanstack/react-router";
import {
  Avatar,
  Button,
  ConfidenceMeter,
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
  useDmThreads,
  useInsights,
  useRepSummary,
  useTeam,
  type Call,
  type CallOutcome,
  type CoachingFocus,
  type RepSummary,
  type SignalTone,
} from "@/lib/data";
import { OUTCOME_LABEL } from "../rep/repFormat";
import { useRepIdParam } from "./repProfileFormat";

/**
 * Shared pieces for the Rep Profile screens T8–T12 (Figma page 09, 12:271 · 45:1147 ·
 * 45:1493 · 45:1841 · 45:2142). Pure presentation of data-layer values — no numbers here.
 *
 * Copy that would need a rep's pronouns ("his baseline") is written neutrally: the data
 * layer carries no pronouns, and guessing from a name is wrong.
 */

// ── header ────────────────────────────────────────────────────────────────────

export type RepTab = "overview" | "calls" | "coaching" | "trends";
const TABS: { key: RepTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "calls", label: "Calls" },
  { key: "coaching", label: "Coaching" },
  { key: "trends", label: "Trends" },
];

/**
 * T9–T12 frame: avatar · name · meta line · Message · Assign coaching, then the tab row.
 * Each tab renders its own body below; the header owns loading / error / not-found.
 */
export function RepProfileFrame({
  tab,
  children,
}: {
  tab: RepTab;
  children: (summary: RepSummary) => React.ReactNode;
}) {
  const repId = useRepIdParam();
  const summary = useRepSummary(repId);
  return (
    <div className="flex w-full flex-col gap-5 px-9 py-7 max-[1024px]:px-6">
      <DataBoundary
        query={summary}
        loading={<ProfileSkeleton />}
        error={() => (
          <StateError
            eyebrow="TEAM · REP PROFILE"
            body="Bylda couldn’t load this rep. Try again in a moment."
            onRetry={() => void summary.refetch()}
          />
        )}
        empty={<RepNotFound />}
      >
        {(s) =>
          s ? (
            <>
              <header className="flex items-center gap-4">
                <Avatar name={s.rep.name} size={64} />
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <h1 className="type-editorial-h1 truncate text-by-text-primary">{s.rep.name}</h1>
                  <RepMeta summary={s} window="(30d)" />
                </div>
                <MessageButton repId={s.rep.id} />
                <AssignButton repId={s.rep.id} />
              </header>
              <RepTabs repId={s.rep.id} active={tab} />
              {children(s)}
            </>
          ) : (
            <RepNotFound />
          )
        }
      </DataBoundary>
    </div>
  );
}

/** "Account Executive · Mid-Market AE · 24 calls (30d)". Tenure has no field (LANE_REQUESTS #32). */
export function RepMeta({
  summary,
  window,
  className,
}: {
  summary: RepSummary;
  window: string;
  className?: string;
}) {
  const team = useTeam(summary.rep.teamId ?? "");
  const parts = [
    summary.rep.title,
    summary.rep.teamId ? team.data?.name : null,
    // GAP: tenure ("14 months") — no start date on Person (LANE_REQUESTS #32)
    `${summary.analyzedCalls} calls ${window}`,
  ].filter(Boolean);
  return (
    <p className={cn("type-ui-small text-by-text-secondary", className)}>{parts.join(" · ")}</p>
  );
}

function RepTabs({ repId, active }: { repId: string; active: RepTab }) {
  return (
    <nav aria-label="Rep profile" className="flex gap-[22px] border-b border-by-border-engraved">
      {TABS.map((t) => (
        <Link
          key={t.key}
          to={`/app/team/reps/$repId/${t.key}`}
          params={{ repId }}
          aria-current={t.key === active ? "page" : undefined}
          className={cn(
            "type-ui-body -mb-px border-b-2 py-[9px] transition-colors duration-200 ease-out",
            t.key === active
              ? "type-ui-body-strong border-by-text-primary text-by-text-primary"
              : "border-transparent text-by-text-secondary hover:text-by-text-primary",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** Opens the manager's DM with this rep when one exists; otherwise there's nowhere to go. */
export function MessageButton({ repId }: { repId: string }) {
  const threads = useDmThreads();
  const thread = threads.data?.find((t) => !t.isCoach && t.participantIds.includes(repId));
  if (!thread)
    return (
      <Button variant="secondary" disabled title="No direct message with this rep yet">
        Message
      </Button>
    );
  return (
    <Button variant="secondary" asChild>
      <Link to="/app/dm/$threadId" params={{ threadId: thread.id }}>
        Message
      </Link>
    </Button>
  );
}

export function AssignButton({ repId }: { repId: string }) {
  return (
    <Button asChild>
      <Link to="/app/coaching/assign" search={{ repId } as never}>
        Assign coaching
      </Link>
    </Button>
  );
}

function RepNotFound() {
  return (
    <SystemState
      eyebrow="TEAM · REP PROFILE"
      title="This rep isn’t in your workspace."
      body="They may have left the team, or the link is wrong."
      actions={[{ label: "Back to Team", variant: "ghost", href: "/app/team" }]}
    />
  );
}

export function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <div className="flex items-center gap-4">
        <SkeletonBlock height={64} className="w-16 rounded-full" />
        <div className="flex flex-col gap-2">
          <SkeletonBar width={240} height={30} />
          <SkeletonBar width={320} height={12} />
        </div>
      </div>
      <SkeletonBlock height={36} />
      <SkeletonBlock height={240} />
      <SkeletonBlock height={160} />
    </div>
  );
}

// ── "What <rep> needs from you" ───────────────────────────────────────────────

/**
 * The top insight about this rep (manager view), with confidence + sample size.
 * Below the rep threshold (§13.13) it renders the "not enough data yet" state instead.
 * Low confidence = observation only: no "Coach now" action (§4).
 */
export function NeedsFromYou({
  repId,
  firstName,
  variant,
}: {
  repId: string;
  firstName: string;
  variant: "wide" | "compact";
}) {
  const insights = useInsights({ repId, limit: 1 });
  const wide = variant === "wide";
  return (
    <section
      aria-label={`What ${firstName} needs from you`}
      className={cn(
        "flex flex-col rounded-by-card border border-by-border-engraved bg-by-surface-raised",
        wide ? "gap-2.5 px-[22px] py-5" : "gap-2.5 px-[18px] py-4",
      )}
    >
      <p
        className={
          wide ? "type-ui-label text-by-text-secondary" : "type-ui-title text-by-text-primary"
        }
      >
        {wide
          ? `WHAT ${firstName.toUpperCase()} NEEDS FROM YOU`
          : `What ${firstName} needs from you`}
      </p>
      <DataBoundary
        query={insights}
        loading={<SkeletonBlock height={wide ? 96 : 72} />}
        error={() => (
          <StateError
            body="Couldn’t load this rep’s insights."
            onRetry={() => void insights.refetch()}
          />
        )}
        empty={
          <p className="type-ui-small text-by-text-secondary">
            Nothing needs you right now. Bylda raises one thing here when the evidence is there.
          </p>
        }
      >
        {([gated]) =>
          gated.state === "insufficient" ? (
            <SystemState
              surface="bare"
              eyebrow="REP · NOT ENOUGH CALLS YET"
              tag={{ tone: "attention", label: "Low evidence" }}
              title="Not enough analyzed calls to say what to coach."
              body={`${gated.callsAnalyzed} of ${gated.callsNeeded} calls analyzed.`}
            />
          ) : (
            <div
              className={cn("flex gap-2.5", wide ? "flex-col" : "flex-col items-start")}
              title={gated.insight.body ?? undefined}
            >
              <p className="type-editorial-insight text-by-text-primary">
                {gated.insight.headline}
              </p>
              <div
                className={cn(
                  "flex gap-3",
                  wide ? "flex-row-reverse items-center justify-end" : "flex-col items-start",
                )}
              >
                <ConfidenceMeter
                  level={gated.insight.confidence}
                  sampleSize={gated.insight.sampleSize}
                  sampleLabel={wide ? (gated.insight.sampleLabel ?? undefined) : undefined}
                />
                {gated.insight.confidence !== "low" &&
                gated.insight.action?.type === "assign_coaching" ? (
                  <Link
                    to="/app/coaching/assign"
                    search={
                      {
                        repId,
                        behaviorKey: gated.insight.action.behaviorKey,
                      } as never
                    }
                    className="rounded-by-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-by-focus-ring"
                  >
                    <Tag tone={gated.insight.tone}>Coach now</Tag>
                  </Link>
                ) : null}
              </div>
            </div>
          )
        }
      </DataBoundary>
    </section>
  );
}

// ── shared labels ─────────────────────────────────────────────────────────────

const OUTCOME_TONE: Record<CallOutcome, TagTone> = {
  won: "improve",
  advanced: "improve",
  lost: "regress",
  no_decision: "attention",
  pending: "neutral",
};

export function OutcomeTag({ outcome }: { outcome: CallOutcome | null }) {
  if (!outcome) return <span className="type-mono-data text-by-text-tertiary">—</span>;
  return <Tag tone={OUTCOME_TONE[outcome]}>{OUTCOME_LABEL[outcome]}</Tag>;
}

/** What the call's top moment asks of the manager — named from its tone, never a score. */
const MOMENT_VERDICT: Record<SignalTone, string | null> = {
  regress: "Needs review",
  attention: "Needs coaching",
  improve: "Good",
  info: "Pattern",
  neutral: null,
};

export function MomentTag({ call }: { call: Call }) {
  const tone = call.topMoment?.tone;
  const label = tone ? MOMENT_VERDICT[tone] : null;
  if (!tone || !label) return <span className="type-mono-data text-by-text-tertiary">—</span>;
  return <Tag tone={tone}>{label}</Tag>;
}

export function PanelLabel({ children }: { children: string }) {
  return <p className="type-ui-label text-by-text-primary">{children}</p>;
}

/** Three engraved gridlines behind a chart, like the Figma frame. */
export function ChartGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative h-[150px] w-full", className)}>
      <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="block border-t border-by-border-engraved" />
        ))}
      </div>
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}
