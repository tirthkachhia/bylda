// TASK-011 · useFeatureGate hook
// React hook that checks plan-based feature access.
// Usage: const { allowed, upsell } = useFeatureGate("automation_workflows");

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { checkFeatureGate } from "@/lib/feature-gates";
import type { FeatureKey, GateResult, Plan } from "@/lib/feature-gates";
import { subscriptionQuery } from "@/lib/queries";

export function useFeatureGate(feature: FeatureKey): GateResult & { isLoading: boolean } {
  const { currentOrgId } = useAuth();
  const { data: sub, isLoading } = useQuery({
    ...subscriptionQuery(currentOrgId ?? ""),
    enabled: !!currentOrgId,
  });

  const plan = (sub?.plan as Plan) ?? "starter";
  const result = checkFeatureGate(feature, plan);

  return { ...result, isLoading };
}

export function useFeatureGates(
  features: FeatureKey[],
): Record<FeatureKey, GateResult> & { isLoading: boolean } {
  const { currentOrgId } = useAuth();
  const { data: sub, isLoading } = useQuery({
    ...subscriptionQuery(currentOrgId ?? ""),
    enabled: !!currentOrgId,
  });

  const plan = (sub?.plan as Plan) ?? "starter";
  const results = Object.fromEntries(features.map((f) => [f, checkFeatureGate(f, plan)])) as Record<
    FeatureKey,
    GateResult
  >;

  return { ...results, isLoading };
}
