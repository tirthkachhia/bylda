/**
 * CASEFILE OUTPUT LAYOUTS — one component per output_shape.
 *
 * The Casefile route (/app/launchpad/outputs/$id) routes on tool_runs.output_shape
 * and renders exactly one of these. Everything reads the tool_run output
 * defensively so any tool renders without a bespoke branch.
 *
 * Motion (per spec): command-register content fades/slides in from the left,
 * 150ms ease. Workspace content (CRM, calendar) gets no entrance animation, so
 * that class lives only here, on the dark command-register surfaces.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Circle,
  Sparkles,
  ShieldAlert,
  Target,
  GitCompareArrows,
  Clock,
  MessageCircle,
} from "lucide-react";
import {
  formatLabel,
  verdictCategory,
  asArray,
  type VerdictCategory,
  type CasefileRun,
  type CasefileCore as Core,
  type NextAction,
} from "@/lib/casefile";
import { AiOriginCard } from "@/components/bylda/AiOriginCard";
import { MomentumRail, type MomentumLoop } from "@/components/bylda/MomentumRail";

const STAGES = ["Clarify", "Validate", "Build", "Launch", "Operate", "Scale"];

const ENTRANCE = "animate-in fade-in slide-in-from-left-3 duration-150 ease-out";

const TONE_CLASSES: Record<VerdictCategory, { badge: string; card: string; text: string }> = {
  danger: {
    badge:
      "bg-[color-mix(in_oklab,var(--destructive)_12%,transparent)] text-[--destructive] border-[color-mix(in_oklab,var(--destructive)_30%,transparent)]",
    card: "border-l-[--destructive] bg-[color-mix(in_oklab,var(--destructive)_6%,transparent)]",
    text: "text-[--destructive]",
  },
  success: {
    badge:
      "bg-[color-mix(in_oklab,var(--success)_12%,transparent)] text-[--success] border-[color-mix(in_oklab,var(--success)_30%,transparent)]",
    card: "border-l-[--success] bg-[color-mix(in_oklab,var(--success)_6%,transparent)]",
    text: "text-[--success]",
  },
  warning: {
    badge:
      "bg-[color-mix(in_oklab,var(--warning)_12%,transparent)] text-[--warning] border-[color-mix(in_oklab,var(--warning)_30%,transparent)]",
    card: "border-l-[--warning] bg-[color-mix(in_oklab,var(--warning)_6%,transparent)]",
    text: "text-[--warning]",
  },
  neutral: {
    badge:
      "bg-[--primary-soft] text-[--accent] border-[color-mix(in_oklab,var(--accent)_30%,transparent)]",
    card: "border-l-[--accent] bg-[--primary-soft]",
    text: "text-[--accent]",
  },
};

function verdictTone(v: string) {
  return TONE_CLASSES[verdictCategory(v)];
}

/** Secondary "Bylda's Take" block — the shared AI-origin grammar. */
function ByldaTake({ text, className = "" }: { text: string; className?: string }) {
  return (
    <AiOriginCard label="Bylda's Take" className={className}>
      <span className="whitespace-pre-wrap">{text}</span>
    </AiOriginCard>
  );
}

/* ── Shared building blocks ────────────────────────────────────── */

