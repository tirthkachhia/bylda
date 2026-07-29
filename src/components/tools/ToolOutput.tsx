/**
 * ToolOutput — the premium structured renderer for research-enriched tools.
 *
 * Renders the structured output contract (verdict / chips / drawers /
 * guidance plan / citations) produced by tools in the server-side research
 * map. Tools still returning legacy shapes never reach this component —
 * the tool route falls back to the existing OutputBody renderer, so
 * nothing breaks mid-migration (`hasStructuredOutput` is the gate).
 *
 * The guidance plan is the point: the answer ends in an ordered path where
 * step one is a launchable button (pre-briefed via the same ?context/
 * ?fromRun mechanism as Chain Once), not a sentence.
 *
 * Theme-aware by construction: every color is an app CSS token, so dark
 * mode works without a separate palette. Score animation respects
 * prefers-reduced-motion via Tailwind's motion-reduce variant.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  AlertTriangle,
  Check,
  ChevronRight,
  Crosshair,
  ExternalLink,
  Sparkles,
  Trophy,
} from "lucide-react";
import { launchpadCatalog } from "@/lib/mock";
import { MarkdownReport } from "@/components/app/OutputRenderer";

/* ─── Contract types (mirror withGuidanceContract server-side) ── */

interface Verdict {
  label: string;
  detail?: string;
  score?: number;
  scoreType?: "confidence" | "threat" | "opportunity";
}
interface Chip {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warning" | "bad";
}
interface DrawerBlock {
  icon?: "trophy" | "alert-triangle" | "target-arrow";
  title: string;
  tone?: "good" | "warning" | "accent";
  items: string[];
}
interface GuidanceStep {
  n?: number;
  title: string;
  detail?: string;
  launch?: { slug: string; label: string };
}
interface Guidance {
  direction: string;
  steps?: GuidanceStep[];
}
export interface StructuredToolOutput {
  verdict?: Verdict;
  chips?: Chip[];
  drawers?: DrawerBlock[];
  guidance?: Guidance;
  longform?: string;
  nextTool?: { slug: string; label: string };
  research_citations?: string[];
}

/** Gate: only outputs carrying the new contract render through ToolOutput. */
export function hasStructuredOutput(
  o: Record<string, unknown> | null,
): o is Record<string, unknown> & StructuredToolOutput {
  if (!o) return false;
  const v = o.verdict as Verdict | undefined;
  return !!v && typeof v.label === "string" && !!(o.guidance || o.chips || o.drawers);
}

/* ─── Tone → token mapping ─────────────────────────────────────── */

const TONE_COLOR: Record<string, string> = {
  good: "var(--success)",
  warning: "var(--warning)",
  bad: "var(--destructive)",
  neutral: "var(--muted-foreground)",
  accent: "var(--primary)",
};
const SCORE_TYPE_COLOR: Record<string, string> = {
  confidence: "var(--primary)",
  threat: "var(--warning)",
  opportunity: "var(--success)",
};
const DRAWER_ICON = {
  trophy: Trophy,
  "alert-triangle": AlertTriangle,
  "target-arrow": Crosshair,
} as const;

const VALID_SLUGS = new Set(launchpadCatalog.map((t) => t.key));

interface ToolOutputProps {
  toolName: string;
  output: StructuredToolOutput;
  /** Finished run id — carried as ?fromRun= so launches are pre-briefed */
  runId: string | null;
  runTitle: string;
  /** Primary input of this run — carried as ?context= */
  contextValue: string;
  /** Durable citations from tool_runs.citations (falls back to output field) */
  citations?: string[];
}

