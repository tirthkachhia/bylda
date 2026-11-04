// Re-analysis uses saved transcript text by default. Explicit rescoring also uses
// saved structured turns. Neither mode downloads or transcribes the audio.
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

  const body = (await req.json().catch(() => null)) as { call_id?: unknown; mode?: unknown } | null;
  if (body?.mode !== undefined && body.mode !== "analyze" && body.mode !== "rescore")
    return json({ error: "mode must be analyze or rescore" }, 400);
  const mode = body?.mode === "rescore" ? "rescore" : "analyze";
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
    .select("structured_turns,transcript_text")
    .eq("call_id", callId)
    .limit(1)
    .maybeSingle();
  if (mode === "analyze" && !transcript?.transcript_text?.trim())
    return json(
      {
        error:
          "No saved transcript. Upload a transcript or explicitly transcribe the recording first.",
      },
      409,
    );
  if (
    mode === "rescore" &&
    (!Array.isArray(transcript?.structured_turns) || transcript.structured_turns.length === 0)
  )
    return json({ error: "This call has no structured transcript to score" }, 409);

  const queuedMetadata = {
    ...(call.metadata ?? {}),
    coaching_stage: mode === "rescore" ? "scoring" : "analyzing",
    scoring_error: null,
    coaching_error: null,
    coaching_updated_at: new Date().toISOString(),
  };
  const { error: stageError } = await admin
    .from("calls")
    .update({ metadata: queuedMetadata })
    .eq("id", callId);

  if (stageError) return json({ error: "Could not prepare re-analysis" }, 500);

  const res = await fetch(`${workerUrl.replace(/\/$/, "")}/enqueue`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [
        {
          kind: mode === "rescore" ? "score" : "analyze",
          call_id: callId,
          organization_id: call.organization_id,
          user_id: call.user_id ?? user.id,
        },
      ],
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res || !res.ok) {
    // Report an enqueue failure without overwriting a worker that already advanced.
    await admin
      .from("calls")
      .update({
        metadata: {
          ...(call.metadata ?? {}),
          coaching_stage: "analysis_failed",
          coaching_error: "Could not confirm re-analysis queue. Retry.",
        },
      })
      .eq("id", callId)
      .eq("metadata", JSON.stringify(queuedMetadata));
    return json({ error: "Could not confirm re-analysis queue. Retry." }, 502);
  }

  return json({
    ok: true,
    call_id: callId,
    coaching_stage: mode === "rescore" ? "scoring" : "analyzing",
    source: "saved_transcript",
  });
});
