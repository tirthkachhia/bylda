import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { toolRunsQuery, organizationQuery, currentMissionQuery } from "@/lib/queries";
import { guestStore } from "@/lib/guest";

export type FounderLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface FounderProgress {
  totalXP: number;
  level: FounderLevel;
  levelLabel: string;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  xpProgressInLevel: number;
  currentMissionTitle: string | null;
  currentMissionStepsTotal: number;
  currentMissionStepsCompleted: number;
  missionProgressPercent: number;
  orgStage: string;
  lane: string;
  nextMilestone: string;
  founderScore: number;
  isLoading: boolean;
}

const LEVEL_THRESHOLDS = [0, 200, 500, 1000, 2000, 3500, 5500, 8000, 11000, 15000];

export const LEVEL_LABELS: string[] = [
  "Spark",
  "Explorer",
  "Validator",
  "Builder",
  "Operator",
  "Commander",
  "Strategist",
  "Architect",
  "Visionary",
  "Legend",
];

// XP awarded per tool_key value stored in tool_runs.
// Covers both DB-format keys (e.g. "validate-idea") and slug variants.
export const XP_BY_TOOL: Record<string, number> = {
  "validate-idea": 80,
  "idea-validator": 80,
  "generate-pitch": 60,
  "pitch-generator": 60,
  "generate-gtm-strategy": 100,
  "gtm-strategy": 100,
  "generate-offer": 90,
  "offer-creation": 90,
  "kill-my-idea": 50,
  "idea-vs-idea": 70,
  "landing-page": 120,
  "landing-page-creator": 120,
  "first-10-customers": 100,
  "first-10-customers-finder": 100,
  "generate-followup-sequence": 80,
  "email-sequence": 80,
  "investor-emails": 70,
  "investor-email-writer": 70,
  "generate-ops-plan": 110,
  "funding-score": 90,
  "funding-readiness-score": 90,
  "business-plan": 150,
  "business-plan-generator": 150,
  "analyze-website": 60,
  "competitor-analysis": 80,
  competitor: 80,
  "pricing-strategy": 70,
  pricing: 70,
  "revenue-projector": 80,
  blog: 50,
  "blog-generator": 50,
};

export const DEFAULT_XP = 40;

const STAGE_ORDER = ["Idea", "Validate", "Launch", "Operate", "Scale"];

export function useFounderProgress(): FounderProgress {
  const { currentOrgId, user } = useAuth();
  const isGuest = guestStore.get().isGuest;

  const runsQ = useQuery({
    ...toolRunsQuery(currentOrgId ?? "", 500),
    enabled: !!currentOrgId,
  });

  const missionQ = useQuery({
    ...currentMissionQuery(user?.id ?? ""),
    enabled: !!user?.id && !isGuest,
  });

  const orgQ = useQuery({
    ...organizationQuery(currentOrgId ?? ""),
    enabled: !!currentOrgId,
  });

  const isLoading = runsQ.isLoading || missionQ.isLoading || orgQ.isLoading;

  // XP — only count succeeded tool runs
  const succeededRuns = (runsQ.data ?? []).filter((r) => r.status === "succeeded");
  const totalXP = succeededRuns.reduce((sum, r) => {
    const key = (r as { tool_key?: string }).tool_key ?? "";
    return sum + (XP_BY_TOOL[key] ?? DEFAULT_XP);
  }, 0);

  // Level from thresholds
  let rawLevel = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_THRESHOLDS[i]) {
      rawLevel = i + 1;
      break;
    }
  }
  const level = Math.min(rawLevel, 10) as FounderLevel;

  const xpForCurrentLevel = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const xpForNextLevel = level < 10 ? (LEVEL_THRESHOLDS[level] ?? 15000) : 15000;
  const xpInLevel = totalXP - xpForCurrentLevel;
  const xpSpanForLevel = xpForNextLevel - xpForCurrentLevel;
  const xpProgressInLevel =
    level === 10 ? 100 : Math.min(100, Math.round((xpInLevel / Math.max(1, xpSpanForLevel)) * 100));

  // Mission data
  const missionData = missionQ.data;
  const mission = missionData?.mission ?? null;
  const steps = missionData?.steps ?? [];
  const stepsCompleted = steps.filter(
    (s: { status: string }) => s.status === "completed" || s.status === "skipped",
  ).length;
  const missionProgressPercent =
    steps.length > 0 ? Math.round((stepsCompleted / steps.length) * 100) : 0;

  // Org context
  const orgStage = (orgQ.data as { stage?: string } | null)?.stage ?? "Idea";
  const stageIndex = Math.max(0, STAGE_ORDER.indexOf(orgStage));
  const lane = (missionData?.workspace as { lane?: string } | null)?.lane ?? "Idea";

  // Founder Score — weighted composite
  const founderScore = Math.min(
    100,
    Math.round(
      Math.min(totalXP / 15000, 1) * 40 +
        Math.min(missionProgressPercent * 0.3, 30) +
        Math.min(stageIndex * 6, 30),
    ),
  );

  // Next milestone
  const nextMilestone =
    level < 10 ? `Level ${level + 1} — ${LEVEL_LABELS[level]}` : "You've reached Legend status";

  return {
    totalXP,
    level,
    levelLabel: LEVEL_LABELS[level - 1] ?? "Spark",
    xpForCurrentLevel,
    xpForNextLevel,
    xpProgressInLevel,
    currentMissionTitle: (mission as { title?: string } | null)?.title ?? null,
    currentMissionStepsTotal: steps.length,
    currentMissionStepsCompleted: stepsCompleted,
    missionProgressPercent,
    orgStage,
    lane,
    nextMilestone,
    founderScore,
    isLoading,
  };
}
