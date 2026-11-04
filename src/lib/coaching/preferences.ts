import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
export type CoachingPreferences = {
  time_zone: string;
  week_starts_on: number;
  analysis_language: string;
  confidence_floor: "medium" | "high";
  history_days: number;
};
export const DEFAULT_COACHING_PREFERENCES: CoachingPreferences = {
  time_zone: "America/New_York",
  week_starts_on: 1,
  analysis_language: "English",
  confidence_floor: "medium",
  history_days: 60,
};
export const coachingPreferencesQuery = (org: string) =>
  queryOptions({
    queryKey: ["coaching-preferences", org],
    enabled: !!org,
    queryFn: async (): Promise<CoachingPreferences> => {
      const { data, error } = await db
        .from("coaching_workspace_preferences")
        .select("time_zone,week_starts_on,analysis_language,confidence_floor,history_days")
        .eq("organization_id", org)
        .maybeSingle();
      if (error) throw error;
      return data ?? DEFAULT_COACHING_PREFERENCES;
    },
  });
export async function saveCoachingPreferences(org: string, value: CoachingPreferences) {
  const { data: existing, error: readError } = await db
    .from("coaching_workspace_preferences")
    .select("organization_id")
    .eq("organization_id", org)
    .maybeSingle();
  if (readError) throw readError;
  const { error } = await (existing
    ? db.from("coaching_workspace_preferences").update(value).eq("organization_id", org)
    : db.from("coaching_workspace_preferences").insert({ organization_id: org, ...value }));
  if (error) throw error;
}
export const notificationPreferencesQuery = (userId: string) =>
  queryOptions({
    queryKey: ["notification-preferences", userId],
    enabled: !!userId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await db
        .from("coaching_notification_preferences")
        .select("muted_types")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data?.muted_types ?? [];
    },
  });
export async function saveNotificationPreferences(userId: string, mutedTypes: string[]) {
  const { data: existing, error: readError } = await db
    .from("coaching_notification_preferences")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw readError;
  const { error } = await (existing
    ? db
        .from("coaching_notification_preferences")
        .update({ muted_types: mutedTypes })
        .eq("user_id", userId)
    : db
        .from("coaching_notification_preferences")
        .insert({ user_id: userId, muted_types: mutedTypes }));
  if (error) throw error;
}
