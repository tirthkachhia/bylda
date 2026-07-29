// Mission loop — closes the run→step gap. When a tool run succeeds, the
// mission step that pointed at that tool completes automatically (via the
// advance-mission edge function) and the caller gets a momentum summary —
// what changed, how far along the mission is, and what's next — to show the
// user instead of leaving a checklist silently waiting for a manual tick.

import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "./invokeEdge";
import { TOOL_ROUTES } from "./step-execution-guidance";

export interface MissionLoopStep {
  id: string;
  title: string;
  tool_key: string | null;
  status: string;
  sort_order: number;
}

export interface RunMomentum {
  missionTitle: string;
  /** True when the step just completed was the mission's last open step. */
  missionCompleted: boolean;
  stepTitle: string;
  /** Steps done after this completion (includes the step just completed). */
  completedCount: number;
  totalSteps: number;
  nextStep: { id: string; title: string; toolRoute: string | null } | null;
}

const isOpen = (s: MissionLoopStep) =>
  s.status !== "completed" && s.status !== "skipped" && s.status !== "done";

/**
 * Lesson/catalog vocabulary → mission_step.tool_key vocabulary.
 * The retired mentor curriculum (and its catalog twins) named these tools
 * differently from the mission-step seeds; a successful run of the left-hand
 * tool must complete the right-hand step. `offer` and `kpi-dashboard` already
 * use the same key in both vocabularies, so they need no entry.
 */
export const STEP_TOOL_ALIASES: Record<string, string> = {
  "first-10-customers-finder": "first-10-customers",
  "email-sequence": "followup",
  "gtm-strategy-builder": "gtm-strategy",
};

/**
 * Pick the step a successful tool run should complete. An explicit stepId
 * (from the step CTA's ?step= param) wins but only while that step is still
 * open — a re-run must not complete a second step. Without one, the first
 * open step pointing at this tool matches, so the loop closes even when the
 * user reached the tool through the catalog instead of a step button.
 */
export function resolveStepForRun(
  steps: MissionLoopStep[],
  match: { stepId?: string | null; toolKeys: string[] },
): MissionLoopStep | null {
  const sorted = [...steps].sort((a, b) => a.sort_order - b.sort_order);
  if (match.stepId) {
    const byId = sorted.find((s) => s.id === match.stepId);
    return byId && isOpen(byId) ? byId : null;
  }
  const keys = new Set(match.toolKeys.filter(Boolean));
  for (const k of [...keys]) {
    const alias = STEP_TOOL_ALIASES[k];
    if (alias) keys.add(alias);
  }
  return sorted.find((s) => isOpen(s) && s.tool_key !== null && keys.has(s.tool_key)) ?? null;
}

/** Momentum summary for the post-run panel, computed as-if completedStepId is done. */
export function buildRunMomentum(
  missionTitle: string,
  steps: MissionLoopStep[],
  completedStepId: string,
): RunMomentum {
  const sorted = [...steps].sort((a, b) => a.sort_order - b.sort_order);
  const after = sorted.map((s) => (s.id === completedStepId ? { ...s, status: "completed" } : s));
  const next = after.find(isOpen) ?? null;
  return {
    missionTitle,
    missionCompleted: next === null,
    stepTitle: sorted.find((s) => s.id === completedStepId)?.title ?? "",
    completedCount: after.filter((s) => !isOpen(s)).length,
    totalSteps: after.length,
    nextStep: next
      ? {
          id: next.id,
          title: next.title,
          toolRoute: next.tool_key ? (TOOL_ROUTES[next.tool_key] ?? null) : null,
        }
      : null,
  };
}

/**
 * Complete the mission step matching this tool run and return the momentum
 * summary, or null when no step matched. Never throws — mission bookkeeping
 * must not break a successful tool run.
 */
export async function advanceMissionAfterRun(args: {
  userId: string;
  stepId?: string | null;
  toolKeys: string[];
}): Promise<RunMomentum | null> {
  try {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", args.userId)
      .maybeSingle();
    if (!ws) return null;

    const { data: mission } = await supabase
      .from("missions")
      .select("id, title")
      .eq("workspace_id", ws.id)
      .eq("status", "active")
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (!mission) return null;

    const { data: stepRows } = await supabase
      .from("mission_steps")
      .select("id, title, tool_key, status, sort_order")
      .eq("mission_id", mission.id)
      .order("sort_order");
    const steps = (stepRows ?? []) as MissionLoopStep[];

    const step = resolveStepForRun(steps, { stepId: args.stepId, toolKeys: args.toolKeys });
    if (!step) return null;

    await invokeEdge(
      "advance-mission",
      {
        action: "complete_step",
        step_id: step.id,
        mission_id: mission.id,
        workspace_id: ws.id,
      },
      { timeoutMs: 20_000 },
    );

    return buildRunMomentum((mission.title as string) ?? "", steps, step.id);
  } catch {
    return null;
  }
}
