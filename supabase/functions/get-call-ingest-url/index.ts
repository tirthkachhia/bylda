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

async function hmacHex(secret: string, message: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Unauthorized" }, 401);
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: authData } = await client.auth.getUser();
  if (!authData.user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const requestedOrg = typeof body.org_id === "string" ? body.org_id : null;
  let query = client
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", authData.user.id);
  if (requestedOrg) query = query.eq("organization_id", requestedOrg);
  const { data: membership } = await query
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) return json({ error: "Organization not found" }, 403);

  const secret = Deno.env.get("INBOUND_WEBHOOK_SECRET");
  if (!secret) return json({ configured: false });
  const orgId = membership.organization_id as string;
  const key = await hmacHex(secret, `calls:${orgId}`);
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ingest-call-webhook?org=${orgId}&key=${key}`;

  return json({
    configured: true,
    url,
    minimum_duration_seconds: 45,
    accepted_content_type: "application/json",
  });
});
