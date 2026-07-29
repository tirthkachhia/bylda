// Bylda execution mode — shared action schema + executors.
// bylda-chat uses BYLDA_ACTION_TOOL to let Claude propose an action mid-conversation.
// bylda-action executes it after the founder approves, using one admin (service-role)
// client so every executor can write across tables regardless of caller RLS.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import { resolveCompany, resolveContact } from "./crmObjects.ts";

export type ByldaActionType =
  | "update_lead_stage"
  | "log_crm_note"
  | "create_task"
  | "create_contact"
  | "create_company"
  | "log_memory"
  | "trigger_n8n_workflow";

// Low-stakes actions execute on any affirmative reply; high-stakes ones always
// require an explicit confirm card, regardless of what the model claims.
export const HIGH_STAKES_ACTIONS: ReadonlySet<ByldaActionType> = new Set([
  "update_lead_stage",
  "trigger_n8n_workflow",
]);

export const BYLDA_ACTION_TOOL = {
  name: "propose_action",
  description:
    "Propose a concrete action in this founder's business after they approve it. Only call this when there is a specific, reversible action to take right now — not for general advice.",
  input_schema: {
    type: "object",
    properties: {
      action_type: {
        type: "string",
        enum: [
          "update_lead_stage",
          "log_crm_note",
          "create_task",
          "create_contact",
          "create_company",
          "log_memory",
          "trigger_n8n_workflow",
        ],
      },
      payload: {
        type: "object",
        description:
          "update_lead_stage: {lead_id, stage}. log_crm_note: {lead_id, note}. create_task: {title, description?, due_date?, priority?(low|medium|high), task_type?(task|call|email|follow_up|meeting), lead_id?, contact_id?}. create_contact: {first_name?, last_name?, email?, phone?, company?, domain?, source?, tags?}. create_company: {name?, domain?, website?, industry?, size?, location?}. log_memory: {category, content}. trigger_n8n_workflow: {integration_key, data}.",
      },
      plain_english: {
        type: "string",
        description: "One sentence telling the founder exactly what will happen if they approve.",
      },
    },
    required: ["action_type", "payload", "plain_english"],
  },
};

export interface ExecuteResult {
  ok: boolean;
  result?: Record<string, unknown>;
  error?: string;
}

const VALID_LEAD_STAGES = new Set(["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"]);

async function executeUpdateLeadStage(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
  payload: Record<string, unknown>,
): Promise<ExecuteResult> {
  const leadId = String(payload.lead_id ?? "");
  const stage = String(payload.stage ?? "");
  if (!leadId || !VALID_LEAD_STAGES.has(stage)) {
    return { ok: false, error: "Invalid lead_id or stage" };
  }

  const { data: lead, error: updErr } = await admin
    .from("leads")
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("organization_id", orgId)
    .select("id, name, stage")
    .maybeSingle();

  if (updErr || !lead) return { ok: false, error: updErr?.message ?? "Lead not found" };

  await admin.from("crm_activities").insert({
    organization_id: orgId,
    deal_id: leadId,
    user_id: userId,
    type: "stage_change",
    content: `Bylda moved this lead to ${stage}`,
    metadata: { source: "bylda_action" },
  });

  return { ok: true, result: lead };
}

async function executeLogCrmNote(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
  payload: Record<string, unknown>,
): Promise<ExecuteResult> {
  const leadId = String(payload.lead_id ?? "");
  const note = String(payload.note ?? "").trim();
  if (!leadId || !note) return { ok: false, error: "Invalid lead_id or note" };

  const { data: lead } = await admin
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!lead) return { ok: false, error: "Lead not found" };

  const { data, error } = await admin
    .from("crm_activities")
    .insert({
      organization_id: orgId,
      deal_id: leadId,
      user_id: userId,
      type: "note",
      content: note,
      metadata: { source: "bylda_action" },
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, result: { activity_id: data.id } };
}

const VALID_TASK_PRIORITY = new Set(["low", "medium", "high"]);
const VALID_TASK_TYPE = new Set(["task", "call", "email", "follow_up", "meeting"]);

async function executeCreateTask(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
  payload: Record<string, unknown>,
): Promise<ExecuteResult> {
  const title = String(payload.title ?? "").trim();
  if (!title) return { ok: false, error: "Missing task title" };
  const priority = VALID_TASK_PRIORITY.has(String(payload.priority))
    ? String(payload.priority)
    : "medium";
  const taskType = VALID_TASK_TYPE.has(String(payload.task_type))
    ? String(payload.task_type)
    : "task";

  const { data, error } = await admin
    .from("tasks")
    .insert({
      organization_id: orgId,
      created_by: userId,
      title,
      description: payload.description ? String(payload.description) : null,
      contact_id: payload.contact_id ? String(payload.contact_id) : null,
      lead_id: payload.lead_id ? String(payload.lead_id) : null,
      due_date: payload.due_date ? String(payload.due_date) : null,
      priority,
      task_type: taskType,
    })
    .select("id, title, status, due_date")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, result: data };
}

