// workflow-engine — evaluates automation triggers and executes workflow steps.
//
// Two entry shapes:
//   { workflow_id, contact_id?, trigger_payload?, mode? }  → run one workflow
//   { event, org_id?, contact_id?, payload?, mode? }        → run every active
//        workflow whose trigger_type matches `event`
//
// mode: "live" actually performs side effects (tags, stage moves, tasks,
// webhooks); "test" (default) walks the steps and records a trace without
// sending messages or firing webhooks. Each run is recorded in
// automation_workflow_runs. Self-contained single file.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

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

const MAX_STEPS = 50;
const VALID_STAGES = new Set(["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"]);
const CONTACT_FIELDS = new Set([
  "status",
  "source",
  "company",
  "phone",
  "lead_score",
  "lead_value",
  "assigned_to",
  "do_not_contact",
  "opted_out_sms",
]);

type Step = { type?: string; config?: Record<string, unknown>; [k: string]: unknown };
type TraceEntry = Record<string, unknown>;

function render(template: string, contact: Record<string, unknown> | null): string {
  if (!template || !contact) return template;
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => {
    const v = contact[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

function evalCondition(
  cond: Record<string, unknown>,
  contact: Record<string, unknown> | null,
): boolean {
  if (!contact) return false;
  const field = String(cond.field ?? "");
  const op = String(cond.operator ?? "equals");
  const target = cond.value;
  const actual = contact[field];
  switch (op) {
    case "equals":
      return String(actual ?? "") === String(target ?? "");
    case "not_equals":
      return String(actual ?? "") !== String(target ?? "");
    case "contains":
      if (Array.isArray(actual)) return actual.map(String).includes(String(target));
      return String(actual ?? "").includes(String(target ?? ""));
    case "gt":
      return Number(actual) > Number(target);
    case "lt":
      return Number(actual) < Number(target);
    case "exists":
      return actual !== undefined && actual !== null && actual !== "";
    default:
      return false;
  }
}

async function executeSteps(
  steps: Step[],
  ctx: {
    admin: SupabaseClient;
    orgId: string;
    contactId: string | null;
    contact: Record<string, unknown> | null;
    live: boolean;
  },
  trace: TraceEntry[],
  budget: { n: number },
): Promise<"completed" | "stopped"> {
  for (const step of steps) {
    if (budget.n >= MAX_STEPS) {
      trace.push({ type: "limit", note: `step budget (${MAX_STEPS}) exhausted` });
      return "stopped";
    }
    budget.n++;
    const type = String(step.type ?? "");
    const cfg = (step.config ?? step) as Record<string, unknown>;
    const entry: TraceEntry = { type, executed: ctx.live };

    try {
      switch (type) {
        case "add_tag":
        case "remove_tag": {
          const tag = String(cfg.tag ?? "");
          entry.tag = tag;
          if (ctx.live && ctx.contactId && tag) {
            const current = Array.isArray(ctx.contact?.tags) ? (ctx.contact!.tags as string[]) : [];
            const next =
              type === "add_tag"
                ? Array.from(new Set([...current, tag]))
                : current.filter((t) => t !== tag);
            await ctx.admin.from("contacts").update({ tags: next }).eq("id", ctx.contactId);
            if (ctx.contact) ctx.contact.tags = next;
          }
          break;
        }
        case "update_contact_field": {
          const field = String(cfg.field ?? "");
          entry.field = field;
          entry.value = cfg.value;
          if (ctx.live && ctx.contactId && CONTACT_FIELDS.has(field)) {
            await ctx.admin
              .from("contacts")
              .update({ [field]: cfg.value })
              .eq("id", ctx.contactId);
            if (ctx.contact) ctx.contact[field] = cfg.value;
          } else if (!CONTACT_FIELDS.has(field)) {
            entry.skipped = "field not allowed";
          }
          break;
        }
        case "move_to_stage":
        case "move_stage": {
          const stage = String(cfg.stage ?? "");
          entry.stage = stage;
          if (!VALID_STAGES.has(stage)) {
            entry.skipped = "invalid stage";
            break;
          }
          if (ctx.live) {
            // Prefer an explicit lead_id, else the contact's most recent lead.
            let leadId = cfg.lead_id ? String(cfg.lead_id) : null;
            if (!leadId && ctx.contactId) {
              const { data: lead } = await ctx.admin
                .from("leads")
                .select("id")
                .eq("organization_id", ctx.orgId)
                .eq("contact_id", ctx.contactId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              leadId = lead?.id ?? null;
            }
            if (leadId) {
              await ctx.admin
                .from("leads")
                .update({ stage, last_activity_at: new Date().toISOString() })
                .eq("id", leadId)
                .eq("organization_id", ctx.orgId);
              entry.lead_id = leadId;
            } else {
              entry.skipped = "no lead to move";
            }
          }
          break;
        }
        case "create_task": {
          const title = render(String(cfg.title ?? "Task"), ctx.contact);
          entry.title = title;
          if (ctx.live) {
            const { data } = await ctx.admin
              .from("tasks")
              .insert({
                organization_id: ctx.orgId,
                contact_id: ctx.contactId,
                title,
                description: cfg.description ? String(cfg.description) : null,
                task_type: ["task", "call", "email", "follow_up", "meeting"].includes(
                  String(cfg.task_type),
                )
                  ? String(cfg.task_type)
                  : "task",
                priority: ["low", "medium", "high"].includes(String(cfg.priority))
                  ? String(cfg.priority)
                  : "medium",
              })
              .select("id")
              .single();
            entry.task_id = data?.id ?? null;
          }
          break;
        }
        case "assign_to": {
          const assignee = cfg.user_id ? String(cfg.user_id) : null;
          entry.assigned_to = assignee;
          if (ctx.live && ctx.contactId && assignee) {
            await ctx.admin
              .from("contacts")
              .update({ assigned_to: assignee })
              .eq("id", ctx.contactId);
          }
          break;
        }
        case "send_email":
        case "send_sms":
        case "send_internal_notification": {
          entry.channel = type === "send_sms" ? "sms" : "email";
          entry.subject = cfg.subject ? render(String(cfg.subject), ctx.contact) : undefined;
          entry.body = render(String(cfg.body ?? cfg.message ?? ""), ctx.contact).slice(0, 2000);
          // Live email/SMS route through the native delivery functions, which
          // no-op gracefully when no provider is configured (delivery:"skipped").
          if (ctx.live && (type === "send_email" || type === "send_sms")) {
            try {
              const fn = type === "send_email" ? "send-email" : "send-sms";
              const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/${fn}`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({
                  internal: true,
                  org_id: ctx.orgId,
                  contact_id: ctx.contactId,
                  subject: entry.subject,
                  body: entry.body,
                }),
              });
              const out = await res.json().catch(() => ({}));
              entry.delivery = res.ok ? (out.sent ? "sent" : "skipped") : "failed";
            } catch (e) {
              entry.delivery = "failed";
              entry.error = e instanceof Error ? e.message : String(e);
            }
          } else {
            entry.delivery = "simulated";
          }
          break;
        }
        case "wait": {
          // A single invocation cannot truly sleep; the delay is recorded and
          // the engine continues. A scheduler can split waits into resumes.
          entry.duration = cfg.duration ?? cfg.delay ?? null;
          entry.unit = cfg.unit ?? null;
          entry.note = "recorded; engine continues synchronously";
          break;
        }
        case "branch":
        case "if_else": {
          const cond = (cfg.condition ?? {}) as Record<string, unknown>;
          const result = evalCondition(cond, ctx.contact);
          entry.condition = cond;
          entry.result = result;
          trace.push(entry);
          const branchSteps = (result ? cfg.then : cfg.else) as Step[] | undefined;
          if (Array.isArray(branchSteps) && branchSteps.length > 0) {
            const outcome = await executeSteps(branchSteps, ctx, trace, budget);
            if (outcome === "stopped") return "stopped";
          }
          continue; // entry already pushed
        }
        case "webhook": {
          const url = String(cfg.url ?? "");
          entry.url = url;
          if (ctx.live && url) {
            try {
              const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cfg.payload ?? { contact_id: ctx.contactId }),
              });
              entry.status = res.status;
            } catch (e) {
              entry.error = e instanceof Error ? e.message : String(e);
            }
          }
          break;
        }
        case "end_workflow":
        case "end":
          trace.push({ type: "end" });
          return "completed";
        default:
          entry.skipped = `unknown step type`;
      }
    } catch (e) {
      entry.error = e instanceof Error ? e.message : String(e);
    }
    trace.push(entry);
  }
  return "completed";
}

async function runWorkflow(
  admin: SupabaseClient,
  workflow: {
    id: string;
    organization_id: string;
    name: string;
    trigger_type: string;
    steps: unknown;
  },
  contactId: string | null,
  live: boolean,
): Promise<Record<string, unknown>> {
  const t0 = Date.now();
  const steps: Step[] = Array.isArray(workflow.steps) ? (workflow.steps as Step[]) : [];

  // Load the contact (contacts uses org_id) for merge fields + conditions.
  let contact: Record<string, unknown> | null = null;
  if (contactId) {
    const { data } = await admin
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .eq("org_id", workflow.organization_id)
      .maybeSingle();
    contact = data ?? null;
  }

  const { data: runRow } = await admin
    .from("automation_workflow_runs")
    .insert({
      organization_id: workflow.organization_id,
      workflow_name: workflow.name,
      trigger_type: workflow.trigger_type,
      contact_id: contactId,
      mode: live ? "live" : "test",
      status: "running",
      steps_total: steps.length,
    })
    .select("id")
    .single();

  const trace: TraceEntry[] = [];
  const budget = { n: 0 };
  let status = "completed";
  let errorMsg: string | null = null;
  try {
    await executeSteps(
      steps,
      { admin, orgId: workflow.organization_id, contactId, contact, live },
      trace,
      budget,
    );
  } catch (e) {
    status = "failed";
    errorMsg = e instanceof Error ? e.message : String(e);
  }

  const duration = Date.now() - t0;
  if (runRow?.id) {
    await admin
      .from("automation_workflow_runs")
      .update({
        status,
        steps_completed: budget.n,
        trace,
        error: errorMsg,
        duration_ms: duration,
        updated_at: new Date().toISOString(),
      })
      .eq("id", runRow.id);
  }

  // Bump workflow counters only on a real (live) execution.
  if (live) {
    await admin
      .from("automation_workflows")
      .update({
        run_count: ((workflow as { run_count?: number }).run_count ?? 0) + 1,
        last_triggered_at: new Date().toISOString(),
      })
      .eq("id", workflow.id);
  }

  return {
    workflow_id: workflow.id,
    run_id: runRow?.id ?? null,
    status,
    steps_completed: budget.n,
    steps_total: steps.length,
    trace,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Server not configured" }, 503);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  let body: {
    workflow_id?: string;
    event?: string;
    org_id?: string;
    contact_id?: string;
    trigger_payload?: Record<string, unknown>;
    payload?: Record<string, unknown>;
    mode?: string;
    internal?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // Internal service path: automation-dispatch (and other service callers) invoke
  // with the service-role bearer + internal:true to fire workflows autonomously,
  // bypassing the per-user RLS/membership checks below.
  const internal = body.internal === true && token === serviceKey;

  // User-scoped client for the interactive (UI) path.
  let userId: string | null = null;
  let userClient = null as ReturnType<typeof createClient> | null;
  if (!internal) {
    if (!authHeader) return json({ error: "Missing auth" }, 401);
    userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error: authErr } = await userClient.auth.getUser();
    if (authErr || !data?.user) return json({ error: "Unauthorized" }, 401);
    userId = data.user.id;
  }

  const live = internal ? body.mode !== "test" : body.mode === "live";
  const contactId = body.contact_id ?? null;

  // ── Run a single workflow by id ──
  if (body.workflow_id) {
    // Internal: load via service role. UI: load via RLS-scoped client.
    const reader = internal ? admin : userClient!;
    const { data: wf } = await reader
      .from("automation_workflows")
      .select("id, organization_id, name, trigger_type, steps, run_count")
      .eq("id", body.workflow_id)
      .maybeSingle();
    if (!wf) return json({ error: "Workflow not found" }, 404);
    const result = await runWorkflow(admin, wf, contactId, live);
    return json({ ran: 1, results: [result] });
  }

  // ── Fan out by event to all active matching workflows ──
  if (body.event) {
    let orgId = body.org_id ?? null;
    if (internal) {
      if (!orgId) return json({ error: "org_id required for internal event dispatch" }, 400);
    } else if (orgId) {
      const { data: m } = await userClient!
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", userId)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (!m) return json({ error: "Forbidden" }, 403);
    } else {
      const { data: m } = await userClient!
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!m) return json({ error: "No organization" }, 403);
      orgId = m.organization_id as string;
    }

    const { data: workflows } = await admin
      .from("automation_workflows")
      .select("id, organization_id, name, trigger_type, steps, run_count")
      .eq("organization_id", orgId)
      .eq("trigger_type", body.event)
      .eq("is_active", true);

    const list = workflows ?? [];
    const results = [];
    for (const wf of list) {
      results.push(await runWorkflow(admin, wf, contactId, live));
    }
    return json({ ran: results.length, results });
  }

  return json({ error: "Provide workflow_id or event" }, 400);
});
