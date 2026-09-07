import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import type { StoredOAuth } from "./integration-credentials.ts";
import {
  resolveCallEntities,
  sha256Hex,
  storeRawObject,
  upsertExternalObject,
} from "./context-ingestion.ts";

type GhlCallMessage = {
  id: string;
  contactId?: string;
  conversationId?: string;
  dateAdded?: string;
  direction?: "inbound" | "outbound";
  status?: string;
  messageType?: string;
  userId?: string;
  from?: string;
  to?: string;
  meta?: { callDuration?: number | string; callStatus?: string };
};

type TranscriptSegment = {
  mediaChannel?: number | string;
  sentenceIndex?: number | string;
  startTime?: number | string;
  endTime?: number | string;
  transcript?: string;
  confidence?: number | string;
};

export type GoHighLevelCallSyncResult = {
  calls_received: number;
  calls_imported: number;
  transcripts_imported: number;
  analyses_queued: number;
  warning: string | null;
};

function segmentsFrom(payload: unknown): TranscriptSegment[] {
  if (Array.isArray(payload)) return payload as TranscriptSegment[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["transcriptions", "transcription", "sentences", "data", "results"]) {
    const value = record[key];
    if (Array.isArray(value)) return value as TranscriptSegment[];
    if (value && typeof value === "object") return [value as TranscriptSegment];
  }
  return typeof record.transcript === "string" ? [record as TranscriptSegment] : [];
}

function textFrom(segments: TranscriptSegment[]) {
  return [...segments]
    .sort((a, b) => Number(a.sentenceIndex ?? 0) - Number(b.sentenceIndex ?? 0))
    .map((segment) => segment.transcript?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .trim();
}

function normalizedStatus(message: GhlCallMessage) {
  const value = String(message.meta?.callStatus ?? message.status ?? "").toLowerCase();
  if (value.includes("voicemail")) return "voicemail";
  if (value.includes("miss") || value.includes("no-answer") || value.includes("no_answer")) {
    return "missed";
  }
  if (value.includes("fail") || value.includes("busy") || value.includes("cancel")) return "failed";
  return "completed";
}

function apiHeaders(oauth: StoredOAuth) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${oauth.accessToken}`,
    Version: "v3",
  };
}

async function queueAnalysis(callId: string) {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const request = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-call`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ call_id: callId }),
  }).then(async (response) => {
    if (!response.ok) {
      console.error("[gohighlevel-calls] analysis", response.status, await response.text());
    }
  });
  const runtime = (
    globalThis as unknown as { EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void } }
  ).EdgeRuntime;
  if (runtime) runtime.waitUntil(request);
  else await request;
}

