// useCourse — the read model for the personalized Founder Course.
//
// The course lives ON the existing mission spine: modules are `missions` rows
// carrying generated_from_casefile_id, steps are their `mission_steps`. This is
// the nested module → step view useProgressSpine (deliberately the single
// "current mission" read model) doesn't expose. Completion still flows through
// advance-mission → bylda_events; this hook has no write path.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

// The course columns are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type ModuleStatus = "locked" | "active" | "completed" | "skipped" | "paused";
export type StepStatus = "pending" | "in_progress" | "completed" | "skipped";
export type ActionType = "navigate" | "click" | "fill_field" | "review_output";

export interface CourseStep {
  id: string;
  mission_id: string;
  title: string;
  description: string | null;
  instruction: string | null;
  tool_key: string | null;
  target_ui_ref: string | null;
  action_type: ActionType | null;
  completion_event: string | null;
  status: StepStatus;
  sort_order: number;
}

export interface CourseModule {
  id: string;
  title: string;
  description: string | null;
  lane: string | null;
  status: ModuleStatus;
  sort_order: number;
  mentor_owner: string | null;
  steps: CourseStep[];
}

export interface Course {
  workspaceId: string | null;
  modules: CourseModule[];
}

const isStepClosed = (s: CourseStep) => s.status === "completed" || s.status === "skipped";

export function courseKey(userId: string) {
  return ["founder-course", userId];
}

export function useCourse() {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const query = useQuery({
    queryKey: courseKey(userId),
    enabled: !!userId,
    staleTime: 15_000,
    queryFn: async (): Promise<Course> => {
      const { data: ws } = await db
        .from("workspaces")
        .select("id")
        .eq("owner_id", userId)
        .maybeSingle();
      if (!ws) return { workspaceId: null, modules: [] };

      const { data: modules } = await db
        .from("missions")
        .select("id, title, description, lane, status, sort_order, mentor_owner")
        .eq("workspace_id", ws.id)
        .not("generated_from_casefile_id", "is", null)
        .order("sort_order", { ascending: true });

      const list = (modules ?? []) as Omit<CourseModule, "steps">[];
      if (list.length === 0) return { workspaceId: ws.id, modules: [] };

      const { data: steps } = await db
        .from("mission_steps")
        .select(
          "id, mission_id, title, description, instruction, tool_key, target_ui_ref, action_type, completion_event, status, sort_order",
        )
        .in(
          "mission_id",
          list.map((m) => m.id),
        )
        .order("sort_order", { ascending: true });

      const stepRows = (steps ?? []) as CourseStep[];
      return {
        workspaceId: ws.id,
        modules: list.map((m) => ({
          ...m,
          steps: stepRows.filter((s) => s.mission_id === m.id),
        })),
      };
    },
  });

  const modules: CourseModule[] = query.data?.modules ?? [];
  const activeModule = modules.find((m) => m.status === "active") ?? null;

  return {
    isLoading: query.isLoading,
    hasCourse: modules.length > 0,
    workspaceId: query.data?.workspaceId ?? null,
    modules,
    activeModule,
    /** First not-yet-closed step in a module — the one the founder works now. */
    currentStepOf: (m: CourseModule) => m.steps.find((s) => !isStepClosed(s)) ?? null,
    completedStepCount: (m: CourseModule) => m.steps.filter(isStepClosed).length,
  };
}
