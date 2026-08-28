import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import {
  compactContextValue,
  CONTEXT_PACKAGE_VERSION,
  estimateTokens,
  rankAndBudgetEvidence,
  type ContextPackage,
  type EntityRef,
  type EvidenceItem,
  type SourceReference,
} from "./context-package.ts";

export interface BuildContextPackageRequest {
  organizationId: string;
  userId?: string | null;
  task: string;
  callId?: string | null;
  leadId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  tokenBudget?: number;
  queryEmbedding?: number[] | null;
  persistReceipt?: boolean;
}

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function source(
  references: SourceReference[],
  type: string,
  id: unknown,
  entity?: EntityRef,
  occurredAt?: unknown,
  label?: string,
) {
  if (!id) return;
  const key = `${type}:${String(id)}`;
  if (references.some((reference) => `${reference.type}:${reference.id}` === key)) return;
  references.push({
    id: String(id),
    type,
    entity,
    occurred_at: typeof occurredAt === "string" ? occurredAt : null,
    label,
  });
}

async function loadMemoryFacts(
  admin: SupabaseClient,
  organizationId: string,
  entities: EntityRef[],
) {
  const rows: Array<Record<string, unknown>> = [];
  for (const entity of entities) {
    const { data } = await admin
      .from("entity_memory_facts")
      .select(
        "id,entity_type,entity_id,fact_key,fact_value,fact_class,source_type,source_id,confidence,evidence,valid_from",
      )
      .eq("organization_id", organizationId)
      .eq("entity_type", entity.type)
      .eq("entity_id", entity.id)
      .is("valid_to", null)
      .order("valid_from", { ascending: false })
      .limit(50);
    rows.push(...((data ?? []) as Array<Record<string, unknown>>));
  }
  return rows;
}

