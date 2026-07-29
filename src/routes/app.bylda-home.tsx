// Bylda Home — the operating system overview. Unmistakably Bylda:
// operational, calm, command-center. Answers on one screen:
//   1. Is the business healthy?      → health hero + KPI blocks
//   2. What needs me right now?      → urgent attention tray
//   3. What's moving?                → pipeline snapshot + recent activity
//   4. What runs by itself?         → automation status
//   5. What should I do next?        → AI recommendations (closed loop)
//   6. What does Bylda remember?      → strategic context from Launchpad
// No missions, no coaching language — this is running, not building.

import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  AlertTriangle,
  Zap,
  Workflow,
  Users,
  Trophy,
  DollarSign,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { recentMomentumQuery } from "@/lib/queries";
import { useBusinessGraph, type LeadRow } from "@/hooks/use-business-graph";
import { ClosedLoopChip } from "@/components/app/ClosedLoopChip";
import { DailyBriefingCard } from "@/components/bylda/DailyBriefingCard";
import { AiBriefingCard } from "@/components/app/dashboard/AiBriefingCard";
import { WorkspaceStatusBanner } from "@/components/app/dashboard/WorkspaceStatusBanner";
import { ModuleBoundary } from "@/components/app/ModuleBoundary";

export const Route = createFileRoute("/app/bylda-home")({
  component: ByldaHomePage,
});

/* ─── Operational read of the lead book ─────────────────────── */

const PIPELINE_BUCKETS = [
  { id: "new", label: "New", test: (s: string) => !s || s.includes("new") },
  { id: "contacted", label: "Contacted", test: (s: string) => s.includes("contact") },
  {
    id: "interested",
    label: "Interested",
    test: (s: string) => s.includes("qualif") || s.includes("interest"),
  },
  {
    id: "deciding",
    label: "Deciding",
    test: (s: string) => s.includes("proposal") || s.includes("negotiat"),
  },
  {
    id: "won",
    label: "Won",
    test: (s: string) => s.includes("won") || s.includes("closed"),
  },
] as const;

function bucketOf(lead: LeadRow) {
  const s = (lead.stage ?? "").toLowerCase();
  if (s.includes("lost")) return null;
  return PIPELINE_BUCKETS.find((b) => b.id !== "new" && b.test(s)) ?? PIPELINE_BUCKETS[0];
}

function staleLeads(leads: LeadRow[]): LeadRow[] {
  const now = Date.now();
  return leads.filter((l) => {
    const s = (l.stage ?? "").toLowerCase();
    if (s.includes("won") || s.includes("closed") || s.includes("lost")) return false;
    if (!l.created_at) return false;
    return now - new Date(l.created_at).getTime() > 3 * 86_400_000;
  });
}

