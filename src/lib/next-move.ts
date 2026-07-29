// nextBestMove — the single source of truth for "what should I do next?".
//
// A blocker to fix always wins; otherwise the top recommendation; otherwise
// "continue this stage." Mission Control's hero and the app-wide
// NextBestActionBar both read from here so the answer is identical everywhere,
// never two surfaces disagreeing.

import type { BusinessGraph } from "@/hooks/use-business-graph";
import type { LaunchpadProgress } from "@/lib/ecosystem";

export interface NextMove {
  tone: "fix" | "do";
  eyebrow: string;
  title: string;
  sub: string;
  to: string;
  cta: string;
  minutes: number;
  /** True when this is the low-signal "just continue" fallback (no blocker/rec). */
  isFallback: boolean;
}

export function nextBestMove(graph: BusinessGraph, progress: LaunchpadProgress): NextMove {
  const blocker = graph.blockers[0];
  const rec = graph.recommendations[0];

  if (blocker) {
    return {
      tone: "fix",
      eyebrow: "Fix this first",
      title: blocker.title,
      sub: blocker.why,
      to: blocker.resolveTo,
      cta: blocker.resolveLabel,
      minutes: blocker.estimatedMinutes,
      isFallback: false,
    };
  }
  if (rec) {
    return {
      tone: "do",
      eyebrow: "Do this next",
      title: rec.title,
      sub: rec.impact,
      to: rec.to,
      cta: "Start now",
      minutes: rec.estimatedMinutes,
      isFallback: false,
    };
  }
  return {
    tone: "do",
    eyebrow: "Continue your mission",
    title: progress.current.headline,
    sub: progress.current.proof,
    to: progress.current.to,
    cta: "Continue",
    minutes: 15,
    isFallback: true,
  };
}
