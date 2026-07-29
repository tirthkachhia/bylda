// Business Roadmap — /app/roadmap. A six-stage business-maturity view
// (Foundation → Build → Launch → Grow → Scale → Exit) that spans both
// Launchpad and Bylda, plus the gamified Business Progress & Levels section:
// Level, Health Score, Milestones, and Recent Wins. Every number here is
// derived from real signals — see src/lib/business-roadmap.ts.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Lock, Trophy, ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { organizationMembersQuery } from "@/lib/queries";
import { useBusinessGraph, type LeadRow } from "@/hooks/use-business-graph";
import { useFounderProgress } from "@/hooks/use-founder-progress";
import { deriveRoadmapProgress, type RoadmapStageState } from "@/lib/business-roadmap";
import { deriveHealthBreakdown } from "@/lib/business-health";
import { MILESTONE_DEFS } from "@/lib/milestones";
import { deriveRecentWins, type ToolRunRow, type AutomationRow } from "@/lib/recent-wins";
import { ProgressRing } from "@/components/app/ProgressRing";
import { Sparkline } from "@/components/app/Sparkline";
import { HexLevelBadge } from "@/components/app/gamification/HexLevelBadge";
import { XPProgressBar } from "@/components/app/gamification/XPProgressBar";
import { StatusPill } from "@/components/app/StatusPill";

