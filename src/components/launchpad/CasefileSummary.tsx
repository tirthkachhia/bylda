// Casefile — Launchpad Home's evidence block. Three questions, answered
// from live signals, never self-reported:
//   Bylda's take   → one-line verdict on where the business actually stands
//   Proven        → what the founder has already demonstrated
//   Needs proof   → what's still an assumption, and where to prove it
// Plus the memory strip: what the system has saved, visibly (closed loop).

import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, CircleDashed } from "lucide-react";
import { ClosedLoopChip } from "@/components/app/ClosedLoopChip";
import { AiOriginCard } from "@/components/bylda/AiOriginCard";
import type { BusinessGraph } from "@/hooks/use-business-graph";
import type { LaunchpadProgress } from "@/lib/ecosystem";

/** Rule-based verdict — plain words for where the business really is. */
function verdictFor(graph: BusinessGraph, progress: LaunchpadProgress): string {
  const s = graph.signals;
  const won = progress.stages.find((st) => st.id === "revenue")?.done;
  if (won) return "This works. Run the loop in Bylda and scale it.";
  if (s.leadCount > 0) return "You're in market. Push conversations to a first close.";
  if (s.hasGtm) return "The plan exists. Now it needs real people in it.";
  if (s.hasOffer) return "You can sell it. Next, decide where customers come from.";
  if (s.hasValidatedIdea) return "The signal is real. Now make it sellable — define the offer.";
  return "Unproven — score the idea before you build anything on top of it.";
}

export function CasefileSummary({
  graph,
  progress,
}: {
  graph: BusinessGraph;
  progress: LaunchpadProgress;
}) {
  return (
    <div className="space-y-3.5">
      {/* Bylda's take — the verdict block (shared AI-origin grammar) */}
      <AiOriginCard label="Bylda's take" title={verdictFor(graph, progress)} />

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {/* Proven */}
        <div
          className="rounded-[6px] border px-5 py-4"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div
            className="mb-2 text-[12.5px] font-bold"
            style={{ color: "var(--muted-foreground)" }}
          >
            Proven so far
          </div>
          {progress.proven.length === 0 ? (
            <div className="text-[12.5px]" style={{ color: "var(--text-faint)" }}>
              Nothing yet — your first proof is one step away.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {progress.proven.map((p) => (
                <li
                  key={p}
                  className="flex items-center gap-2 text-[13px] font-semibold"
                  style={{ color: "var(--foreground)" }}
                >
                  <CheckCircle2
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: "var(--success)" }}
                  />
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Needs proof */}
        <div
          className="rounded-[6px] border px-5 py-4"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div
            className="mb-2 text-[12.5px] font-bold"
            style={{ color: "var(--muted-foreground)" }}
          >
            Still needs proof
          </div>
          {progress.needsProof.length === 0 ? (
            <div className="text-[12.5px]" style={{ color: "var(--text-faint)" }}>
              Nothing — every claim in this casefile is backed. Ready for Bylda.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {progress.needsProof.map((n) => (
                <li key={n.label}>
                  <Link
                    to={n.to}
                    className="flex items-center gap-2 text-[13px] font-semibold transition-opacity hover:opacity-80"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <CircleDashed
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: "var(--warning)" }}
                    />
                    <span className="flex-1">{n.label}</span>
                    <ArrowRight className="h-3 w-3 shrink-0" style={{ color: "var(--primary)" }} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Memory strip — the system is visibly keeping track */}
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[6px] border px-5 py-3"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <ClosedLoopChip kind="memory" />
        <span className="text-[12.5px] font-semibold" style={{ color: "var(--foreground)" }}>
          {graph.businessName}
        </span>
        {graph.goal && (
          <span className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            · {graph.goal}
          </span>
        )}
        <span className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
          · {progress.current.label} stage
        </span>
        <Link
          to="/app/memory"
          className="ml-auto inline-flex items-center gap-1 text-[12px] font-bold"
          style={{ color: "var(--primary)" }}
        >
          Open memory
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
