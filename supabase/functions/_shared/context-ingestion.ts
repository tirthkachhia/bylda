import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import { estimateTokens, normalizePhone, splitContextText } from "./context-package.ts";

export interface RawObjectInput {
  organizationId: string;
  provider: string;
  objectType: string;
  externalId?: string | null;
  idempotencyKey: string;
  payload: Record<string, unknown>;
}

export interface ExternalObjectInput {
  organizationId: string;
  provider: string;
  externalObjectType: string;
  externalObjectId: string;
  canonicalType: "company" | "contact" | "lead" | "call";
  canonicalId: string;
  externalUpdatedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CallEntityInput {
  organizationId: string;
  provider: string;
  contactId?: string | null;
  leadId?: string | null;
  externalContactId?: string | null;
  externalLeadId?: string | null;
  customerPhone?: string | null;
}

export interface CallEntityResolution {
  contactId: string | null;
  leadId: string | null;
  confidence: number;
  method: string;
  ambiguous: boolean;
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function storeRawObject(
  admin: SupabaseClient,
  input: RawObjectInput,
): Promise<string | null> {
  const payloadText = JSON.stringify(input.payload);
  const row = {
    organization_id: input.organizationId,
    provider: input.provider,
    external_object_type: input.objectType,
    external_object_id: input.externalId ?? null,
    idempotency_key: input.idempotencyKey,
    payload_hash: await sha256Hex(payloadText),
    payload: input.payload,
    processing_status: "received",
  };
  const { data, error } = await admin
    .from("integration_raw_objects")
    .upsert(row, {
      onConflict: "organization_id,provider,external_object_type,idempotency_key",
      ignoreDuplicates: true,
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Raw ingestion failed: ${error.message}`);
  if (data?.id) return String(data.id);

  const { data: existing } = await admin
    .from("integration_raw_objects")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("provider", input.provider)
    .eq("external_object_type", input.objectType)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  return existing?.id ? String(existing.id) : null;
}

export async function markRawObjectProcessed(
  admin: SupabaseClient,
  rawObjectId: string | null,
  canonicalType: string,
  canonicalId: string,
): Promise<void> {
  if (!rawObjectId) return;
  const { error } = await admin
    .from("integration_raw_objects")
    .update({
      processing_status: "processed",
      canonical_type: canonicalType,
      canonical_id: canonicalId,
      processed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", rawObjectId);
  if (error) console.error("[context-ingestion] mark raw processed", error.message);
}

export async function upsertExternalObject(
  admin: SupabaseClient,
  input: ExternalObjectInput,
): Promise<void> {
  const { error } = await admin.from("integration_external_objects").upsert(
    {
      organization_id: input.organizationId,
      provider: input.provider,
      external_object_type: input.externalObjectType,
      external_object_id: input.externalObjectId,
      canonical_type: input.canonicalType,
      canonical_id: input.canonicalId,
      external_updated_at: input.externalUpdatedAt ?? null,
      last_synced_at: new Date().toISOString(),
      metadata: input.metadata ?? {},
    },
    { onConflict: "organization_id,provider,external_object_type,external_object_id" },
  );
  if (error) throw new Error(`External identity mapping failed: ${error.message}`);
}

export async function emitDomainEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    eventKey: string;
    eventType: string;
    source: string;
    subjectType?: string | null;
    subjectId?: string | null;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await admin.from("bylda_events").upsert(
    {
      organization_id: input.organizationId,
      event_key: input.eventKey,
      event_type: input.eventType,
      source: input.source,
      subject_type: input.subjectType ?? null,
      subject_id: input.subjectId ?? null,
      version: 1,
      payload: input.payload ?? {},
    },
    { onConflict: "organization_id,event_key", ignoreDuplicates: true },
  );
  if (error) console.error("[context-ingestion] emit event", error.message);
}

async function validateCanonicalId(
  admin: SupabaseClient,
  table: "contacts" | "leads",
  organizationId: string,
  id: string | null | undefined,
): Promise<string | null> {
  if (!id) return null;
  const orgColumn = table === "contacts" ? "org_id" : "organization_id";
  const { data } = await admin
    .from(table)
    .select("id")
    .eq("id", id)
    .eq(orgColumn, organizationId)
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

async function mappedCanonicalId(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    provider: string;
    objectType: string;
    externalId?: string | null;
    canonicalType: "contact" | "lead";
  },
): Promise<string | null> {
  if (!input.externalId) return null;
  const { data } = await admin
    .from("integration_external_objects")
    .select("canonical_id")
    .eq("organization_id", input.organizationId)
    .eq("provider", input.provider)
    .eq("external_object_type", input.objectType)
    .eq("external_object_id", input.externalId)
    .eq("canonical_type", input.canonicalType)
    .maybeSingle();
  return data?.canonical_id ? String(data.canonical_id) : null;
}

export async function resolveCallEntities(
  admin: SupabaseClient,
  input: CallEntityInput,
): Promise<CallEntityResolution> {
  let contactId = await validateCanonicalId(
    admin,
    "contacts",
    input.organizationId,
    input.contactId,
  );
  let leadId = await validateCanonicalId(admin, "leads", input.organizationId, input.leadId);
  let confidence = contactId || leadId ? 1 : 0;
  let method = contactId || leadId ? "canonical_id" : "unresolved";

  if (!contactId) {
    contactId = await mappedCanonicalId(admin, {
      organizationId: input.organizationId,
      provider: input.provider,
      objectType: "contact",
      externalId: input.externalContactId,
      canonicalType: "contact",
    });
    if (contactId) {
      confidence = 1;
      method = "external_contact_id";
    }
  }
  if (!leadId) {
    leadId =
      (await mappedCanonicalId(admin, {
        organizationId: input.organizationId,
        provider: input.provider,
        objectType: "opportunity",
        externalId: input.externalLeadId,
        canonicalType: "lead",
      })) ??
      (await mappedCanonicalId(admin, {
        organizationId: input.organizationId,
        provider: input.provider,
        objectType: "deal",
        externalId: input.externalLeadId,
        canonicalType: "lead",
      }));
    if (leadId) {
      confidence = 1;
      method = "external_lead_id";
    }
  }

  let ambiguous = false;
  if (!contactId) {
    const phone = normalizePhone(input.customerPhone);
    if (phone) {
      const { data: contacts } = await admin
        .from("contacts")
        .select("id")
        .eq("org_id", input.organizationId)
        .eq("phone_normalized", phone)
        .limit(3);
      if (contacts?.length === 1) {
        contactId = String(contacts[0].id);
        confidence = 0.95;
        method = "phone";
      } else if ((contacts?.length ?? 0) > 1) {
        ambiguous = true;
        method = "ambiguous_phone";
      }
    }
  }

  if (leadId && !contactId) {
    const { data: lead } = await admin
      .from("leads")
      .select("contact_id")
      .eq("id", leadId)
      .eq("organization_id", input.organizationId)
      .maybeSingle();
    contactId = lead?.contact_id ? String(lead.contact_id) : null;
  }
  if (contactId && !leadId && !ambiguous) {
    const { data: leads } = await admin
      .from("leads")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("contact_id", contactId)
      .not("stage", "in", "(Won,Lost)")
      .order("updated_at", { ascending: false })
      .limit(2);
    if (leads?.length === 1) {
      leadId = String(leads[0].id);
      confidence = Math.min(confidence, 0.9);
      method = `${method}+active_deal`;
    } else if ((leads?.length ?? 0) > 1) {
      ambiguous = true;
      method = `${method}+ambiguous_deal`;
    }
  }

  return { contactId, leadId, confidence, method, ambiguous };
}

export async function storeTranscriptMemory(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    callId: string;
    contactId?: string | null;
    leadId?: string | null;
    companyId?: string | null;
    transcript: string;
    transcriptHash: string;
    speakerSegments?: unknown[];
    occurredAt?: string | null;
  },
): Promise<{ transcriptId: string; changed: boolean }> {
  const chunks = splitContextText(input.transcript);
  if (!chunks.length) throw new Error("Transcript is empty");
  const rows = chunks.map((content, index) => ({
    content,
    chunk_index: index,
    token_count: estimateTokens(content),
    metadata: { chunk_index: index, chunk_count: chunks.length },
  }));
  const { data, error } = await admin.rpc("store_call_transcript_memory", {
    p_organization_id: input.organizationId,
    p_call_id: input.callId,
    p_contact_id: input.contactId ?? null,
    p_lead_id: input.leadId ?? null,
    p_company_id: input.companyId ?? null,
    p_transcript_text: input.transcript,
    p_speaker_segments: input.speakerSegments ?? [],
    p_transcript_hash: input.transcriptHash,
    p_chunks: rows,
    p_occurred_at: input.occurredAt ?? new Date().toISOString(),
  });
  if (error) throw new Error(`Transcript memory indexing failed: ${error.message}`);
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.transcript_id) throw new Error("Transcript memory RPC returned no transcript");
  return {
    transcriptId: String(result.transcript_id),
    changed: Boolean(result.transcript_changed),
  };
}
