// crm-merge — merges two contacts or two companies. Every FK referencing the
// loser is repointed to the winner (via the crm_merge_records SQL function,
// which discovers referencing columns dynamically), then the loser is archived.
// Membership is verified against the caller; the merge runs with the service
// role. Body: { entity_type, winner_id, loser_id, org_id? }.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ENTITY_TYPES = new Set(["contact", "company"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing auth" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  let body: {
    entity_type?: string;
    winner_id?: string;
    loser_id?: string;
    org_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const entityType = String(body.entity_type ?? "");
  const winnerId = String(body.winner_id ?? "");
  const loserId = String(body.loser_id ?? "");
  if (!ENTITY_TYPES.has(entityType)) {
    return json({ error: "entity_type must be 'contact' or 'company'" }, 400);
  }
  if (!winnerId || !loserId) return json({ error: "winner_id and loser_id are required" }, 400);
  if (winnerId === loserId) return json({ error: "winner_id and loser_id must differ" }, 400);

  // Resolve + verify org membership.
  let orgId = body.org_id ?? null;
  if (orgId) {
    const { data: m } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!m) return json({ error: "Forbidden" }, 403);
  } else {
    const { data: m } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!m) return json({ error: "No organization" }, 403);
    orgId = m.organization_id as string;
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Server not configured" }, 503);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  // Both records must belong to the caller's org (companies use organization_id,
  // contacts use org_id) before we touch anything.
  if (entityType === "company") {
    const { data: rows } = await admin
      .from("companies")
      .select("id")
      .eq("organization_id", orgId)
      .in("id", [winnerId, loserId]);
    if ((rows ?? []).length !== 2) {
      return json({ error: "Both companies must belong to your organization" }, 400);
    }
  } else {
    const { data: rows } = await admin
      .from("contacts")
      .select("id")
      .eq("org_id", orgId)
      .in("id", [winnerId, loserId]);
    if ((rows ?? []).length !== 2) {
      return json({ error: "Both contacts must belong to your organization" }, 400);
    }
  }

  const { error } = await admin.rpc("crm_merge_records", {
    p_entity_type: entityType,
    p_winner_id: winnerId,
    p_loser_id: loserId,
    p_org_id: orgId,
  });
  if (error) return json({ error: error.message }, 400);

  return json({ ok: true, entity_type: entityType, winner_id: winnerId, loser_id: loserId });
});
