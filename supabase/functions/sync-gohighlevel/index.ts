import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  emitDomainEvent,
  markRawObjectProcessed,
  sha256Hex,
  storeRawObject,
  upsertExternalObject,
} from "../_shared/context-ingestion.ts";
import { resolveCompany } from "../_shared/crmObjects.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type GhlContact = {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  source?: string;
  tags?: string[];
  dateAdded?: string;
  customFields?: unknown[];
};

type GhlOpportunity = {
  id: string;
  name?: string;
  monetaryValue?: number;
  status?: string;
  source?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  contactId?: string;
  contact?: { name?: string; email?: string; phone?: string; companyName?: string };
  createdAt?: string;
  updatedAt?: string;
};

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

function transcriptSegments(payload: unknown): TranscriptSegment[] {
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

function transcriptText(segments: TranscriptSegment[]) {
  return [...segments]
    .sort((a, b) => Number(a.sentenceIndex ?? 0) - Number(b.sentenceIndex ?? 0))
    .map((segment) => segment.transcript?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .trim();
}

function callStatus(message: GhlCallMessage) {
  const value = String(message.meta?.callStatus ?? message.status ?? "").toLowerCase();
  if (value.includes("voicemail")) return "voicemail";
  if (value.includes("miss") || value.includes("no-answer") || value.includes("no_answer"))
    return "missed";
  if (value.includes("fail") || value.includes("busy") || value.includes("cancel")) return "failed";
  return "completed";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: membership } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const orgId = membership?.organization_id as string | undefined;
  if (!orgId) return json({ error: "No Bylda organization found" }, 400);

  const encKey = Deno.env.get("INTEGRATIONS_ENCRYPTION_KEY");
  if (!encKey) return json({ error: "Integration storage is not configured" }, 503);
  const secret = async (key: string) => {
    const { data, error } = await admin.rpc("get_user_integration", {
      _user_id: user.id,
      _integration_key: key,
      _encryption_key: encKey,
    });
    if (error) throw new Error(`Unable to read ${key} credential`);
    return typeof data === "string" ? data : "";
  };

  try {
    const [storedCredential, storedLocationId] = await Promise.all([
      secret("gohighlevel"),
      secret("gohighlevel_location"),
    ]);
    let token = storedCredential;
    let locationId = storedLocationId;
    if (storedCredential.startsWith("{")) {
      try {
        const oauth = JSON.parse(storedCredential) as {
          access_token?: string;
          refresh_token?: string;
          expires_at?: string;
          scope?: string[];
          location_id?: string;
          external_account_id?: string;
        };
        token = oauth.access_token ?? "";
        locationId = oauth.location_id ?? storedLocationId;
        const expiresAt = oauth.expires_at ? new Date(oauth.expires_at).getTime() : 0;
        if (expiresAt > 0 && expiresAt <= Date.now() + 60_000) {
          const clientId = Deno.env.get("GHL_CLIENT_ID");
          const clientSecret = Deno.env.get("GHL_CLIENT_SECRET");
          if (!oauth.refresh_token || !clientId || !clientSecret) {
            return json({ error: "Reconnect GoHighLevel to renew access." }, 401);
          }
          const refreshResponse = await fetch("https://services.leadconnectorhq.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", Version: "v3" },
            body: new URLSearchParams({
              clientId,
              clientSecret,
              grantType: "refresh_token",
              refreshToken: oauth.refresh_token,
              userType: "Location",
            }),
          });
          const refreshed = await refreshResponse.json().catch(() => ({}));
          if (!refreshResponse.ok || !refreshed.accessToken) {
            return json({ error: "GoHighLevel access expired. Reconnect the account." }, 401);
          }
          token = refreshed.accessToken;
          locationId = refreshed.locationId ?? locationId;
          const nextExpiry = new Date(Date.now() + Number(refreshed.expiresIn ?? 86400) * 1000);
          const nextPayload = JSON.stringify({
            ...oauth,
            access_token: token,
            refresh_token: refreshed.refreshToken ?? oauth.refresh_token,
            expires_at: nextExpiry.toISOString(),
            location_id: locationId,
          });
          await admin.rpc("set_oauth_integration", {
            _user_id: user.id,
            _integration_key: "gohighlevel",
            _token_payload: nextPayload,
            _account_label: `HighLevel location ${locationId}`,
            _external_account_id: oauth.external_account_id ?? locationId,
            _scopes: oauth.scope ?? [],
            _token_expires_at: nextExpiry.toISOString(),
            _encryption_key: encKey,
          });
        }
      } catch {
        return json(
          { error: "The GoHighLevel connection is invalid. Reconnect the account." },
          400,
        );
      }
    }
    if (!token || !locationId) {
      return json({ error: "Connect your GoHighLevel account first" }, 400);
    }

    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Version: "v3",
    };

    const [contactsResponse, opportunitiesResponse] = await Promise.all([
      fetch("https://services.leadconnectorhq.com/contacts/search", {
        method: "POST",
        headers,
        body: JSON.stringify({ locationId, pageLimit: 100 }),
      }),
      fetch(
        `https://services.leadconnectorhq.com/opportunities/search?locationId=${encodeURIComponent(locationId)}&limit=100`,
        { headers },
      ),
    ]);

    if (contactsResponse.status === 401 || opportunitiesResponse.status === 401) {
      return json(
        { error: "GoHighLevel rejected this token. Check its sub-account and scopes." },
        401,
      );
    }
    if (!contactsResponse.ok) {
      const detail = await contactsResponse.text();
      console.error("[sync-gohighlevel] contacts", contactsResponse.status, detail.slice(0, 500));
      return json({ error: "Could not read GoHighLevel contacts" }, 502);
    }

    const contactsPayload = await contactsResponse.json();
    const opportunitiesPayload = opportunitiesResponse.ok
      ? await opportunitiesResponse.json()
      : { opportunities: [] };
    const contacts: GhlContact[] = contactsPayload.contacts ?? contactsPayload.results ?? [];
    const opportunities: GhlOpportunity[] =
      opportunitiesPayload.opportunities ?? opportunitiesPayload.results ?? [];

    // Retain provider truth before normalization so imports can be replayed.
    const rawContactIds = new Map<string, string | null>();
    const rawOpportunityIds = new Map<string, string | null>();
    await Promise.all([
      ...contacts
        .filter((contact) => contact.id)
        .map(async (contact) => {
          const payload = contact as unknown as Record<string, unknown>;
          const snapshotHash = await sha256Hex(JSON.stringify(payload));
          rawContactIds.set(
            contact.id,
            await storeRawObject(admin, {
              organizationId: orgId,
              provider: "gohighlevel",
              objectType: "contact",
              externalId: contact.id,
              idempotencyKey: `${contact.id}:${snapshotHash}`,
              payload,
            }),
          );
        }),
      ...opportunities
        .filter((opportunity) => opportunity.id)
        .map(async (opportunity) => {
          const payload = opportunity as unknown as Record<string, unknown>;
          const snapshotHash = await sha256Hex(JSON.stringify(payload));
          rawOpportunityIds.set(
            opportunity.id,
            await storeRawObject(admin, {
              organizationId: orgId,
              provider: "gohighlevel",
              objectType: "opportunity",
              externalId: opportunity.id,
              idempotencyKey: `${opportunity.id}:${snapshotHash}`,
              payload,
            }),
          );
        }),
    ]);

    const companyIds = new Map<string, string>();
    for (const companyName of [
      ...new Set(
        contacts
          .map((contact) => contact.companyName?.trim())
          .filter((name): name is string => Boolean(name)),
      ),
    ]) {
      const company = await resolveCompany(admin, orgId, { name: companyName });
      if (company) companyIds.set(companyName.toLowerCase(), company.id);
    }

    const contactExternalIds = contacts.map((contact) => contact.id).filter(Boolean);
    const existingContactsResult = contactExternalIds.length
      ? await admin
          .from("contacts")
          .select("id,external_id,company_id")
          .eq("org_id", orgId)
          .eq("external_source", "gohighlevel")
          .in("external_id", contactExternalIds)
      : { data: [], error: null };
    if (existingContactsResult.error) {
      throw new Error(`Existing contact lookup failed: ${existingContactsResult.error.message}`);
    }
    const existingContacts = existingContactsResult.data;
    const contactIdByExternal = new Map<string, { id: string; companyId: string | null }>();
    for (const row of existingContacts ?? []) {
      if (!row.external_id) continue;
      contactIdByExternal.set(String(row.external_id), {
        id: String(row.id),
        companyId: row.company_id ? String(row.company_id) : null,
      });
    }

    const contactRows = contacts
      .filter((c) => c.id)
      .map((c) => {
        const names = (c.name ?? "").trim().split(/\s+/);
        return {
          user_id: user.id,
          org_id: orgId,
          first_name: c.firstName ?? names[0] ?? null,
          last_name: c.lastName ?? (names.slice(1).join(" ") || null),
          email: c.email ?? null,
          phone: c.phone ?? null,
          company: c.companyName ?? null,
          company_id: c.companyName
            ? (companyIds.get(c.companyName.trim().toLowerCase()) ??
              contactIdByExternal.get(c.id)?.companyId ??
              null)
            : (contactIdByExternal.get(c.id)?.companyId ?? null),
          status: "new",
          source: c.source ?? "GoHighLevel",
          tags: Array.isArray(c.tags) ? c.tags : [],
          custom_fields: { gohighlevel: c.customFields ?? [] },
          external_source: "gohighlevel",
          external_id: c.id,
          updated_at: new Date().toISOString(),
        };
      });

    let contactsImported = 0;
    if (contactRows.length) {
      const { data, error } = await admin
        .from("contacts")
        .upsert(contactRows, { onConflict: "org_id,external_source,external_id" })
        .select("id,external_id,company_id");
      if (error) throw new Error(`Contact import failed: ${error.message}`);
      contactsImported = data?.length ?? contactRows.length;
      for (const row of data ?? []) {
        if (!row.external_id) continue;
        const externalId = String(row.external_id);
        contactIdByExternal.set(externalId, {
          id: String(row.id),
          companyId: row.company_id ? String(row.company_id) : null,
        });
        await Promise.all([
          upsertExternalObject(admin, {
            organizationId: orgId,
            provider: "gohighlevel",
            externalObjectType: "contact",
            externalObjectId: externalId,
            canonicalType: "contact",
            canonicalId: String(row.id),
          }),
          markRawObjectProcessed(
            admin,
            rawContactIds.get(externalId) ?? null,
            "contact",
            String(row.id),
          ),
        ]);
      }
    }

    const opportunityExternalIds = opportunities
      .map((opportunity) => opportunity.id)
      .filter(Boolean);
    const existingLeadsResult = opportunityExternalIds.length
      ? await admin
          .from("leads")
          .select("id,external_id,contact_id,company_id")
          .eq("organization_id", orgId)
          .eq("external_source", "gohighlevel")
          .in("external_id", opportunityExternalIds)
      : { data: [], error: null };
    if (existingLeadsResult.error) {
      throw new Error(`Existing opportunity lookup failed: ${existingLeadsResult.error.message}`);
    }
    const existingLeads = existingLeadsResult.data;
    const existingLeadByExternal = new Map<
      string,
      { contactId: string | null; companyId: string | null }
    >();
    for (const row of existingLeads ?? []) {
      if (!row.external_id) continue;
      existingLeadByExternal.set(String(row.external_id), {
        contactId: row.contact_id ? String(row.contact_id) : null,
        companyId: row.company_id ? String(row.company_id) : null,
      });
    }

    const leadRows = opportunities
      .filter((o) => o.id)
      .map((o) => {
        const linkedContact = o.contactId ? contactIdByExternal.get(o.contactId) : undefined;
        const existingLead = existingLeadByExternal.get(o.id);
        return {
          organization_id: orgId,
          user_id: user.id,
          name: o.name ?? o.contact?.name ?? "GoHighLevel opportunity",
          email: o.contact?.email ?? null,
          phone: o.contact?.phone ?? null,
          company: o.contact?.companyName ?? null,
          contact_id: linkedContact?.id ?? existingLead?.contactId ?? null,
          company_id:
            linkedContact?.companyId ??
            (o.contact?.companyName
              ? (companyIds.get(o.contact.companyName.trim().toLowerCase()) ??
                existingLead?.companyId ??
                null)
              : (existingLead?.companyId ?? null)),
          stage: "New",
          source: o.source ?? "GoHighLevel",
          value: o.monetaryValue ?? null,
          external_source: "gohighlevel",
          external_id: o.id,
          external_data: {
            status: o.status,
            pipeline_id: o.pipelineId,
            pipeline_stage_id: o.pipelineStageId,
            contact_id: o.contactId,
          },
          updated_at: new Date().toISOString(),
        };
      });

    let opportunitiesImported = 0;
    if (leadRows.length) {
      const { data, error } = await admin
        .from("leads")
        .upsert(leadRows, { onConflict: "organization_id,external_source,external_id" })
        .select("id,external_id");
      if (error) throw new Error(`Opportunity import failed: ${error.message}`);
      opportunitiesImported = data?.length ?? leadRows.length;
      for (const row of data ?? []) {
        if (!row.external_id) continue;
        const externalId = String(row.external_id);
        await Promise.all([
          upsertExternalObject(admin, {
            organizationId: orgId,
            provider: "gohighlevel",
            externalObjectType: "opportunity",
            externalObjectId: externalId,
            canonicalType: "lead",
            canonicalId: String(row.id),
          }),
          markRawObjectProcessed(
            admin,
            rawOpportunityIds.get(externalId) ?? null,
            "lead",
            String(row.id),
          ),
        ]);
      }
    }

    // HighLevel exposes completed phone calls as Conversation messages. Import
    // those records and attach HighLevel's transcript when available. Repeated
    // syncs are safe because provider message IDs are unique per organization.
    let callsReceived = 0;
    let callsImported = 0;
    let transcriptsImported = 0;
    let analysesQueued = 0;
    let callSyncWarning: string | null = null;
    const callMessagesResponse = await fetch(
      `https://services.leadconnectorhq.com/conversations/messages/export?locationId=${encodeURIComponent(locationId)}&channel=Call&limit=100&sortBy=createdAt&sortOrder=desc`,
      { headers },
    );

    if (callMessagesResponse.ok) {
      const callPayload = (await callMessagesResponse.json()) as {
        messages?: GhlCallMessage[];
      };
      const messages = (callPayload.messages ?? []).filter((message) => Boolean(message.id));
      callsReceived = messages.length;

      const { data: leadMappings } = await admin
        .from("leads")
        .select("id,external_data")
        .eq("organization_id", orgId)
        .eq("external_source", "gohighlevel");
      const leadByContactId = new Map<string, string>();
      for (const row of leadMappings ?? []) {
        const externalData =
          row.external_data && typeof row.external_data === "object"
            ? (row.external_data as Record<string, unknown>)
            : {};
        if (externalData.contact_id) {
          leadByContactId.set(String(externalData.contact_id), String(row.id));
        }
      }

      const callRows = messages.map((message) => ({
        organization_id: orgId,
        contact_id: message.contactId
          ? (contactIdByExternal.get(message.contactId)?.id ?? null)
          : null,
        lead_id: message.contactId ? (leadByContactId.get(message.contactId) ?? null) : null,
        direction: message.direction === "inbound" ? "inbound" : "outbound",
        status: callStatus(message),
        duration: Number.isFinite(Number(message.meta?.callDuration))
          ? Math.max(0, Math.round(Number(message.meta?.callDuration)))
          : null,
        disposition: message.meta?.callStatus ?? message.status ?? null,
        from_number: message.from ?? null,
        to_number: message.to ?? null,
        provider: "gohighlevel",
        provider_call_id: message.id,
        started_at: message.dateAdded ?? null,
        metadata: {
          ingestion: "gohighlevel-conversations-sync",
          location_id: locationId,
          conversation_id: message.conversationId ?? null,
          message_type: message.messageType ?? null,
          ghl_user_id: message.userId ?? null,
          synced_at: new Date().toISOString(),
        },
      }));

      if (callRows.length) {
        const { data: storedCalls, error: callsError } = await admin
          .from("calls")
          .upsert(callRows, { onConflict: "organization_id,provider,provider_call_id" })
          .select("id,provider_call_id");
        if (callsError) throw new Error(`Call import failed: ${callsError.message}`);
        callsImported = storedCalls?.length ?? callRows.length;
        const callIdByMessage = new Map(
          (storedCalls ?? []).map((row) => [String(row.provider_call_id), String(row.id)]),
        );

        for (let offset = 0; offset < messages.length; offset += 5) {
          const batch = messages.slice(offset, offset + 5);
          const transcriptResults = await Promise.all(
            batch.map(async (message) => {
              const callId = callIdByMessage.get(message.id);
              if (!callId || callStatus(message) !== "completed") return null;
              const response = await fetch(
                `https://services.leadconnectorhq.com/conversations/locations/${encodeURIComponent(locationId)}/messages/${encodeURIComponent(message.id)}/transcription`,
                { headers },
              );
              if (!response.ok) return null;
              const segments = transcriptSegments(await response.json().catch(() => null));
              const text = transcriptText(segments);
              return text ? { callId, text, segments } : null;
            }),
          );

          for (const result of transcriptResults.filter(
            (item): item is { callId: string; text: string; segments: TranscriptSegment[] } =>
              item !== null,
          )) {
            const { error: transcriptError } = await admin.from("call_transcripts").upsert(
              {
                call_id: result.callId,
                organization_id: orgId,
                transcript_text: result.text,
                speaker_segments: result.segments,
              },
              { onConflict: "call_id" },
            );
            if (transcriptError) {
              console.error("[sync-gohighlevel] transcript", transcriptError.message);
              continue;
            }
            transcriptsImported += 1;

            const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            const analysisRequest = fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-call`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${serviceKey}`,
                  apikey: serviceKey,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ call_id: result.callId }),
              },
            ).then(async (response) => {
              if (!response.ok) {
                console.error(
                  "[sync-gohighlevel] analysis",
                  response.status,
                  await response.text(),
                );
              }
            });
            const edgeRuntime = (
              globalThis as unknown as {
                EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void };
              }
            ).EdgeRuntime;
            if (edgeRuntime) edgeRuntime.waitUntil(analysisRequest);
            else await analysisRequest;
            analysesQueued += 1;
          }
        }
      }
    } else if (callMessagesResponse.status === 401 || callMessagesResponse.status === 403) {
      callSyncWarning =
        "Reconnect GoHighLevel and approve Conversations read access to import calls and transcripts.";
    } else {
      callSyncWarning = `HighLevel call sync returned HTTP ${callMessagesResponse.status}.`;
      console.error(
        "[sync-gohighlevel] calls",
        callMessagesResponse.status,
        (await callMessagesResponse.text()).slice(0, 500),
      );
    }

    await emitDomainEvent(admin, {
      organizationId: orgId,
      eventKey: `gohighlevel:${locationId}:sync:${new Date().toISOString().slice(0, 13)}`,
      eventType: "crm.sync.completed",
      source: "sync-gohighlevel",
      subjectType: "integration",
      payload: {
        provider: "gohighlevel",
        location_id: locationId,
        contacts_imported: contactsImported,
        opportunities_imported: opportunitiesImported,
        calls_imported: callsImported,
        transcripts_imported: transcriptsImported,
      },
    });

    return json({
      ok: true,
      location_id: locationId,
      contacts_received: contacts.length,
      contacts_imported: contactsImported,
      opportunities_received: opportunities.length,
      opportunities_imported: opportunitiesImported,
      calls_received: callsReceived,
      calls_imported: callsImported,
      transcripts_imported: transcriptsImported,
      analyses_queued: analysesQueued,
      call_sync_warning: callSyncWarning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GoHighLevel sync failed";
    console.error("[sync-gohighlevel]", message);
    return json({ error: message }, 500);
  }
});