export async function buildContextPackage(
  admin: SupabaseClient,
  request: BuildContextPackageRequest,
): Promise<ContextPackage> {
  const started = Date.now();
  const tokenBudget = Math.max(1000, Math.min(request.tokenBudget ?? 6000, 24_000));
  const references: SourceReference[] = [];
  const omissions: string[] = [];

  const [{ data: membership }, { data: businessContext }, { data: baseline }, { data: version }] =
    await Promise.all([
      request.userId
        ? admin
            .from("organization_members")
            .select("role")
            .eq("organization_id", request.organizationId)
            .eq("user_id", request.userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from("business_context")
        .select(
          "id,version,identity,customer,stage,model,goals,constraints,verdicts,motion,activity,updated_at",
        )
        .eq("organization_id", request.organizationId)
        .maybeSingle(),
      admin
        .from("sales_baselines")
        .select("id,version,profile,provenance,effective_from,updated_at")
        .eq("organization_id", request.organizationId)
        .eq("status", "active")
        .maybeSingle(),
      admin
        .from("context_versions")
        .select("version")
        .eq("organization_id", request.organizationId)
        .maybeSingle(),
    ]);

  if (request.userId && !membership) throw new Error("User is not a member of this organization");

  if (businessContext?.id) {
    source(
      references,
      "business_context",
      businessContext.id,
      { type: "organization", id: request.organizationId },
      businessContext.updated_at,
      "Business context",
    );
  }
  if (baseline?.id) {
    source(
      references,
      "sales_baseline",
      baseline.id,
      { type: "organization", id: request.organizationId },
      baseline.effective_from,
      `Sales baseline v${baseline.version}`,
    );
  }

  let callId = request.callId ?? null;
  let leadId = request.leadId ?? null;
  let contactId = request.contactId ?? null;
  let companyId = request.companyId ?? null;
  let call: Record<string, unknown> | null = null;

  if (callId) {
    const { data } = await admin
      .from("calls")
      .select(
        "id,organization_id,contact_id,lead_id,user_id,direction,status,duration,disposition,from_number,to_number,provider,provider_call_id,started_at,metadata,created_at",
      )
      .eq("id", callId)
      .eq("organization_id", request.organizationId)
      .maybeSingle();
    if (!data) throw new Error("Call was not found in this organization");
    call = data as Record<string, unknown>;
    leadId ??= typeof data.lead_id === "string" ? data.lead_id : null;
    contactId ??= typeof data.contact_id === "string" ? data.contact_id : null;
    source(
      references,
      "call",
      data.id,
      { type: "call", id: String(data.id) },
      data.started_at ?? data.created_at,
      "Current call",
    );
  }

  let deal: Record<string, unknown> | null = null;
  if (leadId) {
    const { data } = await admin
      .from("leads")
      .select(
        "id,name,email,phone,company,stage,source,notes,value,contact_id,company_id,pipeline_id,external_source,external_id,external_data,custom_fields,created_at,updated_at",
      )
      .eq("id", leadId)
      .eq("organization_id", request.organizationId)
      .maybeSingle();
    if (data) {
      deal = data as Record<string, unknown>;
      contactId ??= typeof data.contact_id === "string" ? data.contact_id : null;
      companyId ??= typeof data.company_id === "string" ? data.company_id : null;
      source(
        references,
        "lead",
        data.id,
        { type: "lead", id: String(data.id) },
        data.updated_at,
        String(data.name),
      );
    } else {
      omissions.push("requested_lead_not_found");
      leadId = null;
    }
  }

  let contact: Record<string, unknown> | null = null;
  if (contactId) {
    const { data } = await admin
      .from("contacts")
      .select(
        "id,user_id,org_id,first_name,last_name,email,phone,company,company_id,status,source,tags,notes,custom_fields,external_source,external_id,last_contacted_at,created_at,updated_at",
      )
      .eq("id", contactId)
      .eq("org_id", request.organizationId)
      .maybeSingle();
    if (data) {
      contact = data as Record<string, unknown>;
      companyId ??= typeof data.company_id === "string" ? data.company_id : null;
      source(
        references,
        "contact",
        data.id,
        { type: "contact", id: String(data.id) },
        data.updated_at,
        [data.first_name, data.last_name].filter(Boolean).join(" "),
      );
    } else {
      omissions.push("requested_contact_not_found");
      contactId = null;
    }
  }

  if (!leadId && contactId) {
    const { data } = await admin
      .from("leads")
      .select(
        "id,name,email,phone,company,stage,source,notes,value,contact_id,company_id,pipeline_id,external_source,external_id,external_data,custom_fields,created_at,updated_at",
      )
      .eq("organization_id", request.organizationId)
      .eq("contact_id", contactId)
      .not("stage", "in", "(Won,Lost)")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      deal = data as Record<string, unknown>;
      leadId = String(data.id);
      companyId ??= typeof data.company_id === "string" ? data.company_id : null;
      source(
        references,
        "lead",
        data.id,
        { type: "lead", id: String(data.id) },
        data.updated_at,
        String(data.name),
      );
    }
  }

  let account: Record<string, unknown> | null = null;
  if (companyId) {
    const { data } = await admin
      .from("companies")
      .select(
        "id,organization_id,name,domain,website,industry,size,location,notes,custom_fields,created_at,updated_at",
      )
      .eq("id", companyId)
      .eq("organization_id", request.organizationId)
      .maybeSingle();
    if (data) {
      account = data as Record<string, unknown>;
      source(
        references,
        "company",
        data.id,
        { type: "company", id: String(data.id) },
        data.updated_at,
        String(data.name),
      );
    } else {
      omissions.push("requested_company_not_found");
      companyId = null;
    }
  }

  let pipeline: Record<string, unknown> | null = null;
  if (deal?.pipeline_id) {
    const [{ data: pipelineData }, { data: stages }] = await Promise.all([
      admin
        .from("pipelines")
        .select("id,name,is_default")
        .eq("id", deal.pipeline_id)
        .eq("organization_id", request.organizationId)
        .maybeSingle(),
      admin
        .from("pipeline_stages")
        .select("id,name,sort_order,probability_default,is_won,is_lost")
        .eq("pipeline_id", deal.pipeline_id)
        .eq("organization_id", request.organizationId)
        .order("sort_order"),
    ]);
    if (pipelineData) pipeline = { ...pipelineData, stages: stages ?? [] };
  }

  const entities: EntityRef[] = [{ type: "organization", id: request.organizationId }];
  if (companyId) entities.push({ type: "company", id: companyId });
  if (contactId) entities.push({ type: "contact", id: contactId });
  if (leadId) entities.push({ type: "lead", id: leadId });
  const memoryFacts = await loadMemoryFacts(admin, request.organizationId, entities);
  for (const fact of memoryFacts) {
    source(
      references,
      "entity_memory_fact",
      fact.id,
      { type: fact.entity_type as EntityRef["type"], id: String(fact.entity_id) },
      fact.valid_from,
      String(fact.fact_key),
    );
  }

  let recentActivity: Array<Record<string, unknown>> = [];
  if (leadId) {
    const { data } = await admin
      .from("crm_activities")
      .select("id,type,content,metadata,user_id,created_at")
      .eq("organization_id", request.organizationId)
      .eq("deal_id", leadId)
      .order("created_at", { ascending: false })
      .limit(20);
    recentActivity = (data ?? []) as Array<Record<string, unknown>>;
    for (const activity of recentActivity) {
      source(
        references,
        "crm_activity",
        activity.id,
        { type: "lead", id: leadId },
        activity.created_at,
        String(activity.type),
      );
    }
  }

  let chunkQuery = admin
    .from("context_memory_chunks")
    .select("id,source_type,source_id,content,metadata,occurred_at")
    .eq("organization_id", request.organizationId);
  if (leadId) chunkQuery = chunkQuery.eq("lead_id", leadId);
  else if (contactId) chunkQuery = chunkQuery.eq("contact_id", contactId);
  else if (companyId) chunkQuery = chunkQuery.eq("company_id", companyId);
  else if (callId) chunkQuery = chunkQuery.eq("call_id", callId);
  if (callId) {
    chunkQuery = chunkQuery.or(`call_id.is.null,call_id.neq.${callId}`);
  }
  const { data: recentChunks } = await chunkQuery
    .order("occurred_at", { ascending: false })
    .limit(20);

  const { data: integrationChunks } = await admin
    .from("context_memory_chunks")
    .select("id,source_type,source_id,content,metadata,occurred_at")
    .eq("organization_id", request.organizationId)
    .in("source_type", ["notion_page", "integration_note"])
    .is("lead_id", null)
    .is("contact_id", null)
    .is("company_id", null)
    .is("call_id", null)
    .order("occurred_at", { ascending: false })
    .limit(8);

  const recentEvidence: EvidenceItem[] = [...(recentChunks ?? []), ...(integrationChunks ?? [])].map((row) => ({
    id: String(row.id),
    source_type: String(row.source_type),
    source_id: row.source_id ? String(row.source_id) : null,
    content: String(row.content),
    occurred_at: typeof row.occurred_at === "string" ? row.occurred_at : null,
    importance: 0.7,
    metadata: object(row.metadata),
  }));

  let semanticEvidence: EvidenceItem[] = [];
  if (request.queryEmbedding?.length === 1536) {
    const { data, error } = await admin.rpc("match_context_memory", {
      query_embedding: request.queryEmbedding,
      filter_organization_id: request.organizationId,
      filter_company_id: companyId,
      filter_contact_id: contactId,
      filter_lead_id: leadId,
      filter_call_id: !leadId && !contactId && !companyId ? callId : null,
      exclude_call_id: callId,
      match_count: 12,
    });
    if (error) {
      omissions.push("semantic_retrieval_unavailable");
    } else {
      semanticEvidence = (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        source_type: String(row.source_type),
        source_id: row.source_id ? String(row.source_id) : null,
        content: String(row.content),
        occurred_at: typeof row.occurred_at === "string" ? row.occurred_at : null,
        similarity: typeof row.similarity === "number" ? row.similarity : null,
        importance: 0.8,
        metadata: object(row.metadata),
      }));
    }
  } else {
    omissions.push("semantic_retrieval_skipped_no_embedding");
  }

  const rawBusinessProfile = businessContext
    ? {
        identity: object(businessContext.identity),
        customer: object(businessContext.customer),
        stage: object(businessContext.stage),
        model: object(businessContext.model),
        goals: object(businessContext.goals),
        constraints: object(businessContext.constraints),
        verdicts: object(businessContext.verdicts),
        motion: object(businessContext.motion),
        activity: object(businessContext.activity),
      }
    : {};
  const rawBaselineProfile = baseline ? object(baseline.profile) : pipeline ? { pipeline } : {};
  if (!baseline) omissions.push("active_sales_baseline_missing_using_pipeline_fallback");

  const compact = (value: unknown, tight = false) =>
    compactContextValue(
      value,
      tight
        ? { maxStringChars: 240, maxArrayItems: 6, maxObjectKeys: 16, maxDepth: 4 }
        : { maxStringChars: 800, maxArrayItems: 20, maxObjectKeys: 40, maxDepth: 6 },
    );
  let businessProfile = compact(rawBusinessProfile) as Record<string, unknown>;
  let baselineProfile = compact(rawBaselineProfile) as Record<string, unknown>;
  let packageAccount = account ? (compact(account) as Record<string, unknown>) : null;
  let packageDeal = deal ? (compact(deal) as Record<string, unknown>) : null;
  let packageContacts = contact
    ? ([compact(contact) as Record<string, unknown>] as Array<Record<string, unknown>>)
    : [];
  let packageFacts = compact(memoryFacts) as Array<Record<string, unknown>>;
  let packageActivity = compact(recentActivity) as Array<Record<string, unknown>>;
  let packageCall = call ? (compact(call) as Record<string, unknown>) : null;

  const structuredPayload = () => ({
    business: businessProfile,
    baseline: baselineProfile,
    account: packageAccount,
    deal: packageDeal,
    contacts: packageContacts,
    memoryFacts: packageFacts,
    recentActivity: packageActivity,
    call: packageCall,
  });
  let structuredTokens = estimateTokens(JSON.stringify(structuredPayload()));
  const structuredTarget = Math.floor(tokenBudget * 0.75);
  if (structuredTokens > structuredTarget) {
    businessProfile = compact(rawBusinessProfile, true) as Record<string, unknown>;
    baselineProfile = compact(rawBaselineProfile, true) as Record<string, unknown>;
    packageAccount = account ? (compact(account, true) as Record<string, unknown>) : null;
    packageDeal = deal ? (compact(deal, true) as Record<string, unknown>) : null;
    packageContacts = contact
      ? ([compact(contact, true) as Record<string, unknown>] as Array<Record<string, unknown>>)
      : [];
    packageFacts = (compact(memoryFacts.slice(0, 10), true) ?? []) as Array<
      Record<string, unknown>
    >;
    packageActivity = (compact(recentActivity.slice(0, 10), true) ?? []) as Array<
      Record<string, unknown>
    >;
    packageCall = call ? (compact(call, true) as Record<string, unknown>) : null;
    structuredTokens = estimateTokens(JSON.stringify(structuredPayload()));
    omissions.push("structured_context_compacted_for_token_budget");
  }
  if (structuredTokens > tokenBudget) {
    packageFacts = [];
    packageActivity = [];
    packageCall = packageCall
      ? {
          id: packageCall.id,
          direction: packageCall.direction,
          status: packageCall.status,
          started_at: packageCall.started_at,
        }
      : null;
    structuredTokens = estimateTokens(JSON.stringify(structuredPayload()));
    omissions.push("structured_history_omitted_for_token_budget");
  }
  if (structuredTokens > tokenBudget) {
    businessProfile = {
      identity: compact(object(rawBusinessProfile.identity), true),
      customer: compact(object(rawBusinessProfile.customer), true),
    };
    baselineProfile = {};
    packageAccount = packageAccount
      ? { id: packageAccount.id, name: packageAccount.name, domain: packageAccount.domain }
      : null;
    packageDeal = packageDeal
      ? {
          id: packageDeal.id,
          name: packageDeal.name,
          stage: packageDeal.stage,
          value: packageDeal.value,
        }
      : null;
    packageContacts = packageContacts.slice(0, 3).map((item) => ({
      id: item.id,
      first_name: item.first_name,
      last_name: item.last_name,
      email: item.email,
      status: item.status,
    }));
    structuredTokens = estimateTokens(JSON.stringify(structuredPayload()));
    omissions.push("structured_context_reduced_to_core_fields");
  }
  if (structuredTokens > tokenBudget) {
    businessProfile = {};
    baselineProfile = {};
    packageAccount = packageAccount
      ? { id: packageAccount.id, name: String(packageAccount.name ?? "").slice(0, 120) }
      : null;
    packageDeal = packageDeal
      ? {
          id: packageDeal.id,
          name: String(packageDeal.name ?? "").slice(0, 120),
          stage: packageDeal.stage,
        }
      : null;
    packageContacts = packageContacts.slice(0, 1).map((item) => ({
      id: item.id,
      first_name: String(item.first_name ?? "").slice(0, 60),
      last_name: String(item.last_name ?? "").slice(0, 60),
    }));
    packageFacts = [];
    packageActivity = [];
    packageCall = packageCall ? { id: packageCall.id, started_at: packageCall.started_at } : null;
    structuredTokens = estimateTokens(JSON.stringify(structuredPayload()));
    omissions.push("structured_context_reduced_to_identifiers");
  }
  const rankedHistory = rankAndBudgetEvidence(recentEvidence, tokenBudget, structuredTokens);
  const rankedSemantic = rankAndBudgetEvidence(
    semanticEvidence,
    Math.max(0, tokenBudget - structuredTokens - rankedHistory.tokenEstimate),
  );
  omissions.push(...rankedHistory.omitted, ...rankedSemantic.omitted);

  for (const evidence of [...rankedHistory.included, ...rankedSemantic.included]) {
    source(
      references,
      evidence.source_type,
      evidence.source_id ?? evidence.id,
      leadId ? { type: "lead", id: leadId } : undefined,
      evidence.occurred_at,
      "Retrieved evidence",
    );
  }

  const role = membership?.role ? String(membership.role) : request.userId ? null : "service";
  const canManage = role === "owner" || role === "admin" || role === "service";
  const entity: EntityRef | null = callId
    ? { type: "call", id: callId }
    : leadId
      ? { type: "lead", id: leadId }
      : contactId
        ? { type: "contact", id: contactId }
        : companyId
          ? { type: "company", id: companyId }
          : { type: "organization", id: request.organizationId };
  const contextVersion = Number(version?.version ?? businessContext?.version ?? 1);
  const tokenEstimate =
    structuredTokens + rankedHistory.tokenEstimate + rankedSemantic.tokenEstimate;

  const packageResult: ContextPackage = {
    package_version: CONTEXT_PACKAGE_VERSION,
    task: request.task,
    organization_id: request.organizationId,
    entity,
    business: {
      context_version:
        typeof businessContext?.version === "number" ? businessContext.version : null,
      profile: businessProfile,
      sales_baseline: baselineProfile,
      baseline_version: typeof baseline?.version === "number" ? baseline.version : null,
    },
    user: { id: request.userId ?? null, role },
    account: packageAccount,
    deal: packageDeal,
    contacts: packageContacts,
    current_state: { memory_facts: packageFacts, call: packageCall },
    recent_activity: packageActivity,
    relevant_history: rankedHistory.included,
    playbooks: array(baselineProfile.playbooks),
    rules: array(baselineProfile.rules),
    retrieved_evidence: rankedSemantic.included,
    permissions: {
      can_read: true,
      can_write: role !== null,
      can_manage_context: canManage,
    },
    receipt: {
      context_version: contextVersion,
      package_version: CONTEXT_PACKAGE_VERSION,
      generated_at: new Date().toISOString(),
      source_references: references,
      omissions: [...new Set(omissions)],
      token_estimate: tokenEstimate,
    },
  };

  if (request.persistReceipt !== false) {
    const { error } = await admin.from("context_package_runs").insert({
      organization_id: request.organizationId,
      requested_by: request.userId ?? null,
      task: request.task,
      entity_type: entity?.type ?? null,
      entity_id: entity?.id ?? null,
      context_version: contextVersion,
      source_references: references,
      omissions: packageResult.receipt.omissions,
      token_estimate: tokenEstimate,
      latency_ms: Date.now() - started,
    });
    if (error) console.error("[context-engine] receipt", error.message);
  }

  return packageResult;
}

