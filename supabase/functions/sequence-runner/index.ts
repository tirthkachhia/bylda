// sequence-runner — advances due sequence enrollments one step at a time.
// For each active enrollment whose next_run_at has passed, it executes the
// current step (email / sms / whatsapp via the send-* functions, or a call/task
// row, or an internal note), records the touch on the conversations timeline,
// and schedules the next step (or completes the enrollment).
//
// Auth: internal cron (service-role bearer + internal:true) processes every
// org; an authenticated user processes only their own org. Personalization is
// deterministic {{first_name}}-style variable substitution from the contact;
// AI drafting can layer on top later.
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

const MAX_PER_RUN = 100;

type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
};

function personalize(text: string | null, c: Contact | null): string {
  if (!text) return "";
  if (!c) return text;
  return text
    .replace(/\{\{\s*first_name\s*\}\}/gi, c.first_name ?? "there")
    .replace(/\{\{\s*last_name\s*\}\}/gi, c.last_name ?? "")
    .replace(/\{\{\s*email\s*\}\}/gi, c.email ?? "")
    .replace(/\{\{\s*company\s*\}\}/gi, c.company ?? "");
}

async function callSendFn(fn: string, payload: Record<string, unknown>): Promise<void> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ internal: true, ...payload }),
  }).catch(() => {
    /* provider hiccups must not stall the whole run */
  });
}

async function processEnrollment(
  admin: SupabaseClient,
  enr: {
    id: string;
    sequence_id: string;
    organization_id: string;
    contact_id: string;
    lead_id: string | null;
    current_step: number;
    enrolled_by: string | null;
  },
): Promise<"advanced" | "completed" | "skipped"> {
  // Sequence must still be active.
  const { data: seq } = await admin
    .from("sequences")
    .select("id, status")
    .eq("id", enr.sequence_id)
    .maybeSingle();
  if (!seq || seq.status !== "active") return "skipped";

  const { data: steps } = await admin
    .from("sequence_steps")
    .select("id, step_order, channel, delay_hours, subject, body, template_id")
    .eq("sequence_id", enr.sequence_id)
    .order("step_order", { ascending: true });
  const ordered = steps ?? [];

  if (enr.current_step >= ordered.length) {
    await admin
      .from("sequence_enrollments")
      .update({ status: "completed", next_run_at: null })
      .eq("id", enr.id);
    return "completed";
  }

  const step = ordered[enr.current_step];
  const { data: contact } = await admin
    .from("contacts")
    .select("id, first_name, last_name, email, company")
    .eq("id", enr.contact_id)
    .maybeSingle();
  const c = (contact as Contact) ?? null;

  const subject = personalize(step.subject, c);
  const bodyText = personalize(step.body, c);

  // Execute the step by channel.
  if (step.channel === "email") {
    await callSendFn("send-email", {
      org_id: enr.organization_id,
      contact_id: enr.contact_id,
      subject,
      body: bodyText,
    });
  } else if (step.channel === "sms" || step.channel === "whatsapp") {
    await callSendFn("send-sms", {
      org_id: enr.organization_id,
      contact_id: enr.contact_id,
      body: bodyText,
    });
  } else if (step.channel === "call" || step.channel === "task") {
    await admin.from("tasks").insert({
      organization_id: enr.organization_id,
      contact_id: enr.contact_id,
      lead_id: enr.lead_id,
      assigned_to: enr.enrolled_by,
      created_by: enr.enrolled_by,
      title: subject || (step.channel === "call" ? "Sequence call" : "Sequence task"),
      description: bodyText || null,
      task_type: step.channel === "call" ? "call" : "task",
      due_date: new Date().toISOString(),
    });
  }

  // Record the touch on the unified timeline (skip pure task/call rows).
  if (step.channel !== "call" && step.channel !== "task") {
    await admin.from("conversations").insert({
      organization_id: enr.organization_id,
      contact_id: enr.contact_id,
      lead_id: enr.lead_id,
      channel: step.channel === "whatsapp" ? "whatsapp" : step.channel,
      direction: "outbound",
      subject: subject || null,
      body: bodyText || "(sequence step)",
      status: "read",
      sent_at: new Date().toISOString(),
      sequence_enrollment_id: enr.id,
      metadata: { source: "sequence", sequence_id: enr.sequence_id, step_order: step.step_order },
    });
  }

  // Advance to the next step, or complete.
  const nextIndex = enr.current_step + 1;
  if (nextIndex >= ordered.length) {
    await admin
      .from("sequence_enrollments")
      .update({ current_step: nextIndex, status: "completed", next_run_at: null })
      .eq("id", enr.id);
    return "completed";
  }
  const nextDelayH = ordered[nextIndex].delay_hours ?? 24;
  const nextRun = new Date(Date.now() + nextDelayH * 3600_000).toISOString();
  await admin
    .from("sequence_enrollments")
    .update({ current_step: nextIndex, next_run_at: nextRun })
    .eq("id", enr.id);
  return "advanced";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Server not configured" }, 503);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  let body: { internal?: boolean; org_id?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const internal = body.internal === true && token === serviceKey;
  let orgId: string | null = body.org_id ?? null;

  if (!internal) {
    if (!authHeader) return json({ error: "Missing auth" }, 401);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
      error,
    } = await userClient.auth.getUser();
    if (error || !user) return json({ error: "Unauthorized" }, 401);
    // Non-internal callers may only run their own org.
    const { data: m } = await userClient
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    const orgs = (m ?? []).map((r) => r.organization_id as string);
    if (orgId && !orgs.includes(orgId)) return json({ error: "Forbidden" }, 403);
    if (!orgId) orgId = orgs[0] ?? null;
    if (!orgId) return json({ error: "No organization" }, 403);
  }

  // Fetch due enrollments (scoped to org for user calls; global for cron).
  let q = admin
    .from("sequence_enrollments")
    .select("id, sequence_id, organization_id, contact_id, lead_id, current_step, enrolled_by")
    .eq("status", "active")
    .lte("next_run_at", new Date().toISOString())
    .order("next_run_at", { ascending: true })
    .limit(MAX_PER_RUN);
  if (orgId) q = q.eq("organization_id", orgId);

  const { data: due, error: dueErr } = await q;
  if (dueErr) return json({ error: dueErr.message }, 500);

  let advanced = 0;
  let completed = 0;
  let skipped = 0;
  for (const enr of due ?? []) {
    try {
      const r = await processEnrollment(admin, enr);
      if (r === "advanced") advanced++;
      else if (r === "completed") completed++;
      else skipped++;
    } catch {
      skipped++;
    }
  }

  return json({ ok: true, processed: (due ?? []).length, advanced, completed, skipped });
});