function ByldaHomePage() {
  const { profile, currentOrgId } = useAuth();
  const graph = useBusinessGraph();
  const momentum = useQuery({
    ...recentMomentumQuery(currentOrgId ?? ""),
    enabled: !!currentOrgId,
  });
  const momentumCounts = momentum.data?.counts ?? {};

  const name = profile?.full_name?.split(" ")[0] || "there";
  const leads = graph.leads;
  const open = leads.filter((l) => {
    const s = (l.stage ?? "").toLowerCase();
    return !s.includes("won") && !s.includes("closed") && !s.includes("lost");
  });
  const won = leads.filter((l) => {
    const s = (l.stage ?? "").toLowerCase();
    return s.includes("won") || s.includes("closed");
  }).length;
  const pipelineValue = open.reduce((sum, l) => sum + (l.value ?? 0), 0);
  const stale = staleLeads(leads);
  const autos = graph.signals.activeAutomationCount;

  /* Health: automations running, nothing urgent, pipeline moving. */
  const urgentCount = graph.blockers.length + (stale.length > 0 ? 1 : 0);
  const healthy = urgentCount === 0 && autos > 0;
  const healthLabel = healthy
    ? "Everything is running"
    : urgentCount === 0
      ? "Stable — nothing urgent"
      : `${urgentCount} item${urgentCount === 1 ? "" : "s"} need${urgentCount === 1 ? "s" : ""} attention`;

  // Where the hero's "review" CTA sends you — a real blocker first, else stale leads.
  const firstUrgentTo =
    graph.blockers[0]?.resolveTo ?? (stale.length > 0 ? "/app/contacts" : "/app/bylda/crm");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* ── Provisioning repair / operator cockpit strip ── */}
      <ModuleBoundary name="workspace status">
        <WorkspaceStatusBanner />
      </ModuleBoundary>

      {/* ── Command hero: is the business okay? ── */}
      <div
        className="relative overflow-hidden rounded-[20px] border p-6 md:p-7"
        style={{
          borderColor:
            urgentCount > 0
              ? "color-mix(in oklab, var(--warning) 32%, transparent)"
              : "var(--primary-border)",
          background:
            "radial-gradient(120% 140% at 0% 0%, color-mix(in oklab, " +
            (urgentCount > 0 ? "var(--warning)" : "var(--primary)") +
            " 12%, var(--surface)) 0%, var(--surface) 55%)",
          boxShadow: "var(--shadow-glow-primary)",
        }}
      >
        <div className="bg-grid-faint pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative">
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em]"
            style={{ color: urgentCount > 0 ? "var(--warning)" : "var(--success)" }}
          >
            <span
              className="bylda-live-dot h-1.5 w-1.5 rounded-full"
              style={{ background: "currentColor" }}
            />
            {urgentCount > 0
              ? `${urgentCount} item${urgentCount === 1 ? "" : "s"} need${urgentCount === 1 ? "s" : ""} attention`
              : "All systems operating"}
          </span>
          <h1
            className="mt-2.5 font-display text-[26px] font-extrabold leading-tight md:text-[30px]"
            style={{ color: "var(--foreground)", letterSpacing: "-0.03em" }}
          >
            {greeting()}, {name}
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--muted-foreground)" }}>
            {graph.businessName} · {healthLabel}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {urgentCount > 0 ? (
              <Link
                to={firstUrgentTo}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-bold transition-transform hover:-translate-y-0.5"
                style={{
                  background: "var(--warning)",
                  color: "var(--warning-foreground)",
                  boxShadow: "0 6px 20px color-mix(in oklab, var(--warning) 35%, transparent)",
                }}
              >
                <AlertTriangle className="h-4 w-4" />
                Review what needs you
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                to="/app/bylda/crm"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-bold transition-transform hover:-translate-y-0.5"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                  boxShadow: "0 6px 20px color-mix(in oklab, var(--primary) 40%, transparent)",
                }}
              >
                <Workflow className="h-4 w-4" />
                Open pipeline
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <span
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold"
              style={{ color: "var(--text-faint)" }}
            >
              <DollarSign className="h-3.5 w-3.5" />
              {formatMoney(pipelineValue)} across {open.length} open deal
              {open.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>

      {/* ── KPI blocks ── */}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <KpiBlock
          icon={DollarSign}
          label="Pipeline"
          value={formatMoney(pipelineValue)}
          to="/app/bylda/crm"
        />
        <KpiBlock icon={Users} label="Open deals" value={String(open.length)} to="/app/bylda/crm" />
        <KpiBlock icon={Trophy} label="Won" value={String(won)} to="/app/contacts" />
        <KpiBlock
          icon={Zap}
          label="Automations live"
          value={String(autos)}
          to="/app/automations"
          tone={autos === 0 ? "warn" : "ok"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-6 min-w-0">
          {/* ── Daily briefing — Bylda's overnight check ── */}
          <DailyBriefingCard />

          {/* ── AI briefing — situation report, north star, quick wins ── */}
          <ModuleBoundary name="AI briefing">
            <AiBriefingCard />
          </ModuleBoundary>

          {/* ── Urgent attention tray ── */}
          <div>
            <SectionLabel>Needs your attention</SectionLabel>
            {urgentCount === 0 ? (
              <div
                className="flex items-center gap-2.5 rounded-2xl border px-5 py-4 text-[13px]"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface)",
                  color: "var(--muted-foreground)",
                }}
              >
                <CheckCircle2 className="h-4 w-4" style={{ color: "var(--success)" }} />
                Nothing urgent. Bylda is watching the pipeline and will flag anything that stalls.
              </div>
            ) : (
              <div className="space-y-2.5">
                {stale.length > 0 && (
                  <UrgentRow
                    title={`${stale.length} lead${stale.length === 1 ? "" : "s"} waiting on a reply`}
                    why="They've been quiet 3+ days. Deals die in silence — send the follow-up."
                    to="/app/contacts"
                    cta="Review and follow up"
                  />
                )}
                {graph.blockers.map((b) => (
                  <UrgentRow
                    key={b.id}
                    title={b.title}
                    why={b.why}
                    to={b.resolveTo}
                    cta={`${b.resolveLabel} · ${b.estimatedMinutes} min`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Pipeline snapshot ── */}
          <div>
            <SectionLabel>Pipeline</SectionLabel>
            <div
              className="rounded-2xl border"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <div
                className="flex items-center justify-between px-4.5 py-3"
                style={{ borderBottom: "1px solid var(--border-subtle)", padding: "12px 18px" }}
              >
                <span className="text-[13px] font-bold" style={{ color: "var(--foreground)" }}>
                  Where every deal stands
                </span>
                <Link
                  to="/app/bylda/crm"
                  className="text-[12px] font-semibold"
                  style={{ color: "var(--primary)" }}
                >
                  Open pipeline →
                </Link>
              </div>
              <div className="grid grid-cols-5">
                {PIPELINE_BUCKETS.map((b, i) => {
                  const inBucket = leads.filter((l) => bucketOf(l)?.id === b.id);
                  const value = inBucket.reduce((s, l) => s + (l.value ?? 0), 0);
                  return (
                    <div
                      key={b.id}
                      className="px-3 py-3.5 text-center"
                      style={{
                        borderLeft: i > 0 ? "1px solid var(--border-subtle)" : "none",
                      }}
                    >
                      <div
                        className="text-[18px] font-extrabold"
                        style={{
                          color:
                            b.id === "won"
                              ? "var(--success)"
                              : inBucket.length > 0
                                ? "var(--foreground)"
                                : "var(--text-faint)",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {inBucket.length}
                      </div>
                      <div
                        className="text-[10.5px] font-bold uppercase tracking-[0.06em]"
                        style={{ color: "var(--text-faint)" }}
                      >
                        {b.label}
                      </div>
                      {value > 0 && (
                        <div
                          className="mt-0.5 text-[10.5px] font-semibold"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {formatMoney(value)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Next moves — the closed loop, visible ── */}
          <div>
            <SectionLabel>
              Next moves <ClosedLoopChip kind="learned" />
            </SectionLabel>
            <div
              className="rounded-2xl border"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              {graph.recommendations.map((r, i) => (
                <Link
                  key={r.id}
                  to={r.to}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2"
                  style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold" style={{ color: "var(--foreground)" }}>
                      {r.title}
                    </div>
                    <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                      {r.impact}
                    </div>
                  </div>
                  <span
                    className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-semibold"
                    style={{ color: "var(--text-faint)" }}
                  >
                    <Clock className="h-3 w-3" />
                    {r.estimatedMinutes}m
                  </span>
                  <ArrowRight
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: "var(--primary)" }}
                  />
                </Link>
              ))}
            </div>
          </div>

          {/* ── This week's momentum — event ledger, closed loop ── */}
          {Object.keys(momentumCounts).length > 0 && (
            <div>
              <SectionLabel>
                This week&apos;s momentum <ClosedLoopChip kind="updated" />
              </SectionLabel>
              <div className="flex flex-wrap gap-2">
                {Object.entries(momentumCounts).map(([eventType, count]) => (
                  <div
                    key={eventType}
                    className="inline-flex items-center gap-2 rounded-xl border px-3 py-2"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  >
                    <span
                      className="text-[15px] font-bold tabular-nums"
                      style={{ color: "var(--foreground)" }}
                    >
                      {count}
                    </span>
                    <span
                      className="text-[12px] font-semibold"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {formatEventType(eventType)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right rail: automation status + memory + activity ── */}
        <div className="space-y-6 min-w-0">
          <div>
            <SectionLabel>Automation</SectionLabel>
            <div
              className="rounded-2xl border px-5 py-4"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <div className="flex items-center gap-2">
                <Zap
                  className="h-4 w-4"
                  style={{ color: autos > 0 ? "var(--success)" : "var(--warning)" }}
                />
                <span className="text-[13px] font-bold" style={{ color: "var(--foreground)" }}>
                  {autos > 0
                    ? `${autos} automation${autos === 1 ? "" : "s"} running`
                    : "Nothing runs by itself yet"}
                </span>
              </div>
              <p
                className="mt-1 text-[12px] leading-relaxed"
                style={{ color: "var(--muted-foreground)" }}
              >
                {autos > 0
                  ? "Follow-ups and busywork are handled. Bylda flags anything that fails."
                  : "Every task you do by hand eats your week. Turn one on — it takes 15 minutes."}
              </p>
              {autos > 0 ? (
                <Link
                  to="/app/automations"
                  className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-bold"
                  style={{ color: "var(--primary)" }}
                >
                  View runs
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ) : (
                <Link
                  to="/app/outcomes/$category"
                  params={{ category: "automate" }}
                  className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-bold"
                  style={{ color: "var(--primary)" }}
                >
                  Automate one task
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>

          {/* Memory — strategic context inherited from Launchpad */}
          <div>
            <SectionLabel>
              What Bylda remembers <ClosedLoopChip kind="memory" />
            </SectionLabel>
            <div
              className="rounded-2xl border px-5 py-4"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <div className="text-[13px] font-bold" style={{ color: "var(--foreground)" }}>
                {graph.businessName}
              </div>
              {graph.goal && (
                <div
                  className="mt-0.5 text-[12px] leading-relaxed"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Goal: {graph.goal}
                </div>
              )}
              <ul className="mt-2.5 space-y-1.5">
                {[
                  graph.signals.hasValidatedIdea && "Idea validated in Bylda",
                  graph.signals.hasOffer && "Offer and pricing locked",
                  graph.signals.hasGtm && "Customer plan on file",
                  graph.signals.hasFollowupSequence && "Follow-up sequence written",
                ]
                  .filter((x): x is string => !!x)
                  .map((line) => (
                    <li
                      key={line}
                      className="flex items-center gap-2 text-[12px]"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      <CheckCircle2
                        className="h-3 w-3 shrink-0"
                        style={{ color: "var(--success)" }}
                      />
                      {line}
                    </li>
                  ))}
              </ul>
              <Link
                to="/app/memory"
                className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-bold"
                style={{ color: "var(--primary)" }}
              >
                Open memory
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Recent activity — what changed */}
          <div>
            <SectionLabel>What changed</SectionLabel>
            <div
              className="rounded-2xl border"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              {leads.length === 0 ? (
                <div
                  className="px-5 py-4 text-[12.5px]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Activity shows up here as leads move and automations run.
                </div>
              ) : (
                leads.slice(0, 4).map((l, i) => (
                  <div
                    key={l.id}
                    className="flex items-center gap-2.5 px-5 py-2.5"
                    style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none" }}
                  >
                    <Workflow
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: "var(--primary)" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-[12.5px] font-semibold"
                        style={{ color: "var(--foreground)" }}
                      >
                        {l.name || "New lead"}
                      </div>
                      <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                        {l.stage || "New"} · {timeAgo(l.created_at)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Pieces ────────────────────────────────────────────────── */

function KpiBlock({
  icon: Icon,
  label,
  value,
  to,
  tone = "ok",
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  to: string;
  tone?: "ok" | "warn";
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl border px-4 py-3.5 transition-colors hover:bg-surface-2"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="flex items-center gap-1.5">
        <Icon
          className="h-3.5 w-3.5"
          style={{ color: tone === "warn" ? "var(--warning)" : "var(--primary)" }}
        />
        <span
          className="text-[10.5px] font-bold uppercase tracking-[0.06em]"
          style={{ color: "var(--text-faint)" }}
        >
          {label}
        </span>
      </div>
      <div
        className="mt-1 text-[22px] font-extrabold"
        style={{
          color: tone === "warn" ? "var(--warning)" : "var(--foreground)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
    </Link>
  );
}

function UrgentRow({
  title,
  why,
  to,
  cta,
}: {
  title: string;
  why: string;
  to: string;
  cta: string;
}) {
  return (
    <div
      className="rounded-2xl border px-5 py-4"
      style={{
        background: "color-mix(in oklab, var(--warning) 8%, var(--surface))",
        borderColor: "color-mix(in oklab, var(--warning) 28%, transparent)",
        borderLeft: "3px solid var(--warning)",
      }}
    >
      <div className="text-[13px] font-bold" style={{ color: "var(--foreground)" }}>
        {title}
      </div>
      <div
        className="mt-0.5 text-[12.5px] leading-relaxed"
        style={{ color: "var(--muted-foreground)" }}
      >
        {why}
      </div>
      <Link
        to={to}
        className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-bold"
        style={{ color: "var(--warning)" }}
      >
        {cta}
        <ArrowRight className="h-3 w-3" />
      </Link>
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

// "step.completed" → "Step completed" — human-readable without a per-type map,
// so new event types render sensibly with no code change.
function formatEventType(eventType: string): string {
  const words = eventType.replace(/[._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatMoney(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${Math.round(v)}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "recently";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