async function executeCreateContact(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
  payload: Record<string, unknown>,
): Promise<ExecuteResult> {
  const firstName = String(payload.first_name ?? "").trim();
  const lastName = String(payload.last_name ?? "").trim();
  const email = payload.email ? String(payload.email).trim() : null;
  if (!firstName && !lastName && !email) {
    return { ok: false, error: "Provide at least a name or email" };
  }
  try {
    // Match-or-create the company so the contact links to a single account.
    let companyId: string | null = null;
    if (payload.company || payload.domain || payload.website) {
      const company = await resolveCompany(admin, orgId, {
        name: payload.company,
        domain: payload.domain,
        website: payload.website,
      });
      companyId = company?.id ?? null;
    }
    // contacts is user-owned (user_id NOT NULL) — the founder who approved owns
    // any newly created contact; an existing match is reused (deduped).
    const contact = await resolveContact(admin, orgId, userId, {
      first_name: firstName,
      last_name: lastName,
      email,
      phone: payload.phone,
      company: payload.company,
      source: payload.source ?? "bylda",
      tags: payload.tags,
      company_id: companyId,
    });
    if (!contact) return { ok: false, error: "Provide at least a name or email" };
    return {
      ok: true,
      result: { id: contact.id, created: contact.created, company_id: companyId },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create contact" };
  }
}

async function executeCreateCompany(
  admin: SupabaseClient,
  orgId: string,
  payload: Record<string, unknown>,
): Promise<ExecuteResult> {
  const name = String(payload.name ?? "").trim();
  if (!name && !payload.domain && !payload.website) {
    return { ok: false, error: "Provide a company name or domain" };
  }
  try {
    const company = await resolveCompany(admin, orgId, {
      name,
      domain: payload.domain,
      website: payload.website,
      industry: payload.industry,
      size: payload.size,
      location: payload.location,
    });
    if (!company) return { ok: false, error: "Provide a company name or domain" };
    return { ok: true, result: { id: company.id, name: company.name, created: company.created } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create company" };
  }
}

const VALID_MEMORY_CATEGORIES = new Set([
  "business_context",
  "goal",
  "pain_point",
  "win",
  "product",
  "customer",
  "team",
  "preference",
  "risk",
]);

async function executeLogMemory(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
  payload: Record<string, unknown>,
): Promise<ExecuteResult> {
  const category = String(payload.category ?? "business_context");
  const content = String(payload.content ?? "").trim();
  if (!content) return { ok: false, error: "Missing content" };
  const safeCategory = VALID_MEMORY_CATEGORIES.has(category) ? category : "business_context";

  const { data, error } = await admin
    .from("memory_artifacts")
    .insert({
      org_id: orgId,
      user_id: userId,
      source_type: "bylda",
      source_label: safeCategory,
      title: `Bylda memory: ${content.slice(0, 80)}`,
      content,
      content_preview: content.slice(0, 500),
      status: "indexed",
      metadata: { source: "bylda_action", category: safeCategory },
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, result: { artifact_id: data.id } };
}

async function executeTriggerN8nWorkflow(
  admin: SupabaseClient,
  userId: string,
  payload: Record<string, unknown>,
  encryptionKey: string | undefined,
): Promise<ExecuteResult> {
  const integrationKey = String(payload.integration_key ?? "n8n");
  if (!encryptionKey) return { ok: false, error: "Integration storage is not configured" };

  const { data: webhookUrl, error: rpcErr } = await admin.rpc("get_user_integration_secret", {
    p_user_id: userId,
    p_integration_key: integrationKey,
    p_encryption_key: encryptionKey,
  });
  if (rpcErr || !webhookUrl) {
    return { ok: false, error: `No connected ${integrationKey} webhook for this user` };
  }

  const res = await fetch(webhookUrl as string, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload.data ?? {}),
  });
  if (!res.ok) return { ok: false, error: `Webhook returned HTTP ${res.status}` };

  return { ok: true, result: { triggered: true, integration_key: integrationKey } };
}

export async function executeByldaAction(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
  actionType: ByldaActionType,
  payload: Record<string, unknown>,
): Promise<ExecuteResult> {
  switch (actionType) {
    case "update_lead_stage":
      return executeUpdateLeadStage(admin, orgId, userId, payload);
    case "log_crm_note":
      return executeLogCrmNote(admin, orgId, userId, payload);
    case "create_task":
      return executeCreateTask(admin, orgId, userId, payload);
    case "create_contact":
      return executeCreateContact(admin, orgId, userId, payload);
    case "create_company":
      return executeCreateCompany(admin, orgId, payload);
    case "log_memory":
      return executeLogMemory(admin, orgId, userId, payload);
    case "trigger_n8n_workflow":
      return executeTriggerN8nWorkflow(
        admin,
        userId,
        payload,
        Deno.env.get("INTEGRATIONS_ENCRYPTION_KEY"),
      );
    default:
      return { ok: false, error: `Unknown action_type: ${actionType}` };
  }
}
