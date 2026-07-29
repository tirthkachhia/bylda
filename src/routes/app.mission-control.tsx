// Mission Control — the founder's home. One screen, one clear hierarchy:
//
//   1. CURRENT MISSION   → the dominant element. Where you are, and the single
//                          next move, with a big CTA. Nothing competes with it.
//   2. TASKS             → the queue behind the mission — what's next, ranked.
//   3. NEXT STEP         → the current mission step with its mentor's teaching,
//                          and a way to talk to the mentor.
//   4. PROGRESS          → level, XP, health, next milestone — the game layer.
//   5. SUPPORTING TOOLS  → everything else, deliberately quiet.
//
// This is not a dashboard of equal widgets. It's an operating system that
// always answers "what do I do next?" before anything else.

import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { type LeadRow } from "@/hooks/use-business-graph";
import { useProgressSpine } from "@/hooks/use-progress-spine";
import { useFounderProgress } from "@/hooks/use-founder-progress";
import { useFounderStreak } from "@/hooks/use-founder-streak";
import { NextStepHero } from "@/components/app/dashboard/NextStepHero";
import { MentorChatCard } from "@/components/app/dashboard/MentorChatCard";
import { WorkspaceStatusBanner } from "@/components/app/dashboard/WorkspaceStatusBanner";
import { ModuleBoundary } from "@/components/app/ModuleBoundary";
import { ByldaHandoffCard } from "@/components/launchpad/ByldaHandoffCard";
import { CasefileSummary } from "@/components/launchpad/CasefileSummary";
import { StageSpine } from "@/components/launchpad/StageSpine";
import { nextBestMove, type NextMove } from "@/lib/next-move";
import { MomentumRail } from "@/components/bylda/MomentumRail";
import { RecentWinChip } from "@/components/app/RecentWinChip";
import { TitleBlock } from "@/components/launchpad/TitleBlock";
import {
  BusinessSchematic,
  schematicInputFromGraph,
} from "@/components/launchpad/BusinessSchematic";
import { useQuery } from "@tanstack/react-query";
import { businessContextQuery } from "@/lib/queries";
import { type LaunchpadProgress } from "@/lib/ecosystem";
import { gradeForScore } from "@/lib/business-grade";
import { HexLevelBadge } from "@/components/app/gamification/HexLevelBadge";
import { XPProgressBar } from "@/components/app/gamification/XPProgressBar";
import { ProgressRing } from "@/components/app/ProgressRing";
import {
  ArrowRight,
  AlertTriangle,
  Clock,
  Target,
  Zap,
  Trophy,
  ChevronRight,
  Map,
  FlaskConical,
  FileText,
  Bot,
  Radio,
  GraduationCap,
} from "lucide-react";

export const Route = createFileRoute("/app/mission-control")({
  component: HomePage,
});

