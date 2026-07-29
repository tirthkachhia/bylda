// TASK-049 · Feature entitlements hook
// Resolves per-org feature entitlement overrides from the feature_entitlements table.
// Entitlement overrides supersede plan defaults (e.g. free trial of premium feature).

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { checkFeatureGate } from "@/lib/feature-gates";
import type { FeatureKey, GateResult, Plan } from "@/lib/feature-gates";
import { subscriptionQuery } from "@/lib/queries";

interface EntitlementRow {
  feature_key: string;
  enabled: boolean;
  limit_override: number | null;
  expires_at: string | null;
}

async function fetchEntitlements(orgId: string): Promise<EntitlementRow[]> {
  const { data } = await supabase
    .from("feature_entitlements")
    .select("feature_key, enabled, limit_override, expires_at")
    .eq("organization_id", orgId);
  return (data ?? []) as EntitlementRow[];
}

export interface EntitlementResult extends GateResult {
  hasOverride: boolean;
  isLoading: boolean;
}

export function useEntitlement(feature: FeatureKey): EntitlementResult {
  const { currentOrgId } = useAuth();

  const subQ = useQuery({
    ...subscriptionQuery(currentOrgId ?? ""),
    enabled: !!currentOrgId,
  });

  const entQ = useQuery({
    queryKey: ["feature-entitlements", currentOrgId],
    queryFn: () => fetchEntitlements(currentOrgId!),
    enabled: !!currentOrgId,
    staleTime: 120_000,
  });

  const plan = (subQ.data?.plan as Plan) ?? "starter";
  const planResult = checkFeatureGate(feature, plan);

  const override = entQ.data?.find(
    (e) => e.feature_key === feature && (!e.expires_at || new Date(e.expires_at) > new Date()),
  );

  if (override) {
    return {
      allowed: override.enabled,
      label: planResult.label,
      upsell: planResult.upsell,
      limit: override.limit_override ?? planResult.limit,
      hasOverride: true,
      isLoading: false,
    };
  }

  return {
    ...planResult,
    hasOverride: false,
    isLoading: subQ.isLoading || entQ.isLoading,
  };
}
