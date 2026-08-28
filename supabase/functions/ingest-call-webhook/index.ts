import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { normalizeCall } from "../_shared/call-normalize.ts";
import {
  emitDomainEvent,
  markRawObjectProcessed,
  resolveCallEntities,
  sha256Hex,
  storeTranscriptMemory,
  storeRawObject,
  upsertExternalObject,
} from "../_shared/context-ingestion.ts";

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
  let rawObjectId: string | null = null;
  try {
    rawObjectId = await storeRawObject(admin, {
      organizationId: orgId,
      provider: call.provider,
      objectType: "call",
      externalId: call.providerCallId,
      idempotencyKey: call.providerCallId,
      payload: raw as Record<string, unknown>,
    });
  } catch (error) {
    console.error(
      "[ingest-call-webhook] raw object",
      error instanceof Error ? error.message : error,
    );
    return json({ error: "Could not retain raw call payload" }, 500);
  }

  const customerPhone = call.direction === "inbound" ? call.fromNumber : call.toNumber;
  const entityResolution = await resolveCallEntities(admin, {
    organizationId: orgId,
    provider: call.provider,
    contactId: call.contactId,
    leadId: call.leadId,
    externalContactId: call.externalContactId,
    externalLeadId: call.externalLeadId,
    customerPhone,
  });
  const status = call.connected ? "completed" : "missed";
  const { data: storedCall, error: callError } = await admin
    .from("calls")
    .upsert(
      {
        organization_id: orgId,
        contact_id: entityResolution.contactId,
        lead_id: entityResolution.leadId,
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
          entity_resolution: {
            method: entityResolution.method,
            confidence: entityResolution.confidence,
            ambiguous: entityResolution.ambiguous,
          },
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

  await Promise.all([
    markRawObjectProcessed(admin, rawObjectId, "call", storedCall.id),
    upsertExternalObject(admin, {
      organizationId: orgId,
      provider: call.provider,
      externalObjectType: "call",
      externalObjectId: call.providerCallId,
      canonicalType: "call",
      canonicalId: storedCall.id,
    }),
    emitDomainEvent(admin, {
      organizationId: orgId,
      eventKey: `call:${call.provider}:${call.providerCallId}:received`,
      eventType: "conversation.received",
      source: "ingest-call-webhook",
      subjectType: "call",
      subjectId: storedCall.id,
      payload: {
        provider: call.provider,
        contact_id: entityResolution.contactId,
        lead_id: entityResolution.leadId,
      },
    }),
  ]);
  if (entityResolution.contactId || entityResolution.leadId) {
    await emitDomainEvent(admin, {
      organizationId: orgId,
      eventKey: `call:${call.provider}:${call.providerCallId}:linked`,
      eventType: "conversation.linked",
      source: "ingest-call-webhook",
      subjectType: "call",
      subjectId: storedCall.id,
      payload: {
        contact_id: entityResolution.contactId,
        lead_id: entityResolution.leadId,
        confidence: entityResolution.confidence,
        method: entityResolution.method,
      },
    });
  }

  let transcriptStored = false;
  let transcriptId: string | null = null;
  let analysisNeeded = false;
  let transcriptHash: string | null = null;
  if (eligible && transcript) {
    let companyId: string | null = null;
    if (entityResolution.leadId) {
      const { data: linkedLead } = await admin
        .from("leads")
        .select("company_id")
        .eq("id", entityResolution.leadId)
        .maybeSingle();
      companyId = linkedLead?.company_id ? String(linkedLead.company_id) : null;
    }
    if (!companyId && entityResolution.contactId) {
      const { data: linkedContact } = await admin
        .from("contacts")
        .select("company_id")
        .eq("id", entityResolution.contactId)
        .maybeSingle();
      companyId = linkedContact?.company_id ? String(linkedContact.company_id) : null;
    }
    try {
      transcriptHash = await sha256Hex(transcript);
      const storedTranscript = await storeTranscriptMemory(admin, {
        organizationId: orgId,
        callId: storedCall.id,
        contactId: entityResolution.contactId,
        leadId: entityResolution.leadId,
        companyId,
        transcript,
        transcriptHash,
        speakerSegments: call.speakerSegments,
        occurredAt: call.startedAt,
      });
      transcriptId = storedTranscript.transcriptId;
      transcriptStored = true;
      const { data: existingInsight } = await admin
        .from("call_insights")
        .select("analysis_version,transcript_hash")
        .eq("call_id", storedCall.id)
        .maybeSingle();
      analysisNeeded =
        storedTranscript.changed ||
        !existingInsight ||
        Number(existingInsight.analysis_version ?? 0) < 2 ||
        existingInsight.transcript_hash !== transcriptHash;
      if (storedTranscript.changed) {
        await emitDomainEvent(admin, {
          organizationId: orgId,
          eventKey: `call:${call.provider}:${call.providerCallId}:transcribed:${transcriptHash}`,
          eventType: "conversation.transcribed",
          source: "ingest-call-webhook",
          subjectType: "call",
          subjectId: storedCall.id,
          payload: { transcript_id: transcriptId, transcript_hash: transcriptHash },
        });
      }
    } catch (error) {
      console.error(
        "[ingest-call-webhook] transcript memory",
        error instanceof Error ? error.message : error,
      );
      return json({ error: "Transcript and memory could not be stored" }, 500);
    }
  }

  // Analyze in the background after a qualifying transcript lands. The
  // service-role token is accepted only for this server-to-server path; normal
  // browser calls still require an authenticated organization member.
  let analysisJobId: string | null = null;
  let analysisAttemptToken: string | null = null;
  if (transcriptStored && analysisNeeded && transcriptId && transcriptHash) {
    const { data, error } = await admin.rpc("claim_call_analysis", {
      p_organization_id: orgId,
      p_call_id: storedCall.id,
      p_transcript_id: transcriptId,
      p_transcript_hash: transcriptHash,
      p_analysis_version: 2,
    });
    if (error) {
      console.error("[ingest-call-webhook] analysis claim", error.message);
      return json({ error: "Call stored but analysis could not be queued" }, 500);
    }
    const claim = Array.isArray(data) ? data[0] : data;
    analysisJobId = claim?.job_id ? String(claim.job_id) : null;
    analysisAttemptToken = claim?.attempt_token ? String(claim.attempt_token) : null;
  }
  if (analysisJobId && analysisAttemptToken) {
    const jobId = analysisJobId;
    const attemptToken = analysisAttemptToken;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const analysisRequest = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-call`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        call_id: storedCall.id,
        analysis_job_id: jobId,
        analysis_attempt_token: attemptToken,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const detail = await response.text();
          console.error("[ingest-call-webhook] analysis", response.status, detail);
          await admin
            .from("call_analysis_jobs")
            .update({ status: "failed", error_message: `Dispatch returned ${response.status}` })
            .eq("id", jobId)
            .eq("attempt_token", attemptToken)
            .eq("status", "queued");
        }
      })
      .catch(async (error) => {
        console.error(
          "[ingest-call-webhook] analysis",
          error instanceof Error ? error.message : error,
        );
        await admin
          .from("call_analysis_jobs")
          .update({
            status: "failed",
            error_message: error instanceof Error ? error.message : "Analysis dispatch failed",
          })
          .eq("id", jobId)
          .eq("attempt_token", attemptToken)
          .eq("status", "queued");
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
    analysis_queued: Boolean(analysisJobId && analysisAttemptToken),
    transcription_status: transcriptionStatus,
    skip_reason: skipReason,
    entity_resolution: entityResolution,
  });
});
