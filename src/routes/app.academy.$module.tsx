import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { toolRunsQuery } from "@/lib/queries";
import { ACADEMY_MODULES, getModuleState } from "@/lib/academy-modules";
import { organizationQuery } from "@/lib/queries";
import { loadWorkspaceProfile } from "@/lib/workspaceProfile";
import {
  inferBusinessArchetype,
  getModuleBrief,
  getBuildSteps,
  ARCHETYPE_LABELS,
  type BusinessArchetype,
} from "@/lib/module-briefs";
import {
  CheckCircle2,
  Lock,
  ArrowRight,
  ArrowLeft,
  Zap,
  BookOpen,
  Play,
  ExternalLink,
  Compass,
  ListChecks,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/academy/$module")({
  component: ModuleWorkspace,
});

const TOOL_LABELS: Record<string, string> = {
  "idea-validator": "Idea Validator",
  "kill-my-idea": "Kill My Idea",
  "idea-vs-idea": "Idea vs Idea",
  competitor: "Competitor Analysis",
  "pitch-generator": "Pitch Generator",
  pricing: "Pricing Strategy",
  "gtm-strategy": "GTM Strategy",
  "landing-page": "Landing Page Builder",
  blog: "Blog Content",
  "first-10-customers": "First 10 Customers",
  "investor-emails": "Investor Emails",
  "business-plan": "Business Plan",
  "revenue-projector": "Revenue Projector",
  "funding-score": "Funding Score",
};

