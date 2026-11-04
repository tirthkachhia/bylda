import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export type CoachingUsage = {
  recordings: number;
  known_size_recordings: number;
  storage_bytes: number;
  analyzed_reps: number;
};
export const coachingUsageQuery = (org: string) =>
  queryOptions({
    queryKey: ["coaching-usage", org],
    enabled: !!org,
    queryFn: async (): Promise<CoachingUsage> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("coaching_usage_stats", { p_org: org });
      if (error) throw error;
      if (!data) throw new Error("Usage could not be read.");
      return data;
    },
  });
