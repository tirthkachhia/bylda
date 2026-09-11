import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  fetchCloseSnapshot,
  fetchGoHighLevelSnapshot,
  fetchHubSpotSnapshot,
  fetchNotionPages,
  fetchPipedriveSnapshot,
  fetchSalesforceSnapshot,
  fetchStripeSnapshot,
} from "../_shared/crm-adapters.ts";
import { ingestCrmSnapshot, type CrmIngestResult } from "../_shared/context-crm-ingest.ts";
import { emitDomainEvent, sha256Hex, storeRawObject } from "../_shared/context-ingestion.ts";
import { syncGoHighLevelCalls } from "../_shared/gohighlevel-calls.ts";
import { loadConnectedOAuth, type StoredOAuth } from "../_shared/integration-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CRM_PROVIDERS = ["hubspot", "salesforce", "close_io", "gohighlevel", "pipedrive"] as const;
const MEMORY_PROVIDERS = ["notion", "stripe"] as const;
const ALL_PROVIDERS = [...CRM_PROVIDERS, ...MEMORY_PROVIDERS] as const;

type SyncProvider = (typeof ALL_PROVIDERS)[number];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isSyncProvider(value: string): value is SyncProvider {
  return (ALL_PROVIDERS as readonly string[]).includes(value);
}

async function storeNotionMemory(
  admin: ReturnType<typeof createClient>,
  organizationId: string,
  chunks: Array<{
    sourceType: string;
    sourceId: string;
    chunkIndex: number;
    content: string;
    tokenCount: number;
    occurredAt: string;
    metadata: Record<string, unknown>;
  }>,
) {
  let stored = 0;
  for (const chunk of chunks) {
    await storeRawObject(admin, {
      organizationId,
      provider: "notion",
      objectType: "page",
      externalId: chunk.sourceId,
      idempotencyKey: `${chunk.sourceId}:${await sha256Hex(chunk.content)}`,
      payload: { ...chunk.metadata, content: chunk.content },
    });
    const { error } = await admin.from("context_memory_chunks").upsert(
      {
        organization_id: organizationId,
        source_type: chunk.sourceType,
        source_id: chunk.sourceId,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        token_count: chunk.tokenCount,
        occurred_at: chunk.occurredAt,
        metadata: chunk.metadata,
      },
      { onConflict: "organization_id,source_type,source_id,chunk_index" },
    );
    if (error) throw new Error(`Notion memory ingest failed: ${error.message}`);
    stored += 1;
  }
  await emitDomainEvent(admin, {
    organizationId,
    eventKey: `notion:sync:${new Date().toISOString().slice(0, 13)}`,
    eventType: "memory.sync.completed",
    source: "sync-crm",
    subjectType: "integration",
    payload: { provider: "notion", chunks_imported: stored },
  });
  return stored;
}

