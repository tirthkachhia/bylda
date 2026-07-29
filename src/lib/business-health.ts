// Business Health Score — a 0–100 composite broken into five lettered
// sub-areas, shown on the Business Roadmap's "Business Progress & Levels"
// section. Same spirit as the single-number healthScore() heuristic in
// app.dashboard.tsx (real signals, weighted, capped at 100) but split per
// area instead of one number.
//
// Customer Experience has the weakest signal coverage in this app — there's
// no reviews/CSAT feature — so it's scored from follow-up/response-automation
// coverage as a proxy, not a claim about actual customer sentiment.

import type { BusinessGraph } from "@/hooks/use-business-graph";
import { wonLeadCount } from "@/lib/ecosystem";
import { gradeForScore, type Grade } from "@/lib/business-grade";

export type HealthAreaId = "sales" | "marketing" | "operations" | "financial" | "customer";

export interface HealthArea {
  id: HealthAreaId;
  label: string;
  score: number;
  grade: Grade;
}

export interface HealthBreakdown {
  overall: number;
  overallGrade: Grade;
  areas: HealthArea[];
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function deriveHealthBreakdown(graph: BusinessGraph): HealthBreakdown {
  const s = graph.signals;
  const won = wonLeadCount(graph);
  const winRate = s.leadCount > 0 ? won / s.leadCount : 0;
  const pipelineValue = graph.leads
    .filter((l) => !(l.stage ?? "").toLowerCase().includes("lost"))
    .reduce((sum, l) => sum + (l.value ?? 0), 0);
  const wonValue = graph.leads
    .filter((l) => (l.stage ?? "").toLowerCase().match(/won|closed/))
    .reduce((sum, l) => sum + (l.value ?? 0), 0);

  const salesScore = clamp100(
    20 +
      (s.leadCount >= 1 ? 15 : 0) +
      (s.leadCount >= 10 ? 15 : 0) +
      (won >= 1 ? 25 : 0) +
      (winRate >= 0.2 ? 25 : 0),
  );

  const marketingScore = clamp100(
    20 +
      (s.hasOffer ? 20 : 0) +
      (s.hasGtm ? 30 : 0) +
      (s.succeededToolKeys.some((k) => ["ad-copy", "seo-audit"].includes(k)) ? 30 : 0),
  );

  const operationsScore = clamp100(
    20 +
      (s.activeAutomationCount >= 1 ? 25 : 0) +
      (s.activeAutomationCount >= 3 ? 25 : 0) +
      (s.toolRunCount >= 5 ? 30 : 0),
  );

  const financialScore = clamp100(
    15 + (pipelineValue > 0 ? 20 : 0) + (wonValue > 0 ? 30 : 0) + (wonValue >= 10_000 ? 35 : 0),
  );

  const customerScore = clamp100(
    30 + (s.hasFollowupSequence ? 35 : 0) + (s.activeAutomationCount >= 1 ? 35 : 0),
  );

  const areas: HealthArea[] = [
    { id: "sales", label: "Sales System", score: salesScore, grade: gradeForScore(salesScore) },
    {
      id: "marketing",
      label: "Marketing Engine",
      score: marketingScore,
      grade: gradeForScore(marketingScore),
    },
    {
      id: "operations",
      label: "Operations",
      score: operationsScore,
      grade: gradeForScore(operationsScore),
    },
    {
      id: "financial",
      label: "Financial Health",
      score: financialScore,
      grade: gradeForScore(financialScore),
    },
    {
      id: "customer",
      label: "Customer Experience",
      score: customerScore,
      grade: gradeForScore(customerScore),
    },
  ];

  const overall = clamp100(areas.reduce((sum, a) => sum + a.score, 0) / areas.length);

  return { overall, overallGrade: gradeForScore(overall), areas };
}