function HomePage() {
  const { user, profile, currentOrgId } = useAuth();
  // Revision for the blueprint title block — business_context.version
  const bpCtxQ = useQuery({
    ...businessContextQuery(currentOrgId ?? ""),
    enabled: !!currentOrgId,
  });
  const spine = useProgressSpine();
  const graph = spine.graph;
  const founder = useFounderProgress();
  const streak = useFounderStreak();
  const progress = spine.stage;
  const gpa = gradeForScore(founder.founderScore);

  const name = profile?.full_name?.split(" ")[0] || "Founder";
  const blocker = graph.blockers[0];
  const recs = graph.recommendations;

  // The single most important next move — shared with the app-wide
  // NextBestActionBar so both surfaces always agree (src/lib/next-move.ts).
  const hero = nextBestMove(graph, progress);

  // Task queue behind the hero — the recommendations we didn't surface above.
  const queue = (blocker ? recs.slice(0, 4) : recs.slice(1, 5)).filter(Boolean);

  const stageNumber = progress.currentIndex + 1;
  const stageCount = progress.stages.length;

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      {/* ── Provisioning repair / operator cockpit strip ── */}
      <ModuleBoundary name="workspace status">
        <WorkspaceStatusBanner />
      </ModuleBoundary>

      {/* ── Greeting ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1
            className="font-display text-[26px] font-extrabold leading-tight"
            style={{ color: "var(--foreground)", letterSpacing: "-0.03em" }}
          >
            Welcome back, {name}
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--muted-foreground)" }}>
            {graph.businessName} · you have one clear next move. Bylda will guide you.
          </p>
          <div className="mt-2.5">
            <RecentWinChip />
          </div>
        </div>
        <StatusChip tone={blocker ? "warning" : "success"}>
          {blocker ? "1 thing to fix" : "On track"}
        </StatusChip>
      </div>

      {/* ── Momentum loop — what led to this screen (collapsed by default) ── */}
      <MomentumRail
        loop={{
          goal: graph.goal || undefined,
          decision: `Working the ${progress.current.label} stage`,
          task: hero?.title || progress.current.headline,
          asset: graph.signals.hasOffer ? "Offer defined" : undefined,
          automation: graph.signals.activeAutomationCount
            ? `${graph.signals.activeAutomationCount} automation${graph.signals.activeAutomationCount > 1 ? "s" : ""} running`
            : undefined,
          momentum: recs[0]?.title,
        }}
      />

      {/* ── Bylda handoff — the build is proven, take it live ── */}
      {progress.readyForBylda && <ByldaHandoffCard graph={graph} />}

      {/* ══ 1 · CURRENT MISSION — the dominant element ══ */}
      <MissionHero
        hero={hero}
        stageLabel={progress.current.label}
        stageNumber={stageNumber}
        stageCount={stageCount}
        stages={progress.stages}
        missionPercent={spine.percent}
      />

      {/* ══ 2 · TASKS — the queue behind the mission ══ */}
      <section>
        <SectionLabel icon={Target}>Your task queue</SectionLabel>
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          {queue.length === 0 ? (
            <div
              className="px-5 py-6 text-center text-[13px]"
              style={{ color: "var(--text-faint)" }}
            >
              Finish the mission above and Bylda will line up what's next.
            </div>
          ) : (
            queue.map((r, i) => (
              <Link
                key={r.id}
                to={r.to}
                className="group flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-surface-2"
                style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none" }}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold"
                  style={{
                    background: "var(--primary-soft)",
                    color: "var(--primary)",
                    border: "1px solid var(--primary-border)",
                  }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate text-[13.5px] font-semibold"
                    style={{ color: "var(--foreground)" }}
                  >
                    {r.title}
                  </div>
                  <div className="truncate text-[12px]" style={{ color: "var(--text-faint)" }}>
                    {r.impact}
                  </div>
                </div>
                <span
                  className="hidden shrink-0 items-center gap-1 text-[11.5px] font-semibold sm:inline-flex"
                  style={{ color: "var(--text-faint)" }}
                >
                  <Clock className="h-3 w-3" />
                  {r.estimatedMinutes}m
                </span>
                <ArrowRight
                  className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ color: "var(--primary)" }}
                />
              </Link>
            ))
          )}
        </div>
      </section>

      {/* ══ Continue your course — Home ↔ Course, one click, same sky treatment ══ */}
      <section>
        <SectionLabel icon={GraduationCap}>Your course</SectionLabel>
        <CourseContinueCard stageLabel={progress.current.label} />
      </section>

      {/* ══ 3 · NEXT STEP — the current mission step, with its mentor's
             teaching folded into the step guidance (lessons merged into the
             execution spine — one "do this now", not two) ══ */}
      <section>
        <SectionLabel icon={Bot}>Your next step</SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.62fr_1fr]">
          {user?.id && <NextStepHero userId={user.id} />}
          <MentorChatCard />
        </div>
      </section>

      {/* ══ 4 · PROGRESS — the game layer ══ */}
      <section>
        <SectionLabel icon={Trophy}>
          Your progress
          <Link
            to="/app/roadmap"
            className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-bold normal-case tracking-normal"
            style={{ color: "var(--primary)" }}
          >
            Full report card
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
          {/* Level + XP */}
          <div
            className="flex items-center gap-5 rounded-2xl border p-5"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <HexLevelBadge level={founder.level} levelLabel={founder.levelLabel} size={76} />
            <div className="min-w-0 flex-1">
              <div
                className="text-[10.5px] font-bold uppercase tracking-[0.09em]"
                style={{ color: "var(--text-faint)" }}
              >
                Business level
              </div>
              <div
                className="mt-0.5 text-[16px] font-extrabold"
                style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}
              >
                Level {founder.level} · {founder.levelLabel}
              </div>
              <div className="mt-2.5">
                <XPProgressBar
                  percent={founder.xpProgressInLevel}
                  currentXP={founder.totalXP}
                  xpForNextLevel={founder.xpForNextLevel}
                  height={6}
                  showLabel
                />
              </div>
              <div
                className="mt-2 flex items-center gap-1.5 text-[11.5px] font-semibold"
                style={{ color: "var(--primary)" }}
              >
                <Zap className="h-3 w-3" />
                {founder.nextMilestone}
              </div>
            </div>
          </div>

          {/* Health / GPA */}
          <div
            className="flex items-center gap-4 rounded-2xl border p-5"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <ProgressRing
              percent={founder.founderScore}
              size={78}
              strokeWidth={7}
              color="var(--success)"
              label={
                <span
                  className="font-display font-extrabold"
                  style={{ color: "var(--foreground)", fontSize: 22 }}
                >
                  {gpa.letter}
                </span>
              }
            />
            <div className="min-w-0 flex-1">
              <div
                className="text-[10.5px] font-bold uppercase tracking-[0.09em]"
                style={{ color: "var(--text-faint)" }}
              >
                Business health
              </div>
              <div
                className="mt-0.5 text-[16px] font-extrabold"
                style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}
              >
                {founder.founderScore}
                <span className="text-[12px] font-semibold" style={{ color: "var(--text-faint)" }}>
                  {" "}
                  / 100
                </span>
              </div>
              <div
                className="mt-1.5 text-[12px] leading-snug"
                style={{ color: "var(--muted-foreground)" }}
              >
                {spine.percent > 0
                  ? `Current mission ${spine.percent}% complete`
                  : "Complete your mission to raise your grade"}
              </div>
            </div>
          </div>
        </div>

        {/* Concrete numbers — quiet, factual */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <StatTile
            label="Pipeline value"
            value={formatMoney(graph.leads.reduce((s, l) => s + (l.value ?? 0), 0))}
            delta={leadDelta(graph.leads).valueDelta}
            deltaLabel={(v) => `${formatMoney(v)} this week`}
          />
          <StatTile
            label="Leads"
            value={String(graph.leads.length)}
            suffix=" / 10 goal"
            delta={leadDelta(graph.leads).countDelta}
            deltaLabel={(v) => `+${v} this week`}
          />
          <StatTile
            label="Streak"
            value={String(streak.currentStreak)}
            suffix={streak.currentStreak === 1 ? " day" : " days"}
            delta={0}
            deltaLabel={() => ""}
          />
        </div>
      </section>

      {/* ══ Business blueprint — the business as a live technical drawing.
          Sits in the quiet zone: it's a truthful readout of graph state
          (sealed / drafting / not built), never competing with the mission
          hero above. Same data the rest of this page already loads. ══ */}
      <section>
        <SectionLabel icon={Map}>Business blueprint</SectionLabel>
        <ModuleBoundary name="Business blueprint">
          <div className="space-y-3">
            <TitleBlock
              projectName={graph.businessName}
              drawingNo={`LP-${(currentOrgId ?? "draft000").slice(0, 8).toUpperCase()}`}
              stage={progress.current.label}
              revision={typeof bpCtxQ.data?.version === "number" ? bpCtxQ.data.version : 1}
              founderName={name}
            />
            <BusinessSchematic
              orgId={currentOrgId ?? "guest"}
              {...schematicInputFromGraph(graph)}
            />
          </div>
        </ModuleBoundary>
      </section>

      {/* ══ 5 · SUPPORTING TOOLS — deliberately quiet ══ */}
      <section>
        <SectionLabel icon={Radio}>Supporting tools</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {SUPPORT_TOOLS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-center transition-all hover:-translate-y-0.5"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: "var(--surface-2)", color: "var(--muted-foreground)" }}
              >
                <t.icon className="h-4 w-4" />
              </span>
              <span className="text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>
                {t.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Casefile — supporting evidence, kept last ── */}
      <section>
        <SectionLabel icon={FileText}>Your casefile</SectionLabel>
        <CasefileSummary graph={graph} progress={progress} />
      </section>
    </div>
  );
}

