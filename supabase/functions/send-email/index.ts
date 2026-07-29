// send-email — native email delivery. Resolves the recipient (explicit `to`
// or the contact's email) and sends via Resend when RESEND_API_KEY is set;
// otherwise no-ops gracefully ({ sent:false, reason:"no_provider" }) so callers
// (workflow-engine, campaigns) never fail when delivery isn't configured yet.
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
    subject?: string;
    body?: string;
    html?: string;
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

  // Resolve recipient.
  let to = body.to ?? null;
  if (!to && body.contact_id) {
    const { data: c } = await admin
      .from("contacts")
      .select("email, do_not_contact")
      .eq("id", body.contact_id)
      .maybeSingle();
    if (c?.do_not_contact) return json({ sent: false, reason: "do_not_contact" });
    to = (c?.email as string) ?? null;
  }
  if (!to) return json({ sent: false, reason: "no_recipient" });

  const subject = body.subject || "(no subject)";
  const text = body.body || "";
  const html = body.html || `<div>${text.replace(/\n/g, "<br>")}</div>`;

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM = Deno.env.get("EMAIL_FROM") || "Bylda <onboarding@resend.dev>";
  if (!RESEND_API_KEY) {
    // Provider not configured — succeed as a no-op so flows don't break.
    return json({ sent: false, reason: "no_provider", to });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return json({ sent: false, reason: "provider_error", detail }, 502);
    }
    const out = await res.json().catch(() => ({}));
    return json({ sent: true, id: out.id ?? null, to });
  } catch (e) {
    return json(
      { sent: false, reason: "exception", detail: e instanceof Error ? e.message : String(e) },
      502,
    );
  }
});
