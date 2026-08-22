import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { normalizeCall } from "../_shared/call-normalize.ts";

const MINIMUM_DURATION_SECONDS = 45;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
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

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

async function transcribeRecording(recordingUrl: string, provider: string) {
  const workerUrl = Deno.env.get("TRANSCRIPTION_WORKER_URL");
  const secret = Deno.env.get("CALL_TRANSCRIPTION_SECRET");
  if (!workerUrl || !secret) return { transcript: null, status: "not_configured" };

  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recording_url: recordingUrl, provider, language: "en" }),
      signal: AbortSignal.timeout(90_000),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      transcript?: string;
      error?: string;
    };
    if (!response.ok || !payload.transcript?.trim()) {
      console.error(
        "[ingest-call-webhook] transcription",
        response.status,
        payload.error ?? "empty",
      );
      return { transcript: null, status: "failed" };
    }
    return { transcript: payload.transcript.trim(), status: "completed" };
  } catch (error) {
    console.error(
      "[ingest-call-webhook] transcription",
      error instanceof Error ? error.message : error,
    );
    return { transcript: null, status: "failed" };
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = new URL(req.url);
  const orgId = url.searchParams.get("org") ?? "";
  const suppliedKey = url.searchParams.get("key") ?? "";
  const secret = Deno.env.get("INBOUND_WEBHOOK_SECRET");
  if (!secret || !orgId || !suppliedKey) return json({ error: "Unauthorized" }, 401);
  const expectedKey = await hmacHex(secret, `calls:${orgId}`);
  if (!safeEqual(suppliedKey, expectedKey)) return json({ error: "Unauthorized" }, 401);

  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return json({ error: "Expected a JSON call payload" }, 400);
  }
  const call = normalizeCall(raw as Record<string, unknown>);
  const eligible =
    call.connected && (call.duration == null || call.duration >= MINIMUM_DURATION_SECONDS);
  let transcript = call.transcript;
  let transcriptionStatus = transcript ? "supplied" : "not_requested";
  if (!transcript && call.recordingUrl && eligible) {
    const result = await transcribeRecording(call.recordingUrl, call.provider);
    transcript = result.transcript ?? undefined;
    transcriptionStatus = result.status;
  }
  const skipReason = !call.connected
    ? "not_connected"
    : call.duration != null && call.duration < MINIMUM_DURATION_SECONDS
      ? "under_45_seconds"
      : !transcript
        ? "transcript_not_supplied"
        : null;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const status = call.connected ? "completed" : "missed";
  const { data: storedCall, error: callError } = await admin
    .from("calls")
    .upsert(
      {
        organization_id: orgId,
        contact_id: call.contactId ?? null,
        lead_id: call.leadId ?? null,
        direction: call.direction,
        status,
        duration: call.duration,
        recording_url: call.recordingUrl ?? null,
        disposition: call.disposition ?? null,
        from_number: call.fromNumber ?? null,
        to_number: call.toNumber ?? null,
        provider: call.provider,
        provider_call_id: call.providerCallId,
        started_at: call.startedAt ?? null,
        metadata: {
          ingestion: "universal-dialer-webhook",
          eligible_for_ai: eligible,
          skip_reason: skipReason,
          transcription_status: transcriptionStatus,
          received_at: new Date().toISOString(),
        },
      },
      { onConflict: "organization_id,provider,provider_call_id" },
    )
    .select("id")
    .single();
  if (callError || !storedCall) {
    console.error("[ingest-call-webhook] call", callError?.message);
    return json({ error: "Could not store call" }, 500);
  }

  let transcriptStored = false;
  if (eligible && transcript) {
    const { error } = await admin.from("call_transcripts").upsert(
      {
        call_id: storedCall.id,
        organization_id: orgId,
        transcript_text: transcript,
        speaker_segments: call.speakerSegments,
      },
      { onConflict: "call_id" },
    );
    if (error) {
      console.error("[ingest-call-webhook] transcript", error.message);
      return json({ error: "Call stored but transcript could not be stored" }, 500);
    }
    transcriptStored = true;
  }

  // Analyze in the background after a qualifying transcript lands. The
  // service-role token is accepted only for this server-to-server path; normal
  // browser calls still require an authenticated organization member.
  if (transcriptStored) {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const analysisRequest = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-call`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ call_id: storedCall.id }),
    })
      .then(async (response) => {
        if (!response.ok) {
          console.error("[ingest-call-webhook] analysis", response.status, await response.text());
        }
      })
      .catch((error) => {
        console.error(
          "[ingest-call-webhook] analysis",
          error instanceof Error ? error.message : error,
        );
      });
    const edgeRuntime = (
      globalThis as unknown as {
        EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void };
      }
    ).EdgeRuntime;
    if (edgeRuntime) edgeRuntime.waitUntil(analysisRequest);
    else await analysisRequest;
  }

  return json({
    ok: true,
    call_id: storedCall.id,
    provider: call.provider,
    eligible_for_ai: eligible,
    transcript_stored: transcriptStored,
    analysis_queued: transcriptStored,
    transcription_status: transcriptionStatus,
    skip_reason: skipReason,
  });
});