/* ─── Current Mission hero ──────────────────────────────────── */

function MissionHero({
  hero,
  stageLabel,
  stageNumber,
  stageCount,
  stages,
  missionPercent,
}: {
  hero: NextMove;
  stageLabel: string;
  stageNumber: number;
  stageCount: number;
  stages: LaunchpadProgress["stages"];
  missionPercent: number;
}) {
  const fix = hero.tone === "fix";
  const accent = fix ? "var(--warning)" : "var(--primary)";

  return (
    <div
      className="relative overflow-hidden rounded-[20px] border p-6 md:p-7"
      style={{
        borderColor: fix
          ? "color-mix(in oklab, var(--warning) 32%, transparent)"
          : "var(--primary-border)",
        background:
          "radial-gradient(120% 140% at 0% 0%, color-mix(in oklab, " +
          accent +
          " 12%, var(--surface)) 0%, var(--surface) 55%)",
        boxShadow: "var(--shadow-glow-primary)",
      }}
    >
      {/* ambient grid */}
      <div className="bg-grid-faint pointer-events-none absolute inset-0 opacity-40" />
      {/* soft sun-glow in the corner — the sky-island signature, shared with the course hero */}
      <div
        className="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full"
        style={{
          background: `radial-gradient(circle, color-mix(in oklab, ${accent} 14%, transparent) 0%, transparent 70%)`,
        }}
      />

      <div className="relative">
        {/* stage context + live pill */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em]"
            style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
          >
            <Target className="h-3 w-3" />
            Stage {stageNumber} of {stageCount} · {stageLabel}
          </span>
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em]"
            style={{ color: fix ? "var(--warning)" : "var(--success)" }}
          >
            <span
              className="bylda-live-dot h-1.5 w-1.5 rounded-full"
              style={{ background: "currentColor" }}
            />
            {hero.eyebrow}
          </span>
        </div>

        {/* the objective */}
        <h2
          className="mt-3.5 font-display text-[24px] font-extrabold leading-[1.15] md:text-[28px]"
          style={{ color: "var(--foreground)", letterSpacing: "-0.03em" }}
        >
          {hero.title}
        </h2>
        <p
          className="mt-1.5 max-w-2xl text-[14px] leading-relaxed"
          style={{ color: "var(--muted-foreground)" }}
        >
          {hero.sub}
        </p>

        {/* CTA + time */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            to={hero.to}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-bold transition-transform hover:-translate-y-0.5"
            style={{
              background: accent,
              color: fix ? "var(--warning-foreground)" : "var(--primary-foreground)",
              boxShadow: fix
                ? "0 6px 20px color-mix(in oklab, var(--warning) 35%, transparent)"
                : "0 6px 20px color-mix(in oklab, var(--primary) 40%, transparent)",
            }}
          >
            {fix ? <AlertTriangle className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
            {hero.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <span
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold"
            style={{ color: "var(--text-faint)" }}
          >
            <Clock className="h-3.5 w-3.5" />
            About {hero.minutes} min
          </span>
        </div>

        {/* stage stepper — the shared founder-journey spine, fed by the app's
            canonical 6-stage progress model (same component as onboarding). */}
        <div className="mt-6 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <StageSpine
            stages={stages.map((s) => ({ id: s.id, label: s.label }))}
            currentIndex={Math.max(
              0,
              stages.findIndex((s) => s.current),
            )}
            accent="var(--primary)"
            doneColor="var(--success)"
            mutedColor="var(--text-faint)"
            trackColor="var(--border)"
            labelColor="var(--muted-foreground)"
          />
        </div>
        {missionPercent > 0 && (
          <div className="mt-2 text-[11.5px] font-semibold" style={{ color: "var(--text-faint)" }}>
            Current mission {missionPercent}% complete
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Continue your course — the learning path, one click from home ─── */

function CourseContinueCard({ stageLabel }: { stageLabel: string }) {
  return (
    <Link
      to="/app/academy"
      className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border p-5 transition-transform hover:-translate-y-0.5 sm:flex-row sm:items-center"
      style={{
        borderColor: "var(--primary-border)",
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--primary) 10%, var(--surface)) 0%, var(--surface) 72%)",
      }}
    >
      {/* soft sun-glow — same signature as the course + mission heroes */}
      <div
        className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--primary) 14%, transparent) 0%, transparent 70%)",
        }}
      />
      <span
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        <GraduationCap className="h-5 w-5" />
      </span>
      <div className="relative min-w-0 flex-1">
        <div
          className="text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ color: "var(--primary)" }}
        >
          Bylda Course
        </div>
        <div className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
          Continue building your business, step by step
        </div>
        <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>
          You&apos;re on the <strong style={{ color: "var(--foreground)" }}>{stageLabel}</strong>{" "}
          stage — pick up your next lesson and turn it into a real task.
        </div>
      </div>
      <span
        className="relative inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-bold transition-transform group-hover:translate-x-0.5"
        style={{
          background: "var(--primary)",
          color: "var(--primary-foreground)",
          boxShadow: "0 6px 20px color-mix(in oklab, var(--primary) 35%, transparent)",
        }}
      >
        Open your course
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

