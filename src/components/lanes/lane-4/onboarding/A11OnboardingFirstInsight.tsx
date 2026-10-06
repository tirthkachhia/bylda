import { Link, useNavigate } from "@tanstack/react-router";
import {
  Button,
  ConfidenceMeter,
  DataBoundary,
  EvidenceBlock,
  SystemState,
  systemStates,
} from "@/components/bylda";
import {
  useInsights,
  useOnboarding,
  useViewer,
  type GatedInsight,
  type Insight,
  type InsightAction,
} from "@/lib/data";
import { firstInsightDemo, type FirstInsightDemo } from "./onboardingDemo";

/**
 * A11 · Onboarding — First insight
 * Figma 16:244 (page 1:5) · Lane 4 — Dravin · route /welcome/first-insight · Flow 4
 *
 * The hero card is the one card allowed `shadow-by-float` (CLAUDE.md §13.3). Confidence +
 * sample size always render; low confidence = observation only (no action button); the
 * insight only renders once it clears TEAM_PATTERN_MIN_CALLS (gated in @/lib/data).
 */
export function A11OnboardingFirstInsight() {
  const navigate = useNavigate();
  const insights = useInsights({ kind: "pattern" });
  const onboarding = useOnboarding();
  const viewer = useViewer();
  const analysis = onboarding.data?.analysis;
  const first = insights.data?.find(
    (g): g is Extract<GatedInsight, { state: "insight" }> => g.state === "insight",
  );
  const waiting = insights.data?.find((g) => g.state === "insufficient");

  const notYet = waiting ? (
    <SystemState
      {...systemStates.insufficientData({
        seenIn: waiting.callsAnalyzed,
        needed: waiting.callsNeeded,
      })}
      eyebrow="FIRST INSIGHT · NOT ENOUGH DATA YET"
      title="Bylda needs a few more calls before it says anything about your team."
      body={`${waiting.callsAnalyzed} calls analyzed so far. Team patterns start at ${waiting.callsNeeded}.`}
      actions={[
        {
          label: "Back to analysis",
          variant: "secondary",
          onClick: () => void navigate({ to: "/welcome/analysis" }),
        },
      ]}
    />
  ) : (
    <SystemState
      {...systemStates.analysisProcessing({
        analyzed: analysis?.analyzed,
        total: analysis?.total,
        etaMinutes: analysis?.etaMinutes ?? undefined,
        onNotify: () => void navigate({ to: "/welcome/analysis" }),
      })}
      actions={[
        {
          label: "Back to analysis",
          variant: "secondary",
          onClick: () => void navigate({ to: "/welcome/analysis" }),
        },
      ]}
    />
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-by-surface-canvas px-4 pb-16 pt-20 sm:px-10 lg:pt-[200px]">
      <GridBackdrop />
      <div className="relative mx-auto flex w-full max-w-[760px] flex-col items-start gap-[22px]">
        <DataBoundary query={{ ...insights, isEmpty: !first }} empty={notYet}>
          {() =>
            first ? (
              <FirstInsight
                insight={first.insight}
                totalCalls={analysis?.total ?? null}
                reps={viewer.data?.team?.repCount ?? null}
                demo={firstInsightDemo()}
              />
            ) : null
          }
        </DataBoundary>
      </div>
    </div>
  );
}

/** Figma's 4mm grid (16px, silver/200 hairlines at 35%) behind the first insight. */
function GridBackdrop() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full text-by-border-engraved opacity-35"
    >
      <defs>
        <pattern id="a11-grid" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M 0 0 V 16 M 0 0 H 16" fill="none" stroke="currentColor" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#a11-grid)" />
    </svg>
  );
}

