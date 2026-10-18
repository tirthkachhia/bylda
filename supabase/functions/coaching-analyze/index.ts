// coaching-analyze — internal bridge from the Cloudflare transcriber worker to analyze-call.
//
// Why this exists: analyze-call treats a request as internal only when its bearer
// equals the SUPABASE_SERVICE_ROLE_KEY value injected into the edge runtime, and
// that value is not the legacy service_role JWT an external caller can obtain. So
// the worker authenticates here with the shared COACHING_WORKER_SECRET, and this
// function makes the function-to-function call with the runtime's own key, the
// same way ingest-call-webhook dispatches analysis.
//
// verify_jwt = false in supabase/config.toml: the caller is a worker, not a user.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("COACHING_WORKER_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!secret || !serviceKey || !supabaseUrl) return json({ error: "Server not configured" }, 503);

  const supplied = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(supplied, secret)) return json({ error: "Unauthorized" }, 401);

  const body = (await req.json().catch(() => null)) as { call_id?: unknown } | null;
  const callId = typeof body?.call_id === "string" ? body.call_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(callId)) return json({ error: "call_id is required" }, 400);

  // Only forward calls that exist and have a transcript to analyze.
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: transcript } = await admin
    .from("call_transcripts")
    .select("id")
    .eq("call_id", callId)
    .limit(1)
    .maybeSingle();
  if (!transcript) return json({ error: "No transcript for this call" }, 404);

  const response = await fetch(`${supabaseUrl}/functions/v1/analyze-call`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ call_id: callId }),
    signal: AbortSignal.timeout(150_000),
  }).catch((error) => {
    console.error("[coaching-analyze] dispatch", error instanceof Error ? error.message : error);
    return null;
  });
  if (!response) return json({ error: "analyze-call unreachable" }, 502);
  const text = await response.text().catch(() => "");
  if (!response.ok) {
    console.error("[coaching-analyze] analyze-call", response.status, text.slice(0, 300));
    return json({ error: "analyze-call failed", status: response.status }, 502);
  }
  let analysis: unknown = null;
  try {
    analysis = JSON.parse(text);
  } catch {
    analysis = text.slice(0, 300);
  }
  return json({ ok: true, call_id: callId, analysis });
});
