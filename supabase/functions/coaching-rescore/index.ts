// coaching-rescore — user-triggered re-score + re-analysis of one call.
// Authenticates the user (verify_jwt = true), checks org membership for the call,
// marks the call "scoring", and enqueues a kind:"score" message on the
// transcriber worker. The worker scores in chunks, then calls analyze-call via
// the coaching-analyze bridge. Returns immediately; the page polls the stage.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const workerUrl = Deno.env.get("COACHING_WORKER_URL");
  const secret = Deno.env.get("COACHING_WORKER_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!workerUrl || !secret || !serviceKey)
    return json({ error: "Scoring is not configured" }, 503);

  const authorization = req.headers.get("Authorization") ?? "";
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return json({ error: "Sign in to re-score calls" }, 401);

  const body = (await req.json().catch(() => null)) as { call_id?: unknown } | null;
  const callId = typeof body?.call_id === "string" ? body.call_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(callId)) return json({ error: "call_id is required" }, 400);

  // RLS on calls proves membership: a call the user cannot read does not exist for them.
  const { data: call } = await client
    .from("calls")
    .select("id, organization_id, user_id, metadata")
    .eq("id", callId)
    .maybeSingle();
  if (!call) return json({ error: "Call not found" }, 404);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const { data: transcript } = await admin
    .from("call_transcripts")
    .select("structured_turns")
    .eq("call_id", callId)
    .limit(1)
    .maybeSingle();
  if (!Array.isArray(transcript?.structured_turns) || transcript.structured_turns.length === 0)
    return json({ error: "This call has no structured transcript to score" }, 409);

  const res = await fetch(`${workerUrl.replace(/\/$/, "")}/enqueue`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [
        {
          kind: "score",
          call_id: callId,
          organization_id: call.organization_id,
          user_id: call.user_id ?? user.id,
        },
      ],
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res || !res.ok) return json({ error: "Could not queue re-scoring" }, 502);

  await admin
    .from("calls")
    .update({
      metadata: {
        ...(call.metadata ?? {}),
        coaching_stage: "scoring",
        scoring_error: null,
        coaching_updated_at: new Date().toISOString(),
      },
    })
    .eq("id", callId);

  return json({ ok: true, call_id: callId, coaching_stage: "scoring" });
});
