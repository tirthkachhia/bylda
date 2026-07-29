// automation-dispatch — drains the automation_events queue and fires every
// matching live automation. Invoked two ways:
//   • pg_cron (service-role bearer) → drains every org's queue, once a minute;
//   • an authenticated org member (app nudge) → drains only their own org(s),
//     so activated automations fire in near-real-time without waiting on cron.
//
// For each pending event it finds the org's active_automations whose entry
// trigger matches the event, then invokes run-workflow (internal/service path)
// to execute each one live. No execution logic is duplicated here.
//
// The same per-minute pass also runs trigger_schedule automations: un-armed
// rows (next_run_at null) get armed without firing, due rows are claimed
// optimistically and fired once. See the scheduled_automations migration.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { parseSchedule, nextRunAfter } from "../_shared/schedule.ts";

// event name → builder trigger block types that it fires
const TRIGGERS_FOR_EVENT: Record<string, string[]> = {
  "contact.created": ["trigger_new_lead", "trigger_contact_created"],
  "tag.added": ["trigger_tag_added"],
  "payment.received": ["trigger_payment"],
};

// dotted event → automation_workflows.trigger_type (visual workflow engine)
const WORKFLOW_TRIGGER_FOR_EVENT: Record<string, string> = {
  "contact.created": "contact_created",
  "tag.added": "contact_tagged",
  "payment.received": "payment_received",
  "lead.stage_changed": "lead_stage_changed",
  "form.submitted": "form_submitted",
  "appointment.booked": "appointment_booked",
  "appointment.cancelled": "appointment_cancelled",
  "appointment.no_show": "appointment_no_show",
  "message.received": "message_received",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

interface EventRow {
  id: string;
  organization_id: string;
  event_type: string;
  contact_id: string | null;
}
interface ActiveRow {
  id: string;
  template_id: string;
  trigger_type: string;
  created_by: string | null;
}

interface ScheduledRow {
  id: string;
  organization_id: string;
  template_id: string;
  created_by: string | null;
  next_run_at: string | null;
  automation_templates: {
    blocks: Array<{ type?: string; config?: Record<string, string> }> | null;
  } | null;
}

/**
 * Arm and fire schedule-triggered automations. Un-armed rows (next_run_at
 * null) are set to their next occurrence without firing; due rows are claimed
 * with an update guarded on the previous next_run_at value, so concurrent
 * drains fire each occurrence exactly once. Custom/unparseable schedules stay
 * un-armed — the app tells the user they can't auto-run yet.
 */
async function processScheduledAutomations(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  orgFilter: string[] | null,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<number> {
  let query = admin
    .from("active_automations")
    .select(
      "id, organization_id, template_id, created_by, next_run_at, automation_templates(blocks)",
    )
    .eq("trigger_type", "trigger_schedule")
    .eq("is_active", true);
  if (orgFilter) query = query.in("organization_id", orgFilter);
  const { data } = await query;
  const rows = (data ?? []) as ScheduledRow[];
  if (rows.length === 0) return 0;

  const now = new Date();
  let fired = 0;

  for (const row of rows) {
    try {
      const blocks = row.automation_templates?.blocks ?? [];
      const raw = blocks.find((b) => b.type === "trigger_schedule")?.config?.schedule;
      const kind = parseSchedule(raw);
      if (!kind) continue;
      const next = nextRunAfter(kind, now).toISOString();

      if (!row.next_run_at) {
        // First pass after activation — arm without firing.
        await admin
          .from("active_automations")
          .update({ next_run_at: next })
          .eq("id", row.id)
          .is("next_run_at", null);
        continue;
      }
      if (new Date(row.next_run_at).getTime() > now.getTime()) continue;
      if (!row.created_by) continue; // need an owner to run as

      // Due — claim by advancing next_run_at only if nobody else already has.
      const { data: claimed } = await admin
        .from("active_automations")
        .update({ next_run_at: next })
        .eq("id", row.id)
        .eq("next_run_at", row.next_run_at)
        .select("id");
      if (!claimed || claimed.length === 0) continue;

      const res = await fetch(`${supabaseUrl}/functions/v1/run-workflow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          internal: true,
          user_id: row.created_by,
          org_id: row.organization_id,
          template_id: row.template_id,
          contact_id: null,
          mode: "live",
        }),
      });
      if (res.ok) {
        fired++;
        await admin.rpc("bump_active_automation", { _id: row.id }).then(
          () => {},
          () => {},
        );
      }
    } catch {
      // One bad row must not stall the rest of the schedule pass.
    }
  }

  return fired;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Two callers:
  //  • the pg_cron job (service-role bearer) drains every org's queue;
  //  • an authenticated org member nudges a drain of only their own org(s),
  //    so activated automations fire in near-real-time without waiting on cron.
  let orgFilter: string[] | null = null;
  if (token !== SERVICE_ROLE_KEY) {
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: members } = await admin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id);
    orgFilter = (members ?? []).map((m) => m.organization_id as string);
    if (orgFilter.length === 0) return json({ processed: 0, fired: 0 });
  }

  // Scheduled automations run on every pass — independent of the event queue,
  // and guarded so a schedule failure never blocks the drain below.
  let scheduledFired = 0;
  try {
    scheduledFired = await processScheduledAutomations(
      admin,
      orgFilter,
      SUPABASE_URL,
      SERVICE_ROLE_KEY,
    );
  } catch {
    /* non-fatal */
  }

  // Claim a batch of pending events.
  let pendingQuery = admin
    .from("automation_events")
    .select("id, organization_id, event_type, contact_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);
  if (orgFilter) pendingQuery = pendingQuery.in("organization_id", orgFilter);
  const { data: pending } = await pendingQuery;

  const events = (pending ?? []) as EventRow[];
  if (events.length === 0) return json({ processed: 0, fired: 0, scheduled_fired: scheduledFired });

  await admin
    .from("automation_events")
    .update({ status: "processing" })
    .in(
      "id",
      events.map((e) => e.id),
    );

  let fired = 0;

  for (const ev of events) {
    try {
      const triggers = TRIGGERS_FOR_EVENT[ev.event_type] ?? [];
      let matched: ActiveRow[] = [];
      if (triggers.length > 0) {
        const { data: active } = await admin
          .from("active_automations")
          .select("id, template_id, trigger_type, created_by")
          .eq("organization_id", ev.organization_id)
          .eq("is_active", true)
          .in("trigger_type", triggers);
        matched = (active ?? []) as ActiveRow[];
      }

      for (const a of matched) {
        if (!a.created_by) continue; // need an owner to run as
        const res = await fetch(`${SUPABASE_URL}/functions/v1/run-workflow`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            internal: true,
            user_id: a.created_by,
            org_id: ev.organization_id,
            template_id: a.template_id,
            contact_id: ev.contact_id,
            mode: "live",
          }),
        });
        if (res.ok) {
          fired++;
          await admin.rpc("bump_active_automation", { _id: a.id }).then(
            () => {},
            () => {},
          );
        }
      }

      // Visual workflow engine: fire every live automation_workflow whose
      // trigger_type matches this event, via workflow-engine's internal path.
      const wfTrigger = WORKFLOW_TRIGGER_FOR_EVENT[ev.event_type];
      if (wfTrigger) {
        const { data: wfRows } = await admin
          .from("automation_workflows")
          .select("id")
          .eq("organization_id", ev.organization_id)
          .eq("trigger_type", wfTrigger)
          .eq("is_active", true);
        for (const wf of wfRows ?? []) {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/workflow-engine`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              internal: true,
              workflow_id: (wf as { id: string }).id,
              contact_id: ev.contact_id,
              mode: "live",
            }),
          });
          if (res.ok) fired++;
        }
      }

      await admin
        .from("automation_events")
        .update({ status: "done", processed_at: new Date().toISOString() })
        .eq("id", ev.id);

      // Best-effort bylda_events ledger write. organization_id is already in
      // scope on ev — no lookup needed. Isolated in its own try/catch (not the
      // looser .then(noop,noop) used elsewhere in this repo): the completion
      // update above sits at the tail of this loop's try block, so an un-isolated
      // throw here would fall through to the catch below and flip an already-"done"
      // event to "error"/attempts. This block guarantees a ledger failure can
      // never touch the status update or the retry logic.
      try {
        await admin.from("bylda_events").insert({
          organization_id: ev.organization_id,
          source: "automation",
          event_type: "automation.completed",
          subject_type: "automation_event",
          subject_id: ev.id,
          payload: { event_type: ev.event_type, contact_id: ev.contact_id ?? null },
        });
      } catch {
        // swallow — the ledger is non-critical; dispatch must be unaffected.
      }
    } catch (e) {
      await admin
        .from("automation_events")
        .update({
          status: "error",
          error: e instanceof Error ? e.message : String(e),
          attempts: 1,
          processed_at: new Date().toISOString(),
        })
        .eq("id", ev.id);
    }
  }

  return json({ processed: events.length, fired, scheduled_fired: scheduledFired });
});
