// Profile sync — writes what Bylda learned from a tool run into the org's
// Business Context Graph (business_context), so learning survives devices and
// feeds every AI call, not just this browser's localStorage.
//
// Only the fields that changed this run are written, onto the same block keys
// the read path (mergeBusinessContextIntoProfile) prefers, so a value written
// here is the value read back everywhere. Fire-and-forget: a sync failure
// must never break a successful tool run.

import { supabase } from "@/integrations/supabase/client";
import type { WorkspaceProfile } from "./workspaceProfile";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const asBlock = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? { ...(v as Record<string, unknown>) } : {};

export async function syncProfileToBusinessContext(
  orgId: string,
  changed: Partial<WorkspaceProfile>,
): Promise<boolean> {
  try {
    if (!orgId || Object.keys(changed).length === 0) return false;

    const { data: row } = await db
      .from("business_context")
      .select("id, identity, customer, model, stage")
      .eq("organization_id", orgId)
      .maybeSingle();

    const identity = asBlock(row?.identity);
    const customer = asBlock(row?.customer);
    const model = asBlock(row?.model);
    const stage = asBlock(row?.stage);

    if (changed.business_name) identity.name = changed.business_name;
    if (changed.description) identity.description = changed.description;
    if (changed.target_market) customer.description = changed.target_market;
    if (changed.revenue_model) model.monetization = changed.revenue_model;
    if (changed.stage) stage.stage = changed.stage;

    if (row?.id) {
      const { error } = await db
        .from("business_context")
        .update({ identity, customer, model, stage })
        .eq("id", row.id);
      if (error) return false;
    } else {
      const { error } = await db
        .from("business_context")
        .insert({ organization_id: orgId, identity, customer, model, stage });
      if (error) return false;
    }
    return true;
  } catch {
    return false;
  }
}
