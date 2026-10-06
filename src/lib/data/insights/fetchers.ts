import { supabase } from "../core/db";
import { NotBuiltError } from "../core/errors";
import type { FeedItemRow, InsightRow } from "./map";

/** C-03 · insights */
export async function fetchInsights(): Promise<InsightRow[]> {
  throw new NotBuiltError("insights");
}
/** C-04 · get_home_feed(tab) RPC */
export async function fetchHomeFeed(): Promise<FeedItemRow[]> {
  throw new NotBuiltError("home_feed");
}

/** H7 — REAL: recent health checks (health_checks is not org-scoped today). */
export async function fetchHealthChecks() {
  const res = await supabase
    .from("health_checks")
    .select("endpoint_name,status,checked_at")
    .order("checked_at", { ascending: false })
    .limit(20);
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}