export const Route = createFileRoute("/app/roadmap")({ component: RoadmapPage });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function RoadmapPage() {
  const { user, currentOrgId } = useAuth();
  const orgId = currentOrgId ?? "";
  const graph = useBusinessGraph();
  const founder = useFounderProgress();

  const membersQ = useQuery({ ...organizationMembersQuery(orgId), enabled: !!orgId });
  const orgMemberCount = (membersQ.data ?? []).length;

  const runsQ = useQuery({
    queryKey: ["roadmap-tool-runs", orgId],
    queryFn: async () => {
      const { data } = await db
        .from("tool_runs")
        .select("id, tool_key, status, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(100);
      return (data ?? []) as ToolRunRow[];
    },
    enabled: !!orgId,
  });

  const automationsQ = useQuery({
    queryKey: ["roadmap-automations", orgId],
    queryFn: async () => {
      const { data } = await db
        .from("automation_configs")
        .select("id, automation_slug, is_active, created_at")
        .eq("organization_id", orgId);
      return (data ?? []) as AutomationRow[];
    },
    enabled: !!orgId,
  });

  if (graph.isLoading || !user) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />
        <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />
      </div>
    );
  }

  const activeAutomationSlugs = (automationsQ.data ?? [])
    .filter((a) => a.is_active)
    .map((a) => a.automation_slug);
  const extra = { orgMemberCount, activeAutomationSlugs };

  const roadmap = deriveRoadmapProgress(graph, extra);
  const health = deriveHealthBreakdown(graph);
  const milestones = MILESTONE_DEFS.map((m) => ({
    ...m,
    ...m.progress(graph, extra),
  }));
  const nextMilestone = milestones.find((m) => !m.done) ?? milestones[milestones.length - 1];
  const wins = deriveRecentWins(runsQ.data ?? [], graph.leads, automationsQ.data ?? []);
  const weeklyLeads = bucketLeadsByWeek(graph.leads, 8);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* ── Section 1: Your Business Roadmap ── */}
      <div>
        <SectionLabel>Adaptive roadmap</SectionLabel>
        <div
          className="rounded-[20px] border px-6 py-5"
          style={{
            borderColor: "var(--primary-border)",
            background:
              "radial-gradient(120% 140% at 0% 0%, color-mix(in oklab, var(--primary) 9%, var(--surface)) 0%, var(--surface) 55%)",
            boxShadow: "var(--shadow-glow-primary)",
          }}
        >
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <div>
              <h1
                className="font-display text-[20px] font-bold"
                style={{ color: "var(--foreground)" }}
              >
                Your Business Roadmap
              </h1>
              <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>
                {graph.businessName} · a stage-by-stage view from first idea to exit
              </p>
            </div>
          </div>

          {/* 6-stage ring stepper */}
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
            {roadmap.stages.map((stage) => (
              <div key={stage.id} className="flex flex-col items-center gap-2">
                <ProgressRing
                  percent={stage.percentComplete}
                  size={64}
                  color={
                    stage.done
                      ? "var(--success)"
                      : stage.current
                        ? "var(--primary)"
                        : "var(--border)"
                  }
                  label={
                    stage.done ? (
                      <Check className="h-5 w-5" style={{ color: "var(--success)" }} />
                    ) : undefined
                  }
                />
                <span
                  className="text-[12px] font-semibold"
                  style={{
                    color: stage.current
                      ? "var(--primary)"
                      : stage.done
                        ? "var(--foreground)"
                        : "var(--muted-foreground)",
                  }}
                >
                  {stage.label}
                </span>
                <span className="text-[10.5px]" style={{ color: "var(--text-faint)" }}>
                  {stage.percentComplete}%
                </span>
              </div>
            ))}
          </div>

          {/* Current-stage checklist + why-this-matters rail */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-[1.5fr_1fr]">
            <StageChecklist stage={roadmap.current} />
            <div
              className="rounded-2xl border p-4"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            >
              <div
                className="text-[11px] font-bold uppercase tracking-[0.07em]"
                style={{ color: "var(--text-faint)" }}
              >
                Why this matters
              </div>
              <p
                className="mt-1.5 text-[12.5px] leading-relaxed"
                style={{ color: "var(--muted-foreground)" }}
              >
                {roadmap.current.headline}
              </p>
              <div className="mt-3">
                <Sparkline points={weeklyLeads} />
              </div>
              <div className="mt-2 text-[11.5px] font-semibold" style={{ color: "var(--primary)" }}>
                {roadmap.current.impact}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Business Progress & Levels ── */}
      <div>
        <SectionLabel>Business progress &amp; levels</SectionLabel>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Level */}
          <div
            className="flex items-center gap-5 rounded-2xl border px-5 py-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <HexLevelBadge level={founder.level} levelLabel={founder.levelLabel} />
            <div className="flex-1">
              <div
                className="text-[11px] font-bold uppercase tracking-[0.07em]"
                style={{ color: "var(--text-faint)" }}
              >
                Your business level
              </div>
              <div
                className="mt-1 text-[13px] font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                Level {founder.level} — {founder.levelLabel}
              </div>
              <div className="mt-2">
                <XPProgressBar
                  percent={founder.xpProgressInLevel}
                  currentXP={founder.totalXP}
                  xpForNextLevel={founder.xpForNextLevel}
                  showLabel
                />
              </div>
              <div className="mt-1 text-[11px]" style={{ color: "var(--text-faint)" }}>
                {founder.nextMilestone}
              </div>
            </div>
          </div>

          {/* Health score */}
          <div
            className="flex items-center gap-5 rounded-2xl border px-5 py-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <ProgressRing percent={health.overall} size={80} color="var(--success)" />
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.07em]"
                  style={{ color: "var(--text-faint)" }}
                >
                  Business Health Score
                </div>
                <span className="text-[13px] font-bold" style={{ color: "var(--success)" }}>
                  {health.overallGrade.letter}
                </span>
              </div>
              {health.areas.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-[12px]">
                  <span style={{ color: "var(--muted-foreground)" }}>{a.label}</span>
                  <span className="font-bold" style={{ color: "var(--foreground)" }}>
                    {a.grade.letter}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Milestones */}
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {milestones.map((m) => (
            <div
              key={m.id}
              className="rounded-2xl border px-4 py-3.5"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <Trophy
                className="h-4 w-4"
                style={{ color: m.done ? "var(--warning)" : "var(--text-faint)" }}
              />
              <div
                className="mt-2 text-[12.5px] font-bold leading-tight"
                style={{ color: "var(--foreground)" }}
              >
                {m.label}
              </div>
              <div className="mt-1.5">
                {m.done ? (
                  <StatusPill tone="success">Completed</StatusPill>
                ) : m.current > 0 ? (
                  <StatusPill tone="primary">
                    {m.id === "10k-revenue-month"
                      ? `$${m.current.toLocaleString()} / $${m.target.toLocaleString()}`
                      : `${m.current} / ${m.target}`}
                  </StatusPill>
                ) : (
                  <StatusPill tone="muted">Locked</StatusPill>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Recent wins + Next milestone */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1.4fr_1fr]">
          <div
            className="rounded-2xl border px-5 py-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div
              className="mb-2 text-[12.5px] font-bold"
              style={{ color: "var(--muted-foreground)" }}
            >
              Recent Wins
            </div>
            {wins.length === 0 ? (
              <div className="text-[12.5px]" style={{ color: "var(--text-faint)" }}>
                Nothing yet — your first win will show up here.
              </div>
            ) : (
              <ul className="space-y-2">
                {wins.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <span style={{ color: "var(--foreground)" }}>{w.text}</span>
                    {w.detail && (
                      <span className="shrink-0 font-bold" style={{ color: "var(--success)" }}>
                        {w.detail}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div
            className="rounded-2xl border px-5 py-4"
            style={{
              borderColor: "var(--primary-border)",
              background: "color-mix(in oklab, var(--primary) 5%, var(--surface))",
            }}
          >
            <div
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.07em]"
              style={{ color: "var(--primary)" }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Next milestone
            </div>
            <div className="mt-1.5 text-[14px] font-bold" style={{ color: "var(--foreground)" }}>
              {nextMilestone.label}
            </div>
            <div
              className="mt-2 h-[6px] overflow-hidden rounded-full"
              style={{ background: "var(--border)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, Math.round((nextMilestone.current / nextMilestone.target) * 100))}%`,
                  background: "var(--primary)",
                }}
              />
            </div>
            <div className="mt-1.5 text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
              {nextMilestone.id === "10k-revenue-month"
                ? `$${nextMilestone.current.toLocaleString()} / $${nextMilestone.target.toLocaleString()}`
                : `${nextMilestone.current} / ${nextMilestone.target}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StageChecklist({ stage }: { stage: RoadmapStageState }) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-bold" style={{ color: "var(--foreground)" }}>
          Stage: {stage.label}
        </span>
        <span className="text-[11.5px]" style={{ color: "var(--text-faint)" }}>
          {stage.percentComplete}% done
        </span>
      </div>
      <ul className="space-y-1.5">
        {stage.items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-[4px] px-2 py-1.5"
            style={{ background: item.status === "available" ? "var(--surface)" : "transparent" }}
          >
            <Link
              to={item.to}
              className="flex items-center gap-2 text-[13px]"
              style={{
                color: item.status === "locked" ? "var(--text-faint)" : "var(--foreground)",
                pointerEvents: item.status === "locked" ? "none" : "auto",
              }}
            >
              {item.status === "completed" ? (
                <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--success)" }} />
              ) : item.status === "locked" ? (
                <Lock className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--text-faint)" }} />
              ) : (
                <ArrowRight className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--primary)" }} />
              )}
              {item.label}
            </Link>
            <StatusPill
              tone={
                item.status === "completed"
                  ? "success"
                  : item.status === "available"
                    ? "primary"
                    : "muted"
              }
              dot={false}
            >
              {item.status === "completed"
                ? "Completed"
                : item.status === "available"
                  ? "Start"
                  : "Locked"}
            </StatusPill>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-2.5 flex items-center gap-2 px-0.5 text-[12px] font-bold uppercase tracking-[0.07em]"
      style={{ color: "var(--text-faint)" }}
    >
      {children}
    </div>
  );
}

function bucketLeadsByWeek(leads: LeadRow[], weeks: number): number[] {
  const countPerWeek = new Array<number>(weeks).fill(0);
  const now = Date.now();
  for (const l of leads) {
    if (!l.created_at) continue;
    const age = Math.floor((now - new Date(l.created_at).getTime()) / (7 * 86_400_000));
    const idx = weeks - 1 - age;
    if (idx >= 0 && idx < weeks) countPerWeek[idx] += 1;
  }
  return countPerWeek;
}
