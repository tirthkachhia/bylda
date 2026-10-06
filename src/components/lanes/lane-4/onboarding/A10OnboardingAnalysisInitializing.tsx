import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Button,
  DataBoundary,
  SystemState,
  systemStates,
  Tag,
  type TagTone,
} from "@/components/bylda";
import {
  TEAM_PATTERN_MIN_CALLS,
  useDataSources,
  useInsights,
  useOnboarding,
  type DataSource,
  type OnboardingState,
} from "@/lib/data";
import { InsetNote, OnboardingLayout, StepActions, StepHeader } from "./OnboardingLayout";
import { analysisDemo, type AnalysisDemo } from "./onboardingDemo";

/**
 * A10 · Onboarding — Analysis initializing
 * Figma 16:21 (page 1:5) · Lane 4 — Dravin · route /welcome/analysis · Flow 4
 *
 * A real count, not an animation (Figma: "64% · real count, not an animation"). No fake
 * progress, no shimmer. Stage statuses are derived from the analyzed/total counts and the
 * connected sources — GAP: per-stage status from the pipeline (C-16, LANE_REQUESTS.md #19).
 */

type StageStatus = "done" | "running" | "blocked" | "waiting";
const STATUS_TAG: Record<StageStatus, { tone: TagTone; label: string }> = {
  done: { tone: "improve", label: "Done" },
  running: { tone: "info", label: "Running" },
  blocked: { tone: "attention", label: "Blocked" },
  waiting: { tone: "neutral", label: "Waiting" },
};

type Stage = { title: string; detail: string; status: StageStatus };

function stagesFor(
  a: OnboardingState["analysis"],
  sources: DataSource[],
  demo: AnalysisDemo | null,
): Stage[] {
  const complete = a.total > 0 && a.analyzed >= a.total;
  const callSources = sources
    .filter((s) => s.category !== "crm" && s.status === "connected")
    .map((s) => s.name);
  const crm = sources.find((s) => s.category === "crm" && s.status === "connected");
  const crmTrouble = sources.find((s) => s.category === "crm" && s.status === "error");
  const eta = a.etaMinutes !== null ? ` · ~${a.etaMinutes} min left` : "";
  return [
    {
      title: "Import calls",
      detail:
        demo?.importDetail ??
        (callSources.length
          ? `${a.total} recordings from ${callSources.join(" + ")}`
          : `${a.total} recordings`),
      status: "done",
    },
    {
      title: "Transcribe & separate speakers",
      detail: complete ? `${a.total} of ${a.total}` : `${a.analyzed} of ${a.total}${eta}`,
      status: complete ? "done" : "running",
    },
    {
      title: "Detect behavioral events",
      detail: "Objections, interruptions, questions, monologues",
      status: complete ? "done" : "running",
    },
    demo
      ? { title: "Match calls to CRM outcomes", ...demo.crm }
      : {
          title: "Match calls to CRM outcomes",
          detail: crm
            ? `Reading outcomes from ${crm.name}`
            : crmTrouble
              ? `${crmTrouble.name}: ${crmTrouble.error ?? "sync stopped"}`
              : "Connect a CRM to link calls to outcomes",
          status: crm ? (complete ? "done" : "running") : "blocked",
        },
    {
      title: "Find patterns",
      detail: `Needs ≥ ${TEAM_PATTERN_MIN_CALLS} analyzed calls per team`,
      status:
        demo?.patterns.status ??
        (a.analyzed < TEAM_PATTERN_MIN_CALLS ? "waiting" : complete ? "done" : "running"),
    },
  ];
}

export function A10OnboardingAnalysisInitializing() {
  const navigate = useNavigate();
  const onboarding = useOnboarding();
  const sources = useDataSources();
  const insights = useInsights({ kind: "pattern" });
  const [note, setNote] = useState<string | null>(null);
  const firstInsightReady = insights.data?.some((g) => g.state === "insight") ?? false;
  const demo = analysisDemo();

  return (
    <OnboardingLayout step={4} width={700} top={80}>
      <DataBoundary query={onboarding}>
        {({ analysis: a }) => {
          if (a.total === 0) {
            return (
              <SystemState
                {...systemStates.homeNoCalls({
                  neededPerTeam: TEAM_PATTERN_MIN_CALLS,
                  onConnect: () => void navigate({ to: "/welcome/connect" }),
                  onUpload: () => void navigate({ to: "/app/calls/upload" }),
                })}
              />
            );
          }
          const complete = a.analyzed >= a.total;
          const pct = Math.min(100, Math.round((a.analyzed / a.total) * 100));
          return (
            <>
              <StepHeader
                eyebrow={`Step 5 of 5 · ${complete ? "Done" : "Running"}`}
                title="Bylda is listening to your last 90 days."
                lead={
                  complete
                    ? `All ${a.total} calls are analyzed.`
                    : `${
                        a.etaMinutes !== null
                          ? `This takes about ${a.etaMinutes} more minutes for ${a.total} calls.`
                          : `${a.analyzed} of ${a.total} calls so far.`
                      } You don’t need to stay — the first insight shows up here as soon as there’s enough evidence.`
                }
              />
              <ol className="flex w-full flex-col rounded-by-card border border-by-border-engraved bg-by-surface-raised px-5 py-2">
                {stagesFor(a, sources.data ?? [], demo).map((s) => (
                  <li
                    key={s.title}
                    className="flex w-full items-center gap-3 border-b border-by-border-engraved py-3 last:border-b-0"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="type-ui-body-strong text-by-text-primary">{s.title}</span>
                      <span className="type-ui-small text-by-text-secondary">{s.detail}</span>
                    </span>
                    <Tag tone={STATUS_TAG[s.status].tone}>{STATUS_TAG[s.status].label}</Tag>
                  </li>
                ))}
              </ol>
              <div className="flex w-full flex-col gap-1.5">
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={a.total}
                  aria-valuenow={a.analyzed}
                  aria-label="Calls analyzed"
                  className="h-[3px] w-full bg-by-border-engraved"
                >
                  <div className="h-full bg-by-surface-control-dark" style={{ width: `${pct}%` }} />
                </div>
                <span className="type-mono-micro text-by-text-tertiary">
                  {pct}% · real count, not an animation
                </span>
              </div>
              <InsetNote label="Already visible">
                {/* GAP: objections detected and reps matched so far — C-16. */}
                {demo?.alreadyVisible ?? `${a.analyzed} calls transcribed`}
              </InsetNote>
              {note ? (
                <InsetNote label="Heads up" role="status">
                  {note}
                </InsetNote>
              ) : null}
              <StepActions>
                {firstInsightReady && !demo ? (
                  <Button asChild>
                    <Link to="/welcome/first-insight">See the first insight</Link>
                  </Button>
                ) : null}
                <Button variant="secondary" asChild>
                  <Link to="/welcome/invite-team">Invite team while you wait</Link>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    // GAP: no "notify me when analysis finishes" action yet (LANE_REQUESTS.md #19).
                    setNote(
                      "Ready alerts aren’t wired up yet. Leave this tab open, or check Home later.",
                    )
                  }
                >
                  Email me when ready
                </Button>
              </StepActions>
            </>
          );
        }}
      </DataBoundary>
    </OnboardingLayout>
  );
}
