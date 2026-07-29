// Curriculum data layer — READ-ONLY legacy view of the retired lesson system.
//
// The mentor curriculum was merged into the mission spine (Phase 2): teaching
// copy lives in step-execution-guidance.ts keyed by step tool_key, completion
// is the advance-mission path, and no new lessons are ever minted
// (generate-playbook is retired). This hook remains only so surfaces that
// pick a mentor (MentorChatCard, /app/mentor) can keep reading historical
// lesson rows. It must never grow a write path.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Lesson, Playbook } from "@/lib/mentors";

// Tables are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function playbookQuery(orgId: string) {
  return {
    queryKey: ["playbook", orgId],
    queryFn: async (): Promise<Playbook | null> => {
      const { data, error } = await db
        .from("playbooks")
        .select("id, organization_id, casefile_run_id, business_model, stage")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return (data as Playbook) ?? null;
    },
    staleTime: 60_000,
  };
}

export function lessonsQuery(orgId: string) {
  return {
    queryKey: ["playbook-lessons", orgId],
    queryFn: async (): Promise<Lesson[]> => {
      const { data, error } = await db
        .from("playbook_lessons")
        .select(
          "id, playbook_id, mentor_id, stage, title, tool_key, output_format, status, position, summary, tool_run_id",
        )
        .eq("organization_id", orgId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Lesson[];
    },
    staleTime: 60_000,
  };
}

export function useCurriculum() {
  const { currentOrgId } = useAuth();
  const orgId = currentOrgId ?? "";

  const playbookQ = useQuery({ ...playbookQuery(orgId), enabled: !!orgId });
  const lessonsQ = useQuery({ ...lessonsQuery(orgId), enabled: !!orgId });

  const lessons = lessonsQ.data ?? [];
  const activeLesson = lessons.find((l) => l.status === "active") ?? null;
  const completed = lessons.filter((l) => l.status === "completed" || l.status === "skipped");

  return {
    isLoading: playbookQ.isLoading || lessonsQ.isLoading,
    playbook: playbookQ.data ?? null,
    lessons,
    activeLesson,
    completedCount: completed.length,
    /** Next lessons after the active one, for the muted "up next" avatars. */
    upcoming: lessons.filter((l) => l.status === "locked").slice(0, 4),
  };
}
