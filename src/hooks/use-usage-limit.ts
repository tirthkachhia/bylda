// TASK-048 · Usage metering hook
// Checks current tool usage against plan limits for the current billing period.

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { subscriptionQuery, planEntitlementsQuery } from "@/lib/queries";

interface UsageLimitResult {
  used: number;
  limit: number | null;
  remaining: number | null;
  percentUsed: number;
  isAtLimit: boolean;
  isNearLimit: boolean;
  isLoading: boolean;
}

async function fetchMonthlyUsage(orgId: string): Promise<number> {
  const period = new Date().toISOString().slice(0, 7);
  const { count } = await supabase
    .from("tool_runs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .gte("created_at", `${period}-01`);
  return count ?? 0;
}

export function useUsageLimit(): UsageLimitResult {
  const { currentOrgId } = useAuth();

  const subQ = useQuery({
    ...subscriptionQuery(currentOrgId ?? ""),
    enabled: !!currentOrgId,
  });

  const plansQ = useQuery(planEntitlementsQuery());

  const usageQ = useQuery({
    queryKey: ["monthly-tool-runs", currentOrgId],
    queryFn: () => fetchMonthlyUsage(currentOrgId!),
    enabled: !!currentOrgId,
    staleTime: 30_000,
  });

  const plan = (subQ.data?.plan as string) ?? "starter";
  const limit = plansQ.data?.find((p) => p.plan === plan)?.monthly_generation_limit ?? null;
  const used = usageQ.data ?? 0;
  const remaining = limit !== null ? Math.max(0, limit - used) : null;
  const percentUsed = limit ? Math.min(100, (used / limit) * 100) : 0;

  return {
    used,
    limit,
    remaining,
    percentUsed,
    isAtLimit: limit !== null && used >= limit,
    isNearLimit: limit !== null && percentUsed >= 80,
    isLoading: subQ.isLoading || plansQ.isLoading || usageQ.isLoading,
  };
}
