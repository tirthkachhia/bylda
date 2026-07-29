// Founder streak — persisted daily-activity streak, backed by
// founder_streaks (not yet in the generated Database type, so this follows
// the established `supabase as any` workaround used elsewhere in the repo,
// e.g. src/routes/app.roadmap.tsx).

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useGuest } from "@/lib/guest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface FounderStreakRow {
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
}

export interface FounderStreak {
  currentStreak: number;
  longestStreak: number;
  isLoading: boolean;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function useFounderStreak(): FounderStreak {
  const { currentOrgId } = useAuth();
  const { isGuest } = useGuest();
  const qc = useQueryClient();
  const orgId = currentOrgId ?? "";
  const queryKey = ["founder-streak", orgId] as const;

  const streakQ = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await db
        .from("founder_streaks")
        .select("current_streak, longest_streak, last_active_date")
        .eq("organization_id", orgId)
        .maybeSingle();
      return (data ?? null) as FounderStreakRow | null;
    },
    enabled: !!orgId && !isGuest,
  });

  const lastActiveDate = streakQ.data?.last_active_date ?? null;

  // Record today's activity once — no-ops once last_active_date is today.
  useEffect(() => {
    if (!orgId || isGuest || streakQ.isLoading) return;
    const today = isoDate(new Date());
    if (lastActiveDate === today) return;

    const yesterday = isoDate(new Date(Date.now() - 86_400_000));
    const wasYesterday = lastActiveDate === yesterday;
    const nextStreak = wasYesterday ? (streakQ.data?.current_streak ?? 0) + 1 : 1;
    const nextLongest = Math.max(nextStreak, streakQ.data?.longest_streak ?? 0);

    void db
      .from("founder_streaks")
      .upsert(
        {
          organization_id: orgId,
          current_streak: nextStreak,
          longest_streak: nextLongest,
          last_active_date: today,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" },
      )
      .then(() => qc.invalidateQueries({ queryKey }));
    // Re-run only when the org or the loaded last-active-date changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, isGuest, streakQ.isLoading, lastActiveDate]);

  return {
    currentStreak: streakQ.data?.current_streak ?? 0,
    longestStreak: streakQ.data?.longest_streak ?? 0,
    isLoading: streakQ.isLoading,
  };
}