/* ─── Supporting tools ──────────────────────────────────────── */

const SUPPORT_TOOLS = [
  { label: "Course", to: "/app/academy", icon: GraduationCap },
  { label: "Roadmap", to: "/app/roadmap", icon: Map },
  { label: "Research", to: "/app/research", icon: FlaskConical },
  { label: "Assets", to: "/app/assets", icon: FileText },
  { label: "Automations", to: "/app/automations", icon: Zap },
  { label: "Ask Bylda", to: "/app/mentor", icon: Bot },
] as const;

/* ─── Small pieces ──────────────────────────────────────────── */

function SectionLabel({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className="mb-3 flex items-center gap-2 px-0.5 text-[12px] font-bold uppercase tracking-[0.08em]"
      style={{ color: "var(--text-faint)" }}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </div>
  );
}

function StatusChip({
  tone,
  children,
}: {
  tone: "success" | "warning";
  children: React.ReactNode;
}) {
  const color = tone === "warning" ? "var(--warning)" : "var(--success)";
  return (
    <span
      className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-bold"
      style={{
        color,
        background: `color-mix(in oklab, ${color} 12%, var(--surface))`,
        borderColor: `color-mix(in oklab, ${color} 30%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

function StatTile({
  label,
  value,
  suffix,
  delta,
  deltaLabel,
}: {
  label: string;
  value: string;
  suffix?: string;
  delta: number;
  deltaLabel: (v: number) => string;
}) {
  return (
    <div
      className="rounded-2xl border px-5 py-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div
        className="text-[10.5px] font-bold uppercase tracking-[0.09em]"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          className="font-display text-[24px] font-extrabold"
          style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}
        >
          {value}
        </span>
        {suffix && (
          <span className="text-[12px] font-semibold" style={{ color: "var(--text-faint)" }}>
            {suffix}
          </span>
        )}
      </div>
      {delta > 0 && (
        <div className="mt-0.5 text-[11.5px] font-bold" style={{ color: "var(--success)" }}>
          ▲ {deltaLabel(delta)}
        </div>
      )}
    </div>
  );
}

/* ─── Lead deltas (last week) ───────────────────────────────── */

function leadDelta(leads: LeadRow[]): { countDelta: number; valueDelta: number } {
  const now = Date.now();
  let countDelta = 0;
  let valueDelta = 0;
  for (const l of leads) {
    if (!l.created_at) continue;
    const age = Math.floor((now - new Date(l.created_at).getTime()) / (7 * 86_400_000));
    if (age === 0) {
      countDelta += 1;
      valueDelta += l.value ?? 0;
    }
  }
  return { countDelta, valueDelta };
}

function formatMoney(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${Math.round(v)}`;
}