function ModuleWorkspace() {
  const { module: moduleId } = Route.useParams();
  const { currentOrgId } = useAuth();
  const navigate = useNavigate();

  // Infer the founder's business archetype (client-only — reads localStorage).
  const [archetype, setArchetype] = useState<BusinessArchetype>("general");
  useEffect(() => {
    setArchetype(inferBusinessArchetype(loadWorkspaceProfile()));
  }, []);

  // Locally-checkable build steps, persisted per module so progress sticks.
  const stepsKey = `bylda-module-steps-${moduleId}`;
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(stepsKey);
      if (raw) setDoneSteps(new Set(JSON.parse(raw) as number[]));
      else setDoneSteps(new Set());
    } catch {
      setDoneSteps(new Set());
    }
  }, [stepsKey]);
  const toggleStep = (i: number) => {
    setDoneSteps((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      try {
        localStorage.setItem(stepsKey, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const runsQ = useQuery({ ...toolRunsQuery(currentOrgId ?? "", 500), enabled: !!currentOrgId });
  const orgQ = useQuery({ ...organizationQuery(currentOrgId ?? ""), enabled: !!currentOrgId });

  const module = ACADEMY_MODULES.find((m) => m.id === moduleId);

  const completedSlugs = new Set(
    (runsQ.data ?? [])
      .filter((r: { status: string }) => r.status === "succeeded")
      .map((r: { tool_key?: string }) => r.tool_key ?? ""),
  );
  const orgStage = (orgQ.data as { stage?: string } | null)?.stage ?? "Idea";

  if (!module) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-[40px] mb-4">🔭</div>
        <h2
          className="font-display text-[18px] font-bold mb-2"
          style={{ color: "var(--foreground)" }}
        >
          Module not found
        </h2>
        <p className="text-[13px] mb-6" style={{ color: "var(--muted-foreground)" }}>
          This module doesn't exist. Check the Academy for available modules.
        </p>
        <Link
          to="/app/academy"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold btn-execute"
        >
          Back to Academy
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const state = getModuleState(module, completedSlugs, orgStage);
  const completedTools = module.tools.filter((t) => completedSlugs.has(t));
  const moduleIndex = ACADEMY_MODULES.findIndex((m) => m.id === moduleId);
  const nextModule = ACADEMY_MODULES[moduleIndex + 1];

  const brief = getModuleBrief(module.id, archetype);
  const buildSteps = getBuildSteps(module.id, archetype);
  const businessLabel = ARCHETYPE_LABELS[archetype];

  // "Where am I / what's next" — the single obvious action for this module.
  const moduleNumber = moduleIndex + 1;
  const totalModules = ACADEMY_MODULES.length;
  const firstIncompleteTool = module.tools.find((t) => !completedSlugs.has(t));
  const nextToolLabel = firstIncompleteTool
    ? (TOOL_LABELS[firstIncompleteTool] ??
      firstIncompleteTool.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    : null;

  if (state === "locked") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-[48px] mb-4">🔒</div>
        <h2
          className="font-display text-[20px] font-bold mb-2"
          style={{ color: "var(--foreground)" }}
        >
          {module.title} — Locked
        </h2>
        <p className="text-[13px] mb-6" style={{ color: "var(--muted-foreground)" }}>
          Reach the <strong>{module.requiredStage}</strong> stage to unlock this module.
        </p>
        <Link
          to="/app/academy"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold btn-execute"
        >
          Back to Academy
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const STATE_COLOR_MAP = {
    locked: "#7f9bb8",
    available: "#38bdf8",
    active: "#0284c7",
    complete: "#0d9488",
    mastered: "#d97706",
  };
  const stateColor = STATE_COLOR_MAP[state];

  return (
    <div className="space-y-6">
      {/* Breadcrumb — always know exactly where you are */}
      <div className="flex items-center gap-2 text-[12px]">
        <Link
          to="/app/academy"
          className="inline-flex items-center gap-1 font-medium transition-colors hover:opacity-80"
          style={{ color: "var(--muted-foreground)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Course
        </Link>
        <span style={{ color: "var(--text-faint)" }}>/</span>
        <span
          className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
          style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
        >
          Module {moduleNumber} of {totalModules}
        </span>
        <span className="font-semibold truncate" style={{ color: "var(--foreground)" }}>
          {module.title}
        </span>
      </div>

      {/* Module header */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{
          background: `color-mix(in oklab, ${stateColor} 6%, var(--surface))`,
          border: `1px solid color-mix(in oklab, ${stateColor} 22%, var(--border))`,
        }}
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="text-[48px] shrink-0">{module.emoji}</span>
            <div>
              <div
                className="text-[10px] font-mono font-bold uppercase tracking-widest mb-1"
                style={{ color: stateColor }}
              >
                ●{" "}
                {state === "complete"
                  ? "Complete"
                  : state === "active"
                    ? "In Progress"
                    : "Available"}
              </div>
              <h1
                className="font-display text-[22px] font-bold leading-tight"
                style={{ color: "var(--foreground)", letterSpacing: "-0.03em" }}
              >
                {module.title}
              </h1>
              <p className="text-[13px] mt-1" style={{ color: "var(--muted-foreground)" }}>
                {module.outcome}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="flex items-center gap-1.5 rounded-xl px-3 py-2"
              style={{
                background: `color-mix(in oklab, ${stateColor} 10%, transparent)`,
                border: `1px solid color-mix(in oklab, ${stateColor} 25%, transparent)`,
              }}
            >
              <Zap className="h-3.5 w-3.5" style={{ color: stateColor }} />
              <span className="font-mono font-bold text-[13px]" style={{ color: stateColor }}>
                {module.xpReward} XP
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {module.tools.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-[10px] font-bold uppercase tracking-wide"
                style={{ color: "var(--muted-foreground)" }}
              >
                Task Progress
              </span>
              <span className="text-[10px] font-mono" style={{ color: stateColor }}>
                {completedTools.length}/{module.tools.length} complete
              </span>
            </div>
            <div
              className="rounded-full overflow-hidden"
              style={{ height: 4, background: "var(--surface-2)" }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{
                  width: `${(completedTools.length / module.tools.length) * 100}%`,
                  background: `linear-gradient(90deg, ${stateColor}, color-mix(in oklab, ${stateColor} 60%, var(--accent)))`,
                  boxShadow: `0 0 8px ${stateColor}55`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Your next step — one clear action, so it's always obvious what to do now */}
      {firstIncompleteTool ? (
        <div
          className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--primary) 12%, var(--surface)) 0%, var(--surface) 75%)",
            border: "1px solid var(--primary-border)",
          }}
        >
          <div
            className="pointer-events-none absolute -top-12 -right-8 h-40 w-40 rounded-full"
            style={{
              background:
                "radial-gradient(circle, color-mix(in oklab, var(--primary) 15%, transparent) 0%, transparent 70%)",
            }}
          />
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            <Play className="h-5 w-5" />
          </div>
          <div className="relative flex-1 min-w-0">
            <div
              className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
              style={{ color: "var(--primary)" }}
            >
              Your next step
            </div>
            <div className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
              Run {nextToolLabel} for your {businessLabel}
            </div>
            <div className="text-[12px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              Task {completedTools.length + 1} of {module.tools.length} · takes a few minutes
            </div>
          </div>
          <Link
            to="/app/launchpad/$tool"
            params={{ tool: firstIncompleteTool }}
            className="relative inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold btn-execute shrink-0"
          >
            <Play className="h-4 w-4" />
            Start now
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div
          className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
          style={{
            background: "color-mix(in oklab, var(--success) 8%, var(--surface))",
            border: "1px solid color-mix(in oklab, var(--success) 28%, var(--border))",
          }}
        >
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "var(--success)", color: "#fff" }}
          >
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
              style={{ color: "var(--success)" }}
            >
              Module complete
            </div>
            <div className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
              You&apos;ve finished {module.title} — nice work.
            </div>
          </div>
          {nextModule && (
            <Link
              to="/app/academy/$module"
              params={{ module: nextModule.id }}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold btn-execute shrink-0"
            >
              Next: {nextModule.title}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Learn content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Lesson */}
          <div className="rounded-xl p-5 bylda-card">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="h-4 w-4" style={{ color: "var(--primary)" }} />
              <span
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "var(--muted-foreground)" }}
              >
                Lesson
              </span>
            </div>
            <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--foreground)" }}>
              {module.learnContent}
            </p>
          </div>

          {/* Tailored brief — why this matters for THEIR business + how to nail it */}
          {brief && (
            <div
              className="rounded-xl p-5"
              style={{
                background: "color-mix(in oklab, var(--primary) 6%, var(--surface))",
                border: "1px solid color-mix(in oklab, var(--primary) 22%, var(--border))",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Compass className="h-4 w-4" style={{ color: "var(--primary)" }} />
                <span
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: "var(--primary)" }}
                >
                  Why this matters for your {businessLabel}
                </span>
              </div>
              <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--foreground)" }}>
                {brief.why}
              </p>
              <div
                className="mt-3 rounded-lg p-3 text-[12.5px] leading-relaxed"
                style={{
                  background: "color-mix(in oklab, var(--launch-accent) 10%, transparent)",
                  color: "var(--foreground)",
                }}
              >
                <span className="font-semibold" style={{ color: "var(--launch-accent)" }}>
                  How to make it effective:{" "}
                </span>
                {brief.how}
              </div>
            </div>
          )}

          {/* Build steps — the concrete, do-it-now checklist */}
          {buildSteps.length > 0 && (
            <div className="rounded-xl p-5 bylda-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4" style={{ color: "var(--primary)" }} />
                  <span
                    className="text-[11px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Build steps
                  </span>
                </div>
                <span
                  className="text-[10px] font-mono"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {doneSteps.size}/{buildSteps.length} done
                </span>
              </div>
              <ol className="space-y-2.5">
                {buildSteps.map((step, i) => {
                  const done = doneSteps.has(i);
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => toggleStep(i)}
                        className="flex w-full items-start gap-3 rounded-xl p-3 text-left transition-all bylda-card-hover"
                        style={{
                          background: done
                            ? "color-mix(in oklab, var(--success) 6%, var(--surface))"
                            : "var(--surface)",
                          border: done
                            ? "1px solid color-mix(in oklab, var(--success) 28%, var(--border))"
                            : "1px solid var(--border)",
                        }}
                      >
                        <span className="mt-0.5 shrink-0">
                          {done ? (
                            <CheckCircle2 className="h-4 w-4" style={{ color: "var(--success)" }} />
                          ) : (
                            <Circle className="h-4 w-4" style={{ color: "var(--text-faint)" }} />
                          )}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span
                            className="block text-[13px] font-semibold"
                            style={{
                              color: done ? "var(--muted-foreground)" : "var(--foreground)",
                              textDecoration: done ? "line-through" : "none",
                            }}
                          >
                            {i + 1}. {step.title}
                          </span>
                          <span
                            className="block text-[12px] mt-0.5 leading-relaxed"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {step.detail}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* Execute tasks */}
          <div>
            <div
              className="text-[10px] font-bold uppercase tracking-widest mb-3"
              style={{ color: "var(--muted-foreground)" }}
            >
              Execute Tasks
            </div>
            <div className="space-y-3">
              {module.tools.map((toolKey, i) => {
                const isDone = completedSlugs.has(toolKey);
                const label =
                  TOOL_LABELS[toolKey] ??
                  toolKey.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

                return (
                  <div
                    key={toolKey}
                    className="flex items-center gap-3 rounded-xl p-4 bylda-card transition-all"
                    style={{
                      borderColor: isDone
                        ? "color-mix(in oklab, var(--success) 28%, var(--border))"
                        : undefined,
                      background: isDone
                        ? "color-mix(in oklab, var(--success) 5%, var(--surface))"
                        : undefined,
                    }}
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono font-bold text-[12px]"
                      style={{
                        background: isDone
                          ? "color-mix(in oklab, var(--success) 15%, transparent)"
                          : "var(--surface-2)",
                        color: isDone ? "var(--success)" : "var(--muted-foreground)",
                      }}
                    >
                      {isDone ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[13px] font-semibold"
                        style={{ color: isDone ? "var(--success)" : "var(--foreground)" }}
                      >
                        {label}
                      </div>
                      <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                        {isDone
                          ? "Completed — you can run it again anytime"
                          : "Run this tool to complete the task"}
                      </div>
                    </div>

                    <Link
                      to="/app/launchpad/$tool"
                      params={{ tool: toolKey }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold transition-all shrink-0",
                        isDone ? "bylda-card bylda-card-hover" : "btn-execute",
                      )}
                    >
                      {isDone ? (
                        <>
                          <ExternalLink className="h-3.5 w-3.5" />
                          View
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" />
                          Execute
                        </>
                      )}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: Progress panel */}
        <div className="space-y-4">
          {/* Completion summary */}
          <div className="rounded-xl p-4 bylda-card">
            <div
              className="text-[10px] font-bold uppercase tracking-widest mb-3"
              style={{ color: "var(--muted-foreground)" }}
            >
              Module Status
            </div>

            <div className="space-y-2.5">
              {module.tools.map((toolKey) => {
                const isDone = completedSlugs.has(toolKey);
                const label =
                  TOOL_LABELS[toolKey] ??
                  toolKey.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                return (
                  <div key={toolKey} className="flex items-center gap-2.5">
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ background: isDone ? "var(--success)" : "var(--border)" }}
                    />
                    <span
                      className="text-[12px] truncate"
                      style={{ color: isDone ? "var(--foreground)" : "var(--muted-foreground)" }}
                    >
                      {label}
                    </span>
                    {isDone && (
                      <CheckCircle2
                        className="h-3 w-3 shrink-0 ml-auto"
                        style={{ color: "var(--success)" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {state === "complete" && (
              <div
                className="mt-4 rounded-xl p-3 text-center"
                style={{
                  background: "color-mix(in oklab, var(--success) 8%, transparent)",
                  border: "1px solid color-mix(in oklab, var(--success) 25%, transparent)",
                }}
              >
                <CheckCircle2
                  className="h-5 w-5 mx-auto mb-1.5"
                  style={{ color: "var(--success)" }}
                />
                <div className="text-[12px] font-semibold" style={{ color: "var(--success)" }}>
                  Module Complete!
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  +{module.xpReward} XP earned
                </div>
              </div>
            )}
          </div>

          {/* Next module */}
          {nextModule && (
            <div
              className="rounded-xl p-4"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-widest mb-3"
                style={{ color: "var(--muted-foreground)" }}
              >
                Up Next
              </div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[24px]">{nextModule.emoji}</span>
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                    {nextModule.title}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    {nextModule.xpReward} XP
                  </div>
                </div>
              </div>
              {state === "complete" ? (
                <Link
                  to="/app/academy/$module"
                  params={{ module: nextModule.id }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-[12px] font-semibold btn-execute"
                >
                  Start Next Module <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <div
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <Lock className="h-3 w-3" />
                  <span className="text-[11px]">Complete this module to unlock</span>
                </div>
              )}
            </div>
          )}

          {/* Academy nav */}
          <Link
            to="/app/academy"
            className="flex items-center gap-2 rounded-xl p-3 bylda-card bylda-card-hover text-[12px] font-medium"
            style={{ color: "var(--muted-foreground)" }}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Back to Academy Map
          </Link>
        </div>
      </div>
    </div>
  );
}
