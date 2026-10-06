import {
  useInsights,
  useObjectionStats,
  usePatterns,
  useTeam,
  useTeamBehaviors,
  useViewer,
} from "@/lib/data";
import { belowPatternFloor, importantToday, isOpenPattern } from "./model";

/**
 * The team context every Intelligence tab (I7–I11) opens with: who and how much it covers, and
 * whether the team has cleared the ~50-call pattern floor (§13.13). Counts on the tabs come from
 * the same hooks as I1, so the strip reads the same on every tab — and a count renders only once
 * its hook has answered (TanStack caches them, so moving between tabs refetches nothing).
 */
export function useIntelligenceContext() {
  const viewer = useViewer();
  const team = useTeam(viewer.data?.team?.id ?? "");
  const insights = useInsights();
  const patterns = usePatterns();
  const behaviors = useTeamBehaviors();
  const objections = useObjectionStats();

  const analyzed = team.data?.analyzedCalls ?? null;
  const tooFew = belowPatternFloor(analyzed);
  const teamName = viewer.data?.team?.name ?? team.data?.name ?? null;
  const eyebrow = [
    "INTELLIGENCE",
    teamName?.toUpperCase(),
    "LAST 30 DAYS",
    analyzed != null ? `${analyzed} ${analyzed === 1 ? "CALL" : "CALLS"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const counts = tooFew
    ? {}
    : {
        today: insights.data ? importantToday(insights.data).length : null,
        patterns: patterns.data ? patterns.data.filter(isOpenPattern).length : null,
        behaviors: behaviors.data?.length ?? null,
        objections: objections.data?.length ?? null,
      };

  return { eyebrow, analyzed, tooFew, counts };
}
