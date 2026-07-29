// useProgressSpine — Phase 1 of the progress-spine consolidation: the one
// read model every "where am I / what's next" surface reads from.
//
//   stage    → deriveLaunchpadProgress(graph), passed through untouched. That
//              function is the canonical stage computation (the same one the
//              sidebar renders) — consumers must never recompute stage from
//              their own signals.
//   mission / steps → currentMissionQuery (missions / mission_steps tables,
//              advanced by the advance-mission edge function).
//   nextStep → the first open mission_step, in sort order. mission_steps state
//              is authoritative: when a roadmap signal disagrees with a step's
//              status, the step wins, and this hook does not reconcile or
//              expose the competing view.
//   percent  → mission_steps completion count only — never roadmap signals,
//              XP, or streak data.
//
// Read-only. This hook has zero write paths.

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { currentMissionQuery } from "@/lib/queries";
import { useBusinessGraph, type BusinessGraph } from "@/hooks/use-business-graph";
import { deriveLaunchpadProgress, type LaunchpadProgress } from "@/lib/ecosystem";

export interface SpineStep {
  id: string;
  title: string;
  description: string | null;
  tool_key: string | null;
  status: string;
  sort_order: number;
}

export interface SpineMission {
  id: string;
  title: string;
  description: string | null;
  lane: string | null;
  status: string;
}

export interface SpineWorkspace {
  id: string;
  name: string;
  lane: string | null;
  current_mission_id: string | null;
}

export interface ProgressSpine {
  isLoading: boolean;
  /** Canonical stage — deriveLaunchpadProgress output, never recomputed. */
  stage: LaunchpadProgress;
  /** The underlying graph, for consumers that also need blockers/recs/leads. */
  graph: BusinessGraph;
  workspace: SpineWorkspace | null;
  mission: SpineMission | null;
  steps: SpineStep[];
  /** First open mission_step — the authoritative next action. */
  nextStep: SpineStep | null;
  /** Steps closed out (completed or skipped). */
  completedCount: number;
  /** Mission completion, 0–100 — from mission_steps counts only. */
  percent: number;
}

const isClosed = (s: SpineStep) => s.status === "completed" || s.status === "skipped";

export function useProgressSpine(): ProgressSpine {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const graph = useBusinessGraph();
  const missionQ = useQuery({ ...currentMissionQuery(userId), enabled: !!userId });

  const data = missionQ.data as {
    workspace: SpineWorkspace;
    mission: SpineMission | null;
    steps: SpineStep[];
  } | null;

  const steps = data?.steps ?? [];
  const completedCount = steps.filter(isClosed).length;
  const nextStep = steps.find((s) => !isClosed(s)) ?? null;
  const percent = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return {
    isLoading: graph.isLoading || missionQ.isLoading,
    stage: deriveLaunchpadProgress(graph),
    graph,
    workspace: data?.workspace ?? null,
    mission: data?.mission ?? null,
    steps,
    nextStep,
    completedCount,
    percent,
  };
}