export function ToolOutput({
  toolName,
  output,
  runId,
  runTitle,
  contextValue,
  citations,
}: ToolOutputProps) {
  const sources = citations?.length ? citations : (output.research_citations ?? []);
  const steps = output.guidance?.steps ?? [];
  const primaryLaunch =
    steps.find((st) => st.launch && VALID_SLUGS.has(st.launch.slug))?.launch ??
    (output.nextTool && VALID_SLUGS.has(output.nextTool.slug) ? output.nextTool : undefined);

  const launchSearch = useMemo(
    () => ({ context: contextValue, title: runTitle, fromRun: runId ?? undefined }) as never,
    [contextValue, runTitle, runId],
  );

  const [done, setDone] = useState<Set<number>>(new Set());
  const toggleDone = (i: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--muted-foreground)" }}
        >
          {toolName}
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-medium"
          style={{
            borderColor: "color-mix(in oklab, var(--success) 30%, transparent)",
            background: "color-mix(in oklab, var(--success) 8%, transparent)",
            color: "var(--success)",
          }}
        >
          <Check className="h-3 w-3" aria-hidden="true" /> Saved to memory
        </span>
      </div>

      {/* ── Verdict ── */}
      {output.verdict && <VerdictBlock verdict={output.verdict} />}

      {/* ── Direction — the founder's takeaway, always visible ── */}
      {output.guidance?.direction && (
        <p
          className="border-l-4 py-1 pl-3 text-[14.5px] font-semibold leading-snug"
          style={{
            borderColor: "var(--primary)",
            color: "var(--foreground)",
          }}
        >
          {output.guidance.direction}
        </p>
      )}

      {/* ── Chips ── */}
      {!!output.chips?.length && (
        <div className="flex flex-wrap gap-2.5">
          {output.chips.slice(0, 4).map((c, i) => (
            <div
              key={i}
              className="min-w-[120px] flex-1 rounded-xl border px-3 py-2.5"
              style={{
                borderColor: `color-mix(in oklab, ${TONE_COLOR[c.tone ?? "neutral"]} 30%, var(--border))`,
                background: `color-mix(in oklab, ${TONE_COLOR[c.tone ?? "neutral"]} 5%, var(--surface))`,
              }}
            >
              <div
                className="text-[9.5px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: "var(--muted-foreground)" }}
              >
                {c.label}
              </div>
              <div
                className="mt-0.5 text-[13.5px] font-bold"
                style={{ color: TONE_COLOR[c.tone ?? "neutral"] }}
              >
                {c.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Drawers — progressive disclosure, collapsed by default ── */}
      {!!output.drawers?.length && (
        <div>
          {output.drawers.map((d, i) => (
            <OutputDrawer key={i} drawer={d} />
          ))}
        </div>
      )}

      {/* ── Guidance plan — numbered spine, step one is a button ── */}
      {steps.length > 0 && (
        <div>
          <div
            className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Your plan
          </div>
          <ol className="relative space-y-0">
            {steps.map((st, i) => {
              const launchable = st.launch && VALID_SLUGS.has(st.launch.slug);
              const isDone = done.has(i);
              return (
                <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                  {/* spine */}
                  {i < steps.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute left-[13px] top-7 bottom-0 w-px"
                      style={{ background: "var(--border)" }}
                    />
                  )}
                  <span
                    className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11.5px] font-bold"
                    style={
                      isDone
                        ? {
                            borderColor: "var(--success)",
                            background: "color-mix(in oklab, var(--success) 12%, transparent)",
                            color: "var(--success)",
                          }
                        : {
                            borderColor: "var(--border)",
                            background: "var(--surface)",
                            color: "var(--foreground)",
                          }
                    }
                  >
                    {isDone ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      (st.n ?? i + 1)
                    )}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div
                      className={`text-[13px] font-semibold ${isDone ? "line-through opacity-60" : ""}`}
                      style={{ color: "var(--foreground)" }}
                    >
                      {st.title}
                    </div>
                    {st.detail && (
                      <p
                        className="mt-0.5 text-[12px] leading-relaxed"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {st.detail}
                      </p>
                    )}
                    {launchable ? (
                      <Link
                        to="/app/launchpad/$tool"
                        params={{ tool: st.launch!.slug }}
                        search={launchSearch}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90"
                        style={{ background: "var(--primary)" }}
                      >
                        Start: {st.launch!.label}
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleDone(i)}
                        aria-pressed={isDone}
                        className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] font-medium transition hover:opacity-100"
                        style={{ color: "var(--muted-foreground)", opacity: 0.85 }}
                      >
                        <span
                          className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border"
                          style={{
                            borderColor: isDone ? "var(--success)" : "var(--border)",
                            background: isDone
                              ? "color-mix(in oklab, var(--success) 15%, transparent)"
                              : "transparent",
                          }}
                          aria-hidden="true"
                        >
                          {isDone && (
                            <Check className="h-2.5 w-2.5" style={{ color: "var(--success)" }} />
                          )}
                        </span>
                        {isDone ? "Done" : "Mark done"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* ── Longform prose (playbooks, sequences) ── */}
      {output.longform && (
        <OutputDrawer
          drawer={{ title: "Full write-up", tone: "accent", items: [] }}
          customBody={<MarkdownReport content={output.longform} />}
        />
      )}

      {/* ── Sources — the visible trust signal ── */}
      {sources.length > 0 && (
        <div>
          <div
            className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Sources
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sources.slice(0, 8).map((url, i) => {
              let host = url;
              try {
                host = new URL(url).hostname.replace(/^www\./, "");
              } catch {
                /* keep raw */
              }
              return (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition hover:opacity-100"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--muted-foreground)",
                    opacity: 0.9,
                  }}
                >
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  {host}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Action bar — persistent bottom anchor (Chain Once) ── */}
      <div
        className="flex flex-wrap items-center gap-2 border-t pt-4"
        style={{ borderColor: "color-mix(in oklab, var(--border) 60%, transparent)" }}
      >
        {primaryLaunch && (
          <Link
            to="/app/launchpad/$tool"
            params={{ tool: primaryLaunch.slug }}
            search={launchSearch}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition hover:opacity-90"
            style={{ background: "var(--primary)" }}
          >
            {primaryLaunch.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
        <Link
          to="/app/mentor"
          className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[12.5px] font-medium transition hover:opacity-100"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
            color: "var(--muted-foreground)",
            opacity: 0.9,
          }}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Ask Bylda why
        </Link>
      </div>
    </div>
  );
}

/* ─── Verdict block with animated score ring ───────────────────── */

function VerdictBlock({ verdict }: { verdict: Verdict }) {
  const color = SCORE_TYPE_COLOR[verdict.scoreType ?? "confidence"];
  const score =
    typeof verdict.score === "number" ? Math.max(0, Math.min(100, verdict.score)) : null;
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);
  const C = 2 * Math.PI * 26;

  return (
    <div
      className="flex items-center gap-4 rounded-xl border p-4"
      style={{
        borderColor: `color-mix(in oklab, ${color} 30%, var(--border))`,
        background: `color-mix(in oklab, ${color} 5%, var(--surface))`,
      }}
    >
      {score !== null && (
        <svg viewBox="0 0 60 60" width={64} height={64} className="shrink-0" aria-hidden="true">
          <circle cx="30" cy="30" r="26" fill="none" stroke="var(--border)" strokeWidth="4" />
          <circle
            cx="30"
            cy="30"
            r="26"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={animated ? C * (1 - score / 100) : C}
            transform="rotate(-90 30 30)"
            className="transition-all duration-700 ease-out motion-reduce:transition-none"
          />
          <text x="30" y="34" textAnchor="middle" fontSize="15" fontWeight="700" fill={color}>
            {score}
          </text>
        </svg>
      )}
      <div className="min-w-0">
        <div
          className="text-[17px] font-extrabold leading-tight"
          style={{ color: "var(--foreground)" }}
        >
          {verdict.label}
        </div>
        {verdict.detail && (
          <p
            className="mt-1 text-[12.5px] leading-relaxed"
            style={{ color: "var(--muted-foreground)" }}
          >
            {verdict.detail}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Drawer (collapsed by default) ────────────────────────────── */

function OutputDrawer({
  drawer,
  customBody,
}: {
  drawer: DrawerBlock;
  customBody?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const Icon = DRAWER_ICON[drawer.icon ?? "target-arrow"] ?? Crosshair;
  const tone = TONE_COLOR[drawer.tone ?? "accent"];

  return (
    <div
      className="mb-2 overflow-hidden rounded-xl border last:mb-0"
      style={{ borderColor: "var(--border)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors"
        style={{
          background: open ? `color-mix(in oklab, ${tone} 6%, var(--surface))` : "var(--surface)",
        }}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: tone }} aria-hidden="true" />
        <span className="flex-1 text-[12.5px] font-semibold" style={{ color: "var(--foreground)" }}>
          {drawer.title}
        </span>
        <ChevronRight
          className={`h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-90" : ""}`}
          style={{ color: "var(--muted-foreground)" }}
          aria-hidden="true"
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out motion-reduce:transition-none ${
          open ? "max-h-[1200px]" : "max-h-0"
        }`}
      >
        <div className="px-4 pb-4 pt-1">
          {customBody ??
            (drawer.items.length > 0 && (
              <ul className="space-y-1.5">
                {drawer.items.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[12px] leading-relaxed"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <span className="mt-0.5 shrink-0" style={{ color: tone }} aria-hidden="true">
                      ▸
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            ))}
        </div>
      </div>
    </div>
  );
}