export function renderContextPackageForPrompt(context: ContextPackage, maxChars = 16_000): string {
  const limit = Math.max(1000, maxChars);
  const promptContext: Record<string, unknown> = {
    package_version: context.package_version,
    organization_id: context.organization_id,
    business: context.business,
    account: context.account,
    deal: context.deal,
    contacts: context.contacts,
    current_state: context.current_state,
    recent_activity: context.recent_activity,
    relevant_history: context.relevant_history,
    playbooks: context.playbooks,
    rules: context.rules,
    context_receipt: context.receipt.source_references,
  };
  let serialized = JSON.stringify(promptContext);
  if (serialized.length <= limit) return serialized;

  const reduced = compactContextValue(promptContext, {
    maxStringChars: 300,
    maxArrayItems: 8,
    maxObjectKeys: 20,
    maxDepth: 5,
  }) as Record<string, unknown>;
  serialized = JSON.stringify(reduced);
  if (serialized.length <= limit) return serialized;

  const fallback = JSON.stringify({
    package_version: context.package_version,
    organization_id: context.organization_id,
    business: compactContextValue(context.business, {
      maxStringChars: 160,
      maxArrayItems: 3,
      maxObjectKeys: 10,
      maxDepth: 3,
    }),
    account: context.account
      ? { id: context.account.id, name: context.account.name, domain: context.account.domain }
      : null,
    deal: context.deal
      ? {
          id: context.deal.id,
          name: context.deal.name,
          stage: context.deal.stage,
          value: context.deal.value,
        }
      : null,
    contacts: context.contacts.slice(0, 2).map((contact) => ({
      id: contact.id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
    })),
    context_receipt: context.receipt.source_references.slice(0, 12),
    omissions: [...context.receipt.omissions, "prompt_context_reduced_for_character_budget"],
  });
  return fallback.length <= limit
    ? fallback
    : JSON.stringify({
        package_version: context.package_version,
        organization_id: context.organization_id,
        entity: context.entity,
        context_version: context.receipt.context_version,
        omissions: ["prompt_context_reduced_to_identity_only"],
      });
}
