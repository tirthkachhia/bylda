// Founder Course — the post-approval, casefile-personalized program.
//
// One vertical path. Exactly one module is "active"; the rest are locked and
// greyed until the prior module completes. Inside the active module the founder
// sees ONE step at a time — the next step never appears until the current one
// is marked complete. Each step points at a real, clickable in-product action;
// "Start this step" navigates there and a coachmark spotlights the exact
// control. Completion flows through advance-mission (which dual-writes to
// bylda_events and unlocks the next module) and is celebrated in the moment.

import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCourse, type CourseModule, type CourseStep } from "@/hooks/use-course";
import { requestCoachmark } from "@/components/launchpad/Coachmark";
import { StageSpine } from "@/components/launchpad/StageSpine";
import { invokeEdge } from "@/lib/invokeEdge";
import { mentorById, mentorInitials, type Mentor } from "@/lib/mentors";
import { ArrowRight, Check, Lock, GraduationCap, Sparkles } from "lucide-react";

export const Route = createFileRoute("/app/launchpad/course")({ component: CoursePage });

// Map the active module's lane → position on the shared founder-journey spine
// (Idea → Validate → Build → Launch → Operate). When every module is complete,
// the founder has reached the end of the journey.
const LANE_TO_JOURNEY: Record<string, number> = { Idea: 0, Offer: 1, Customer: 3, Systems: 4 };
function journeyIndex(activeLane: string | null, allComplete: boolean): number {
  if (allComplete) return 4;
  if (!activeLane) return 0;
  return LANE_TO_JOURNEY[activeLane] ?? 0;
}

