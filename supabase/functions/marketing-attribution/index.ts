// marketing-attribution — links leads to campaigns and credits revenue into
// campaign_attributions. A lead is attributed via its explicit campaign_id
// (e.g. set by a form/landing page) or by matching a utm_campaign captured in
// leads.custom_fields to a campaign's utm_campaign. Won deals credit their value
// as attributed revenue. Idempotent: attributions upsert on (lead, campaign,
// touch). On-demand from Marketing, or internal for all orgs.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

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

type Lead = {
  id: string;
  organization_id: string;
  contact_id: string | null;
  campaign_id: string | null;
  stage: string;
  value: number | null;
  custom_fields: Record<string, unknown> | null;
};

async function attributeOrg(admin: SupabaseClient, orgId: string): Promise<number> {
  // Build a utm_campaign → campaign_id map for the org.
  const { data: campaigns } = await admin
    .from("campaigns")
    .select("id, utm_campaign")
    .eq("organization_id", orgId);
  const utmMap = new Map<string, string>();
  for (const c of campaigns ?? []) {
    if (c.utm_campaign) utmMap.set(String(c.utm_campaign).toLowerCase(), c.id as string);
  }

  const { data: leads } = await admin
    .from("leads")
    .select("id, organization_id, contact_id, campaign_id, stage, value, custom_fields")
    .eq("organization_id", orgId)
    .limit(5000);

  const rows: Record<string, unknown>[] = [];
  for (const l of (leads ?? []) as Lead[]) {
    const cf = l.custom_fields ?? {};
    const utmCampaign = (cf["utm_campaign"] ?? cf["utm"] ?? "") as string;
    const utmSource = (cf["utm_source"] ?? null) as string | null;
    const utmMedium = (cf["utm_medium"] ?? null) as string | null;

    const campaignId =
      l.campaign_id ??
      (utmCampaign ? (utmMap.get(String(utmCampaign).toLowerCase()) ?? null) : null);
    if (!campaignId) continue;

    const revenue = l.stage === "Won" ? Number(l.value ?? 0) : 0;
    // Single known touch → record both first and last so first/last-touch
    // reports both resolve. (Multi-touch history can refine this later.)
    for (const touch of ["first_touch", "last_touch"]) {
      rows.push({
        organization_id: orgId,
        campaign_id: campaignId,
        lead_id: l.id,
        contact_id: l.contact_id,
        touch,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign || null,
        revenue_attributed: revenue,
        attributed_at: new Date().toISOString(),
      });
    }
  }

  if (rows.length) {
    await admin
      .from("campaign_attributions")
      .upsert(rows, { onConflict: "lead_id,campaign_id,touch" });
  }
  return rows.length / 2;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Server not configured" }, 503);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  let body: { internal?: boolean; org_id?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const internal = body.internal === true && token === serviceKey;

  if (internal && !body.org_id) {
    const { data: orgs } = await admin.from("organizations").select("id").limit(5000);
    let n = 0;
    for (const o of orgs ?? []) {
      try {
        await attributeOrg(admin, o.id as string);
        n++;
      } catch {
        /* keep going */
      }
    }
    return json({ ok: true, orgs_attributed: n });
  }

  if (!authHeader) return json({ error: "Missing auth" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

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

  const attributed = await attributeOrg(admin, orgId);
  return json({ ok: true, leads_attributed: attributed });
});
