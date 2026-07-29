// crm-action — executes Bylda AI CRM commands directly (stage updates, note
// logging, task creation, and create-or-match of contacts, companies and leads).
// create_lead wires the deal to a deduped contact + company and logs a 'created'
// activity, so the CRM graph stays coherent from a single entry point. The
// caller's org membership is verified, then writes happen with the service-role
// client so they succeed across CRM tables. Object resolution lives in the
// shared _shared/crmObjects.ts helper. Self-contained otherwise.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import { resolveCompany, resolveContact, logLeadActivity } from "../_shared/crmObjects.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const VALID_STAGES = new Set(["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"]);
const VALID_PRIORITY = new Set(["low", "medium", "high"]);
const VALID_TASK_TYPE = new Set(["task", "call", "email", "follow_up", "meeting"]);

type Result = { ok: boolean; result?: Record<string, unknown>; error?: string };

async function updateStage(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
  p: Record<string, unknown>,
): Promise<Result> {
  const leadId = String(p.lead_id ?? "");
  const stage = String(p.stage ?? "");
  if (!leadId || !VALID_STAGES.has(stage)) return { ok: false, error: "Invalid lead_id or stage" };
  const { data: lead, error } = await admin
    .from("leads")
    .update({
      stage,
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", leadId)
    .eq("organization_id", orgId)
    .select("id, name, stage")
    .maybeSingle();
  if (error || !lead) return { ok: false, error: error?.message ?? "Lead not found" };
  await logLeadActivity(
    admin,
    orgId,
    userId,
    leadId,
    "stage_change",
    `Bylda moved this lead to ${stage}`,
    {
      source: "crm_action",
    },
  );
  return { ok: true, result: lead };
}

async function logNote(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
  p: Record<string, unknown>,
): Promise<Result> {
  const leadId = String(p.lead_id ?? "");
  const note = String(p.note ?? "").trim();
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
      metadata: { source: "crm_action" },
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await admin
    .from("leads")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("organization_id", orgId);
  return { ok: true, result: { activity_id: data.id } };
}

async function createTask(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
  p: Record<string, unknown>,
): Promise<Result> {
  const title = String(p.title ?? "").trim();
  if (!title) return { ok: false, error: "Missing task title" };
  const priority = VALID_PRIORITY.has(String(p.priority)) ? String(p.priority) : "medium";
  const taskType = VALID_TASK_TYPE.has(String(p.task_type)) ? String(p.task_type) : "task";
  const { data, error } = await admin
    .from("tasks")
    .insert({
      organization_id: orgId,
      created_by: userId,
      title,
      description: p.description ? String(p.description) : null,
      contact_id: p.contact_id ? String(p.contact_id) : null,
      lead_id: p.lead_id ? String(p.lead_id) : null,
      assigned_to: p.assigned_to ? String(p.assigned_to) : null,
      due_date: p.due_date ? String(p.due_date) : null,
      priority,
      task_type: taskType,
    })
    .select("id, title, status, due_date")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, result: data };
}

async function createContact(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
  p: Record<string, unknown>,
): Promise<Result> {
  const firstName = String(p.first_name ?? "").trim();
  const lastName = String(p.last_name ?? "").trim();
  const email = p.email ? String(p.email).trim() : null;
  if (!firstName && !lastName && !email) {
    return { ok: false, error: "Provide at least a name or email" };
  }
  try {
    // Match-or-create the company first so the contact can be linked to it.
    let companyId: string | null = null;
    if (p.company || p.domain || p.website) {
      const company = await resolveCompany(admin, orgId, {
        name: p.company,
        domain: p.domain,
        website: p.website,
      });
      companyId = company?.id ?? null;
    }
    // Dedupe by email/name, backfilling the company link on an existing record.
    const contact = await resolveContact(admin, orgId, userId, {
      first_name: firstName,
      last_name: lastName,
      email,
      phone: p.phone,
      company: p.company,
      source: p.source ?? "bylda",
      tags: p.tags,
      company_id: companyId,
    });
    if (!contact) return { ok: false, error: "Provide at least a name or email" };
    // bylda_events "contact.created" is emitted by the AFTER INSERT trigger on
    // public.contacts, which fires for the resolveContact insert path too.
    return {
      ok: true,
      result: { id: contact.id, created: contact.created, company_id: companyId },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create contact" };
  }
}

async function createCompany(
  admin: SupabaseClient,
  orgId: string,
  p: Record<string, unknown>,
): Promise<Result> {
  const name = String(p.name ?? "").trim();
  const domain = p.domain ?? p.website;
  if (!name && !domain) {
    return { ok: false, error: "Provide a company name or domain" };
  }
  try {
    const company = await resolveCompany(admin, orgId, {
      name,
      domain: p.domain,
      website: p.website,
      industry: p.industry,
      size: p.size,
      location: p.location,
    });
    if (!company) return { ok: false, error: "Provide a company name or domain" };
    return { ok: true, result: { id: company.id, name: company.name, created: company.created } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create company" };
  }
}

async function createLead(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
  p: Record<string, unknown>,
): Promise<Result> {
  const name = String(p.name ?? "").trim();
  if (!name) return { ok: false, error: "Missing lead name" };
  const stage = VALID_STAGES.has(String(p.stage)) ? String(p.stage) : "New";
  try {
    // 1. Match-or-create the company from any account signal on the payload.
    let companyId: string | null = null;
    if (p.company || p.domain || p.website) {
      const company = await resolveCompany(admin, orgId, {
        name: p.company,
        domain: p.domain,
        website: p.website,
      });
      companyId = company?.id ?? null;
    }

    // 2. Match-or-create the contact (person) behind this lead and link company.
    let contactId: string | null = null;
    const hasPerson = p.contact_first_name || p.contact_last_name || p.email;
    if (hasPerson) {
      const contact = await resolveContact(admin, orgId, userId, {
        first_name: p.contact_first_name,
        last_name: p.contact_last_name,
        email: p.email,
        phone: p.phone,
        company: p.company,
        source: p.source ?? "crm",
        company_id: companyId,
      });
      contactId = contact?.id ?? null;
    }

    // 3. Insert the lead wired to both objects.
    const { data: lead, error } = await admin
      .from("leads")
      .insert({
        organization_id: orgId,
        user_id: userId,
        name,
        email: p.email ? String(p.email) : null,
        phone: p.phone ? String(p.phone) : null,
        company: p.company ? String(p.company) : null,
        stage,
        source: p.source ? String(p.source) : "crm",
        notes: p.notes ? String(p.notes).slice(0, 2000) : null,
        value: typeof p.value === "number" ? p.value : null,
        contact_id: contactId,
        company_id: companyId,
        last_activity_at: new Date().toISOString(),
      })
      .select("id, name, stage, contact_id, company_id")
      .single();
    if (error || !lead) return { ok: false, error: error?.message ?? "Failed to create lead" };

    // 4. Log the create event on the CRM timeline.
    await logLeadActivity(
      admin,
      orgId,
      userId,
      lead.id as string,
      "created",
      `Deal created: ${name}`,
      {
        source: "crm_action",
        contact_id: contactId,
        company_id: companyId,
      },
    );

    return { ok: true, result: lead };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create lead" };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing auth" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  let body: { action?: string; org_id?: string; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const action = body.action ?? "";
  const payload = body.payload ?? {};

  // Resolve + verify org membership.
  let orgId = body.org_id ?? null;
  if (orgId) {
    const { data: m } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!m) return json({ error: "Forbidden" }, 403);
  } else {
    const { data: m } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!m) return json({ error: "No organization" }, 403);
    orgId = m.organization_id as string;
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Server not configured" }, 503);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  let res: Result;
  switch (action) {
    case "update_stage":
      res = await updateStage(admin, orgId, user.id, payload);
      break;
    case "log_note":
      res = await logNote(admin, orgId, user.id, payload);
      break;
    case "create_task":
      res = await createTask(admin, orgId, user.id, payload);
      break;
    case "create_contact":
      res = await createContact(admin, orgId, user.id, payload);
      break;
    case "create_company":
      res = await createCompany(admin, orgId, payload);
      break;
    case "create_lead":
      res = await createLead(admin, orgId, user.id, payload);
      break;
    default:
      return json({ error: `Unknown action: ${action}` }, 400);
  }

  if (!res.ok) return json({ error: res.error }, 400);

  // Best-effort audit row for the supported enum actions.
  if (action === "update_stage" || action === "log_note") {
    await admin
      .from("bylda_actions")
      .insert({
        organization_id: orgId,
        user_id: user.id,
        action_type: action === "update_stage" ? "update_lead_stage" : "log_crm_note",
        payload,
        plain_english: action === "update_stage" ? "Updated lead stage" : "Logged a CRM note",
        confirmation_required: false,
        status: "executed",
        result: res.result ?? {},
        executed_at: new Date().toISOString(),
      })
      .then(
        () => {},
        () => {},
      );
  }

  return json({ ok: true, action, result: res.result });
});
