/**
 * MISSION DETAIL — /app/launchpad/missions
 *
 * Full-focus view of the active mission (master-build dream UI): plain-English
 * description, a vertical step list (active = violet accent + CTA, done = green
 * check, pending = muted, locked = dimmed), and a pinned Bylda guidance card.
 * Reads the workspace's active mission + steps via currentMissionQuery.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Lock, ArrowRight, Sparkles, Circle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { currentMissionQuery } from "@/lib/queries";
import { AiOriginCard } from "@/components/bylda/AiOriginCard";

export const Route = createFileRoute("/app/launchpad/missions")({ component: MissionDetail });

type Step = {
  id: string;
  title: string;
  description: string | null;
  tool_key: string | null;
  status: string | null;
  sort_order: number | null;
};

function MissionDetail() {
  const { user } = useAuth();
  const mission = useQuery({ ...currentMissionQuery(user?.id ?? ""), enabled: !!user?.id });

  const data = mission.data;
  const steps = (data?.steps ?? []) as Step[];
  const activeIndex = steps.findIndex((s) => s.status !== "done" && s.status !== "completed");

  return (
    <div className="min-h-full bg-[--background] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/app/launchpad"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[--text-faint] hover:text-[--foreground]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Bylda
        </Link>

        {mission.isLoading ? (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-2xl bg-[--surface-2]" />
            <div className="h-64 animate-pulse rounded-2xl bg-[--surface-2]" />
          </div>
        ) : !data?.mission ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[--border] bg-[--surface] px-8 py-16 text-center">
            <Sparkles className="mb-3 h-8 w-8 text-[--accent]" />
            <p className="mb-1 text-sm font-semibold text-[--foreground]">No active mission</p>
            <p className="mb-4 max-w-xs text-xs text-[--text-faint]">
              Ask Bylda to set your next mission based on where your business is right now.
            </p>
            <Link
              to="/app/launchpad/bylda"
              className="rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[--primary-hover]"
            >
              Ask Bylda
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-[22px] font-bold tracking-[-0.025em] text-[--foreground]">
                {data.mission.title}
              </h1>
              {data.mission.description && (
                <p className="mt-2 text-sm leading-relaxed text-[--muted-foreground]">
                  {data.mission.description}
                </p>
              )}
            </div>

            <div className="space-y-3">
              {steps.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[--border] px-4 py-8 text-center text-xs text-[--text-faint]">
                  Bylda is still sequencing the steps for this mission.
                </p>
              ) : (
                steps.map((s, i) => {
                  const done = s.status === "done" || s.status === "completed";
                  const isActive = i === activeIndex;
                  const locked = !done && !isActive && i > activeIndex;
                  return (
                    <div
                      key={s.id}
                      className={`flex gap-3 rounded-2xl border bg-[--surface] p-4 shadow-sm ${
                        isActive
                          ? "border-[--border] border-l-4 border-l-[--accent]"
                          : "border-[--border]"
                      } ${locked ? "opacity-60" : ""}`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {done ? (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[--success] text-white">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        ) : isActive ? (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[--primary-soft] text-[--accent]">
                            <Circle className="h-3 w-3 fill-current" />
                          </span>
                        ) : (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[--surface-2] text-[--text-faint]">
                            {locked ? (
                              <Lock className="h-3 w-3" />
                            ) : (
                              <span className="text-xs font-semibold">{i + 1}</span>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-semibold ${isActive ? "text-[--foreground]" : done ? "text-[--muted-foreground]" : "text-[--foreground]"}`}
                        >
                          {s.title}
                        </p>
                        {s.description && (
                          <p className="mt-0.5 text-xs leading-relaxed text-[--text-faint]">
                            {s.description}
                          </p>
                        )}
                        {isActive && s.tool_key && (
                          <Link
                            to="/app/launchpad/$tool"
                            params={{ tool: s.tool_key }}
                            search={{ step: s.id } as never}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[--accent] px-4 py-2 text-sm font-semibold text-white shadow-[0_2px_8px_var(--accent-glow)] hover:bg-[--primary-hover]"
                          >
                            Start this step <ArrowRight className="h-4 w-4" />
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pinned Bylda guidance — shared AI-origin grammar */}
            <AiOriginCard
              className="mt-6"
              label="Bylda"
              action={
                <Link
                  to="/app/launchpad/bylda"
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: "var(--primary)" }}
                >
                  Ask Bylda about this mission <ArrowRight className="h-4 w-4" />
                </Link>
              }
            >
              {activeIndex === -1
                ? "Every step is done — ask Bylda to set your next mission."
                : "Focus on the highlighted step. When you finish it, come back and Bylda will unlock the next move."}
            </AiOriginCard>
          </>
        )}
      </div>
    </div>
  );
}
