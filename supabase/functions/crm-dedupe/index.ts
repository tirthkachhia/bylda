// crm-dedupe — flags likely duplicate contacts/companies into duplicate_matches.
// Two modes:
//   { entity_type, entity_id }  → scan one record against the org (used after a
//                                 create, and on demand from the dedupe UI)
//   { entity_type, scan: "all" } → backfill scan across the org's records
// Membership is verified against the caller; the scan itself runs with the
// service-role client via the shared helper. Self-contained aside from _shared.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { scanForDuplicates } from "../_shared/crmObjects.ts";

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
    entity_id?: string;
    org_id?: string;
    scan?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const entityType = String(body.entity_type ?? "");
  if (!ENTITY_TYPES.has(entityType)) {
    return json({ error: "entity_type must be 'contact' or 'company'" }, 400);
  }

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

  // Single-record scan.
  if (body.entity_id) {
    await scanForDuplicates(
      admin,
      orgId,
      entityType as "contact" | "company",
      String(body.entity_id),
    );
    return json({ ok: true, scanned: 1 });
  }

  // Backfill: scan every active record of the type in the org.
  if (body.scan === "all") {
    let ids: string[] = [];
    if (entityType === "contact") {
      const { data } = await admin
        .from("contacts")
        .select("id")
        .eq("org_id", orgId)
        .neq("status", "merged")
        .limit(1000);
      ids = (data ?? []).map((r) => r.id as string);
    } else {
      const { data } = await admin
        .from("companies")
        .select("id")
        .eq("organization_id", orgId)
        .is("merged_into_id", null)
        .limit(1000);
      ids = (data ?? []).map((r) => r.id as string);
    }
    for (const id of ids) {
      await scanForDuplicates(admin, orgId, entityType as "contact" | "company", id);
    }
    return json({ ok: true, scanned: ids.length });
  }

  return json({ error: "Provide entity_id, or scan: 'all'" }, 400);
});