function CoursePage() {
  const course = useCourse();
  const qc = useQueryClient();
  const [busyStepId, setBusyStepId] = useState<string | null>(null);

  const refresh = () => {
    // Course view + the mission spine (useProgressSpine → currentMissionQuery).
    qc.invalidateQueries({ queryKey: ["founder-course"] });
    qc.invalidateQueries({ queryKey: ["current-mission"] });
    // bylda_events-derived surfaces (momentum, graph signals) pick up the new event.
    qc.invalidateQueries({ queryKey: ["business-graph-bylda-events"] });
  };

  async function completeStep(step: CourseStep, module: CourseModule, mentor: Mentor | null) {
    if (busyStepId) return;
    setBusyStepId(step.id);
    try {
      const res = (await invokeEdge("advance-mission", {
        action: "complete_step",
        step_id: step.id,
        mission_id: module.id,
        workspace_id: course.workspaceId,
      })) as { mission_auto_completed?: boolean };

      if (res?.mission_auto_completed) {
        toast.success(`Module complete — "${module.title}" is done`, {
          description: "Your next module just unlocked. Keep the momentum.",
          icon: "🎉",
        });
      } else {
        const who = mentor?.first ?? "Bylda";
        toast.success("Step complete", {
          description: `Nice work. ${who} has your next move ready.`,
          icon: "✓",
        });
      }
      refresh();
    } catch {
      toast.error("Couldn't save that step. Try again in a moment.");
    } finally {
      setBusyStepId(null);
    }
  }

  if (course.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-24 animate-pulse rounded-2xl bg-[--surface-2]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[--surface-2]" />
      </div>
    );
  }

  if (!course.hasCourse) return <EmptyCourse />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
        >
          <GraduationCap className="h-5 w-5" />
        </span>
        <div>
          <h1
            className="font-display text-[24px] font-extrabold leading-tight"
            style={{ color: "var(--foreground)", letterSpacing: "-0.03em" }}
          >
            Your course
          </h1>
          <p className="mt-0.5 text-[13.5px]" style={{ color: "var(--muted-foreground)" }}>
            Built from your casefile. One module at a time — Bylda points at exactly what to click.
          </p>
        </div>
      </div>

      {/* Where this course sits in the founder journey — the shared spine. */}
      <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        <StageSpine
          currentIndex={journeyIndex(
            course.activeModule?.lane ?? null,
            course.modules.length > 0 && !course.activeModule,
          )}
          accent="var(--primary)"
          doneColor="var(--success)"
          mutedColor="var(--text-faint)"
          trackColor="var(--border)"
          labelColor="var(--muted-foreground)"
        />
      </div>

      {/* Vertical path */}
      <div className="space-y-3">
        {course.modules.map((m, i) => {
          const mentor = mentorById(m.mentor_owner);
          const currentStep = course.currentStepOf(m);
          const doneCount = course.completedStepCount(m);
          return (
            <ModuleNode
              key={m.id}
              module={m}
              index={i}
              isLast={i === course.modules.length - 1}
              mentor={mentor}
              currentStep={currentStep}
              doneCount={doneCount}
              busyStepId={busyStepId}
              onStart={(step) => {
                if (step.target_ui_ref) {
                  requestCoachmark("tool-runner");
                  // target_ui_ref is an in-app route path.
                  window.location.assign(step.target_ui_ref);
                }
              }}
              onComplete={(step) => completeStep(step, m, mentor)}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ── One module node on the vertical path ─────────────────────────── */

function ModuleNode({
  module: m,
  index,
  isLast,
  mentor,
  currentStep,
  doneCount,
  busyStepId,
  onStart,
  onComplete,
}: {
  module: CourseModule;
  index: number;
  isLast: boolean;
  mentor: Mentor | null;
  currentStep: CourseStep | null;
  doneCount: number;
  busyStepId: string | null;
  onStart: (s: CourseStep) => void;
  onComplete: (s: CourseStep) => void;
}) {
  const state: "completed" | "active" | "locked" =
    m.status === "completed" ? "completed" : m.status === "active" ? "active" : "locked";
  const total = m.steps.length;

  const nodeColor =
    state === "completed"
      ? "var(--success)"
      : state === "active"
        ? "var(--primary)"
        : "var(--text-faint)";

  return (
    <div className="flex gap-3.5">
      {/* Rail */}
      <div className="flex flex-col items-center">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
          style={
            state === "locked"
              ? {
                  background: "var(--surface-2)",
                  color: "var(--text-faint)",
                  border: "1px solid var(--border)",
                }
              : {
                  background: nodeColor,
                  color:
                    state === "completed"
                      ? "var(--success-foreground)"
                      : "var(--primary-foreground)",
                  boxShadow: state === "active" ? "0 0 0 4px var(--primary-soft)" : undefined,
                }
          }
        >
          {state === "completed" ? (
            <Check className="h-4 w-4" />
          ) : state === "locked" ? (
            <Lock className="h-3.5 w-3.5" />
          ) : (
            index + 1
          )}
        </span>
        {!isLast && (
          <span
            className="mt-1 w-[2px] flex-1 rounded-full"
            style={{
              background: state === "completed" ? "var(--success)" : "var(--border)",
              minHeight: 24,
            }}
          />
        )}
      </div>

      {/* Card */}
      <div
        className="mb-1 flex-1 overflow-hidden rounded-2xl border"
        style={{
          borderColor: state === "active" ? "var(--primary-border)" : "var(--border)",
          background:
            state === "active"
              ? "color-mix(in oklab, var(--primary) 5%, var(--surface))"
              : "var(--surface)",
          opacity: state === "locked" ? 0.6 : 1,
        }}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3.5">
          <div className="min-w-0">
            <div
              className="text-[10.5px] font-bold uppercase tracking-[0.08em]"
              style={{ color: "var(--text-faint)" }}
            >
              Module {index + 1}
              {mentor && <> · {mentor.first}</>}
            </div>
            <div
              className="mt-0.5 truncate text-[15px] font-extrabold"
              style={{ color: "var(--foreground)" }}
            >
              {m.title}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {mentor && (
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: "var(--surface-2)", color: mentor.hue }}
                title={`${mentor.name} · ${mentor.domain}`}
              >
                {mentorInitials(mentor)}
              </span>
            )}
            <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-faint)" }}>
              {doneCount}/{total}
            </span>
          </div>
        </div>

        {/* Active module → the one current step, full width */}
        {state === "active" && currentStep && (
          <ActiveStep
            step={currentStep}
            stepNumber={doneCount + 1}
            total={total}
            mentor={mentor}
            busy={busyStepId === currentStep.id}
            onStart={() => onStart(currentStep)}
            onComplete={() => onComplete(currentStep)}
          />
        )}
        {state === "active" && !currentStep && (
          <div className="px-5 pb-4 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            All steps done — wrapping up this module…
          </div>
        )}
      </div>
    </div>
  );
}

/* ── The single active step ───────────────────────────────────────── */

function ActiveStep({
  step,
  stepNumber,
  total,
  mentor,
  busy,
  onStart,
  onComplete,
}: {
  step: CourseStep;
  stepNumber: number;
  total: number;
  mentor: Mentor | null;
  busy: boolean;
  onStart: () => void;
  onComplete: () => void;
}) {
  return (
    <div className="border-t px-5 py-4" style={{ borderColor: "var(--border-subtle)" }}>
      <div
        className="text-[11px] font-bold uppercase tracking-[0.08em]"
        style={{ color: "var(--primary)" }}
      >
        Step {stepNumber} of {total}
      </div>
      <div className="mt-1.5 text-[15px] font-bold" style={{ color: "var(--foreground)" }}>
        {step.title}
      </div>
      {step.instruction && (
        <p
          className="mt-1.5 text-[13.5px] leading-relaxed"
          style={{ color: "var(--muted-foreground)" }}
        >
          {mentor && <span style={{ color: mentor.hue, fontWeight: 700 }}>{mentor.first}: </span>}
          {step.instruction}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        {step.target_ui_ref ? (
          <button
            onClick={onStart}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-bold transition-transform hover:-translate-y-0.5"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              boxShadow: "0 6px 20px color-mix(in oklab, var(--primary) 40%, transparent)",
            }}
          >
            <Sparkles className="h-4 w-4" />
            Start this step
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : null}
        <button
          onClick={onComplete}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold transition-colors disabled:opacity-50"
          style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
        >
          <Check className="h-3.5 w-3.5" />
          {busy ? "Saving…" : "Mark this step done"}
        </button>
      </div>
    </div>
  );
}

/* ── No course yet ────────────────────────────────────────────────── */

function EmptyCourse() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <span
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
      >
        <GraduationCap className="h-7 w-7" />
      </span>
      <h1
        className="font-display text-[22px] font-extrabold"
        style={{ color: "var(--foreground)" }}
      >
        Your course isn't built yet
      </h1>
      <p className="text-[14px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
        The moment you approve your Founder Casefile, Bylda turns it into a personalized,
        step-by-step course — built around your exact business, not a generic curriculum.
      </p>
      <button
        onClick={() => navigate({ to: "/app/launchpad/history" })}
        className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-bold"
        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        Open your casefile
        <ArrowRight className="h-4 w-4" />
      </button>
      <Link
        to="/app/mission-control"
        className="text-[12.5px] font-semibold"
        style={{ color: "var(--text-faint)" }}
      >
        ← Back to Mission Control
      </Link>
    </div>
  );
}
