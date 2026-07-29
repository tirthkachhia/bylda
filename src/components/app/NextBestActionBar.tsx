// NextBestActionBar — the app's "what do I do next?" answer, inline on every
// inner screen (audit Part 2 Q1). The home screens carry the full hero, so this
// slim bar fills the gap everywhere else: one move, one CTA, dismissible.
//
// Reads the same nextBestMove() the Mission Control hero does, so the guidance
// is identical wherever it appears — never a second surface disagreeing.

import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, AlertTriangle, Zap, X } from "lucide-react";
import { useProgressSpine } from "@/hooks/use-progress-spine";
import { nextBestMove } from "@/lib/next-move";

// Screens that already answer "what's next" prominently — no bar needed.
const HIDE_ON = new Set(["/app/mission-control", "/app/bylda-home", "/app/launchpad/course"]);

const DISMISS_KEY = "nba-dismissed-title";

export function NextBestActionBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const spine = useProgressSpine();
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });

  if (spine.isLoading || HIDE_ON.has(path) || !path.startsWith("/app/")) return null;

  const move = nextBestMove(spine.graph, spine.stage);
  if (dismissed === move.title) return null;

  const fix = move.tone === "fix";
  const accent = fix ? "var(--warning)" : "var(--primary)";

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, move.title);
    } catch {
      /* ignore */
    }
    setDismissed(move.title);
  };

  return (
    <div
      className="sticky top-0 z-20 flex items-center gap-3 border-b px-5 py-2 backdrop-blur md:px-7"
      style={{
        borderColor: `color-mix(in oklab, ${accent} 22%, var(--border))`,
        background: `color-mix(in oklab, ${accent} 7%, color-mix(in oklab, var(--surface) 82%, transparent))`,
      }}
    >
      <span
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em]"
        style={{ background: `color-mix(in oklab, ${accent} 16%, transparent)`, color: accent }}
      >
        {fix ? <AlertTriangle className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
        {move.eyebrow}
      </span>

      <span
        className="min-w-0 flex-1 truncate text-[13px] font-semibold"
        style={{ color: "var(--foreground)" }}
        title={move.title}
      >
        {move.title}
      </span>

      <Link
        to={move.to}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition-transform hover:-translate-y-0.5"
        style={{
          background: accent,
          color: fix ? "var(--warning-foreground)" : "var(--primary-foreground)",
        }}
      >
        {move.cta}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>

      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 transition-colors hover:bg-surface-2"
        style={{ color: "var(--text-faint)" }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
