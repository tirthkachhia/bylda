import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { coachingCors, coachingJson as json } from "../_shared/coaching/admin-access.ts";
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: coachingCors });
  if (req.method !== "GET") return json({ error: "Read-only API; use GET" }, 405);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!/^bylda_[a-f0-9]{64}$/.test(token)) return json({ error: "Invalid API key" }, 401);
  const url = Deno.env.get("SUPABASE_URL"),
    key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "API is not configured" }, 503);
  const db = createClient(url, key);
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
  const { data: org, error } = await db.rpc("use_coaching_api_key", { p_hash: hash });
  if (error)
    return error.message.includes("API rate limit exceeded")
      ? json({ error: "API rate limit exceeded" }, 429)
      : json({ error: "API authorization service is unavailable" }, 503);
  if (!org) return json({ error: "API key is invalid or revoked" }, 401);
  const params = new URL(req.url).searchParams,
    offset = Number(params.get("offset") ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0) return json({ error: "Invalid offset" }, 400);
  const resource = params.get("resource") ?? "calls";
  if (!["calls", "insights"].includes(resource))
    return json({ error: "resource must be calls or insights" }, 400);
  const table = resource === "calls" ? "calls" : "coaching_analysis_runs";
  const columns: string =
    resource === "calls"
      ? "id,rep_id,provider,direction,status,duration,started_at,created_at"
      : "id,call_id,rep_id,call_occurred_at,prompt_version,taxonomy_version,analysis";
  let query = db.from(table).select(columns).eq("organization_id", org);
  const callId = params.get("call_id");
  if (callId) {
    if (!/^[0-9a-f-]{36}$/i.test(callId)) return json({ error: "Invalid call_id" }, 400);
    query = query.eq(resource === "calls" ? "id" : "call_id", callId);
  }
  const { data, error: readError } = await query.order("id").range(offset, offset + 99);
  if (readError) return json({ error: "Data could not be read" }, 500);
  return json({ data, next_offset: data?.length === 100 ? offset + 100 : null });
});
