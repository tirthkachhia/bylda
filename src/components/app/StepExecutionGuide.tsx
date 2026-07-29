// Step Execution Guide — renders one step's hand-holding block:
// why it matters, a numbered directions table, "you are done when", and one
// clear purple button. Sharp corners, plain words.

import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock, MessageCircle } from "lucide-react";
import type { StepGuidance } from "@/lib/step-execution-guidance";

interface Props {
  guidance: StepGuidance;
  /** Called when the user says "I did it" (manual steps). */
  onMarkDone?: () => void;
  isCompleted?: boolean;
  /** Hide why/done-when boxes for tight checklist rows. */
  compact?: boolean;
  /**
   * mission_steps.id — carried into the tool page (?step=) so a successful
   * run auto-completes this exact step instead of waiting for a manual tick.
   */
  stepId?: string;
}

export function StepExecutionGuide({ guidance, onMarkDone, isCompleted, compact, stepId }: Props) {
  if (isCompleted) {
    return (
      <div className="text-[12.5px] font-semibold" style={{ color: "var(--success)" }}>
        ✓ Step done
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!compact && guidance.mentor && (
        <div
          className="text-[13px] italic leading-relaxed"
          style={{ color: "var(--muted-foreground)" }}
        >
          &ldquo;{guidance.mentor.line}&rdquo;{" "}
          <span className="not-italic font-semibold" style={{ color: "var(--primary)" }}>
            — {guidance.mentor.name}
          </span>
        </div>
      )}

      {!compact && (
        <div
          className="rounded-[4px] border px-3.5 py-2.5 text-[13px] leading-relaxed"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border-subtle)",
            borderLeft: "3px solid var(--primary)",
            color: "var(--muted-foreground)",
          }}
        >
          <b style={{ color: "var(--foreground)", fontWeight: 700 }}>Why this matters: </b>
          {guidance.why}
        </div>
      )}

      {!compact && guidance.prerequisite && (
        <div
          className="rounded-[4px] border px-3.5 py-2.5 text-[13px] leading-relaxed"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border-subtle)",
            color: "var(--muted-foreground)",
          }}
        >
          <b style={{ color: "var(--foreground)", fontWeight: 700 }}>Before you start: </b>
          {guidance.prerequisite}
        </div>
      )}

      {/* Directions — numbered, one move per row */}
      <div>
        <div className="mb-1.5 text-[12.5px] font-bold" style={{ color: "var(--foreground)" }}>
          How to do it — {guidance.directions.length} small steps:
        </div>
        <div
          className="overflow-hidden rounded-[4px] border"
          style={{ borderColor: "var(--border)" }}
        >
          {guidance.directions.map((d, i) => (
            <div
              key={i}
              className="flex items-stretch"
              style={{
                borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none",
              }}
            >
              <div
                className="flex w-10 shrink-0 items-center justify-center text-[13px] font-extrabold"
                style={{
                  color: "var(--primary)",
                  background: "var(--primary-soft)",
                  borderRight: "1px solid var(--primary-border)",
                }}
              >
                {i + 1}
              </div>
              <div className="px-3.5 py-2.5 text-[13px] leading-relaxed">
                <span className="font-bold" style={{ color: "var(--foreground)" }}>
                  {d.action}
                </span>{" "}
                <span style={{ color: "var(--muted-foreground)" }}>{d.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {!compact && guidance.doneWhen.length > 0 && (
        <div
          className="rounded-[4px] border px-3.5 py-2.5"
          style={{
            background: "color-mix(in oklab, var(--success) 7%, var(--surface))",
            borderColor: "color-mix(in oklab, var(--success) 30%, transparent)",
            borderLeft: "3px solid var(--success)",
          }}
        >
          <div className="mb-1 text-[12.5px] font-bold" style={{ color: "var(--success)" }}>
            You are done when:
          </div>
          <ul className="space-y-0.5">
            {guidance.doneWhen.map((c, i) => (
              <li
                key={i}
                className="flex gap-2 text-[13px] leading-relaxed"
                style={{ color: "var(--foreground)" }}
              >
                <span className="font-extrabold" style={{ color: "var(--success)" }}>
                  ✓
                </span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* One clear action */}
      <div className="flex flex-wrap items-center gap-2.5">
        {guidance.toolRoute ? (
          <Link
            to={guidance.toolRoute}
            search={stepId ? ({ step: stepId } as never) : undefined}
            className="inline-flex items-center gap-2 rounded-[4px] px-4 py-2.5 text-[13px] font-bold text-white transition hover:opacity-90"
            style={{
              background: "var(--primary)",
              boxShadow: "0 2px 6px var(--primary-glow)",
            }}
          >
            {guidance.buttonLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          onMarkDone && (
            <button
              onClick={onMarkDone}
              className="inline-flex items-center gap-2 rounded-[4px] px-4 py-2.5 text-[13px] font-bold text-white transition hover:opacity-90"
              style={{
                background: "var(--primary)",
                boxShadow: "0 2px 6px var(--primary-glow)",
              }}
            >
              {guidance.buttonLabel}
            </button>
          )
        )}
        <Link
          to="/app/mentor"
          className="inline-flex items-center gap-1.5 rounded-[4px] border px-3.5 py-2 text-[12.5px] font-semibold"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          I'm stuck — ask Bylda
        </Link>
        <span
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold"
          style={{ color: "var(--text-faint)" }}
        >
          <Clock className="h-3 w-3" />
          about {guidance.minutes} minutes
        </span>
      </div>
    </div>
  );
}
