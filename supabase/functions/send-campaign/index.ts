// send-campaign — resolves a campaign's audience from contacts, renders merge
// fields per recipient, and delivers via send-email / send-sms. Two modes:
//   { campaign_id }  → send one campaign (authenticated org member)
//   { internal:true } → cron: send every campaign whose scheduled_at is due
// Delivery no-ops gracefully when no provider is configured, but the campaign
// is still marked sent with an accurate recipient count.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function render(t: string, c: Record<string, unknown>): string {
  if (!t) return t;
  let out = t;
  for (const k of Object.keys(c)) {
    const v = c[k];
    const rep = v == null ? "" : String(v);
    out = out.split(`{{${k}}}`).join(rep).split(`{{ ${k} }}`).join(rep);
  }
  return out;
}

// Build tracked HTML for an email: rewrite links through the click tracker,
// append a 1x1 open pixel and an unsubscribe link. Falls back to plain wrapping
// when there's no contact to attribute engagement to.
function trackedEmailHtml(
  supabaseUrl: string,
  campaignId: string,
  contactId: string | null,
  textBody: string,
): string {
  const escaped = textBody.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  if (!contactId) return `<div>${escaped.split("\n").join("<br>")}</div>`;
  const base = `${supabaseUrl}/functions/v1/track-event?c=${campaignId}&e=${contactId}`;
  let html = escaped.replace(/(https?:\/\/[^\s<]+)/g, (m) => {
    const tracked = `${base}&t=click&u=${encodeURIComponent(btoa(m))}`;
    return `<a href="${tracked}">${m}</a>`;
  });
  html = html.split("\n").join("<br>");
  const pixel = `<img src="${base}&t=open" width="1" height="1" style="display:none" alt="">`;
  const unsub = `<div style="margin-top:24px;font-size:12px;color:#888"><a href="${base}&t=unsubscribe">Unsubscribe</a></div>`;
  return `<div>${html}${pixel}${unsub}</div>`;
}

type Contact = Record<string, unknown> & { id: string };

async function sendOne(
  url: string,
  serviceKey: string,
  campaign: Record<string, unknown>,
  contacts: Contact[],
): Promise<number> {
  let sent = 0;
  const channel = campaign.channel as string;
  for (const c of contacts) {
    const fn = channel === "sms" ? "send-sms" : "send-email";
    let payload: Record<string, unknown>;
    if (channel === "sms") {
      payload = { internal: true, contact_id: c.id, body: render(String(campaign.body ?? ""), c) };
    } else {
      const bodyText = render(String(campaign.body ?? ""), c);
      payload = {
        internal: true,
        contact_id: c.id,
        subject: render(String(campaign.subject ?? ""), c),
        body: bodyText,
        html: trackedEmailHtml(url, String(campaign.id), c.id, bodyText),
      };
    }
    try {
      const res = await fetch(`${url}/functions/v1/${fn}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify(payload),
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.sent) sent++;
    } catch {
      /* skip individual failures */
    }
  }
  return sent;
}

async function resolveAudience(
  admin: ReturnType<typeof createClient>,
  orgId: string,
  filter: Record<string, unknown>,
): Promise<Contact[]> {
  let q = admin
    .from("contacts")
    .select("id, first_name, last_name, email, phone, company, status, tags")
    .eq("org_id", orgId);
  if (filter.status) q = q.eq("status", String(filter.status));
  if (filter.tag) q = q.contains("tags", [String(filter.tag)]);
  const { data } = await q.limit(5000);
  return (data as Contact[]) ?? [];
}

async function processCampaign(
  admin: ReturnType<typeof createClient>,
  url: string,
  serviceKey: string,
  campaign: Record<string, unknown>,
): Promise<{ campaign_id: string; sent: number; recipients: number }> {
  await admin.from("campaigns").update({ status: "sending" }).eq("id", campaign.id);
  const audience = await resolveAudience(
    admin,
    campaign.organization_id as string,
    (campaign.audience_filter as Record<string, unknown>) ?? {},
  );
  const sent = await sendOne(url, serviceKey, campaign, audience);
  await admin
    .from("campaigns")
    .update({ status: "sent", sent_at: new Date().toISOString(), recipient_count: audience.length })
    .eq("id", campaign.id);
  return { campaign_id: campaign.id as string, sent, recipients: audience.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Server not configured" }, 503);
  const admin = createClient(url, serviceKey);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  let body: { campaign_id?: string; internal?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const internal = body.internal === true && token === serviceKey;

  // ── Cron: send all due scheduled campaigns ──
  if (internal && !body.campaign_id) {
    const { data: due } = await admin
      .from("campaigns")
      .select("id, organization_id, channel, subject, body, audience_filter, status")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .limit(20);
    const results = [];
    for (const c of due ?? []) results.push(await processCampaign(admin, url, serviceKey, c));
    return json({ processed: results.length, results });
  }

  // ── Authenticated: send a specific campaign ──
  if (!body.campaign_id) return json({ error: "Missing campaign_id" }, 400);

  if (!internal) {
    if (!authHeader) return json({ error: "Missing auth" }, 401);
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error } = await userClient.auth.getUser();
    if (error || !data?.user) return json({ error: "Unauthorized" }, 401);
    // Membership is enforced by reading the campaign through the user's RLS.
    const { data: camp } = await userClient
      .from("campaigns")
      .select("id")
      .eq("id", body.campaign_id)
      .maybeSingle();
    if (!camp) return json({ error: "Campaign not found" }, 404);
  }

  const { data: campaign } = await admin
    .from("campaigns")
    .select("id, organization_id, channel, subject, body, audience_filter, status")
    .eq("id", body.campaign_id)
    .maybeSingle();
  if (!campaign) return json({ error: "Campaign not found" }, 404);
  if (campaign.status === "sent" || campaign.status === "sending") {
    return json({ error: `Campaign already ${campaign.status}` }, 409);
  }

  const result = await processCampaign(admin, url, serviceKey, campaign);
  return json({ ok: true, ...result });
});
