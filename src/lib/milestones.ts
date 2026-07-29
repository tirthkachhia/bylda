// Milestones — a small, fixed catalog of concrete business facts, each
// derived from real signals (never self-reported), shown on the Business
// Roadmap's "Business Progress & Levels" section.

import type { BusinessGraph } from "@/hooks/use-business-graph";
import { wonLeadCount } from "@/lib/ecosystem";
import type { RoadmapExtraSignals } from "@/lib/business-roadmap";

export interface MilestoneProgress {
  done: boolean;
  current: number;
  target: number;
}

export interface MilestoneDef {
  id: string;
  label: string;
  progress: (graph: BusinessGraph, extra: RoadmapExtraSignals) => MilestoneProgress;
}

function isWon(stage: string | null): boolean {
  const s = (stage ?? "").toLowerCase();
  return s.includes("won") || s.includes("closed");
}

/** Won-deal value recorded in the current calendar month (by updated_at, the
 *  closest real timestamp this schema has to "when it was marked won"). */
function wonValueThisMonth(graph: BusinessGraph): number {
  const now = new Date();
  return graph.leads
    .filter((l) => isWon(l.stage))
    .filter((l) => {
      const ts = l.updated_at ?? l.created_at;
      if (!ts) return false;
      const d = new Date(ts);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, l) => sum + (l.value ?? 0), 0);
}

export const MILESTONE_DEFS: MilestoneDef[] = [
  {
    id: "first-deal-closed",
    label: "First Deal Closed",
    progress: (graph) => {
      const won = wonLeadCount(graph);
      return { done: won >= 1, current: Math.min(won, 1), target: 1 };
    },
  },
  {
    id: "10k-revenue-month",
    label: "$10k Revenue Month",
    progress: (graph) => {
      const value = wonValueThisMonth(graph);
      return { done: value >= 10_000, current: Math.round(value), target: 10_000 };
    },
  },
  {
    id: "10-active-customers",
    label: "10 Active Customers",
    progress: (graph) => {
      const won = wonLeadCount(graph);
      return { done: won >= 10, current: won, target: 10 };
    },
  },
  {
    id: "build-a-team",
    label: "Build a Team",
    progress: (_graph, extra) => ({
      done: extra.orgMemberCount > 1,
      current: extra.orgMemberCount,
      target: 2,
    }),
  },
];