function CommandHeader({
  run,
  core,
  showScoreBox = true,
}: {
  run: CasefileRun;
  core: Core;
  showScoreBox?: boolean;
}) {
  const tone = verdictTone(core.verdict || "review");
  const topDims = Object.entries(core.scores).slice(0, 4);
  return (
    <div className="bg-[--bg-command] px-4 py-6 text-[--text-inverse] sm:px-6 lg:px-8">
      <div className={`mx-auto max-w-6xl ${ENTRANCE}`}>
        <Link
          to="/app/launchpad/history"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Outputs
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-[#b9a4ff]">
              {formatLabel(run.tool_key)} · CASE {run.id.slice(0, 8)}
            </p>
            <h1 className="mt-1 text-[22px] font-bold tracking-[-0.025em]">
              {run.title || run.tool_key.replace(/-/g, " ")}
            </h1>
            <p className="mt-0.5 text-xs text-white/50">
              {new Date(run.created_at).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              {run.model ? ` · ${run.model}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {core.verdict && (
              <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${tone.badge}`}>
                {core.verdict}
              </span>
            )}
            {showScoreBox && core.score != null && (
              <div className="rounded-xl bg-white/10 px-4 py-2 text-center">
                <p className="text-2xl font-bold leading-none">{core.score}</p>
                <p className="text-[10px] uppercase tracking-wider text-white/50">score</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {STAGES.map((s, i) => (
            <span
              key={s}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                i === 1 ? "bg-[#6B46E8] text-white" : "bg-white/5 text-white/40"
              }`}
            >
              {s}
            </span>
          ))}
        </div>

        {topDims.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {topDims.map(([k, v]) => (
              <div key={k} className="rounded-xl bg-[--bg-command-2] p-3">
                <p className="text-[10px] uppercase tracking-wider text-white/40">
                  {k.replace(/_/g, " ")}
                </p>
                <p className="mt-1 text-lg font-bold">
                  {v}
                  <span className="text-xs text-white/40">/10</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Drawer({
  title,
  icon,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-[--border] bg-[--surface] shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-5 py-3.5 text-left hover:bg-[--surface-2]"
      >
        {icon}
        <span className="text-sm font-semibold text-[--foreground]">{title}</span>
        {count != null && (
          <span className="rounded-full bg-[--surface-2] px-2 py-0.5 text-xs font-semibold text-[--text-faint]">
            {count}
          </span>
        )}
        <ChevronDown
          className={`ml-auto h-4 w-4 text-[--text-faint] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="border-t border-[--border] px-5 py-4">{children}</div>}
    </div>
  );
}

function CaseRail({ run, core }: { run: CasefileRun; core: Core }) {
  return (
    <div className="space-y-4">
      {Object.keys(core.scores).length > 0 && (
        <div className="rounded-2xl border border-[--border] bg-[--surface] p-5 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[--text-faint]">
            Score Breakdown
          </p>
          <div className="space-y-2.5">
            {Object.entries(core.scores).map(([k, v]) => (
              <div key={k}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-[--muted-foreground]">{k.replace(/_/g, " ")}</span>
                  <span className="font-semibold text-[--foreground]">{v}/10</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[--surface-2]">
                  <div
                    className="h-full rounded-full bg-[--accent] transition-all duration-700"
                    style={{ width: `${Math.max(0, Math.min(100, (Number(v) / 10) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[--border] bg-[--surface] p-5 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[--text-faint]">
          Case Metadata
        </p>
        <dl className="space-y-2 text-xs">
          {(
            [
              ["Case ID", run.id.slice(0, 8)],
              ["Tool", run.tool_key],
              ["Shape", run.output_shape ?? "—"],
              ["Model", run.model ?? "—"],
              ["Status", run.status],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <dt className="text-[--text-faint]">{k}</dt>
              <dd className="truncate font-mono text-[--muted-foreground]">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-2xl border border-[--border] bg-[--surface] p-5 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[--text-faint]">
          Saved to Memory
        </p>
        <div className="flex items-center gap-2 text-sm text-[--muted-foreground]">
          <span className="h-2 w-2 rounded-full bg-[--success]" />
          This output is indexed in your Bylda memory.
        </div>
      </div>
    </div>
  );
}

function RecommendedMove({ nextActions }: { nextActions: NextAction[] }) {
  if (nextActions.length === 0) return null;
  return (
    <div className="rounded-2xl border border-[--border] bg-[--surface] p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5">
        <Target className="h-4 w-4 text-[--accent]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[--text-faint]">
          Recommended Move
        </span>
      </div>
      <div className="space-y-2">
        {nextActions.slice(0, 3).map((a, i) => (
          <div key={i} className="rounded-xl border border-[--border] bg-[--surface-2] p-3">
            <p className="text-sm font-semibold text-[--foreground]">{a.label}</p>
            {a.reason && (
              <p className="mt-0.5 text-xs leading-relaxed text-[--text-faint]">{a.reason}</p>
            )}
            {a.type === "tool" && a.target && (
              <Link
                to="/app/launchpad/$tool"
                params={{ tool: a.target }}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[--accent] hover:underline"
              >
                Run this tool <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MentorBridge() {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[--border] bg-[--primary-soft] p-4">
      <p className="text-sm text-[--foreground]">Want a second opinion on this?</p>
      <Link
        to="/app/launchpad/mentors"
        className="text-sm font-semibold text-[--accent] hover:underline"
      >
        Ask a mentor →
      </Link>
    </div>
  );
}

function Strengths({ strengths }: { strengths: string[] }) {
  if (strengths.length === 0) return null;
  return (
    <Drawer
      title="Confirmed Strengths"
      icon={<CheckCircle2 className="h-4 w-4 text-[--success]" />}
      count={strengths.length}
    >
      <ul className="space-y-2">
        {strengths.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm text-[--muted-foreground]">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[--success]" />
            {s}
          </li>
        ))}
      </ul>
    </Drawer>
  );
}

function ProofNeeded({ proof }: { proof: string[] }) {
  if (proof.length === 0) return null;
  return (
    <Drawer
      title="What Needs Proof"
      icon={<ShieldAlert className="h-4 w-4 text-[--warning]" />}
      count={proof.length}
    >
      <ul className="space-y-2">
        {proof.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm text-[--muted-foreground]">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[--warning]" />
            {s}
          </li>
        ))}
      </ul>
    </Drawer>
  );
}

/** Two-column body shell shared by the founder-analysis shapes. */
function FounderShell({
  run,
  core,
  header,
  children,
}: {
  run: CasefileRun;
  core: Core;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-[--background] pb-12">
      {header}
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <MomentumRail loop={loopFromRun(run, core)} className="mb-4" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.7fr_1fr]">
          <div className={`space-y-4 ${ENTRANCE}`}>{children}</div>
          <CaseRail run={run} core={core} />
        </div>
      </div>
    </div>
  );
}

/** Build the loop-context strip from a saved run — the chain that led here. */
function loopFromRun(run: CasefileRun, core: Core): MomentumLoop {
  const momentum =
    (core.verdict && `Verdict: ${core.verdict}`) || core.nextActions[0]?.label || undefined;
  return {
    decision: `Chose to run ${formatLabel(run.tool_key)}`,
    asset: run.title || formatLabel(run.tool_key),
    momentum,
  };
}

/* ── LAYOUT: score_verdict (highest priority) ──────────────────── */

export function ScoreVerdictLayout({
  run,
  core,
  extra,
}: {
  run: CasefileRun;
  core: Core;
  extra?: React.ReactNode;
}) {
  const tone = verdictTone(core.verdict || "review");
  // The hero numeral is the single largest element on the page — above the
  // fold, no scroll. Score if numeric, else the verdict word.
  const hero = core.score != null ? String(core.score) : core.verdict || "—";
  const heroIsScore = core.score != null;
  return (
    <FounderShell
      run={run}
      core={core}
      header={<CommandHeader run={run} core={core} showScoreBox={false} />}
    >
      {/* Bylda's Take — hero numeral */}
      <div className="rounded-2xl border border-[--border] border-l-4 border-l-[--accent] bg-[--surface] p-6 shadow-sm sm:p-8">
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[--accent]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[--accent]">
            Bylda's Take
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <span
            className={`font-bold leading-[0.85] tracking-[-0.04em] ${tone.text} ${
              heroIsScore ? "text-[96px] sm:text-[128px]" : "text-[44px] sm:text-[64px]"
            }`}
          >
            {hero}
          </span>
          {heroIsScore && (
            <span className="mb-2 text-2xl font-semibold text-[--text-faint]">/ 100</span>
          )}
          {heroIsScore && core.verdict && (
            <span
              className={`mb-3 rounded-full border px-3 py-1 text-sm font-semibold ${tone.badge}`}
            >
              {core.verdict}
            </span>
          )}
        </div>
        {(core.byldaTake || core.recommendation) && (
          <p className="mt-4 max-w-2xl whitespace-pre-wrap text-[15px] leading-relaxed text-[--foreground]">
            {core.byldaTake || core.recommendation}
          </p>
        )}
      </div>

      <RecommendedMove nextActions={core.nextActions} />
      {extra}
      <MentorBridge />
      <Strengths strengths={core.strengths} />
      <ProofNeeded proof={core.proof} />
    </FounderShell>
  );
}

/* ── LAYOUT: report ────────────────────────────────────────────── */

export function ReportLayout({
  run,
  core,
  extra,
}: {
  run: CasefileRun;
  core: Core;
  extra?: React.ReactNode;
}) {
  return (
    <FounderShell run={run} core={core} header={<CommandHeader run={run} core={core} />}>
      {(core.verdict || core.recommendation) && (
        <div
          className={`rounded-2xl border border-[--border] border-l-4 bg-[--surface] p-5 shadow-sm ${verdictTone(core.verdict || "review").card}`}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-[--text-faint]">
            Verdict
          </p>
          <p className="mt-1 text-[17px] font-semibold text-[--foreground]">
            {core.verdict || "Assessment complete"}
          </p>
          {core.recommendation && (
            <p className="mt-1.5 text-sm leading-relaxed text-[--muted-foreground]">
              {core.recommendation}
            </p>
          )}
        </div>
      )}
      {core.fullReport && (
        <div className="rounded-2xl border border-[--border] bg-[--surface] p-6 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[--text-faint]">
            Full Report
          </p>
          <div className="prose-casefile whitespace-pre-wrap text-sm leading-relaxed text-[--foreground]">
            {core.fullReport}
          </div>
        </div>
      )}
      {core.byldaTake && !core.fullReport && <ByldaTake text={core.byldaTake} />}
      <RecommendedMove nextActions={core.nextActions} />
      {extra}
      <MentorBridge />
      <Strengths strengths={core.strengths} />
      <ProofNeeded proof={core.proof} />
    </FounderShell>
  );
}

/* ── LAYOUT: memo (also the null/fallback shape) ───────────────── */

export function MemoLayout({
  run,
  core,
  extra,
}: {
  run: CasefileRun;
  core: Core;
  extra?: React.ReactNode;
}) {
  const tone = verdictTone(core.verdict || "review");
  return (
    <FounderShell run={run} core={core} header={<CommandHeader run={run} core={core} />}>
      {(core.verdict || core.recommendation) && (
        <div
          className={`rounded-2xl border border-[--border] border-l-4 bg-[--surface] p-5 shadow-sm ${tone.card}`}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-[--text-faint]">
            Verdict
          </p>
          <p className="mt-1 text-[17px] font-semibold text-[--foreground]">
            {core.verdict || "Assessment complete"}
          </p>
          {core.recommendation && (
            <p className="mt-1.5 text-sm leading-relaxed text-[--muted-foreground]">
              {core.recommendation}
            </p>
          )}
        </div>
      )}
      {core.byldaTake && <ByldaTake text={core.byldaTake} />}
      {core.fullReport && (
        <div className="rounded-2xl border border-[--border] bg-[--surface] p-6 shadow-sm">
          <div className="prose-casefile whitespace-pre-wrap text-sm leading-relaxed text-[--foreground]">
            {core.fullReport}
          </div>
        </div>
      )}
      <RecommendedMove nextActions={core.nextActions} />
      {extra}
      <MentorBridge />
      <Strengths strengths={core.strengths} />
      <ProofNeeded proof={core.proof} />
    </FounderShell>
  );
}

/* ── LAYOUT: comparison ────────────────────────────────────────── */

type Option = {
  label: string;
  price?: string | number;
  fields: [string, string][];
  recommended?: boolean;
};

/** Pull comparable options out of common shapes (pricing tiers, competitors). */
function readOptions(out: Record<string, unknown>): { options: Option[]; pick: string } {
  const pick = String(
    out.recommended_strategy ?? out.recommended_price ?? out.recommendation ?? "",
  );
  const raw =
    (Array.isArray(out.tiers) && out.tiers) ||
    (Array.isArray(out.options) && out.options) ||
    (Array.isArray(out.competitors) && out.competitors) ||
    (Array.isArray(out.comparison) && out.comparison) ||
    [];
  const options: Option[] = (raw as Record<string, unknown>[]).map((o) => {
    const label = String(o.name ?? o.label ?? o.tier ?? o.title ?? o.option ?? "Option");
    const price = (o.price ?? o.monthly_price ?? o.recommended_price) as
      | string
      | number
      | undefined;
    const fields = Object.entries(o)
      .filter(
        ([k, v]) =>
          !["name", "label", "tier", "title", "option", "price"].includes(k) &&
          (typeof v === "string" || typeof v === "number"),
      )
      .slice(0, 5)
      .map(([k, v]) => [k.replace(/_/g, " "), String(v)] as [string, string]);
    return {
      label,
      price,
      fields,
      recommended: pick !== "" && label.toLowerCase() === pick.toLowerCase(),
    };
  });
  return { options, pick };
}

export function ComparisonLayout({
  run,
  core,
  extra,
}: {
  run: CasefileRun;
  core: Core;
  extra?: React.ReactNode;
}) {
  const { options, pick } = readOptions(core.out);
  return (
    <FounderShell run={run} core={core} header={<CommandHeader run={run} core={core} />}>
      {pick && (
        <div className="rounded-2xl border border-[--border] border-l-4 border-l-[--accent] bg-[--primary-soft] p-5 shadow-sm">
          <div className="mb-1 flex items-center gap-1.5">
            <GitCompareArrows className="h-4 w-4 text-[--accent]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[--accent]">
              Recommended
            </span>
          </div>
          <p className="text-[17px] font-semibold text-[--foreground]">{pick}</p>
          {core.recommendation && pick !== core.recommendation && (
            <p className="mt-1 text-sm text-[--muted-foreground]">{core.recommendation}</p>
          )}
        </div>
      )}
      {options.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {options.map((o, i) => (
            <div
              key={i}
              className={`rounded-2xl border bg-[--surface] p-4 shadow-sm ${
                o.recommended ? "border-[--accent] ring-1 ring-[--accent]" : "border-[--border]"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-[--foreground]">{o.label}</p>
                {o.recommended && (
                  <span className="rounded-full bg-[--primary-soft] px-2 py-0.5 text-[10px] font-bold uppercase text-[--accent]">
                    Pick
                  </span>
                )}
              </div>
              {o.price != null && (
                <p className="mt-1 text-2xl font-bold text-[--foreground]">
                  {typeof o.price === "number" ? `$${o.price}` : o.price}
                </p>
              )}
              <dl className="mt-3 space-y-1.5">
                {o.fields.map(([k, v]) => (
                  <div key={k} className="text-xs">
                    <dt className="uppercase tracking-wide text-[--text-faint]">{k}</dt>
                    <dd className="text-[--muted-foreground]">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      ) : (
        core.fullReport && (
          <div className="rounded-2xl border border-[--border] bg-[--surface] p-6 shadow-sm">
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-[--foreground]">
              {core.fullReport}
            </div>
          </div>
        )
      )}
      <RecommendedMove nextActions={core.nextActions} />
      {extra}
      <MentorBridge />
    </FounderShell>
  );
}

/* ── LAYOUT: plan_with_steps ───────────────────────────────────── */

type Step = { label: string; detail?: string; done?: boolean };

function readSteps(out: Record<string, unknown>): Step[] {
  const raw =
    (Array.isArray(out.steps) && out.steps) ||
    (Array.isArray(out.sequence) && out.sequence) ||
    (Array.isArray(out.action_items) && out.action_items) ||
    (Array.isArray(out.plan) && out.plan) ||
    [];
  return (raw as unknown[]).map((s) => {
    if (typeof s === "string") return { label: s };
    const o = s as Record<string, unknown>;
    return {
      label: String(o.label ?? o.title ?? o.step ?? o.subject ?? o.action ?? o.name ?? "Step"),
      detail: (() => {
        const d = o.detail ?? o.description ?? o.body ?? o.content ?? o.message ?? o.reason;
        return d != null ? String(d) : undefined;
      })(),
      done: o.done === true || o.status === "done" || o.completed === true,
    };
  });
}

function StepRow({ step, index }: { step: Step; index: number }) {
  const [open, setOpen] = useState(false);
  const hasDetail = Boolean(step.detail);
  return (
    <div className="overflow-hidden rounded-xl border border-[--border] bg-[--surface] shadow-sm">
      <button
        onClick={() => hasDetail && setOpen((o) => !o)}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left ${hasDetail ? "hover:bg-[--surface-2]" : "cursor-default"}`}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            step.done ? "bg-[--success] text-white" : "bg-[--surface-2] text-[--text-faint]"
          }`}
        >
          {step.done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
        </span>
        <span className="flex-1 text-sm font-semibold text-[--foreground]">{step.label}</span>
        {step.done ? (
          <span className="text-[10px] font-bold uppercase text-[--success]">Done</span>
        ) : (
          <Circle className="h-3.5 w-3.5 text-[--text-faint]" />
        )}
        {hasDetail && (
          <ChevronDown
            className={`h-4 w-4 text-[--text-faint] transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>
      {open && step.detail && (
        <div className="border-t border-[--border] px-4 py-3 pl-14">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[--muted-foreground]">
            {step.detail}
          </p>
        </div>
      )}
    </div>
  );
}

export function PlanWithStepsLayout({
  run,
  core,
  extra,
}: {
  run: CasefileRun;
  core: Core;
  extra?: React.ReactNode;
}) {
  const steps = readSteps(core.out);
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <FounderShell run={run} core={core} header={<CommandHeader run={run} core={core} />}>
      {core.byldaTake && <ByldaTake text={core.byldaTake} />}
      {steps.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[--text-faint]">
              Plan · {steps.length} steps
            </p>
            {doneCount > 0 && (
              <p className="text-xs font-semibold text-[--success]">
                {doneCount}/{steps.length} done
              </p>
            )}
          </div>
          <div className="space-y-2">
            {steps.map((s, i) => (
              <StepRow key={i} step={s} index={i} />
            ))}
          </div>
        </div>
      ) : (
        core.fullReport && (
          <div className="rounded-2xl border border-[--border] bg-[--surface] p-6 shadow-sm">
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-[--foreground]">
              {core.fullReport}
            </div>
          </div>
        )
      )}
      <RecommendedMove nextActions={core.nextActions} />
      {extra}
      <MentorBridge />
    </FounderShell>
  );
}

/* ── LAYOUT: pipeline_snapshot (reads like a CRM row) ──────────── */

export function PipelineSnapshotLayout({ run, core }: { run: CasefileRun; core: Core }) {
  const out = core.out;
  const stage = String(out.stage ?? out.status ?? "—");
  const lastActivity = out.last_activity_at ?? out.updated_at ?? run.created_at;
  const rows: [string, string][] = [
    ["Stage", stage],
    ["Value", out.value != null ? `$${out.value}` : "—"],
    ["Owner", String(out.owner ?? out.assigned_to ?? "—")],
    ["Contact", String(out.contact ?? out.contact_name ?? "—")],
    ["Company", String(out.company ?? out.company_name ?? "—")],
    ["Source", String(out.source ?? "—")],
  ].filter(([, v]) => v !== "—") as [string, string][];

  return (
    <div className="min-h-full bg-[--background] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/app/bylda/crm"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-[--muted-foreground] hover:text-[--foreground]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Pipeline
        </Link>
        <div className="rounded-2xl border border-[--border] bg-[--surface] shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[--border] px-5 py-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[--text-faint]">
                {formatLabel(run.tool_key)}
              </p>
              <h1 className="text-lg font-bold text-[--foreground]">
                {run.title || "Pipeline snapshot"}
              </h1>
            </div>
            <span className="rounded-full bg-[--primary-soft] px-3 py-1 text-sm font-semibold text-[--accent]">
              {stage}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-3">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] uppercase tracking-wide text-[--text-faint]">{k}</dt>
                <dd className="text-sm font-semibold text-[--foreground]">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex items-center gap-1.5 border-t border-[--border] px-5 py-3 text-xs text-[--text-faint]">
            <Clock className="h-3.5 w-3.5" />
            Last activity{" "}
            {new Date(lastActivity as string).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>
        {core.byldaTake && <ByldaTake text={core.byldaTake} className="mt-4" />}
      </div>
    </div>
  );
}

/* ── LAYOUT: session_summary (mentor header) ───────────────────── */

export function SessionSummaryLayout({ run, core }: { run: CasefileRun; core: Core }) {
  const out = core.out;
  const mentor = String(out.mentor ?? out.mentor_name ?? out.persona ?? "Your mentor");
  const takeaways = asArray(out.takeaways ?? out.key_takeaways ?? out.highlights ?? core.strengths);
  const nextAction =
    core.nextActions[0]?.label ??
    String(out.next_action ?? out.next_suggested_action ?? core.recommendation ?? "");
  const nextTarget = core.nextActions[0]?.target;
  const initials = mentor
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-full bg-[--background] pb-12">
      <div className="bg-[--bg-command] px-4 py-6 text-[--text-inverse] sm:px-6 lg:px-8">
        <div className={`mx-auto flex max-w-3xl items-center gap-4 ${ENTRANCE}`}>
          <Link
            to="/app/launchpad/history"
            className="mr-2 inline-flex items-center gap-1.5 text-xs font-medium text-white/60 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#6B46E8] text-lg font-bold text-white">
            {initials || <MessageCircle className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[#b9a4ff]">Session Summary</p>
            <h1 className="text-lg font-bold">{mentor}</h1>
            <p className="text-xs text-white/50">
              {new Date(run.created_at).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      <div className={`mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6 lg:px-8 ${ENTRANCE}`}>
        {core.byldaTake && (
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[--foreground]">
            {core.byldaTake}
          </p>
        )}
        {takeaways.length > 0 && (
          <div className="rounded-2xl border border-[--border] bg-[--surface] p-5 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[--text-faint]">
              Key Takeaways
            </p>
            <ul className="space-y-2.5">
              {takeaways.map((t, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-[--foreground]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[--accent]" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}
        {nextAction && (
          <div className="rounded-2xl border border-[--accent] bg-[--primary-soft] p-5 shadow-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[--accent]">
              Next Suggested Action
            </p>
            <p className="text-[15px] font-semibold text-[--foreground]">{nextAction}</p>
            {nextTarget ? (
              <Link
                to="/app/launchpad/$tool"
                params={{ tool: nextTarget }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[--accent] px-4 py-2 text-sm font-semibold text-white hover:bg-[--primary-hover]"
              >
                Do it now <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                to="/app/launchpad/mentors"
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[--accent] px-4 py-2 text-sm font-semibold text-white hover:bg-[--primary-hover]"
              >
                Continue with a mentor <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        )}
        {takeaways.length === 0 && !nextAction && !core.byldaTake && (
          <div className="flex items-center gap-2 rounded-2xl border border-[--border] bg-[--surface] p-5 text-sm text-[--muted-foreground]">
            <CircleDashed className="h-4 w-4 text-[--text-faint]" />
            No summary was captured for this session yet.
          </div>
        )}
      </div>
    </div>
  );
}