async function syncProvider(
  admin: ReturnType<typeof createClient>,
  input: {
    organizationId: string;
    userId: string;
    provider: SyncProvider;
    oauth: StoredOAuth;
  },
) {
  if (input.provider === "notion") {
    const chunks = await fetchNotionPages(input.oauth);
    const stored = await storeNotionMemory(admin, input.organizationId, chunks);
    return {
      provider: "notion",
      companies_imported: 0,
      contacts_imported: 0,
      deals_imported: 0,
      companies_received: 0,
      contacts_received: 0,
      deals_received: 0,
      memory_chunks_imported: stored,
    };
  }

  const snapshot =
    input.provider === "hubspot"
      ? await fetchHubSpotSnapshot(input.oauth)
      : input.provider === "salesforce"
        ? await fetchSalesforceSnapshot(input.oauth)
        : input.provider === "close_io"
          ? await fetchCloseSnapshot(input.oauth)
          : input.provider === "pipedrive"
            ? await fetchPipedriveSnapshot(input.oauth)
            : input.provider === "stripe"
              ? await fetchStripeSnapshot(input.oauth)
              : await fetchGoHighLevelSnapshot(input.oauth);

  const labels: Record<SyncProvider, string> = {
    hubspot: "HubSpot",
    salesforce: "Salesforce",
    close_io: "Close",
    gohighlevel: "GoHighLevel",
    pipedrive: "Pipedrive",
    notion: "Notion",
    stripe: "Stripe",
  };
  const ingested = await ingestCrmSnapshot(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
    provider: input.provider,
    sourceLabel: labels[input.provider],
    snapshot,
  });
  if (input.provider !== "gohighlevel") return ingested;

  const conversations = await syncGoHighLevelCalls(admin, {
    organizationId: input.organizationId,
    oauth: input.oauth,
  });
  return {
    ...ingested,
    ...conversations,
    conversation_warning: conversations.warning,
  };
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

  const body = (await req.json().catch(() => ({}))) as {
    provider?: string;
    providers?: string[];
  };
  const requested = [
    ...new Set(
      (body.providers?.length ? body.providers : body.provider ? [body.provider] : []).filter(
        Boolean,
      ),
    ),
  ];
  if (requested.some((provider) => !isSyncProvider(provider))) {
    return json({ error: "Unsupported CRM or memory provider" }, 400);
  }

  const { data: connectedRows, error: connectedError } = await admin
    .from("user_integrations")
    .select("integration_key,status")
    .eq("user_id", user.id)
    .eq("status", "connected")
    .in("integration_key", requested.length ? requested : [...ALL_PROVIDERS]);
  if (connectedError) return json({ error: connectedError.message }, 500);

  const connected = (connectedRows ?? [])
    .map((row) => String(row.integration_key))
    .filter(isSyncProvider);
  const targets = requested.length ? requested.filter(isSyncProvider) : connected;
  if (!targets.length) {
    return json(
      { error: "Connect HubSpot, Salesforce, Close, or another supported source first" },
      400,
    );
  }

  const results: Array<
    CrmIngestResult & {
      memory_chunks_imported?: number;
      calls_received?: number;
      calls_imported?: number;
      transcripts_imported?: number;
      analyses_queued?: number;
      conversation_warning?: string | null;
      error?: string;
    }
  > = [];
  for (const provider of targets) {
    try {
      const oauth = await loadConnectedOAuth(admin, user.id, provider, encKey);
      results.push(
        await syncProvider(admin, {
          organizationId: orgId,
          userId: user.id,
          provider,
          oauth,
        }),
      );
    } catch (error) {
      results.push({
        provider,
        companies_imported: 0,
        contacts_imported: 0,
        deals_imported: 0,
        companies_received: 0,
        contacts_received: 0,
        deals_received: 0,
        error: error instanceof Error ? error.message : `${provider} sync failed`,
      });
    }
  }

  const failed = results.filter((result) => result.error);
  const allFailed = failed.length > 0 && failed.length === results.length;
  return json(
    {
      ok: failed.length === 0,
      ...(allFailed
        ? {
            error: failed
              .map((result) => `${result.provider}: ${result.error ?? "sync failed"}`)
              .join("; "),
          }
        : {}),
      results,
      contacts_imported: results.reduce((sum, result) => sum + result.contacts_imported, 0),
      deals_imported: results.reduce((sum, result) => sum + result.deals_imported, 0),
      companies_imported: results.reduce((sum, result) => sum + result.companies_imported, 0),
      contacts_received: results.reduce((sum, result) => sum + result.contacts_received, 0),
      deals_received: results.reduce((sum, result) => sum + result.deals_received, 0),
      calls_received: results.reduce((sum, result) => sum + (result.calls_received ?? 0), 0),
      calls_imported: results.reduce((sum, result) => sum + (result.calls_imported ?? 0), 0),
      transcripts_imported: results.reduce(
        (sum, result) => sum + (result.transcripts_imported ?? 0),
        0,
      ),
      analyses_queued: results.reduce((sum, result) => sum + (result.analyses_queued ?? 0), 0),
    },
    200,
  );
});
