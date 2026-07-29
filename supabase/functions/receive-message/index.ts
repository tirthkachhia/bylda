// receive-message — inbound webhook for the unified inbox. Any channel
// provider (email inbound parse, SMS webhook, chat widget) posts here with an
// org-scoped key in the query string; we find-or-create the contact and
// insert an inbound conversations row, which fires message.received via the
// existing conversations trigger → automation_events → dispatch.
//
// Auth: no Supabase JWT (providers can't send one). Instead requires
// ?org=<organization_id>&key=<derived key>. The key is
// HMAC-SHA256(INBOUND_WEBHOOK_SECRET, org_id), so it's deterministic and
// verifiable without a lookup table — get-inbound-url computes the same value
// for display in Settings. verify_jwt = false.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

const VALID_CHANNELS = new Set(["email", "sms", "whatsapp", "instagram", "facebook", "webchat"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Server not configured" }, 503);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  const reqUrl = new URL(req.url);
  const orgId = reqUrl.searchParams.get("org");
  const key = reqUrl.searchParams.get("key");
  if (!orgId || !key) return json({ error: "Missing org or key" }, 401);

  const secret = Deno.env.get("INBOUND_WEBHOOK_SECRET");
  if (!secret) return json({ error: "Inbound webhooks not configured" }, 503);
  const expected = await hmacHex(secret, orgId);
  if (key !== expected) return json({ error: "Unauthorized" }, 401);

  let body: {
    channel?: string;
    from_email?: string;
    from_phone?: string;
    from_name?: string;
    subject?: string;
    body?: string;
    text?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const channel = VALID_CHANNELS.has(String(body.channel)) ? String(body.channel) : "email";
  const messageBody = body.body || body.text || "";
  if (!messageBody.trim()) return json({ error: "Empty message" }, 400);

  const email = body.from_email?.trim() || null;
  const phone = body.from_phone?.trim() || null;

  // Find-or-create the contact by email/phone (contacts uses org_id).
  let contactId: string | null = null;
  if (email || phone) {
    let q = admin.from("contacts").select("id").eq("org_id", orgId);
    q = email ? q.eq("email", email) : q.eq("phone", phone);
    const { data: existing } = await q.maybeSingle();
    if (existing) {
      contactId = existing.id;
    } else {
      // contacts.user_id is NOT NULL and contacts are user-owned — system-created
      // contacts belong to the org owner.
      const { data: org } = await admin
        .from("organizations")
        .select("owner_id, created_by")
        .eq("id", orgId)
        .maybeSingle();
      let ownerId: string | null = org?.owner_id ?? org?.created_by ?? null;
      if (!ownerId) {
        const { data: m } = await admin
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        ownerId = m?.user_id ?? null;
      }
      if (ownerId) {
        const name = (body.from_name || "").trim();
        const [firstName, ...rest] = name.split(" ");
        const { data: created } = await admin
          .from("contacts")
          .insert({
            org_id: orgId,
            user_id: ownerId,
            first_name: firstName || null,
            last_name: rest.join(" ") || null,
            email,
            phone,
            source: channel,
          })
          .select("id")
          .single();
        contactId = created?.id ?? null;
      }
    }
  }

  const { data: msg, error } = await admin
    .from("conversations")
    .insert({
      organization_id: orgId,
      contact_id: contactId,
      channel,
      direction: "inbound",
      subject: body.subject || null,
      body: messageBody,
      status: "open",
    })
    .select("id")
    .single();
  if (error) return json({ error: "Failed to record message" }, 500);

  return json({ ok: true, conversation_id: msg.id, contact_id: contactId });
});
