// bylda-action — executes (or skips) a pending Bylda-proposed action after
// founder approval. bylda-chat inserts the pending row via BYLDA_ACTION_TOOL;
// this function is the only thing allowed to flip its status, using one
// service-role client so the executor can write across tables regardless of
// the caller's RLS.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse } from "../_shared/helpers.ts";
import { executeByldaAction, type ByldaActionType } from "../_shared/byldaActions.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return jsonResponse({ error: "Missing auth" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return jsonResponse({ error: "Invalid token" }, 401);
  const userId = userData.user.id;

  let body: { action_id?: string; decision?: "approve" | "skip" };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const actionId = body.action_id;
  const decision = body.decision ?? "approve";
  if (!actionId) return jsonResponse({ error: "Missing action_id" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: action, error: fetchErr } = await admin
    .from("bylda_actions")
    .select("id, organization_id, action_type, payload, status")
    .eq("id", actionId)
    .maybeSingle();
  if (fetchErr || !action) return jsonResponse({ error: "Action not found" }, 404);
  if (action.status !== "pending") {
    return jsonResponse({ error: `Action already ${action.status}` }, 409);
  }

  // Caller must belong to the org the action was proposed for.
  const { data: member } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("organization_id", action.organization_id)
    .maybeSingle();
  if (!member) return jsonResponse({ error: "Forbidden" }, 403);

  if (decision === "skip") {
    await admin
      .from("bylda_actions")
      .update({ status: "skipped", executed_at: new Date().toISOString() })
      .eq("id", actionId);
    return jsonResponse({ ok: true, skipped: true });
  }

  const result = await executeByldaAction(
    admin,
    action.organization_id as string,
    userId,
    action.action_type as ByldaActionType,
    (action.payload as Record<string, unknown>) ?? {},
  );

  await admin
    .from("bylda_actions")
    .update({
      status: result.ok ? "executed" : "failed",
      result: result.result ?? null,
      error: result.error ?? null,
      executed_at: new Date().toISOString(),
    })
    .eq("id", actionId);

  return jsonResponse(result, result.ok ? 200 : 400);
});
