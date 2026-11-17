import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";

export async function readyModeExtensionAction(
  action: string,
  organizationId: string,
  repId?: string,
) {
  const { data, error } = await supabase.functions.invoke("readymode-extension", {
    body: { action, organization_id: organizationId, rep_id: repId },
  });
  if (error) throw new Error("Could not reach the extension connection service. Try again.");
  if (data?.error) throw new Error(data.error);
  return data as { connected: boolean; expires_at?: string; connection_code?: string };
}

export const readyModeExtensionQuery = (orgId: string, userId: string) =>
  queryOptions({
    queryKey: ["readymode-extension", orgId, userId],
    queryFn: () => readyModeExtensionAction("status", orgId),
    enabled: !!orgId && !!userId,
  });
