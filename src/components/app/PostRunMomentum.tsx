// Post-run momentum panel — the after-action receipt. One glance answers the
// three closed-loop questions: what changed (step complete, mission progress),
// what Bylda learned (facts saved to memory), and what happens next (the next
// step, unlocked, with one CTA). Rendered under the tool output.

import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Trophy } from "lucide-react";
import { ClosedLoopChip } from "@/components/app/ClosedLoopChip";
import type { RunMomentum } from "@/lib/mission-loop";
import type { LearnedFact } from "@/lib/workspaceProfile";

interface Props {
  momentum: RunMomentum | null;
  facts: LearnedFact[];
}

const clip = (v: string, max = 90) => (v.length > max ? `${v.slice(0, max)}…` : v);

export function PostRunMomentum({ momentum, facts }: Props) {
  if (!momentum && facts.length === 0) return null;

  return (
    <div
      className="mt-4 overflow-hidden rounded-xl border"
      style={{
        borderColor: "color-mix(in oklab, var(--primary) 30%, var(--border))",
        background: "color-mix(in oklab, var(--primary) 3%, var(--surface))",
      }}
    >
      {/* What changed */}
      {momentum && (
        <div
          className="px-4 py-3"
          style={{
            borderBottom:
              facts.length > 0 || momentum.nextStep || momentum.missionCompleted
                ? "1px solid color-mix(in oklab, var(--border) 60%, transparent)"
                : "none",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "var(--success)" }} />
              <span className="text-[13px] font-bold" style={{ color: "var(--foreground)" }}>
                Step complete: {momentum.stepTitle}
              </span>
            </div>
            <ClosedLoopChip kind="updated" />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full"
              style={{ background: "var(--border-subtle)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.round((momentum.completedCount / Math.max(momentum.totalSteps, 1)) * 100)}%`,
                  background: "var(--success)",
                }}
              />
            </div>
            <span
              className="shrink-0 text-[11.5px] font-semibold"
              style={{ color: "var(--muted-foreground)" }}
            >
              {momentum.completedCount} of {momentum.totalSteps} steps · {momentum.missionTitle}
            </span>
          </div>
        </div>
      )}

      {/* What Bylda learned */}
      {facts.length > 0 && (
        <div
          className="px-4 py-3"
          style={{
            borderBottom:
              momentum && (momentum.nextStep || momentum.missionCompleted)
                ? "1px solid color-mix(in oklab, var(--border) 60%, transparent)"
                : "none",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--muted-foreground)" }}
            >
              Bylda learned from this run
            </span>
            <ClosedLoopChip kind="memory" />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {facts.map((f) => (
              <span
                key={f.label}
                className="rounded-full px-2.5 py-1 text-[11px]"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--muted-foreground)",
                }}
              >
                <b style={{ color: "var(--foreground)", fontWeight: 600 }}>{f.label}:</b>{" "}
                {clip(f.value)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* What happens next */}
      {momentum?.missionCompleted && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 shrink-0" style={{ color: "var(--primary)" }} />
            <span className="text-[13px] font-bold" style={{ color: "var(--foreground)" }}>
              Mission complete — Bylda is preparing your next goal.
            </span>
          </div>
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 rounded-[4px] px-3.5 py-2 text-[12.5px] font-bold text-white"
            style={{ background: "var(--primary)" }}
          >
            See what's next <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
      {momentum?.nextStep && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ClosedLoopChip kind="unlocked" />
            </div>
            <div
              className="mt-1 truncate text-[13px] font-bold"
              style={{ color: "var(--foreground)" }}
            >
              {momentum.nextStep.title}
            </div>
          </div>
          {momentum.nextStep.toolRoute ? (
            <Link
              to={momentum.nextStep.toolRoute}
              search={{ step: momentum.nextStep.id } as never}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-[4px] px-3.5 py-2 text-[12.5px] font-bold text-white"
              style={{ background: "var(--primary)" }}
            >
              Continue to next step <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <Link
              to="/app/launchpad/missions"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-[4px] border px-3.5 py-2 text-[12.5px] font-bold"
              style={{ borderColor: "var(--primary-border)", color: "var(--primary)" }}
            >
              See how to do it <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