function FirstInsight({
  insight,
  totalCalls,
  reps,
  demo,
}: {
  insight: Insight;
  totalCalls: number | null;
  reps: number | null;
  demo: FirstInsightDemo | null;
}) {
  const evidence = insight.evidence[0];
  const canAct = insight.confidence !== "low" && insight.action !== null;
  const calls = totalCalls ?? insight.callsAnalyzed;
  if (demo) return <FirstInsightFigma insight={insight} calls={calls} reps={reps} demo={demo} />;
  return (
    <>
      <p className="type-mono-micro uppercase text-by-text-tertiary">
        {/* 90 days = the import window A10 promises ("your last 90 days"). */}
        Ready · {calls} calls{reps ? ` · ${reps} reps` : ""} · 90 days
      </p>
      <h1 className="type-display-l text-by-text-primary">
        Here’s the first thing Bylda noticed about your team.
      </h1>
      <article className="flex w-full animate-by-resolve flex-col gap-4 rounded-by-card border border-by-border-focus bg-by-surface-raised px-7 py-[26px] shadow-by-float">
        <h2 className="type-editorial-h2 text-by-text-primary">{insight.headline}</h2>
        {/* GAP: the metric trio (with vs without, outcome rate, count) isn't on Insight —
            C-04 / LANE_REQUESTS.md #19. The body carries the numbers until it is. */}
        {insight.body ? (
          <p className="type-ui-body text-by-text-secondary">{insight.body}</p>
        ) : null}
        {evidence ? (
          <EvidenceBlock
            evidence={{
              timestamp: evidence.timestamp,
              speaker: evidence.speakerLabel,
              quote: evidence.quote,
            }}
          />
        ) : null}
        <div className="flex w-full flex-wrap items-center gap-x-2.5 gap-y-1">
          <ConfidenceMeter
            level={insight.confidence}
            sampleSize={insight.sampleSize}
            sampleLabel={insight.sampleLabel ?? undefined}
          />
          {!insight.causalTested ? (
            <span className="type-mono-micro min-w-0 flex-1 text-by-text-secondary">
              Association, not a proven cause. Confidence rises as more deals close.
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canAct && insight.action ? <ActionButton action={insight.action} /> : null}
          {evidence ? (
            <Button variant="secondary" asChild>
              <Link to="/app/calls/$callId" params={{ callId: evidence.callId }}>
                {insight.evidence.length === 1
                  ? "Hear the example"
                  : `Hear ${insight.evidence.length} examples`}
              </Link>
            </Button>
          ) : null}
          <Button variant="ghost" asChild>
            <Link to="/app/home">Go to my Home</Link>
          </Button>
        </div>
      </article>
      <p className="type-ui-small text-by-text-secondary">
        Tomorrow morning you’ll get your first Daily Brief. Reps get theirs once you invite them.
      </p>
    </>
  );
}

/** Mocks-only Figma copy (onboardingDemo.ts); confidence still comes from the insight. */
function FirstInsightFigma({
  insight,
  calls,
  reps,
  demo,
}: {
  insight: Insight;
  calls: number;
  reps: number | null;
  demo: FirstInsightDemo;
}) {
  const canAct = insight.confidence !== "low";
  return (
    <>
      <p className="type-mono-micro uppercase text-by-text-tertiary">
        Ready · {calls} calls{reps ? ` · ${reps} reps` : ""} · 90 days
      </p>
      <h1 className="type-display-l text-by-text-primary">
        Here’s the first thing Bylda noticed about your team.
      </h1>
      <article className="flex w-full animate-by-resolve flex-col gap-4 rounded-by-card border border-by-border-focus bg-by-surface-raised px-7 py-[26px] shadow-by-float">
        <h2 className="type-editorial-h2 text-by-text-primary">{demo.headline}</h2>
        <dl className="flex w-full items-start">
          {demo.metrics.map((m) => (
            <div key={m.label} className="flex min-w-0 flex-1 flex-col gap-1 py-1">
              <dt className="type-mono-micro uppercase text-by-text-tertiary">{m.label}</dt>
              <dd className="type-mono-metric text-by-text-primary">{m.value}</dd>
              <dd className="type-mono-micro text-by-text-secondary">{m.note}</dd>
            </div>
          ))}
        </dl>
        <EvidenceBlock
          evidence={{
            timestamp: demo.evidence.timestamp,
            speaker: demo.evidence.speaker,
            quote: demo.evidence.quote,
          }}
        />
        <div className="flex w-full flex-wrap items-center gap-x-2.5 gap-y-1">
          <ConfidenceMeter level={insight.confidence} sampleSize={demo.sampleSize} />
          <span className="type-mono-micro min-w-0 flex-1 text-by-text-secondary">
            {demo.caveat}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canAct ? (
            <Button asChild>
              <Link
                to="/app/intelligence/behaviors/$behaviorKey"
                params={{ behaviorKey: demo.primary.behaviorKey }}
              >
                {demo.primary.label}
              </Link>
            </Button>
          ) : null}
          <Button variant="secondary" asChild>
            <Link to="/app/calls/$callId" params={{ callId: demo.evidence.callId }}>
              Hear {demo.examples} examples
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/app/home">Go to my Home</Link>
          </Button>
        </div>
      </article>
      <p className="type-ui-small text-by-text-secondary">
        Tomorrow at {demo.briefAt} you’ll get your first Daily Brief. Reps get theirs once you
        invite them.
      </p>
    </>
  );
}

/** The insight's own action — never shown at low confidence. */
function ActionButton({ action }: { action: InsightAction }) {
  switch (action.type) {
    case "open_behavior":
      return (
        <Button asChild>
          <Link
            to="/app/intelligence/behaviors/$behaviorKey"
            params={{ behaviorKey: action.behaviorKey }}
          >
            {action.label}
          </Link>
        </Button>
      );
    case "assign_coaching":
      return (
        <Button asChild>
          <Link to="/app/coaching/assign">{action.label}</Link>
        </Button>
      );
    case "review_calls":
      return (
        <Button asChild>
          <Link to="/app/calls">{action.label}</Link>
        </Button>
      );
    case "open_report":
      return (
        <Button asChild>
          <Link to="/app/reports">{action.label}</Link>
        </Button>
      );
  }
}
