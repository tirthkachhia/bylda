// TASK-083 · Agent Context Packaging Logic
// Assembles the full context payload sent to the AI operator on every call.
// Keeps context consistent whether called from edge function or frontend.

import { supabase } from "@/integrations/supabase/client";
import type { OperatorContext } from "./operator-types";

export async function buildAgentContext(
  userId: string,
  opts: { workspaceId?: string; organizationId?: string } = {},
): Promise<OperatorContext> {
  const [profileRes, workspaceRes, missionRes, runsRes, subRes, intakeRes] =
    await Promise.allSettled([
      // Profile
      supabase
        .from("profiles")
        .select("full_name, onboarding_complete")
        .eq("id", userId)
        .maybeSingle(),
      // Workspace + current mission
      opts.workspaceId
        ? supabase
            .from("workspaces")
            .select("id, name, lane, current_mission_id, organization_id")
            .eq("id", opts.workspaceId)
            .maybeSingle()
        : supabase
            .from("workspaces")
            .select("id, name, lane, current_mission_id, organization_id")
            .eq("owner_id", userId)
            .limit(1)
            .maybeSingle(),
      // Current mission + step progress
      opts.workspaceId
        ? supabase
            .from("missions")
            .select("id, title, description, lane, status")
            .eq("workspace_id", opts.workspaceId)
            .eq("status", "active")
            .order("sort_order")
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      // Recent tool runs
      opts.organizationId
        ? supabase
            .from("tool_runs")
            .select("tool_key, status, created_at")
            .eq("organization_id", opts.organizationId)
            .order("created_at", { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [], error: null }),
      // Subscription / plan
      opts.organizationId
        ? supabase
            .from("subscriptions")
            .select("plan")
            .eq("organization_id", opts.organizationId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      // Workspace intake (idea, challenge)
      opts.workspaceId
        ? supabase
            .from("workspace_intake")
            .select("full_name, idea, challenge, lane")
            .eq("workspace_id", opts.workspaceId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  const profile = profileRes.status === "fulfilled" ? profileRes.value.data : null;
  const workspace = workspaceRes.status === "fulfilled" ? workspaceRes.value.data : null;
  const mission = missionRes.status === "fulfilled" ? missionRes.value.data : null;
  const recentRuns = runsRes.status === "fulfilled" ? (runsRes.value.data ?? []) : [];
  const sub = subRes.status === "fulfilled" ? subRes.value.data : null;
  const intake = intakeRes.status === "fulfilled" ? intakeRes.value.data : null;

  // Get step counts if we have a mission
  let stepCount = 0;
  let completedSteps = 0;
  if (mission?.id) {
    const stepsRes = await supabase
      .from("mission_steps")
      .select("status")
      .eq("mission_id", mission.id);
    if (stepsRes.data) {
      stepCount = stepsRes.data.length;
      completedSteps = stepsRes.data.filter(
        (s: { status: string }) => s.status === "completed",
      ).length;
    }
  }

  const orgId =
    opts.organizationId ?? (workspace as { organization_id?: string } | null)?.organization_id;

  // Stage comes from organizations.stage (canonical, user-updatable) — not the
  // frozen workspaces.stage, which was stuck at its onboarding value.
  let stage = "Idea";
  if (orgId) {
    const orgRes = await supabase
      .from("organizations")
      .select("stage")
      .eq("id", orgId)
      .maybeSingle();
    stage = (orgRes.data?.stage as string | undefined) ?? "Idea";
  }

  return {
    user_id: userId,
    workspace_id: workspace?.id,
    organization_id: orgId,
    lane: (workspace?.lane ?? intake?.lane ?? "Idea") as OperatorContext["lane"],
    stage,
    current_mission: mission
      ? {
          id: mission.id as string,
          title: mission.title as string,
          description: (mission.description as string | undefined) ?? undefined,
          step_count: stepCount,
          completed_steps: completedSteps,
        }
      : undefined,
    recent_tool_runs: recentRuns.map((r) => ({
      tool_key: r.tool_key as string,
      status: r.status as string,
      created_at: r.created_at as string,
    })),
    plan: sub?.plan ?? "starter",
    profile: {
      full_name: profile?.full_name ?? intake?.full_name ?? undefined,
      idea: intake?.idea ?? undefined,
      challenge: intake?.challenge ?? undefined,
    },
  };
}
