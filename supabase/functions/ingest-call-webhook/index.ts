import { createClient } from "npm:@supabase/supabase-js@2.45.0";

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

function first(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function uuid(value: string | undefined) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;
}

function normalize(raw: Record<string, unknown>) {
  const nested = [raw.data, raw.call, raw.payload, raw.event, raw.body].find(
    (value) => value && typeof value === "object" && !Array.isArray(value),
  ) as Record<string, unknown> | undefined;
  const source = { ...raw, ...(nested ?? {}) };
  const transcriptObject = first(source, ["transcription", "transcript_data"]);
  const transcriptNested =
    transcriptObject && typeof transcriptObject === "object"
      ? (transcriptObject as Record<string, unknown>)
      : undefined;
  const transcript =
    text(first(source, ["transcript", "transcript_text", "transcription_text", "text"])) ??
    text(transcriptNested?.text);
  const segments = first(source, ["speaker_segments", "segments", "utterances"]);
  const duration = number(
    first(source, ["duration_seconds", "duration", "call_duration", "talk_time", "talkTime"]),
  );
  const disposition = text(
    first(source, ["disposition", "outcome", "call_outcome", "result", "status"]),
  );
  const statusValue = (disposition ?? "completed").toLowerCase();
  const connectedFlag = first(source, ["connected", "answered", "is_connected", "isAnswered"]);
  const connected =
    typeof connectedFlag === "boolean"
      ? connectedFlag
      : !["missed", "no_answer", "no-answer", "voicemail", "failed", "busy"].includes(statusValue);
  const provider =
    text(first(source, ["provider", "dialer", "source", "integration"])) ??
    text(raw.provider) ??
    "generic";

  return {
    provider: provider.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 64),
    providerCallId:
      text(first(source, ["provider_call_id", "call_id", "callId", "id", "uuid", "sid"])) ??
      crypto.randomUUID(),
    direction:
      text(first(source, ["direction", "call_direction"]))?.toLowerCase() === "inbound"
        ? "inbound"
        : "outbound",
    duration: duration == null ? null : Math.max(0, Math.round(duration)),
    connected,
    disposition,
    fromNumber: text(first(source, ["from_number", "from", "caller", "caller_number"])),
    toNumber: text(first(source, ["to_number", "to", "callee", "destination"])),
    recordingUrl: text(first(source, ["recording_url", "recordingUrl", "recording", "audio_url"])),
    transcript,
    speakerSegments: Array.isArray(segments) ? segments : [],
    startedAt: text(first(source, ["started_at", "start_time", "startTime", "timestamp"])),
    contactId: uuid(text(first(source, ["contact_id", "contactId"]))),
    leadId: uuid(text(first(source, ["lead_id", "leadId", "opportunity_id"]))),
  };
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
  const call = normalize(raw as Record<string, unknown>);
  const eligible = call.connected && (call.duration == null || call.duration >= MINIMUM_DURATION_SECONDS);
  const skipReason = !call.connected
    ? "not_connected"
    : call.duration != null && call.duration < MINIMUM_DURATION_SECONDS
      ? "under_45_seconds"
      : !call.transcript
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
  if (eligible && call.transcript) {
    const { error } = await admin.from("call_transcripts").upsert(
      {
        call_id: storedCall.id,
        organization_id: orgId,
        transcript_text: call.transcript,
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

  return json({
    ok: true,
    call_id: storedCall.id,
    provider: call.provider,
    eligible_for_ai: eligible,
    transcript_stored: transcriptStored,
    skip_reason: skipReason,
  });
});