export async function syncGoHighLevelCalls(
  admin: SupabaseClient,
  input: { organizationId: string; oauth: StoredOAuth },
): Promise<GoHighLevelCallSyncResult> {
  const empty = {
    calls_received: 0,
    calls_imported: 0,
    transcripts_imported: 0,
    analyses_queued: 0,
    warning: null,
  };
  if (!input.oauth.locationId) {
    return { ...empty, warning: "Reconnect GoHighLevel so Bylda can identify the location." };
  }

  const headers = apiHeaders(input.oauth);
  const messagesResponse = await fetch(
    `https://services.leadconnectorhq.com/conversations/messages/export?locationId=${encodeURIComponent(input.oauth.locationId)}&channel=Call&limit=100&sortBy=createdAt&sortOrder=desc`,
    { headers },
  );
  if (messagesResponse.status === 401 || messagesResponse.status === 403) {
    return {
      ...empty,
      warning:
        "Reconnect GoHighLevel and approve Conversations read access to import calls and transcripts.",
    };
  }
  if (!messagesResponse.ok) {
    return { ...empty, warning: `HighLevel call sync returned HTTP ${messagesResponse.status}.` };
  }

  const payload = (await messagesResponse.json()) as { messages?: GhlCallMessage[] };
  const messages = (payload.messages ?? []).filter((message) => Boolean(message.id));
  const storedByMessage = new Map<string, string>();
  for (const message of messages) {
    const raw = message as unknown as Record<string, unknown>;
    await storeRawObject(admin, {
      organizationId: input.organizationId,
      provider: "gohighlevel",
      objectType: "call",
      externalId: message.id,
      idempotencyKey: `${message.id}:${await sha256Hex(JSON.stringify(raw))}`,
      payload: raw,
    });
    const entities = await resolveCallEntities(admin, {
      organizationId: input.organizationId,
      provider: "gohighlevel",
      externalContactId: message.contactId,
      customerPhone: message.direction === "inbound" ? message.from : message.to,
    });
    const duration = Number(message.meta?.callDuration);
    const { data: stored, error } = await admin
      .from("calls")
      .upsert(
        {
          organization_id: input.organizationId,
          contact_id: entities.contactId,
          lead_id: entities.leadId,
          direction: message.direction === "inbound" ? "inbound" : "outbound",
          status: normalizedStatus(message),
          duration: Number.isFinite(duration) ? Math.max(0, Math.round(duration)) : null,
          disposition: message.meta?.callStatus ?? message.status ?? null,
          from_number: message.from ?? null,
          to_number: message.to ?? null,
          provider: "gohighlevel",
          provider_call_id: message.id,
          started_at: message.dateAdded ?? null,
          metadata: {
            ingestion: "gohighlevel-conversations-sync",
            location_id: input.oauth.locationId,
            conversation_id: message.conversationId ?? null,
            message_type: message.messageType ?? null,
            ghl_user_id: message.userId ?? null,
            entity_resolution: entities,
            synced_at: new Date().toISOString(),
          },
        },
        { onConflict: "organization_id,provider,provider_call_id" },
      )
      .select("id")
      .single();
    if (error || !stored) throw new Error(`Call import failed: ${error?.message ?? "unknown"}`);
    storedByMessage.set(message.id, String(stored.id));
    await upsertExternalObject(admin, {
      organizationId: input.organizationId,
      provider: "gohighlevel",
      externalObjectType: "call",
      externalObjectId: message.id,
      canonicalType: "call",
      canonicalId: String(stored.id),
      externalUpdatedAt: message.dateAdded ?? null,
    });
  }

  let transcriptsImported = 0;
  let analysesQueued = 0;
  for (let offset = 0; offset < messages.length; offset += 5) {
    const results = await Promise.all(
      messages.slice(offset, offset + 5).map(async (message) => {
        const callId = storedByMessage.get(message.id);
        if (!callId || normalizedStatus(message) !== "completed") return null;
        const response = await fetch(
          `https://services.leadconnectorhq.com/conversations/locations/${encodeURIComponent(input.oauth.locationId!)}/messages/${encodeURIComponent(message.id)}/transcription`,
          { headers },
        );
        if (!response.ok) return null;
        const segments = segmentsFrom(await response.json().catch(() => null));
        const transcript = textFrom(segments);
        return transcript ? { callId, transcript, segments } : null;
      }),
    );

    for (const result of results.filter(
      (item): item is { callId: string; transcript: string; segments: TranscriptSegment[] } =>
        item !== null,
    )) {
      const { data: existing } = await admin
        .from("call_transcripts")
        .select("transcript_text")
        .eq("call_id", result.callId)
        .maybeSingle();
      const changed = existing?.transcript_text !== result.transcript;
      const { error } = await admin.from("call_transcripts").upsert(
        {
          call_id: result.callId,
          organization_id: input.organizationId,
          transcript_text: result.transcript,
          speaker_segments: result.segments,
        },
        { onConflict: "call_id" },
      );
      if (error) throw new Error(`Transcript import failed: ${error.message}`);
      transcriptsImported += 1;
      if (changed) {
        await queueAnalysis(result.callId);
        analysesQueued += 1;
      }
    }
  }

  return {
    calls_received: messages.length,
    calls_imported: storedByMessage.size,
    transcripts_imported: transcriptsImported,
    analyses_queued: analysesQueued,
    warning: null,
  };
}
