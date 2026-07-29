// send-sms — native SMS delivery via Twilio when TWILIO_* secrets are set;
// otherwise no-ops gracefully ({ sent:false, reason:"no_provider" }). Resolves
// the recipient from `to` or the contact's phone (respecting opted_out_sms).
//
// Auth: internal service calls (service-role bearer + internal:true) or an
// authenticated org member.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Server not configured" }, 503);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  let body: {
    internal?: boolean;
    org_id?: string;
    contact_id?: string;
    to?: string;
    body?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const internal = body.internal === true && token === serviceKey;
  if (!internal) {
    if (!authHeader) return json({ error: "Missing auth" }, 401);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
      },
    );
    const { data, error } = await userClient.auth.getUser();
    if (error || !data?.user) return json({ error: "Unauthorized" }, 401);
  }

  let to = body.to ?? null;
  if (!to && body.contact_id) {
    const { data: c } = await admin
      .from("contacts")
      .select("phone, opted_out_sms, do_not_contact")
      .eq("id", body.contact_id)
      .maybeSingle();
    if (c?.opted_out_sms || c?.do_not_contact) return json({ sent: false, reason: "opted_out" });
    to = (c?.phone as string) ?? null;
  }
  if (!to) return json({ sent: false, reason: "no_recipient" });

  const text = body.body || "";
  const SID = Deno.env.get("TWILIO_ACCOUNT_SID");
  const AUTH = Deno.env.get("TWILIO_AUTH_TOKEN");
  const FROM = Deno.env.get("TWILIO_FROM");
  if (!SID || !AUTH || !FROM) {
    return json({ sent: false, reason: "no_provider", to });
  }

  try {
    const params = new URLSearchParams({ To: to, From: FROM, Body: text });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${SID}:${AUTH}`)}`,
      },
      body: params.toString(),
    });
    if (!res.ok) {
      const detail = await res.text();
      return json({ sent: false, reason: "provider_error", detail }, 502);
    }
    const out = await res.json().catch(() => ({}));
    return json({ sent: true, sid: out.sid ?? null, to });
  } catch (e) {
    return json(
      { sent: false, reason: "exception", detail: e instanceof Error ? e.message : String(e) },
      502,
    );
  }
});
